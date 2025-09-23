// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\PlayerSync.js
var PlayerSync = pc.createScript('playerSync');

PlayerSync.attributes.add('playerPrefab', {
    type: 'asset',
    assetType: 'template',
    title: 'Player Prefab'
});

PlayerSync.prototype.initialize = function() {
    this.playerEntities = {};
    this.room = null;
    this.localSessionId = null;
    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
};

PlayerSync.prototype.onConnected = function(room) {
    if (!room || !this.playerPrefab || !this.playerPrefab.resource) {
        console.error("PlayerSync: Cannot initialize. Room or Player Prefab not ready.");
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

PlayerSync.prototype.onDisconnected = function(data) {
    for (const sessionId in this.playerEntities) {
        this.removePlayer(sessionId);
    }
    this.playerEntities = {};
    if (this.app.localPlayer) this.app.localPlayer = null;
    this.room = null;
    this.localSessionId = null;
};

PlayerSync.prototype.spawnPlayer = function(playerState, sessionId) {
    if (this.playerEntities[sessionId]) return;
    
    const isLocalPlayer = (sessionId === this.localSessionId);
    const playerEntity = this.playerPrefab.resource.instantiate();
    playerEntity.name = isLocalPlayer ? "LocalPlayer" : sessionId;

    const camera = playerEntity.findByName("PlayerCamera");
    if (camera) camera.enabled = isLocalPlayer;
    
    const movementScript = playerEntity.script?.playerMovement;
    if (movementScript) movementScript.enabled = isLocalPlayer;

    if (isLocalPlayer) {
        this.app.localPlayer = playerEntity;
        if (!playerEntity.script?.playerData) {
            console.warn("PlayerSync: PlayerData script not found on LocalPlayer prefab.");
        }
    } else {
        if (playerEntity.script?.playerData) playerEntity.script.playerData.enabled = false;
    }

    playerEntity.enabled = true;
    playerEntity.setPosition(playerState.x, playerState.y, playerState.z);
    playerEntity.setEulerAngles(0, playerState.rotation, 0);
    this.app.root.addChild(playerEntity);
    this.playerEntities[sessionId] = playerEntity;
    this.updateNameplate(playerEntity, playerState.username);
    this.app.fire('player:spawned', { entity: playerEntity, isLocal: isLocalPlayer });
};

PlayerSync.prototype.removePlayer = function(sessionId) {
    const entity = this.playerEntities[sessionId];
    if (entity) {
        entity.destroy();
        delete this.playerEntities[sessionId];
        if (this.app.localPlayer === entity) this.app.localPlayer = null;
        this.app.fire('player:removed', { sessionId: sessionId });
    }
};

PlayerSync.prototype.handlePlayerChange = function(playerState, sessionId) {
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

PlayerSync.prototype.updateRemotePlayerVisuals = function(entity, playerState) {
    const targetPos = new pc.Vec3(playerState.x, playerState.y, playerState.z);
    entity.setPosition(entity.getPosition().lerp(targetPos, 0.3));

    const targetRot = new pc.Quat().setFromEulerAngles(0, playerState.rotation, 0);
    entity.setRotation(entity.getRotation().slerp(targetRot, 0.3));

    if (entity.anim) {
        if (playerState.hasOwnProperty('xDirection')) entity.anim.setFloat('xDirection', playerState.xDirection);
        if (playerState.hasOwnProperty('zDirection')) entity.anim.setFloat('zDirection', playerState.zDirection);
    }
};

PlayerSync.prototype.updateNameplate = function(playerEntity, username) {
    const nameplate = playerEntity.findByName("NameplateText");
    if (nameplate?.element) {
        nameplate.element.text = username || "";
    }
};