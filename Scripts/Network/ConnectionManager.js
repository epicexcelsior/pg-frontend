var ConnectionManager = pc.createScript('connectionManager');

ConnectionManager.attributes.add('servicesEntity', {
    type: 'entity',
    title: 'Services Entity',
    description: 'The entity holding core services like ConfigLoader.'
});

// initialize code called once per entity
ConnectionManager.prototype.initialize = function() {
    console.log("ConnectionManager: Initializing...");
    this.room = null; // Store the Colyseus room instance

    // Ensure ConfigLoader is available
    if (!this.servicesEntity || !this.servicesEntity.script || !this.servicesEntity.script.configLoader) {
        console.error("ConnectionManager: Services Entity or ConfigLoader script not found!");
        return;
    }
    this.configLoader = this.servicesEntity.script.configLoader;

    // Wait for config to load before attempting connection
    if (this.app.config) {
        this.connect();
    } else {
        console.log("ConnectionManager: Waiting for config:loaded event...");
        this.app.once('config:loaded', this.connect, this);
        this.app.once('config:error', function(errorMsg) {
            console.error("ConnectionManager: Failed to connect due to config error:", errorMsg);
            this.app.fire('colyseus:connectionError', { message: `Config loading failed: ${errorMsg}` });
        }, this);
    }

    // Listen for explicit disconnect requests
    this.app.on('network:disconnect', this.disconnect, this);
};

ConnectionManager.prototype.connect = async function() {
    const colyseusEndpoint = this.configLoader.get('colyseusEndpoint');
    if (!colyseusEndpoint) {
        console.error("ConnectionManager: Colyseus endpoint not found in config!");
        this.app.fire('colyseus:connectionError', { message: 'Colyseus endpoint missing in configuration.' });
        return;
    }

    // Use a default or previously stored username. Consider integrating with AuthService later.
    const initialUsername = localStorage.getItem('userName') || `Guest_${Math.random().toString(36).substring(2, 7)}`;
    // TODO: Replace localStorage access with AuthService interaction if applicable

    console.log(`ConnectionManager: Attempting connection to ${colyseusEndpoint} as ${initialUsername}...`);
    this.app.fire('colyseus:connecting');

    try {
        // Ensure Colyseus library is loaded (assuming global `Colyseus`)
        if (typeof Colyseus === 'undefined' || !Colyseus.Client) {
             throw new Error("Colyseus client library not found.");
        }

        const client = new Colyseus.Client(colyseusEndpoint);
        // TODO: Add error handling for client creation if needed

        // Use username from localStorage for initial join. Server might update/confirm later.
        this.room = await client.joinOrCreate("my_room", { username: initialUsername });

        if (!this.room) {
            throw new Error("Failed to join or create room. Room object is null.");
        }

        console.log("ConnectionManager: Successfully joined room. Session ID:", this.room.sessionId);
        this.setupRoomLifecycleListeners(); // Setup leave/error listeners immediately

        // Fire event with the room object for other network scripts to use
        this.app.fire("colyseus:connected", this.room);

    } catch (e) {
        console.error("ConnectionManager: Colyseus connection failed:", e);
        this.room = null; // Ensure room is null on failure
        this.app.fire("colyseus:connectionError", { message: e.message || 'Unknown connection error.', error: e });
    }
};

ConnectionManager.prototype.disconnect = function() {
    if (this.room) {
        console.log("ConnectionManager: Leaving room...");
        this.room.leave(); // This will trigger the onLeave listener
        // Do not nullify this.room here; let the onLeave handler do it.
    } else {
        console.log("ConnectionManager: Not connected, cannot disconnect.");
    }
};

ConnectionManager.prototype.setupRoomLifecycleListeners = function() {
    if (!this.room) return;

    this.room.onLeave((code) => {
        console.log("ConnectionManager: Left room. Code:", code);
        const wasConnected = !!this.room;
        this.room = null; // Clear room reference
        if (wasConnected) {
            this.app.fire("colyseus:disconnected", { code: code });
        }
        // Optionally attempt reconnect based on code?
        // if (code !== 1000) { // 1000 is normal closure
        //     console.log("ConnectionManager: Attempting reconnect...");
        //     setTimeout(() => this.connect(), 5000); // Example reconnect delay
        // }
    });

    this.room.onError((code, message) => {
        console.error("ConnectionManager: Room error. Code:", code, "Message:", message);
        // Don't nullify room here, as the connection might still be partially active or attempting recovery.
        // The onLeave event will handle full disconnection.
        this.app.fire("colyseus:roomError", { code: code, message: message });
    });
};

// swap method called for script hot-reloading
// ConnectionManager.prototype.swap = function(old) { };