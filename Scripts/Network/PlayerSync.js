var PlayerSync = pc.createScript('playerSync');

PlayerSync.attributes.add('playerPrefab', {
    type: 'asset',
    assetType: 'template',
    title: 'Player Prefab',
    description: 'The prefab asset used to instantiate player entities.'
});

// initialize code called once per entity
PlayerSync.prototype.initialize = function() {
    console.log("PlayerSync: Initializing...");
    this.playerEntities = {}; // Map sessionId to player entity
    this.room = null;
    this.localSessionId = null;

    if (!this.playerPrefab) {
        console.error("PlayerSync: Player Prefab asset is not assigned!");
    }

    // Listen for connection events
    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
};

PlayerSync.prototype.onConnected = function(room) {
    console.log("PlayerSync: Received colyseus:connected event.");
    if (!room || !this.playerPrefab || !this.playerPrefab.resource) {
        console.error("PlayerSync: Cannot initialize listeners. Room or Player Prefab not ready.");
        if (!this.playerPrefab || !this.playerPrefab.resource) {
             console.error("PlayerSync: Player Prefab asset not loaded or assigned.");
        }
        return;
    }
    this.room = room;
    this.localSessionId = room.sessionId;

    // --- Setup Player State Listeners ---
    console.log("PlayerSync: Setting up player state listeners...");

    // Listen for new players joining
    this.room.state.players.onAdd((playerState, sessionId) => {
        console.log(`PlayerSync: Player added: ${sessionId}`);
        this.spawnPlayer(playerState, sessionId);

        // Listen for changes on this specific player
        playerState.onChange(() => {
            this.handlePlayerChange(playerState, sessionId);
        });
    });

    // Listen for players leaving
    this.room.state.players.onRemove((playerState, sessionId) => {
        console.log(`PlayerSync: Player removed: ${sessionId}`);
        this.removePlayer(sessionId);
    });

    // --- Initial Population ---
    // Process players already in the room when we join
    console.log("PlayerSync: Processing existing players...");
    this.room.state.players.forEach((playerState, sessionId) => {
        console.log(`PlayerSync: Processing existing player: ${sessionId}`);
        this.spawnPlayer(playerState, sessionId);

        // Attach onChange listener for existing players too
         playerState.onChange(() => {
            this.handlePlayerChange(playerState, sessionId);
        });
    });

    console.log("PlayerSync: Player listeners initialized.");
};

PlayerSync.prototype.onDisconnected = function(data) {
    console.log("PlayerSync: Received colyseus:disconnected event.", data);
    this.room = null;
    this.localSessionId = null;
    // Clean up all player entities
    for (const sessionId in this.playerEntities) {
        if (this.playerEntities[sessionId]) {
            this.removePlayer(sessionId); // Use removePlayer to handle cleanup and event firing
        }
    }
    // Ensure map is clear
    this.playerEntities = {};
    // Clear global reference if it exists (though PlayerData should replace this)
    if (this.app.localPlayer) {
        this.app.localPlayer = null;
    }
};


PlayerSync.prototype.spawnPlayer = function (playerState, sessionId) {
    if (this.playerEntities[sessionId]) {
        console.warn(`PlayerSync: Player entity for ${sessionId} already exists. Ignoring spawn request.`);
        return; // Avoid spawning duplicates
    }
     if (!this.playerPrefab || !this.playerPrefab.resource) {
        console.error("PlayerSync: Cannot spawn player, Player Prefab asset not loaded or assigned.");
        return;
    }

    const isLocalPlayer = (sessionId === this.localSessionId);
    let playerEntity;

    console.log(`PlayerSync: Spawning ${isLocalPlayer ? 'local' : 'remote'} player: ${sessionId}`);
    playerEntity = this.playerPrefab.resource.instantiate();

    // --- Configure Entity based on Local/Remote ---
    if (isLocalPlayer) {
        playerEntity.name = "LocalPlayer"; // Specific name
        this.app.localPlayer = playerEntity; // Assign global reference (temporary, use PlayerData later)

        // Enable camera and movement script
        const camera = playerEntity.findByName("PlayerCamera"); // Ensure name is correct
        if (camera) camera.enabled = true;
        const movementScript = playerEntity.script?.playerMovement; // Ensure script name is correct
        if (movementScript) movementScript.enabled = true;

        // Add PlayerData script if it exists in the prefab
        if (playerEntity.script?.playerData) {
             console.log("PlayerSync: PlayerData script found on LocalPlayer prefab.");
             // PlayerData script will likely listen for auth events itself
        } else {
            console.warn("PlayerSync: PlayerData script not found on LocalPlayer prefab. Consider adding it.");
        }

    } else {
        playerEntity.name = sessionId; // Use sessionId for remote players

        // Disable camera and movement script
        const camera = playerEntity.findByName("PlayerCamera");
        if (camera) camera.enabled = false;
        const movementScript = playerEntity.script?.playerMovement;
        if (movementScript) movementScript.enabled = false;

        // Remove PlayerData script if it exists (remote players don't need it)
        if (playerEntity.script?.playerData) {
            // playerEntity.destroyComponent('script', playerEntity.script.playerData); // Or disable?
            playerEntity.script.playerData.enabled = false;
        }
    }

    playerEntity.enabled = true;

    // --- Common Setup ---
    // Store initial state directly on entity (PlayerData should manage this ideally)
    playerEntity.username = playerState.username || (isLocalPlayer ? (window.userName || `Guest_${sessionId.substring(0,4)}`) : `Guest_${sessionId.substring(0,4)}`);
    playerEntity.walletAddress = playerState.walletAddress || "";
    playerEntity.claimBoothId = playerState.claimBoothId || "";

    // Set initial transform
    playerEntity.setPosition(playerState.x, playerState.y, playerState.z);
    playerEntity.setEulerAngles(0, playerState.rotation, 0); // Assuming Y-axis rotation

    // Add to scene and store reference
    this.app.root.addChild(playerEntity);
    this.playerEntities[sessionId] = playerEntity;

    // Update nameplate immediately
    this.updateNameplate(playerEntity, playerEntity.username);

    console.log(`PlayerSync: ${playerEntity.name} spawned at ${playerState.x.toFixed(2)}, ${playerState.z.toFixed(2)}`);

    // Fire event for other systems
    this.app.fire('player:spawned', { entity: playerEntity, sessionId: sessionId, isLocal: isLocalPlayer, initialState: playerState });
};

PlayerSync.prototype.removePlayer = function (sessionId) {
    const entity = this.playerEntities[sessionId];
    if (entity) {
        console.log(`PlayerSync: Destroying player entity ${sessionId}`);
        entity.destroy();
        delete this.playerEntities[sessionId];

        // Clear global reference if it was the local player
        if (this.app.localPlayer === entity) {
            this.app.localPlayer = null;
        }

        // Fire event
        this.app.fire('player:removed', { sessionId: sessionId });
    } else {
         console.warn(`PlayerSync: Tried to remove player ${sessionId}, but no entity found.`);
    }
};

PlayerSync.prototype.handlePlayerChange = function (playerState, sessionId) {
    const entity = this.playerEntities[sessionId];
    if (!entity) {
        // console.warn(`PlayerSync: Received state change for unknown player ${sessionId}`);
        return; // Entity might already be removed or not yet added
    }

    const isLocalPlayer = (sessionId === this.localSessionId);

    // --- Update Local Player Data (if applicable) ---
    // This should ideally be handled by PlayerData listening to events or directly to state
    if (isLocalPlayer) {
        // Example: Update PlayerData script if it exists
        const playerData = entity.script?.playerData;
        if (playerData) {
            // Construct an update object with only the changed fields
            const updatePayload = {};
            let hasChanges = false;

            if (playerState.hasOwnProperty('username') && playerData.username !== playerState.username) {
                updatePayload.username = playerState.username;
                hasChanges = true;
                console.log(`PlayerSync: Detected server change for local username: ${playerState.username}`);
            }
            if (playerState.hasOwnProperty('walletAddress') && playerData.walletAddress !== playerState.walletAddress) {
                updatePayload.walletAddress = playerState.walletAddress;
                hasChanges = true;
                 console.log(`PlayerSync: Detected server change for local walletAddress: ${playerState.walletAddress}`);
            }
             if (playerState.hasOwnProperty('claimedBoothId') && playerData.claimedBoothId !== playerState.claimedBoothId) {
                updatePayload.claimedBoothId = playerState.claimedBoothId;
                hasChanges = true;
                 console.log(`PlayerSync: Detected server change for local claimedBoothId: ${playerState.claimedBoothId}`);
            }
            // Add other synchronized player fields here...

            // If any relevant data changed, fire the event that PlayerData listens for
            if (hasChanges) {
                 console.log("PlayerSync: Firing player:data:update with payload:", updatePayload);
                 this.app.fire('player:data:update', updatePayload);
            }
        }

        // Update nameplate for local player too
        if (playerState.username && entity.username !== playerState.username) {
             console.log(`PlayerSync: Server updated local username to: ${playerState.username}`);
             entity.username = playerState.username; // Update temp entity property
             this.updateNameplate(entity, playerState.username);
        }
        // Local player position is controlled locally, so we don't update it here from server state.

    }
    // --- Update Remote Player ---
    else {
        // Update remote player's position, rotation, animation, etc.
        this.updateRemotePlayerVisuals(entity, playerState);

         // Update nameplate if username changed
        if (playerState.username && entity.username !== playerState.username) {
            console.log(`PlayerSync: Updating remote player ${sessionId}'s username to: ${playerState.username}`);
            entity.username = playerState.username; // Update temp entity property
            this.updateNameplate(entity, playerState.username);
        }

         // Fire event for other systems interested in remote player updates
         this.app.fire('player:updated', { entity: entity, sessionId: sessionId, state: playerState });
    }
};


PlayerSync.prototype.updateRemotePlayerVisuals = function (entity, playerState) {
    // Basic interpolation (consider more advanced techniques if needed)
    const interpolationFactor = 0.3; // Adjust for smoother or more responsive movement
    const currentPos = entity.getPosition();
    const targetPos = new pc.Vec3(playerState.x, playerState.y, playerState.z);

    // Lerp position
    const interpolatedPosition = new pc.Vec3().lerp(currentPos, targetPos, interpolationFactor);
    entity.setPosition(interpolatedPosition);

    // Slerp rotation (assuming Y-axis rotation)
    const currentRot = entity.getRotation();
    const targetRot = new pc.Quat().setFromEulerAngles(0, playerState.rotation, 0);
    const interpolatedRotation = new pc.Quat().slerp(currentRot, targetRot, interpolationFactor);
    entity.setRotation(interpolatedRotation);

    // Animation Sync
    if (entity.anim) { // Check for animation component
        // Ensure parameter names match your animation graph
        if (playerState.hasOwnProperty('xDirection')) entity.anim.setFloat('xDirection', playerState.xDirection);
        if (playerState.hasOwnProperty('zDirection')) entity.anim.setFloat('zDirection', playerState.zDirection);
        // Add other animation parameters if needed (e.g., isMoving)
    }
};

PlayerSync.prototype.updateNameplate = function(playerEntity, username) {
    if (!playerEntity) return;
    const nameplate = playerEntity.findByName("NameplateText"); // Ensure name is correct
    if (nameplate?.element) {
        nameplate.element.text = username || ""; // Set to empty string if username is null/undefined
    }
};

// swap method called for script hot-reloading
// PlayerSync.prototype.swap = function(old) { };