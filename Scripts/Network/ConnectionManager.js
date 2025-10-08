var ConnectionManager = pc.createScript('connectionManager');

ConnectionManager.attributes.add('servicesEntity', {
    type: 'entity',
    title: 'Services Entity',
    description: 'The entity holding core services like ConfigLoader.'
});

ConnectionManager.prototype.initialize = function() {
    console.log("ConnectionManager: Initializing...");
    this.room = null;

    if (!this.app.services) {
        console.error("ConnectionManager: Services registry not found!");
        return;
    }
    this.configLoader = this.app.services.get('configLoader');

    if (this.configLoader && this.configLoader.config) {
        this.connect();
    } else {
        console.log("ConnectionManager: Waiting for config:loaded event...");
        this.app.once('config:loaded', this.connect, this);
    }

    this.app.on('network:disconnect', this.disconnect, this);
};

ConnectionManager.prototype.connect = async function() {
    const colyseusEndpoint = this.configLoader.get('colyseusEndpoint');
    if (!colyseusEndpoint) {
        console.error("ConnectionManager: Colyseus endpoint not found in config!");
        this.app.fire('colyseus:connectionError', { message: 'Colyseus endpoint missing in configuration.' });
        return;
    }

    const initialUsername = localStorage.getItem('userName') || `Guest_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`ConnectionManager: Attempting connection to ${colyseusEndpoint} as ${initialUsername}...`);
    this.app.fire('colyseus:connecting');

    try {
        if (typeof Colyseus === 'undefined' || !Colyseus.Client) {
            console.error("ConnectionManager: Colyseus client library (Colyseus) is not available on the window object. Make sure your bundle.js is loaded and has executed before this script.");
            throw new Error("Colyseus client library not found.");
        }

        const client = new Colyseus.Client(colyseusEndpoint);
        this.room = await client.joinOrCreate("my_room", { username: initialUsername });

        if (!this.room) {
            throw new Error("Failed to join or create room. Room object is null.");
        }

        console.log("ConnectionManager: Successfully joined room. Session ID:", this.room.sessionId);
        this.app.room = this.room; // Expose room globally
        this.setupRoomLifecycleListeners();

        this.app.fire("colyseus:connected", this.room);

    } catch (e) {
        console.error("ConnectionManager: Colyseus connection failed:", e);
        this.room = null;
        this.app.fire("colyseus:connectionError", { message: e.message || 'Unknown connection error.', error: e });
    }
};

ConnectionManager.prototype.disconnect = function() {
    if (this.room) {
        console.log("ConnectionManager: Leaving room...");
        this.room.leave();
    } else {
        console.log("ConnectionManager: Not connected, cannot disconnect.");
    }
};

ConnectionManager.prototype.setupRoomLifecycleListeners = function() {
    if (!this.room) return;

    this.room.onLeave((code) => {
        console.log("ConnectionManager: Left room. Code:", code);
        const wasConnected = !!this.room;
        this.room = null;
        this.app.room = null;
        if (wasConnected) {
            this.app.fire("colyseus:disconnected", { code: code });
        }
    });

    this.room.onError((code, message) => {
        console.error("ConnectionManager: Room error. Code:", code, "Message:", message);
        this.app.fire("colyseus:roomError", { code: code, message: message });
    });
};