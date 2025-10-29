var AvatarLoader = pc.createScript('avatarLoader');

AvatarLoader.attributes.add('avatarModelRoot', {
    type: 'entity',
    title: 'Avatar Model Root',
    description: 'Empty child entity under the player where the RPM avatar instance will be parented'
});

AvatarLoader.attributes.add('nameplateRoot', {
    type: 'entity',
    title: 'Nameplate Root',
    description: 'Optional floating nameplate entity used for anchor re-parenting',
    required: false
});

AvatarLoader.attributes.add('rpmSubdomain', {
    type: 'string',
    title: 'RPM Subdomain (e.g. pls-give.readyplayer.me)',
    default: ''
});

AvatarLoader.attributes.add('defaultAvatarId', {
    type: 'string',
    title: 'Default RPM Avatar ID',
    default: ''
});

AvatarLoader.attributes.add('avatarDescriptorJson', {
    type: 'string',
    title: 'Avatar Descriptor (JSON w/ avatarId)',
    default: ''
});

(function () {
    var scope = (typeof window !== 'undefined' && window) ||
                (typeof globalThis !== 'undefined' && globalThis) ||
                {};

    function buildAvatarUrl(subdomain, avatarId) {
        var raw = (subdomain || '').trim();
        if (!raw) {
            throw new Error('AvatarLoader: rpmSubdomain is not configured.');
        }

        var base;
        if (/^https?:\/\//i.test(raw)) {
            base = raw.replace(/\/+$/, '');
        } else {
            base = 'https://' + raw.replace(/\/+$/, '');
        }

        var isGlobalCdn = /models\.readyplayer\.me$/i.test(base);
        if (isGlobalCdn) {
            return base + '/' + avatarId + '.glb';
        }
        return base + '/avatar/' + avatarId + '.glb';
    }

    function stripEmbeddedAnim(entity) {
        if (!entity || typeof entity.findComponents !== 'function') {
            return;
        }
        var animComponents = entity.findComponents('anim');
        for (var i = 0; i < animComponents.length; i++) {
            var compEntity = animComponents[i].entity;
            if (compEntity && compEntity.removeComponent) {
                compEntity.removeComponent('anim');
            }
        }
    }

    AvatarLoader.prototype.initialize = function () {
        this.currentAvatarId = null;
        this.currentAvatarEntity = null;
        this._loadToken = 0;

        var descriptor = null;
        if (this.avatarDescriptorJson) {
            try {
                descriptor = JSON.parse(this.avatarDescriptorJson);
            } catch (err) {
                console.warn('[AvatarLoader] Failed to parse avatarDescriptorJson for', this.entity.name, err);
            }
        }

        var initialId = null;
        if (descriptor && typeof descriptor.avatarId === 'string') {
            initialId = descriptor.avatarId.trim();
        }
        if (!initialId && typeof this.defaultAvatarId === 'string' && this.defaultAvatarId.length > 0) {
            initialId = this.defaultAvatarId.trim();
        }

        if (initialId) {
            this.setAvatarId(initialId);
        } else {
            console.warn('[AvatarLoader] No avatarId/defaultAvatarId set on init for entity', this.entity.name);
        }

        this.app.on('avatar:set', this.onAvatarSetEvent, this);
    };

    AvatarLoader.prototype.updateLodIfNeeded = function () { /* no-op placeholder */ };

    AvatarLoader.prototype.onAvatarSetEvent = function (data) {
        if (!data || data.player !== this.entity) return;
        if (!data.avatarId || typeof data.avatarId !== 'string') return;
        this.setAvatarId(data.avatarId.trim());
    };

    AvatarLoader.prototype.setAvatarId = function (avatarId) {
        if (!avatarId) return;

        var safeId = this.sanitizeAvatarId(avatarId);
        if (!safeId) {
            console.warn('[AvatarLoader] Rejected avatarId', avatarId);
            return;
        }

        if (this.currentAvatarId === safeId && this.currentAvatarEntity) {
            return;
        }

        var self = this;
        var token = ++this._loadToken;
        this.currentAvatarId = safeId;

        this.loadRpmAvatarById(safeId, function (err, entity) {
            if (token !== self._loadToken) {
                if (entity && entity.destroy) {
                    entity.destroy();
                }
                return;
            }
            if (err) {
                console.error('[AvatarLoader] Failed to load RPM avatar', safeId, err);
                self.currentAvatarId = null;
                return;
            }
            self._swapAvatarEntity(entity);
        });
    };

    AvatarLoader.prototype._swapAvatarEntity = function (newAvatarEntity) {
        if (!newAvatarEntity) return;
        if (!this.avatarModelRoot) {
            console.error('[AvatarLoader] avatarModelRoot not assigned in Editor for', this.entity.name);
            return;
        }

        for (var i = this.avatarModelRoot.children.length - 1; i >= 0; i--) {
            var child = this.avatarModelRoot.children[i];
            if (child !== newAvatarEntity) {
                child.destroy();
            }
        }

        if (newAvatarEntity.parent !== this.avatarModelRoot) {
            this.avatarModelRoot.addChild(newAvatarEntity);
            newAvatarEntity.setLocalPosition(0, 0, 0);
            newAvatarEntity.setLocalEulerAngles(0, 0, 0);
            newAvatarEntity.setLocalScale(1, 1, 1);
        }

        stripEmbeddedAnim(newAvatarEntity);
        newAvatarEntity.enabled = true;

        this.currentAvatarEntity = newAvatarEntity;
        this.entity.animTarget = newAvatarEntity;
        this.entity.currentAvatarId = this.currentAvatarId;

        if (typeof this.entity.fire === 'function') {
            this.entity.fire('avatar:model:updated', {
                entity: newAvatarEntity,
                model: newAvatarEntity,
                animTarget: newAvatarEntity,
                avatarId: this.currentAvatarId
            });
        }

        this.app.fire('avatar:loaded', {
            player: this.entity,
            avatar: newAvatarEntity
        });

        this.app.fire('avatar:anchors:update', {
            player: this.entity,
            avatar: newAvatarEntity,
            nameplateRoot: this.nameplateRoot || null
        });
    };

    AvatarLoader.prototype.sanitizeAvatarId = function (avatarId) {
        if (typeof avatarId !== 'string') return null;
        var trimmed = avatarId.trim();
        if (!trimmed) return null;
        if (!/^[A-Za-z0-9\-_]{4,128}$/.test(trimmed)) return null;
        return trimmed;
    };

    AvatarLoader.prototype.loadRpmAvatarById = function (avatarId, done) {
        var safeId = this.sanitizeAvatarId(avatarId);
        if (!safeId) {
            done(new Error('AvatarLoader: Invalid avatarId supplied to loadRpmAvatarById.'));
            return;
        }

        var subdomain = typeof this.rpmSubdomain === 'string' ? this.rpmSubdomain.trim() : '';
        if (!subdomain) {
            done(new Error('AvatarLoader: rpmSubdomain attribute is required.'));
            return;
        }

        var url;
        try {
            url = buildAvatarUrl(subdomain, safeId);
        } catch (err) {
            done(err);
            return;
        }

        var self = this;
        this.app.assets.loadFromUrlAndFilename(url, safeId + '.glb', 'container', function (err, asset) {
            if (err || !asset || !asset.resource) {
                done(err || new Error('AvatarLoader: Failed to load RPM avatar asset.'));
                return;
            }

            var entity;
            try {
                entity = asset.resource.instantiateRenderEntity();
            } catch (instErr) {
                done(instErr || new Error('AvatarLoader: Failed to instantiate RPM avatar entity.'));
                return;
            }

            entity.name = 'RPMAvatar_' + safeId;
            done(null, entity);
        });
    };

    AvatarLoader.prototype.destroy = function () {
        this.app.off('avatar:set', this.onAvatarSetEvent, this);
    };

    scope.PlayerCustomization = scope.PlayerCustomization || {};
    scope.PlayerCustomization.AvatarLoader = AvatarLoader;
    scope.PlayerCustomization.AvatarLoaderScript = AvatarLoader;
})();
