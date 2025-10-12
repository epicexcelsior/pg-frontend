///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" 
var NetworkManager = pc.createScript('networkManager');

NetworkManager.prototype.initialize = function () {
    console.log("NetworkManager: Initializing (will wait for connection)...");
    // this.playerEntities = {}; // Moved to PlayerSync.js
    this.room = null; // Store room reference when connected

    // Listen for the connection event from ConnectionManager
    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this); // Listen for disconnects too

    // Setup app listeners that DON'T depend on the room immediately
    this.setupAppListeners();

    if (this.app.room) {
        this.onConnected(this.app.room);
    }
};

// Called when ConnectionManager successfully connects
NetworkManager.prototype.onConnected = function(room) {
    console.log("NetworkManager: Received colyseus:connected event.");
    if (!room) {
        console.error("NetworkManager: Connected event received but room object is missing!");
        return;
    }
    if (this.room === room) {
        return;
    }
    this.room = room; // Store the room reference

    // Now setup listeners that depend on the room
    this.setupRoomListeners();
    // Note: App listeners that SEND messages might need checks like `if (this.room)`
};

// Called when ConnectionManager disconnects
NetworkManager.prototype.onDisconnected = function(data) {
    console.log("NetworkManager: Received colyseus:disconnected event.", data);
    this.room = null; // Clear room reference
    // Player entity cleanup is now handled by PlayerSync.js
    // if (this.app.localPlayer) {
    //    this.app.localPlayer = null; // PlayerSync handles this too
    // }
    // Remove room-specific listeners if necessary (though app.once might handle this)
    // e.g., this.app.off('player:move', ...); // If not using .once or if re-connection is possible
};

// Removed connectToColyseus function - Handled by ConnectionManager.js

// Function to encapsulate setting up room listeners
NetworkManager.prototype.setupRoomListeners = function() {
    // this.room is now guaranteed to be set by onConnected before this is called
    if (!this.room) {
         console.error("NetworkManager: setupRoomListeners called but room is not available. This shouldn't happen.");
         return;
     }
    console.log("NetworkManager: Setting up room listeners...");

    // --- Player State Listeners Removed ---
    // Handled by PlayerSync.js

    // --- Booth State Listeners Removed ---
    // Handled by BoothSync.js

    // --- Message Listeners Removed ---
    // Handled by MessageBroker.js


    // --- Room Lifecycle Listeners Removed ---
    // Handled by ConnectionManager.js

    // --- Initial Population ---
    // Process players already in the room when we join
    // Player initial population removed - Handled by PlayerSync.js
    // Booth initial population removed - Handled by BoothSync.js
};

// Function to setup app-level listeners that depend on the room
NetworkManager.prototype.setupAppListeners = function() {
    console.log("NetworkManager: Setting up app listeners...");
    // App listeners for sending messages removed.
    // MessageBroker.js now listens for these app events and sends the messages.
};


// --- Helper Functions (from original_project) ---

// Removed updateUsernameOnServer function.
// MessageBroker listens for 'player:setUsername' and sends the update.
// Removed onPlayerAdd - Handled by PlayerSync.js

// Removed onPlayerRemove - Handled by PlayerSync.js

// Removed updateRemotePlayer - Handled by PlayerSync.js
// Stray brace removed.

// Removed updateBoothDisplay - UI updates should be handled by dedicated UI/Booth controllers
// listening for events fired by BoothSync.js (e.g., 'booth:added', 'booth:updated', 'booth:removed').

// swap method called for script hot-reloading
// inherit your script state here
// NetworkManager.prototype.swap = function(old) { };

NetworkManager.prototype.destroy = function () {
    this.app.off('colyseus:connected', this.onConnected, this);
    this.app.off('colyseus:disconnected', this.onDisconnected, this);
};

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/
