///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var NetworkManager = pc.createScript('networkManager');

NetworkManager.prototype.initialize = async function () {
    console.log("Connecting to Colyseus...");
    window.colyseus = new Colyseus.Client("ws://localhost:2567");
    this.app.room = await window.colyseus.joinOrCreate("my_room", { username: window.userName });
    this.app.fire("colyseus:roomJoined", this.app.room);
    console.log("Connected to room, sessionId:", this.app.room.sessionId);

    this.playerEntities = {};

    // Listen for new players
    this.app.room.state.players.onAdd((playerState, sessionId) => {
        this.onPlayerAdd(playerState, sessionId);
    });
    this.app.room.state.players.onRemove((playerState, sessionId) => {
        this.onPlayerRemove(playerState, sessionId);
    });

    // Listen for the local "player:move" event to send to server
    this.app.on("player:move", (data) => {
        if (this.app.room) {
            this.app.room.send("updatePosition", data);
        }
    });

    // Spawn your local player
    //this.spawnLocalPlayer();

    // Handle booth adds and changes (e.g., claimedBy, label)
    // booth = Booth schema instance
    this.app.room.state.booths.onAdd((booth, boothId) => {
        //console.log("Booth added:", boothId);

        // Listen for any subfield changes (e.g., claimedBy, label)
        booth.onChange(() => {
            //console.log("Booth changed:", boothId, "Label:", booth.label);
            this.updateBoothDisplay(booth, boothId);
        });

        // initial update when the booth is first added
        this.updateBoothDisplay(booth, boothId);
    });

    this.app.room.onMessage("claimSuccess", (data) => {
        // data.claimBoothId is the booth the player claimed
        if (this.app.localPlayer) {
            this.app.localPlayer.claimBoothId = data.claimBoothId;
            console.log("Player claimed booth:", data.claimBoothId);
        }
    });

    // Listen for booth claimError messages (doesn't exist or already claimed)
    this.app.room.onMessage("claimError", (data) => {
        console.warn(`Error claiming booth '${data.boothId}': ${data.reason}`);
    });
}

// // Spawns the local player
// NetworkManager.prototype.spawnLocalPlayer = function () {
//     // Find the player template asset by name.
//     var playerAsset = this.app.assets.find("PlayerPrefab");
//     if (!playerAsset) {
//         console.error("Player template asset not found");
//         return;
//     }

//     // Instantiate a new player entity from the asset.
//     var localEntity = playerAsset.resource.instantiate();
//     localEntity.enabled = true;
//     localEntity.name = "LocalPlayer";
//     localEntity.address = `address_${this.app.room.sessionId}`;
//     localEntity.claimBoothId = "";

//     // Set the spawn position explicitly (replace with your server-provided coordinates).
//     const player_ = this.app.room.state.players.get(this.app.room.sessionId);
//     console.log(player_);
//     var serverSpawnX = player_.x;
//     var serverSpawnY = player_.y;
//     var serverSpawnZ = player_.z;
//     localEntity.setPosition(serverSpawnX, serverSpawnY, serverSpawnZ);

//     // Add the new entity to the scene.
//     this.app.root.addChild(localEntity);

//     // Enable the camera if it’s part of the player entity.
//     var camera = localEntity.findByName("PlayerCamera");
//     if (camera) {
//         camera.enabled = true;
//     }

//     // Store reference for network sync.
//     this.app.localPlayer = localEntity;
//     this.playerEntities[this.app.room.sessionId] = localEntity;

//     console.log("Local player spawned:", this.app.room.sessionId);
// };

NetworkManager.prototype.onPlayerAdd = function (playerState, sessionId) {
    console.log("New player added:", sessionId, playerState);

    // If it's us, we've already spawned the local entity
    if (sessionId === this.app.room.sessionId) {
        // Find the player template asset by name.
        var playerAsset = this.app.assets.find("PlayerPrefab");
        if (!playerAsset) {
            console.error("Player template asset not found");
            return;
        }

        // Instantiate a new player entity from the asset.
        var localEntity = playerAsset.resource.instantiate();
        localEntity.enabled = true;
        localEntity.name = "LocalPlayer";
        localEntity.address = `address_${this.app.room.sessionId}`;
        localEntity.claimBoothId = "";

        // Set the spawn position explicitly (replace with your server-provided coordinates).
        //const player_ = this.app.room.state.players.get(this.app.room.sessionId);
        var serverSpawnX = playerState.x;
        var serverSpawnY = playerState.y;
        var serverSpawnZ = playerState.z;
        localEntity.setPosition(serverSpawnX, serverSpawnY, serverSpawnZ);

        // Add the new entity to the scene.
        this.app.root.addChild(localEntity);

        // Enable the camera if it’s part of the player entity.
        var camera = localEntity.findByName("PlayerCamera");
        if (camera) {
            camera.enabled = true;
        }

        // Store reference for network sync.
        this.app.localPlayer = localEntity;
        this.playerEntities[this.app.room.sessionId] = localEntity;

        console.log("Local player spawned:", this.app.room.sessionId);
        return;
    }

    // Load the prefab asset from the assets registry.
    var playerAsset = this.app.assets.find("PlayerPrefab");
    if (!playerAsset) {
        console.error("PlayerPrefab asset not found");
        return;
    }

    // Instantiate a new remote player entity from the asset.
    const remoteEntity = playerAsset.resource.instantiate();
    remoteEntity.enabled = true;
    remoteEntity.name = sessionId;

    // Disable local movement logic on remote players.
    let movementScript = remoteEntity.script && remoteEntity.script.playerMovement;
    if (movementScript) {
        movementScript.enabled = false;
    }

    // Disable the camera for remote players.
    var camera = remoteEntity.findByName("PlayerCamera");
    if (camera) camera.enabled = false;

    // Add the remote entity to the scene.
    this.app.root.addChild(remoteEntity);
    this.playerEntities[sessionId] = remoteEntity;

    // Listen for state changes and update remote player's transform.
    playerState.onChange(() => {
        this.updateRemotePlayer(remoteEntity, playerState);
    });
};

// Called when a remote player leaves the room
NetworkManager.prototype.onPlayerRemove = function (playerState, sessionId) {
    console.log("Player left:", sessionId);
    const entity = this.playerEntities[sessionId];
    if (entity) {
        entity.destroy();
        delete this.playerEntities[sessionId];
    }
};

NetworkManager.prototype.updateRemotePlayer = function (entity, playerState) {
    if (entity.name === this.app.room.sessionId) {
        return;
    }

    // Basic example of direct assignment:
    entity.setPosition(playerState.x, playerState.y, playerState.z);
    entity.setEulerAngles(0, playerState.rotation, 0);

    //console.log(playerState.x, playerState.y, playerState.z, playerState.rotation);

    // Or you can do interpolation:
    // var currentPos = entity.getPosition().clone();
    // var targetPos = new pc.Vec3(playerState.x, playerState.y, playerState.z);
    // entity.setPosition(currentPos.lerp(targetPos, 0.2));
    // entity.setEulerAngles(0, playerState.rotation, 0);
};

// Helper method to update the booth UI
NetworkManager.prototype.updateBoothDisplay = function (booth, boothId) {
    // Find the booth entity by name
    let boothEntity = this.app.root.findByName(boothId);
    if (!boothEntity) return;

    // Locate the "AddressText" child
    let addressTextEntity = boothEntity.findByName("AddressText");
    if (addressTextEntity && addressTextEntity.element) {
        // Disable text if claimed, otherwise enable with text "Claim"
        addressTextEntity.enabled = !booth.claimedBy;
        addressTextEntity.element.text = booth.claimedBy ? "" : "Claim";
    }

    // Enable the "ClaimButton" if not claimed, otherwise disable it
    let claimButtonEntity = boothEntity.findByName("ClaimButton");
    if (claimButtonEntity && claimButtonEntity.element) {
        claimButtonEntity.enabled = !booth.claimedBy;
    }

    // Enable the "DonateButton" if claimed, otherwise disable it
    let donateButtonEntity = boothEntity.findByName("DonateButton");
    if (donateButtonEntity && donateButtonEntity.element) {
        // Hide or show donate button depending on claim
        donateButtonEntity.enabled = !!booth.claimedBy;

        // If the booth is claimed, set the text
        let donateTextEntity = donateButtonEntity.findByName("DonateText");
        if (donateTextEntity && donateTextEntity.element) {
            if (booth.claimedBy) {
                donateTextEntity.element.text = `Donate to ${booth.claimedBy}`;
            } else {
                donateTextEntity.element.text = "Donate to X";
            }
        }

        // If the booth is claimed, set up the donation handler's recipient property
        let donationScript = donateButtonEntity.script && donateButtonEntity.script.donationHandler;
        if (donationScript && booth.claimedBy) {
            donationScript.recipient = booth.claimedBy;
        }
    }

    // Update the booth's claimedBy property on its BoothClaimZone script:
    if (boothEntity.script && boothEntity.script.boothClaimZone) {
        boothEntity.script.boothClaimZone.claimedBy = booth.claimedBy;
    }

    // If this booth is claimed and it is currently registered as claimable,
    // then hide the claim UI.
    var uiManagerEntity = this.app.root.findByName('ClaimUiManager');
    if (uiManagerEntity && uiManagerEntity.script && uiManagerEntity.script.claimUiManager) {
        var uiManager = uiManagerEntity.script.claimUiManager;
        if (uiManager.currentBooth && uiManager.currentBooth.boothId === boothId && booth.claimedBy) {
            console.log("Booth " + boothId + " has been claimed. Hiding claim UI.");
            uiManager.unregisterClaimableBooth(uiManager.currentBooth);
        }
    }
};