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

    var FALLBACK_SLOTS = ["head", "body", "legs", "feet"];
    var FALLBACK_DEFAULTS = {
        version: 1,
        gender: "unisex",
        head: "Casual_Head",
        body: "Casual_Body",
        legs: "Casual_Legs",
        feet: "Casual_Feet"
    };

    function isAvatarDescriptor(value) {
        return value && typeof value === 'object' && typeof value.avatarId === 'string';
    }

    AvatarCustomization.prototype.initialize = function () {
        var namespace = getNamespace();
        if (typeof namespace.ensureAvatarAnchors !== 'function' ||
            typeof namespace.AvatarLoader !== 'function' ||
            typeof namespace.AvatarController !== 'function') {
            console.error('AvatarCustomization: Required PlayerCustomization helpers are missing.');
            return;
        }

        this.ns = namespace;
        this.defaults = namespace.DEFAULTS || FALLBACK_DEFAULTS;
        this.slots = namespace.AVATAR_SLOTS || FALLBACK_SLOTS;
        this.persistence = namespace.AvatarPersistence || null;

        this.catalog = null;
        var self = this;
        this.catalogPromise = this._prepareCatalog();
        this.uiBridge = null;
        this._resolveUiReady = null;
        this.uiPromise = new Promise(function (resolve) { self._resolveUiReady = resolve; });
        this.controllers = new Map();
        this.remoteLoaders = new Map();
        this.pendingRecipes = new Map();
        this.localSessionId = null;
        this.localController = null;
        this._destroyed = false;
        this._lodInterval = 360;
        this._lastLodUpdate = 0;
        this._updateLodBound = this._updateLod.bind(this);

        this.app.on('avatar:uiReady', this.onUiReady, this);
        this.app.on('player:spawned', this.onPlayerSpawned, this);
        this.app.on('player:removed', this.onPlayerRemoved, this);
        this.app.on('avatar:apply', this.onLocalApply, this);
        this.app.on('avatar:rpm:exported', this.onRpmAvatarExported, this);
        this.app.on('colyseus:disconnected', this.onDisconnected, this);
        this.app.on('postUpdate', this._updateLodBound, this);

        if (typeof namespace.AvatarNetSync === 'function') {
            this.netSync = new namespace.AvatarNetSync(this.app, {
                sendRecipe: function (recipe) {
                    self.app.fire('player:avatar:recipe', recipe);
                },
                applyRecipeToPlayer: function (playerId, recipe) {
                    return self.applyRecipeForRemote(playerId, recipe);
                },
                isLocalPlayerId: function (playerId) {
                    return playerId === self.localSessionId;
                }
            });
        }
    };

    AvatarCustomization.prototype._prepareCatalog = function () {
        var self = this;
        return new Promise(function (resolve) {
            if (!self.catalogAsset) {
                self.catalog = { defaults: self.defaults, slots: {} };
                resolve(self.catalog);
                return;
            }
            function ready() {
                self.catalog = self.catalogAsset.resource || self.catalog || { defaults: self.defaults, slots: {} };
                resolve(self.catalog);
            }
            if (self.catalogAsset.resource) {
                ready();
            } else {
                self.catalogAsset.once('load', ready);
                self.catalogAsset.once('error', function (err) {
                    console.error('AvatarCustomization: Failed to load catalog asset.', err);
                    resolve({ defaults: self.defaults, slots: {} });
                });
                self.app.assets.load(self.catalogAsset);
            }
        });
    };

    AvatarCustomization.prototype.onUiReady = function (bridge) {
        if (this._destroyed) return;
        this.uiBridge = bridge;
        if (this._resolveUiReady) {
            this._resolveUiReady(bridge);
            this._resolveUiReady = null;
        }
    };

    AvatarCustomization.prototype._waitForUi = function () {
        if (this.uiBridge) {
            return Promise.resolve(this.uiBridge);
        }
        return this.uiPromise;
    };

    AvatarCustomization.prototype._parseRecipeString = function (raw) {
        if (!raw || typeof raw !== 'string') return null;
        try {
            return JSON.parse(raw);
        } catch (err) {
            console.warn('AvatarCustomization: failed to parse avatar recipe', err);
            return null;
        }
    };

    AvatarCustomization.prototype.onPlayerSpawned = function (evt) {
        if (this._destroyed) return;
        var sessionId = evt.sessionId || (evt.entity && evt.entity.sessionId) || (evt.entity && evt.entity.name);
        if (!sessionId) {
            console.warn('AvatarCustomization: Spawned player missing sessionId.');
            return;
        }
        var entity = evt.entity;
        var serverRecipe = null;
        if (evt.state && typeof evt.state.avatarRecipe === 'string' && evt.state.avatarRecipe) {
            serverRecipe = this._parseRecipeString(evt.state.avatarRecipe);
            if (!serverRecipe) {
                console.warn('AvatarCustomization: Failed to parse avatar recipe from state for', sessionId);
            }
        }

        if (evt.isLocal) {
            this.localSessionId = sessionId;
            this._setupLocalPlayer(sessionId, entity, serverRecipe);
        } else {
            if (serverRecipe) {
                this.pendingRecipes.set(sessionId, serverRecipe);
            }
            this._setupRemotePlayer(sessionId, entity);
        }
    };

    AvatarCustomization.prototype._setupLocalPlayer = function (sessionId, entity, serverRecipe) {
        var self = this;
        var namespace = this.ns;
        Promise.all([this.catalogPromise, this._waitForUi()]).then(function (values) {
            if (self._destroyed) return;
            var catalog = values[0];
            var bridge = values[1];
            var ControllerCtor = namespace.AvatarController;
            if (typeof ControllerCtor !== 'function') {
                console.error('AvatarCustomization: AvatarController not available for local player.');
                return;
            }
            var controller = new ControllerCtor(self.app, entity, catalog, bridge, {
                anchorOptions: {},
                onApply: function (recipe) {
                    self._persistRecipe(sessionId, recipe);
                },
                onAvatarApplied: function (descriptor) {
                    self._persistRecipe(sessionId, descriptor);
                }
            });
            self.controllers.set(sessionId, controller);
            self.localController = controller;

            var saved = self.persistence ? self.persistence.load(sessionId) : null;
            var initial = serverRecipe || saved || catalog.defaults || self.defaults;

            var initializePromise;
            if (isAvatarDescriptor(initial)) {
                if (!initial.version) initial.version = 1;
                if (initial.rpm === undefined) initial.rpm = true;
                initializePromise = controller.applyAvatarDescriptor(initial, {
                    castShadows: true,
                    quiet: true,
                    initialTier: 'near'
                });
            } else {
                initializePromise = controller.init(initial).then(function () {
                    self._persistRecipe(sessionId, controller.getRecipe());
                });
            }

            initializePromise.then(function () {
                var movement = entity.script && entity.script.playerMovement;
                if (movement && typeof movement.modelForwardOffsetY === "number") {
                    var offset = movement.modelForwardOffsetY % 360;
                    if (offset < 0) offset += 360;
                    if (Math.abs(offset) < 1 || Math.abs(offset - 360) < 1) {
                        movement.modelForwardOffsetY = 180;
                    }
                }
                if (controller.loader && typeof controller.loader.updateLodIfNeeded === 'function') {
                    controller.loader.updateLodIfNeeded(0, { force: true, isLocal: true });
                }
                if (self.autoOpenOnSpawn && bridge && typeof bridge.open === 'function') {
                    bridge.open();
                }
            }).catch(function (err) {
                console.error('AvatarCustomization: Failed to initialize local avatar.', err);
            });
        }).catch(function (err) {
            console.error('AvatarCustomization: Failed to prepare local player.', err);
        });
    };

    AvatarCustomization.prototype._setupRemotePlayer = function (sessionId, entity) {
        var self = this;
        var namespace = this.ns;
        this.catalogPromise.then(function (catalog) {
            if (self._destroyed) return;
            var anchors = namespace.ensureAvatarAnchors(entity, {});
            var loader = new namespace.AvatarLoader(self.app, entity, anchors, catalog, {});
            self.remoteLoaders.set(sessionId, loader);
            var recipe = self.pendingRecipes.get(sessionId) || (catalog.defaults || self.defaults);
            self.pendingRecipes.delete(sessionId);
            var applyPromise;
            if (isAvatarDescriptor(recipe)) {
                if (!recipe.version) recipe.version = 1;
                if (recipe.rpm === undefined) recipe.rpm = true;
                applyPromise = loader.applyAvatar(recipe, {
                    castShadows: false,
                    receiveShadows: true,
                    quiet: true,
                    initialTier: 'mid'
                });
            } else {
                applyPromise = loader.applyRecipe(recipe);
            }
            applyPromise.catch(function (err) {
                console.error('AvatarCustomization: Failed to equip avatar for remote player', sessionId, err);
            });
        });
    };

    AvatarCustomization.prototype.onPlayerRemoved = function (evt) {
        var sessionId = evt.sessionId;
        if (!sessionId) return;
        var controller = this.controllers.get(sessionId);
        if (controller) {
            controller.destroy();
            this.controllers.delete(sessionId);
        }
        var loader = this.remoteLoaders.get(sessionId);
        if (loader) {
            loader.destroy();
            this.remoteLoaders.delete(sessionId);
        }
        this.pendingRecipes.delete(sessionId);
        if (sessionId === this.localSessionId) {
            this.localSessionId = null;
            this.localController = null;
        }
    };

    AvatarCustomization.prototype.applyRecipeForRemote = function (sessionId, recipe) {
        if (!sessionId || !recipe) return Promise.resolve();
        if (sessionId === this.localSessionId) return Promise.resolve();
        this.pendingRecipes.set(sessionId, recipe);
        var loader = this.remoteLoaders.get(sessionId);
        if (!loader) {
            return Promise.resolve();
        }
        if (isAvatarDescriptor(recipe) && typeof loader.applyAvatar === 'function') {
            if (!recipe.version) recipe.version = 1;
            if (recipe.rpm === undefined) recipe.rpm = true;
            return loader.applyAvatar(recipe, {
                castShadows: false,
                receiveShadows: true,
                quiet: true,
                initialTier: 'mid'
            }).catch(function (err) {
                console.error('AvatarCustomization: Failed to apply remote RPM avatar.', err);
            });
        }
        if (typeof loader.applyRecipe === 'function') {
            return loader.applyRecipe(recipe).catch(function (err) {
                console.error('AvatarCustomization: Failed to apply remote recipe.', err);
            });
        }
        return Promise.resolve();
    };

    AvatarCustomization.prototype.onLocalApply = function (recipe) {
        if (!recipe || !this.localSessionId) return;
        this._persistRecipe(this.localSessionId, recipe);
    };

    AvatarCustomization.prototype.onRpmAvatarExported = function (payload) {
        if (!payload || !payload.avatarId) {
            console.warn('AvatarCustomization: RPM export payload missing avatarId.', payload);
            return;
        }
        if (!this.localSessionId || !this.localController) {
            console.warn('AvatarCustomization: Local controller not ready. Deferring RPM avatar apply.');
            this.pendingRecipes.set(this.localSessionId || 'local', payload);
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
        var self = this;
        this.localController.applyAvatarDescriptor(descriptor, {
            castShadows: true,
            quiet: false,
            initialTier: 'near'
        }).then(function () {
            self._persistRecipe(self.localSessionId, descriptor);
            self.app.fire('avatar:apply', descriptor);
        }).catch(function (err) {
            console.error('AvatarCustomization: Failed to apply RPM avatar for local player.', err);
        });
    };

    AvatarCustomization.prototype._persistRecipe = function (sessionId, recipe) {
        if (!this.persistence || !sessionId || !recipe) return;
        this.persistence.save(sessionId, recipe);
    };

    AvatarCustomization.prototype.onDisconnected = function () {
        this.localSessionId = null;
        this.localController = null;
        this.controllers.forEach(function (controller) { controller.destroy(); });
        this.controllers.clear();
        this.remoteLoaders.forEach(function (loader) { loader.destroy(); });
        this.remoteLoaders.clear();
        this.pendingRecipes.clear();
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
        this.remoteLoaders.forEach(function (loader) {
            if (!loader || typeof loader.updateLodIfNeeded !== 'function') {
                return;
            }
            var entity = loader.player;
            if (!entity || !entity.getPosition) {
                return;
            }
            var pos = entity.getPosition();
            var distance = cameraPos.distance(pos);
            loader.updateLodIfNeeded(distance, { isLocal: false });
        });
    };

    AvatarCustomization.prototype._cleanupListeners = function () {
        this.app.off('avatar:uiReady', this.onUiReady, this);
        this.app.off('player:spawned', this.onPlayerSpawned, this);
        this.app.off('player:removed', this.onPlayerRemoved, this);
        this.app.off('avatar:apply', this.onLocalApply, this);
        this.app.off('avatar:rpm:exported', this.onRpmAvatarExported, this);
        this.app.off('colyseus:disconnected', this.onDisconnected, this);
        this.app.off('postUpdate', this._updateLodBound, this);
    };

    AvatarCustomization.prototype.swap = function (old) {
        this.catalog = old.catalog;
        this.catalogPromise = old.catalogPromise;
        this.uiBridge = old.uiBridge;
        this.uiPromise = old.uiPromise;
        this.controllers = old.controllers;
        this.remoteLoaders = old.remoteLoaders;
        this.pendingRecipes = old.pendingRecipes;
        this.localSessionId = old.localSessionId;
        this.localController = old.localController;
        this.persistence = old.persistence;
        this.ns = old.ns;
        this.defaults = old.defaults;
        this.slots = old.slots;
        this.netSync = old.netSync;
        this._lodInterval = old._lodInterval;
        this._lastLodUpdate = old._lastLodUpdate;
        this._updateLodBound = old._updateLodBound || this._updateLodBound;
        if (this.app && this._updateLodBound) {
            this.app.on('postUpdate', this._updateLodBound, this);
        }
    };

    AvatarCustomization.prototype.destroy = function () {
        this._destroyed = true;
        this._cleanupListeners();
        if (this.netSync && this.netSync.destroy) {
            this.netSync.destroy();
        }
        this.controllers.forEach(function (controller) { controller.destroy(); });
        this.controllers.clear();
        this.remoteLoaders.forEach(function (loader) { loader.destroy(); });
        this.remoteLoaders.clear();
        this.pendingRecipes.clear();
    };
})();

