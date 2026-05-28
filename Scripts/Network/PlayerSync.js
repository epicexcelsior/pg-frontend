// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\PlayerSync.js
var PlayerSync = pc.createScript('playerSync');

PlayerSync.attributes.add('playerPrefab', {
    type: 'asset',
    assetType: 'template',
    title: 'Player Prefab'
});
PlayerSync.attributes.add('positionLerpFactor', { type: 'number', default: 0.15 });
PlayerSync.attributes.add('rotationSlerpFactor', { type: 'number', default: 0.15 });
PlayerSync.attributes.add('remoteRotationOffset', { type: 'number', default: 0 });
PlayerSync.attributes.add('jumpSmoothingFactor', { type: 'number', default: 0.25, title: 'Jump Smoothing (higher = smoother jumps)' });

function findAnimEntity(entity) {
    if (!entity) return null;
    if (entity.anim) return entity;
    for (var i = 0; i < entity.children.length; i++) {
        var child = findAnimEntity(entity.children[i]);
        if (child) return child;
    }
    return null;
}

function findVisualRoot(entity) {
    if (!entity) return null;
    return (
        entity.findByName('Armature') ||
        entity.findByName('Wolf3D_Avatar') ||
        entity
    );
}

function resolveSpeedScale(entity) {
    if (!entity || !entity.script || !entity.script.playerMovement) {
        return 1;
    }
    var movement = entity.script.playerMovement;
    var maxSpeed = typeof movement.maxSpeed === 'number' ? movement.maxSpeed : 1;
    return maxSpeed > 0 ? maxSpeed : 1;
}

function convertNormalizedSpeed(entity, value) {
    var normalized = Number(value);
    if (!Number.isFinite(normalized)) {
        return 0;
    }
    return normalized * resolveSpeedScale(entity);
}

function frameBlend(base, dt) {
    if (base <= 0) return 0;
    if (base >= 1) return 1;
    var scaled = 1 - Math.pow(1 - base, dt * 60);
    return pc.math.clamp(scaled, 0, 1);
}

function unwrapAngle(prev, next) {
    if (typeof prev !== 'number') return next;
    var diff = next - prev;
    while (diff > 180) {
        next -= 360;
        diff -= 360;
    }
    while (diff < -180) {
        next += 360;
        diff += 360;
    }
    return next;
}

function applyRemoteYaw(entity, yaw) {
    if (!entity || !entity.remoteVisualRoot) return;

    var baseRot = entity.remoteBaseLocalRot ? entity.remoteBaseLocalRot.clone() : new pc.Quat();
    var yawQuat = new pc.Quat().setFromEulerAngles(0, yaw, 0);
    baseRot.mul(yawQuat);
    entity.remoteVisualRoot.setLocalRotation(baseRot);
}

// Force-use the rigged PlayerPrefab template (220534551) instead of whatever
// the scene's `playerPrefab` script attribute points at — but ONLY when the
// Quaternius anim clips PlayerPrefab depends on are actually in the build's
// asset registry. Today they aren't (preload=false on those clips), so we
// stay on PlayerAvatarV2 to preserve nameplate/cameraShaker; the moment an
// admin flips preload=true on the clips, the next build will auto-include
// them and this swap will activate.
var PLAYER_PREFAB_FORCE_ID = 220534551;
// Probe: any one Quaternius clip the rigged anim component requires.
var QUATERNIUS_CLIP_PROBE_ID = 255648385; // CharacterArmature|Idle.glb

PlayerSync.prototype.initialize = function () {
    this.playerEntities = {};
    this.room = null;
    this.localSessionId = null;
    this._loggedMissingNameplate = false;
    this._tempLerpPos = new pc.Vec3();
    this._tempQuat = new pc.Quat();
    this._playerPrefabReady = null;

    // Expose PlayerSync to the app so MessageBroker can access it
    this.app.playerSync = this;

    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);

    var hasClips = !!this.app.assets.get(QUATERNIUS_CLIP_PROBE_ID);
    if (!hasClips) {
        console.warn('PlayerSync: Quaternius clips not in build registry. ' +
            'Staying on scene-assigned playerPrefab (no anim). ' +
            'To enable: flip preload=true on assets 255648385/394/395/393/398 + 228285420.');
        return;
    }

    var forcedPrefab = this.app.assets.get(PLAYER_PREFAB_FORCE_ID);
    if (forcedPrefab) {
        this.playerPrefab = forcedPrefab;
        var self = this;
        this._playerPrefabReady = new Promise(function (resolve) {
            if (forcedPrefab.resource) { resolve(forcedPrefab); return; }
            forcedPrefab.once('load', function () { resolve(forcedPrefab); });
            forcedPrefab.once('error', function (err) {
                console.error('PlayerSync: failed to load forced PlayerPrefab', err);
                resolve(null);
            });
            self.app.assets.load(forcedPrefab);
        });
    }
};

PlayerSync.prototype.getPlayerEntityById = function (sessionId) {
    return this.playerEntities[sessionId] || null;
};

PlayerSync.prototype.onConnected = async function (room) {
    if (!room) {
        console.error('PlayerSync: Room object is null or undefined.');
        return;
    }
    if (this._playerPrefabReady) {
        // Forced PlayerPrefab may still be loading on first connect.
        await this._playerPrefabReady;
    }
    if (!this.playerPrefab) {
        console.error('PlayerSync: Player Prefab asset is not assigned in the editor.');
        return;
    }
    if (!this.playerPrefab.resource) {
        console.error('PlayerSync: Player Prefab resource has not been loaded.');
        return;
    }
    this.room = room;
    this.localSessionId = room.sessionId;

    const handlePlayerAdded = (playerState, sessionId) => {
        this.ensurePlayerBindings(playerState, sessionId);
        if (!this.playerEntities[sessionId]) {
            this.spawnPlayer(playerState, sessionId);
        }
    };

    this.room.state.players.onAdd(handlePlayerAdded);

    this.room.state.players.onRemove((playerState, sessionId) => {
        this.removePlayer(sessionId);
    });

    this.room.state.players.forEach((playerState, sessionId) => {
        handlePlayerAdded(playerState, sessionId);
    });
};

// Asset ids for the runtime anim swap (state graph + clips).
// 228285420 (the graph PlayerPrefab references) isn't in the build registry;
// 255649199 is. State graph 255649199 has 7 states: Idle, Forward, Wave,
// Jump, DanceA, DanceB, Cheer. Quaternius doesn't ship matching Jump/Dance/
// Cheer clips so emotes fall back to the closest visible animation.
var ANIM_FALLBACK_STATEGRAPH = 255649199;
var ANIM_STATE_CLIPS = {
    'Idle':    255648385, // CharacterArmature|Idle.glb
    'Forward': 255648394, // CharacterArmature|Run.glb
    'Wave':    255648401, // CharacterArmature|Wave.glb (exact match)
    'Jump':    255648396, // CharacterArmature|Roll.glb (no jump clip; roll is closest)
    'DanceA':  255648397, // CharacterArmature|Sword_Slash.glb
    'DanceB':  255648391, // CharacterArmature|Punch_Left.glb
    'Cheer':   255648392  // CharacterArmature|Kick_Right.glb
};

PlayerSync.prototype._configureAnim = function (animEntity) {
    if (!animEntity) return;
    var app = this.app;

    var sg = app.assets.get(ANIM_FALLBACK_STATEGRAPH);
    if (!sg) {
        console.warn('PlayerSync._configureAnim: state graph missing', ANIM_FALLBACK_STATEGRAPH);
        return;
    }
    // Resolve clip assets; tolerate any missing (state stays unassigned).
    var clipAssets = {};
    for (var stateName in ANIM_STATE_CLIPS) {
        clipAssets[stateName] = app.assets.get(ANIM_STATE_CLIPS[stateName]);
    }
    if (!clipAssets.Idle || !clipAssets.Forward) {
        console.warn('PlayerSync._configureAnim: required Idle/Forward clips missing');
        return;
    }

    // The static anim component on the PlayerPrefab template is bound to
    // stateGraphAsset 228285420 which isn't in the build's asset registry —
    // remove + re-add fresh, mirroring the (unused) PlayerAnimation script's
    // pattern. Also forces bone re-resolution against the current rootBone.
    var rootBone = animEntity.anim && animEntity.anim.rootBone;
    if (typeof rootBone === 'string') {
        rootBone = animEntity.findByGuid && animEntity.findByGuid(rootBone);
    }
    if (!rootBone) {
        rootBone = animEntity.findByName && animEntity.findByName('Armature');
    }
    if (!rootBone) rootBone = animEntity;

    if (animEntity.anim) {
        animEntity.removeComponent('anim');
    }

    function ensureLoaded(asset) {
        return new Promise(function (resolve) {
            if (!asset) { resolve(null); return; }
            if (asset.resource) { resolve(asset); return; }
            asset.once('load', function () { resolve(asset); });
            asset.once('error', function () { resolve(asset); });
            app.assets.load(asset);
        });
    }

    var loads = [ensureLoaded(sg)];
    var stateNames = Object.keys(clipAssets);
    stateNames.forEach(function (n) { loads.push(ensureLoaded(clipAssets[n])); });

    Promise.all(loads).then(function () {
        try {
            animEntity.addComponent('anim', {
                activate: true,
                playing: true,
                speed: 1,
                rootBone: rootBone
            });
            var anim = animEntity.anim;
            if (!anim) {
                console.error('PlayerSync._configureAnim: addComponent returned no component');
                return;
            }
            anim.loadStateGraph(sg.resource);
            // Assign each state's clip. Unassigned states (asset missing) just
            // no-op when their trigger fires — graceful degradation.
            stateNames.forEach(function (n) {
                var a = clipAssets[n];
                if (a && a.resource) {
                    anim.assignAnimation(n, a.resource, 'Base');
                }
            });
            if (typeof anim.setFloat === 'function') anim.setFloat('speed', 0);
            anim.playing = true;
        } catch (err) {
            console.error('PlayerSync._configureAnim: anim setup failed', err);
        }
    });
};

PlayerSync.prototype.onDisconnected = function () {
    for (const sessionId in this.playerEntities) {
        this.removePlayer(sessionId);
    }
    this.playerEntities = {};
    if (this.app.localPlayer) this.app.localPlayer = null;
    this.room = null;
    this.localSessionId = null;
};

PlayerSync.prototype.spawnPlayer = function (playerState, sessionId) {
    if (this.playerEntities[sessionId]) {
        return;
    }

    const isLocalPlayer = sessionId === this.localSessionId;
    const playerEntity = this.playerPrefab.resource.instantiate();
    playerEntity.name = isLocalPlayer ? 'LocalPlayer' : sessionId;

    const animTarget = findAnimEntity(playerEntity);
    playerEntity.animTarget = animTarget || null;
    if (animTarget) {
        // PlayerPrefab's static anim references state graph 228285420 which
        // isn't in the build registry. _configureAnim removes that broken
        // anim and adds a fresh one with state graph 255649199 + Quaternius
        // Idle/Run clips (all preloaded/registered).
        this._configureAnim(animTarget);
    }

    const visualRoot = findVisualRoot(playerEntity);
    playerEntity.remoteVisualRoot = visualRoot || null;
    playerEntity.remoteBaseLocalRot = visualRoot ? visualRoot.getLocalRotation().clone() : null;

    const camera = playerEntity.findByName('PlayerCamera');
    if (camera) camera.enabled = isLocalPlayer;

    const movementScript = playerEntity.script?.playerMovement;
    if (movementScript) movementScript.enabled = isLocalPlayer;

    if (isLocalPlayer) {
        this.app.localPlayer = playerEntity;
        if (!playerEntity.script?.playerData) {
            console.warn('PlayerSync: PlayerData script not found on LocalPlayer prefab.');
        }
    } else {
        if (playerEntity.script?.playerData) playerEntity.script.playerData.enabled = false;
    }

    playerEntity.enabled = true;

    if (!isLocalPlayer) {
        const rawYaw = typeof playerState.rotation === 'number' ? playerState.rotation : 0;
        const yawWithOffset = rawYaw + this.remoteRotationOffset;
        playerEntity.syncTargetPos = new pc.Vec3(playerState.x, playerState.y, playerState.z);
        playerEntity.syncTargetYaw = yawWithOffset;
        playerEntity.syncTargetYawRaw = rawYaw;
        playerEntity.syncCurrentYaw = yawWithOffset;
        playerEntity.syncTargetSpeed = convertNormalizedSpeed(playerEntity, playerState.speed || 0);
    }

    const initialYaw = (typeof playerState.rotation === 'number' ? playerState.rotation : 0) + this.remoteRotationOffset;
    const initialRot = new pc.Quat().setFromEulerAngles(0, initialYaw, 0);
    const initialPos = new pc.Vec3(playerState.x, playerState.y, playerState.z);
    if (playerEntity.rigidbody) {
        playerEntity.rigidbody.teleport(initialPos, initialRot);
    } else {
        playerEntity.setPosition(initialPos);
    }
    playerEntity.setRotation(initialRot);
    if (!isLocalPlayer) applyRemoteYaw(playerEntity, playerEntity.syncCurrentYaw);

    playerEntity.sessionId = sessionId;
    playerEntity.isLocalPlayer = isLocalPlayer;
    this.app.root.addChild(playerEntity);
    this.playerEntities[sessionId] = playerEntity;
    this._syncAvatarRecipe(playerEntity, playerState, sessionId);
    this._setupNameplate(playerEntity, isLocalPlayer, playerState.username);
    this.updateNameplate(playerEntity, playerState.username);
    this.app.fire('player:spawned', { entity: playerEntity, isLocal: isLocalPlayer, sessionId: sessionId, state: playerState });
};

PlayerSync.prototype.removePlayer = function (sessionId) {
    const entity = this.playerEntities[sessionId];
    if (entity) {
        entity.destroy();
        delete this.playerEntities[sessionId];
        if (this.app.localPlayer === entity) this.app.localPlayer = null;
        this.app.fire('player:removed', { sessionId: sessionId, entity: entity });
    }
};

PlayerSync.prototype.handlePlayerChange = function (playerState, sessionId) {
    const entity = this.playerEntities[sessionId];
    if (!entity) return;

    if (sessionId === this.localSessionId) {
        const playerData = entity.script?.playerData;
        if (playerData && playerState.hasOwnProperty('username') && playerData.username !== playerState.username) {
            this.app.fire('player:data:update', { username: playerState.username });
        }
        this.updateNameplate(entity, playerState.username);
    } else {
        this.updateRemotePlayerVisuals(entity, playerState);
        this._syncAvatarRecipe(entity, playerState, sessionId);
        if (playerState.username && entity.username !== playerState.username) {
            entity.username = playerState.username;
            this.updateNameplate(entity, playerState.username);
        }
    }
};

PlayerSync.prototype.updateRemotePlayerVisuals = function (entity, playerState) {
    if (entity.syncTargetPos) {
        entity.syncTargetPos.set(playerState.x, playerState.y, playerState.z);
    }
    if (typeof playerState.rotation === 'number') {
        const rawYaw = playerState.rotation + this.remoteRotationOffset;
        entity.syncTargetYaw = unwrapAngle(entity.syncCurrentYaw, rawYaw);
        entity.syncTargetYawRaw = playerState.rotation;
    }
        if (typeof playerState.speed === 'number') {
        entity.syncTargetSpeed = convertNormalizedSpeed(entity, playerState.speed);
    }
    // Capture vertical velocity for smooth jump interpolation
    if (typeof playerState.verticalVelocity === 'number') {
        entity.syncVerticalVelocity = playerState.verticalVelocity;
    }
};


PlayerSync.prototype._syncAvatarRecipe = function (entity, playerState, sessionId) {
    if (!playerState || sessionId === this.localSessionId) return;
    const raw = typeof playerState.avatarRecipe === "string" ? playerState.avatarRecipe : "";
    const updatedAt = typeof playerState.avatarRecipeUpdatedAt === "number" ? playerState.avatarRecipeUpdatedAt : 0;
    const hasContent = raw && raw.length > 0;
    if (!hasContent) {
        entity.avatarRecipeString = "";
        entity.avatarRecipeUpdatedAt = updatedAt;
        return;
    }
    if (entity.avatarRecipeString === raw && entity.avatarRecipeUpdatedAt === updatedAt) {
        return;
    }
    entity.avatarRecipeString = raw;
    entity.avatarRecipeUpdatedAt = updatedAt;
    try {
        const parsed = JSON.parse(raw);
        this.app.fire("avatar:recipe", { playerId: sessionId, recipe: parsed, source: "state" });
    } catch (err) {
        console.warn("PlayerSync: failed to parse avatar recipe for", sessionId, err);
    }
};

PlayerSync.prototype.update = function (dt) {
    // Pump local-player anim `speed` directly from PlayerMovement.currentSpeed.
    // The PlayerAnimation script normally does this, but it isn't attached to
    // PlayerPrefab — so without this, the local avatar's `speed` parameter
    // stays at 0 and the Idle→Forward transition (`speed > 0.1`) never fires.
    if (this.localSessionId) {
        const localEntity = this.playerEntities[this.localSessionId];
        if (localEntity) {
            const movement = localEntity.script && localEntity.script.playerMovement;
            const anim = localEntity.animTarget && localEntity.animTarget.anim;
            if (movement && anim && typeof anim.setFloat === 'function') {
                const v = Number(movement.currentSpeed);
                anim.setFloat('speed', Number.isFinite(v) ? v : 0);
            }
        }
    }

    for (const sessionId in this.playerEntities) {
        if (sessionId === this.localSessionId) continue;

        const entity = this.playerEntities[sessionId];
        if (!entity || !entity.syncTargetPos || typeof entity.syncTargetYaw !== 'number') continue;

        if (typeof entity.syncCurrentYaw !== 'number') {
            entity.syncCurrentYaw = entity.syncTargetYaw;
        }

        const rotBlend = frameBlend(this.rotationSlerpFactor, dt);
        entity.syncCurrentYaw = pc.math.lerp(entity.syncCurrentYaw, entity.syncTargetYaw, rotBlend);
        
        const currentPos = entity.getPosition();
        const targetPos = entity.syncTargetPos;
        
        // Detect if player is jumping based on vertical velocity (smoother jump interpolation)
        const verticalVel = typeof entity.syncVerticalVelocity === 'number' ? entity.syncVerticalVelocity : 0;
        const isJumping = verticalVel > 0.5;
        const jumpFactor = isJumping ? this.jumpSmoothingFactor : this.positionLerpFactor;
        const posBlend = frameBlend(jumpFactor, dt);
        
        this._tempLerpPos.lerp(currentPos, targetPos, posBlend);

        // Build quaternion from yaw for proper entity rotation
        var entityRotQuat = new pc.Quat().setFromEulerAngles(0, entity.syncCurrentYaw, 0);
        
        if (entity.rigidbody) {
            entity.rigidbody.teleport(this._tempLerpPos, entityRotQuat);
        } else {
            entity.setPosition(this._tempLerpPos);
            entity.setRotation(entityRotQuat);
        }

        applyRemoteYaw(entity, entity.syncCurrentYaw);

        if (typeof entity.syncTargetSpeed === 'number') {
            // Get anim from PlayerAnimation script if available (handles avatar recipe changes)
            const playerAnimScript = entity.script?.playerAnimation;
            const anim = playerAnimScript?.avatarAnim || (entity.animTarget?.anim);
            
            if (anim) {
                anim.setFloat('speed', entity.syncTargetSpeed);
            }
        }
    }
};

PlayerSync.prototype.updateNameplate = function (playerEntity, username) {
    if (!playerEntity) {
        return;
    }
    let nameplate = playerEntity.nameplateText;
    if (!nameplate || !nameplate.element) {
        nameplate = playerEntity.findByName('NameplateText');
        if (nameplate && nameplate.element) {
            playerEntity.nameplateText = nameplate;
        } else {
            if (!this._loggedMissingNameplate) {
                console.warn('PlayerSync: NameplateText entity with an element component was not found on the player prefab.');
                this._loggedMissingNameplate = true;
            }
            return;
        }
    }
    nameplate.element.text = username || '';
    var s = (username || '').toString().trim();
    if (s.length > 16) s = s.slice(0, 16);
    nameplate.element.text = s;
};

PlayerSync.prototype.ensurePlayerBindings = function (playerState, sessionId) {
    if (!playerState) return;
    if (!playerState.__playerSyncChangeHandler) {
        const changeHandler = () => this.handlePlayerChange(playerState, sessionId);
        playerState.__playerSyncChangeHandler = changeHandler;
        playerState.onChange(changeHandler);
    }
};

PlayerSync.prototype._setupNameplate = function (playerEntity, isLocalPlayer, username) {
    if (!playerEntity) {
        return;
    }
    let root = playerEntity.nameplateRoot;
    if (!root) {
        root = playerEntity.findByName('NameplateRoot') || null;
        if (root) {
            playerEntity.nameplateRoot = root;
        }
    }
    this._setNameplateVisibility(playerEntity, !isLocalPlayer);
    if (username) {
        this.updateNameplate(playerEntity, username);
    }
};

PlayerSync.prototype._setNameplateVisibility = function (playerEntity, shouldShow) {
    if (!playerEntity) {
        return;
    }
    let root = playerEntity.nameplateRoot;
    if (!root) {
        root = playerEntity.findByName('NameplateRoot') || null;
        if (root) {
            playerEntity.nameplateRoot = root;
        }
    }
    if (root) {
        root.enabled = shouldShow;
    }
};
