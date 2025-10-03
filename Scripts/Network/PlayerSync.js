// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\PlayerSync.js
var PlayerSync = pc.createScript('playerSync');

PlayerSync.attributes.add('playerPrefab', {
    type: 'asset',
    assetType: 'template',
    title: 'Player Prefab'
});
PlayerSync.attributes.add('positionLerpFactor', { type: 'number', default: 0.1 });
PlayerSync.attributes.add('rotationSlerpFactor', { type: 'number', default: 0.15 });
PlayerSync.attributes.add('remoteRotationOffset', { type: 'number', default: 0 });

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

PlayerSync.prototype.initialize = function () {
    this.playerEntities = {};
    this.room = null;
    this.localSessionId = null;
    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
};

PlayerSync.prototype.onConnected = function (room) {
    if (!room) {
        console.error('PlayerSync: Room object is null or undefined.');
        return;
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

    this.room.state.players.onAdd((playerState, sessionId) => {
        this.spawnPlayer(playerState, sessionId);
        playerState.onChange(() => this.handlePlayerChange(playerState, sessionId));
    });

    this.room.state.players.onRemove((playerState, sessionId) => {
        this.removePlayer(sessionId);
    });

    this.room.state.players.forEach((playerState, sessionId) => {
        this.spawnPlayer(playerState, sessionId);
        playerState.onChange(() => this.handlePlayerChange(playerState, sessionId));
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
        console.warn(`PlayerSync: Player entity for session ID ${sessionId} already exists. Aborting spawn.`);
        return;
    }

    const isLocalPlayer = sessionId === this.localSessionId;
    const playerEntity = this.playerPrefab.resource.instantiate();
    playerEntity.name = isLocalPlayer ? 'LocalPlayer' : sessionId;

    const animTarget = findAnimEntity(playerEntity);
    playerEntity.animTarget = animTarget || null;
    if (animTarget && animTarget.anim) {
        animTarget.anim.playing = true;
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
        playerEntity.syncTargetSpeed = playerState.speed || 0;
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

    this.app.root.addChild(playerEntity);
    this.playerEntities[sessionId] = playerEntity;
    this.updateNameplate(playerEntity, playerState.username);
    this.app.fire('player:spawned', { entity: playerEntity, isLocal: isLocalPlayer });
};

PlayerSync.prototype.removePlayer = function (sessionId) {
    const entity = this.playerEntities[sessionId];
    if (entity) {
        entity.destroy();
        delete this.playerEntities[sessionId];
        if (this.app.localPlayer === entity) this.app.localPlayer = null;
        this.app.fire('player:removed', { sessionId: sessionId });
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
    } else {
        this.updateRemotePlayerVisuals(entity, playerState);
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
        entity.syncTargetSpeed = playerState.speed;
    }
};

PlayerSync.prototype.update = function (dt) {
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
        const posBlend = frameBlend(this.positionLerpFactor, dt);
        const lerpedPos = new pc.Vec3().lerp(currentPos, targetPos, posBlend);

        if (entity.rigidbody) {
            // Teleport the physics body for position, but do not rotate it here.
            // The visual rotation is handled separately by applyRemoteYaw.
            entity.rigidbody.teleport(lerpedPos, pc.Quat.IDENTITY);
        } else {
            entity.setPosition(lerpedPos);
        }

        // Apply the visual rotation to the model. This is the single source of truth for rotation.
        applyRemoteYaw(entity, entity.syncCurrentYaw);

        if (typeof entity.syncTargetSpeed === 'number') {
            const animTarget = entity.animTarget;
            if (animTarget && animTarget.anim) {
                animTarget.anim.setFloat('speed', entity.syncTargetSpeed);
            }
        }
    }
};

PlayerSync.prototype.updateNameplate = function (playerEntity, username) {
    const nameplate = playerEntity.findByName('NameplateText');
    if (nameplate?.element) {
        nameplate.element.text = username || '';
    }
};
