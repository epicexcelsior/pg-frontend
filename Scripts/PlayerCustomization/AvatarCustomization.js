var AvatarCustomization = pc.createScript('avatarCustomization');

AvatarCustomization.attributes.add('catalogAsset', {
    type: 'asset',
    assetType: 'json',
    title: 'Avatar Catalog JSON'
});

AvatarCustomization.attributes.add('autoOpenOnSpawn', {
    type: 'boolean',
    default: false,
    title: 'Auto Open UI on Local Spawn'
});

(function () {
    var scope = (typeof window !== 'undefined' && window) ||
                (typeof globalThis !== 'undefined' && globalThis) ||
                {};

    function getNamespace() {
        scope.PlayerCustomization = scope.PlayerCustomization || {};
        return scope.PlayerCustomization;
    }

    function isDescriptor(value) {
        return value && typeof value === 'object' && typeof value.avatarId === 'string';
    }

    AvatarCustomization.prototype.initialize = function () {
        this.ns = getNamespace();
        this.persistence = this.ns.AvatarPersistence || null;
        this.loaders = new Map();
        this.pendingDescriptors = new Map();
        this.localSessionId = null;
        this._destroyed = false;
        this.feedbackService = null;

        this._lodInterval = 360;
        this._lastLodUpdate = 0;
        this._updateLodBound = this._updateLod.bind(this);

        this.app.on('player:spawned', this.onPlayerSpawned, this);
        this.app.on('player:removed', this.onPlayerRemoved, this);
        this.app.on('avatar:rpm:exported', this.onRpmAvatarExported, this);
        this.app.on('avatar:apply', this.onLocalApply, this);
        this.app.on('colyseus:disconnected', this.onDisconnected, this);
        this.app.on('postUpdate', this._updateLodBound, this);

        if (typeof this.ns.AvatarNetSync === 'function') {
            var self = this;
            this.netSync = new this.ns.AvatarNetSync(this.app, {
                sendDescriptor: function (descriptor) {
                    self.app.fire('player:avatar:recipe', descriptor);
                },
                applyDescriptorToPlayer: function (playerId, descriptor) {
                    return self.applyDescriptorForRemote(playerId, descriptor);
                },
                isLocalPlayerId: function (playerId) {
                    return playerId === self.localSessionId;
                }
            });
        } else {
            this.netSync = null;
        }
    };

    AvatarCustomization.prototype.onPlayerSpawned = function (evt) {
        if (this._destroyed) return;
        var entity = evt && evt.entity;
        if (!entity) {
            console.warn('AvatarCustomization: Spawn event missing entity.', evt);
            return;
        }

        var sessionId = evt.sessionId || entity.sessionId || entity.name;
        if (!sessionId) {
            console.warn('AvatarCustomization: Spawned player missing sessionId.');
            return;
        }

        var loader = entity.script && entity.script.avatarLoader;
        if (!loader) {
            console.warn('AvatarCustomization: avatarLoader script missing on player entity', entity.name);
            return;
        }

        this.loaders.set(sessionId, loader);

        var isLocal = !!evt.isLocal;
        if (isLocal) {
            this.localSessionId = sessionId;
        }

        var descriptor = this._descriptorFromState(evt && evt.state);
        if (!descriptor && this.pendingDescriptors.has(sessionId)) {
            descriptor = this.pendingDescriptors.get(sessionId);
            this.pendingDescriptors.delete(sessionId);
        }
        if (!descriptor && isLocal && this.persistence) {
            descriptor = this.persistence.load(sessionId);
        }

        if (isDescriptor(descriptor)) {
            loader.setAvatarId(descriptor.avatarId);
            if (isLocal) {
                this._persistDescriptor(sessionId, descriptor);
            }
        } else if (isLocal && typeof loader.defaultAvatarId === 'string' && loader.defaultAvatarId.length) {
            // loader.initialize already handles defaultAvatarId. No extra work required.
        }
    };

    AvatarCustomization.prototype.onPlayerRemoved = function (evt) {
        var sessionId = evt && evt.sessionId;
        if (!sessionId) return;
        this.loaders.delete(sessionId);
        this.pendingDescriptors.delete(sessionId);
        if (sessionId === this.localSessionId) {
            this.localSessionId = null;
        }
    };

    AvatarCustomization.prototype.onRpmAvatarExported = function (payload) {
        if (this._destroyed) return;
        if (!payload || !payload.avatarId) {
            console.warn('AvatarCustomization: RPM export payload missing avatarId.', payload);
            return;
        }
        if (!this.localSessionId) {
            console.warn('AvatarCustomization: Local loader not ready; deferring export.');
            return;
        }

        var descriptor = {
            avatarId: payload.avatarId,
            url: payload.url || null,
            userId: payload.userId || null,
            updatedAt: Date.now(),
            version: 1,
            rpm: true
        };

        var loader = this.loaders.get(this.localSessionId);
        if (!loader) {
            console.warn('AvatarCustomization: Local avatarLoader script not cached; deferring.');
            this.pendingDescriptors.set(this.localSessionId, descriptor);
            return;
        }

        this._showApplyingToast();
        loader.setAvatarId(descriptor.avatarId);
        this._persistDescriptor(this.localSessionId, descriptor);
        this.app.fire('avatar:apply', descriptor);
        this._showSuccessToast();
    };

    AvatarCustomization.prototype.onLocalApply = function (descriptor) {
        if (!descriptor || !isDescriptor(descriptor)) {
            return;
        }
        if (!this.localSessionId) {
            return;
        }
        this._persistDescriptor(this.localSessionId, descriptor);
    };

    AvatarCustomization.prototype.applyDescriptorForRemote = function (sessionId, descriptor) {
        if (!descriptor || !isDescriptor(descriptor)) {
            return Promise.resolve();
        }
        var loader = this.loaders.get(sessionId);
        if (!loader) {
            this.pendingDescriptors.set(sessionId, descriptor);
            return Promise.resolve();
        }
        loader.setAvatarId(descriptor.avatarId);
        return Promise.resolve();
    };

    AvatarCustomization.prototype.onDisconnected = function () {
        this.localSessionId = null;
        this.loaders.clear();
        this.pendingDescriptors.clear();
    };

    AvatarCustomization.prototype._descriptorFromState = function (state) {
        if (!state || typeof state.avatarRecipe !== 'string' || !state.avatarRecipe.length) {
            return null;
        }
        try {
            var parsed = JSON.parse(state.avatarRecipe);
            return isDescriptor(parsed) ? parsed : null;
        } catch (err) {
            console.warn('AvatarCustomization: Failed to parse avatar descriptor from state.', err);
            return null;
        }
    };

    AvatarCustomization.prototype._persistDescriptor = function (sessionId, descriptor) {
        if (!this.persistence || !sessionId || !isDescriptor(descriptor)) return;
        this.persistence.save(sessionId, descriptor);
    };

    AvatarCustomization.prototype._updateLod = function () {
        if (this._destroyed) {
            return;
        }
        var now = Date.now();
        if (now - this._lastLodUpdate < this._lodInterval) {
            return;
        }
        this._lastLodUpdate = now;

        var camera = this.app && this.app.scene ? this.app.scene.activeCamera : null;
        var cameraEntity = camera && camera.entity ? camera.entity : null;
        if (!cameraEntity || !cameraEntity.getPosition) {
            return;
        }
        var cameraPos = cameraEntity.getPosition();
        this.loaders.forEach(function (loader, sessionId) {
            if (!loader || typeof loader.entity === 'undefined') {
                return;
            }
            if (sessionId === this.localSessionId) {
                return;
            }
            var playerEntity = loader.entity;
            if (!playerEntity || !playerEntity.getPosition) {
                return;
            }
            var distance = cameraPos.distance(playerEntity.getPosition());
            if (typeof loader.updateLodIfNeeded === 'function') {
                loader.updateLodIfNeeded(distance, { isLocal: false });
            }
        }, this);
    };

    AvatarCustomization.prototype._getFeedbackService = function () {
        if (this.feedbackService) {
            return this.feedbackService;
        }
        if (this.app.services && typeof this.app.services.get === 'function') {
            try {
                this.feedbackService = this.app.services.get('feedbackService');
                return this.feedbackService;
            } catch (err) {
                // Service not found
            }
        }
        if (typeof window !== 'undefined' && window.feedbackService) {
            this.feedbackService = window.feedbackService;
            return this.feedbackService;
        }
        return null;
    };

    AvatarCustomization.prototype._showApplyingToast = function () {
        var feedbackService = this._getFeedbackService();
        if (feedbackService && typeof feedbackService.showInfo === 'function') {
            feedbackService.showInfo('Applying avatar', 3000);
        }
    };

    AvatarCustomization.prototype._showSuccessToast = function () {
        var feedbackService = this._getFeedbackService();
        if (feedbackService && typeof feedbackService.showSuccess === 'function') {
            feedbackService.showSuccess('Avatar applied successfully!', 5000);
        }
    };

    AvatarCustomization.prototype._cleanupListeners = function () {
        this.app.off('player:spawned', this.onPlayerSpawned, this);
        this.app.off('player:removed', this.onPlayerRemoved, this);
        this.app.off('avatar:rpm:exported', this.onRpmAvatarExported, this);
        this.app.off('avatar:apply', this.onLocalApply, this);
        this.app.off('colyseus:disconnected', this.onDisconnected, this);
        this.app.off('postUpdate', this._updateLodBound, this);
    };

    AvatarCustomization.prototype.destroy = function () {
        this._destroyed = true;
        this._cleanupListeners();
        if (this.netSync && typeof this.netSync.destroy === 'function') {
            this.netSync.destroy();
        }
        this.loaders.clear();
        this.pendingDescriptors.clear();
    };
})();
