// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\PlayerSync.js
var PlayerSync = pc.createScript('playerSync');

PlayerSync.attributes.add('playerPrefab', {
    type: 'asset',
    assetType: 'template',
    title: 'Player Prefab'
});

PlayerSync.prototype.initialize = function() {
    console.log("PlayerSync: Initializing script.");
    this.playerEntities = {};
    this.room = null;
    this.localSessionId = null;
    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
    console.log("PlayerSync: Event listeners for 'colyseus:connected' and 'colyseus:disconnected' registered.");
};

PlayerSync.prototype.onConnected = function(room) {
    console.log("PlayerSync: 'colyseus:connected' event received.");
    if (!room) {
        console.error("PlayerSync: Room object is null or undefined.");
        return;
    }
    if (!this.playerPrefab) {
        console.error("PlayerSync: Player Prefab asset is not assigned in the editor.");
        return;
    }
    if (!this.playerPrefab.resource) {
        console.error("PlayerSync: Player Prefab resource has not been loaded.");
        return;
    }
    this.room = room;
    this.localSessionId = room.sessionId;

    this.room.state.players.onAdd((playerState, sessionId) => {
        console.log(`PlayerSync: onAdd event for session ID: ${sessionId}`, playerState);
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
    console.log(`PlayerSync: Spawning player for session ID: ${sessionId}`);
    if (this.playerEntities[sessionId]) {
        console.warn(`PlayerSync: Player entity for session ID ${sessionId} already exists. Aborting spawn.`);
        return;
    }
    
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
    
    // Use appropriate positioning method based on player type
    if (isLocalPlayer) {
        // For local player, use setPosition
        playerEntity.setPosition(playerState.x, playerState.y, playerState.z);
        console.log(`PlayerSync: Local player spawned at: (${playerState.x}, ${playerState.y}, ${playerState.z})`);
    } else {
        // For remote players, use rigidbody.teleport() if available to avoid physics conflicts
        const rigidbody = playerEntity.rigidbody;
        if (rigidbody) {
            rigidbody.teleport(playerState.x, playerState.y, playerState.z);
            console.log(`PlayerSync: Remote player ${sessionId} spawned using rigidbody.teleport() at: (${playerState.x}, ${playerState.y}, ${playerState.z})`);
        } else {
            playerEntity.setPosition(playerState.x, playerState.y, playerState.z);
            console.log(`PlayerSync: Remote player ${sessionId} spawned using setPosition() at: (${playerState.x}, ${playerState.y}, ${playerState.z})`);
        }
    }
    
    playerEntity.setEulerAngles(0, playerState.rotation, 0);
    console.log(`PlayerSync: Spawning player at position: (${playerState.x}, ${playerState.y}, ${playerState.z})`);
    this.app.root.addChild(playerEntity);
    this.playerEntities[sessionId] = playerEntity;
    this.updateNameplate(playerEntity, playerState.username);
    this.app.fire('player:spawned', { entity: playerEntity, isLocal: isLocalPlayer });
    
    // Additional debug logging for entity state
    console.log(`PlayerSync: Player ${sessionId} entity enabled: ${playerEntity.enabled}, visible: ${playerEntity.enabled && playerEntity.model?.enabled}`);
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
    // Check if entity is enabled and visible before update
    const wasEnabled = entity.enabled;
    const wasVisible = entity.model ? entity.model.enabled : true;
    
    // Validate coordinates to prevent invalid positions
    const x = isNaN(playerState.x) ? 0 : playerState.x;
    const y = isNaN(playerState.y) ? 0 : playerState.y;
    const z = isNaN(playerState.z) ? 0 : playerState.z;
    
    // Check for suspicious coordinates that might cause issues
    if (Math.abs(x) > 1000 || Math.abs(y) > 1000 || Math.abs(z) > 1000) {
        console.warn(`PlayerSync: Suspicious coordinates for ${entity.name}: (${x}, ${y}, ${z})`);
    }
    
    // Check if player is entering spawn area (near zero coordinates)
    const isNearSpawn = Math.abs(x) < 5 && Math.abs(z) < 5;
    if (isNearSpawn) {
        console.log(`PlayerSync: Player ${entity.name} is near spawn area: (${x}, ${y}, ${z})`);
    }
    
    const targetPos = new pc.Vec3(x, y, z);
    
    // Use rigidbody teleport if available for better physics sync, otherwise use setPosition
    if (entity.rigidbody) {
        entity.rigidbody.teleport(targetPos);
        console.log(`PlayerSync: Teleported ${entity.name} to (${x}, ${y}, ${z}) via rigidbody`);
    } else {
        entity.setPosition(targetPos);
        console.log(`PlayerSync: Moved ${entity.name} to (${x}, ${y}, ${z}) via setPosition`);
    }
    
    // Improved rotation synchronization - use direct setting instead of slerp for better sync
    if (playerState.hasOwnProperty('rotation')) {
        const targetRot = new pc.Quat().setFromEulerAngles(0, playerState.rotation, 0);
        entity.setRotation(targetRot);
    }
    
    // Update animation parameters
    if (entity.anim) {
        if (playerState.hasOwnProperty('xDirection')) entity.anim.setFloat('xDirection', playerState.xDirection);
        if (playerState.hasOwnProperty('zDirection')) entity.anim.setFloat('zDirection', playerState.zDirection);
    }
    
    // Log final position after update
    const finalPos = entity.getPosition();
    console.log(`PlayerSync: Final position for ${entity.name}: (${finalPos.x}, ${finalPos.y}, ${finalPos.z})`);
    
    // Check entity state after update
    const isEnabledAfter = entity.enabled;
    const isVisibleAfter = entity.model ? entity.model.enabled : true;
    if (wasEnabled !== isEnabledAfter || wasVisible !== isVisibleAfter) {
        console.error(`PlayerSync: Entity ${entity.name} state changed! Enabled: ${wasEnabled} -> ${isEnabledAfter}, Visible: ${wasVisible} -> ${isVisibleAfter}`);
    }
    
    // Force entity to be enabled and visible if it got disabled somehow
    if (!entity.enabled) {
        entity.enabled = true;
        console.warn(`PlayerSync: Re-enabled entity ${entity.name}`);
    }
    
    // Warn if player is not visible after update
    if (!isVisibleAfter) {
        console.error(`PlayerSync: WARNING - Player ${entity.name} is not visible after update!`);
    }
};

PlayerSync.prototype.updateNameplate = function(playerEntity, username) {
    const nameplate = playerEntity.findByName("NameplateText");
    if (nameplate?.element) {
        nameplate.element.text = username || "";
    }
};