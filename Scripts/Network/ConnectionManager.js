var ConnectionManager = pc.createScript('connectionManager');

ConnectionManager.attributes.add('servicesEntity', {
    type: 'entity',
    title: 'Services Entity',
    description: 'The entity holding core services like ConfigLoader.'
});
ConnectionManager.attributes.add('autoReconnect', {
    type: 'boolean',
    default: true,
    title: 'Auto Reconnect',
    description: 'Automatically try to reconnect when the room connection drops.'
});
ConnectionManager.attributes.add('maxReconnectAttempts', {
    type: 'number',
    default: 0,
    title: 'Max Reconnect Attempts (0 = unlimited)'
});
ConnectionManager.attributes.add('reconnectBaseDelay', {
    type: 'number',
    default: 1000,
    title: 'Reconnect Base Delay (ms)'
});
ConnectionManager.attributes.add('reconnectMaxDelay', {
    type: 'number',
    default: 10000,
    title: 'Reconnect Max Delay (ms)'
});
ConnectionManager.attributes.add('reconnectBackoffMultiplier', {
    type: 'number',
    default: 1.6,
    title: 'Reconnect Backoff Multiplier'
});
ConnectionManager.attributes.add('reconnectJitter', {
    type: 'number',
    default: 0.25,
    title: 'Reconnect Jitter (0-1)'
});

ConnectionManager.prototype.initialize = function() {
    console.log("ConnectionManager: Initializing...");
    this.room = null;
    this.client = null;
    this.isConnecting = false;
    this.retryAttempt = 0;
    this.reconnectTimer = null;
    this.manualDisconnect = false;
    this._allowsAutoReconnect = this.autoReconnect !== false;
    this._shouldReconnect = this._allowsAutoReconnect;
    this._onWindowOnline = this.onWindowOnline.bind(this);

    if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('online', this._onWindowOnline);
    }

    if (!this.app.services) {
        console.error("ConnectionManager: Services registry not found!");
        return;
    }
    this.configLoader = this.app.services.get('configLoader');

    if (this.configLoader && this.configLoader.config) {
        this.connect();
    } else {
        console.log("ConnectionManager: Waiting for config:loaded event...");
        this.app.once('config:loaded', function () {
            this.connect();
        }, this);
    }

    this.app.on('network:disconnect', this.disconnect, this);
};

ConnectionManager.prototype.connect = async function(options) {
    if (this.isConnecting) {
        console.log("ConnectionManager: Already connecting, ignoring duplicate connect() call.");
        return;
    }
    if (this.room) {
        console.log("ConnectionManager: Already connected; skipping connect() call.");
        return;
    }

    if (!this.configLoader) {
        console.error("ConnectionManager: Cannot connect without config loader.");
        return;
    }

    const colyseusEndpoint = this.configLoader.get('colyseusEndpoint');
    if (!colyseusEndpoint) {
        console.error("ConnectionManager: Colyseus endpoint not found in config!");
        this.app.fire('colyseus:connectionError', { message: 'Colyseus endpoint missing in configuration.' });
        return;
    }

    if (typeof Colyseus === 'undefined' || !Colyseus.Client) {
        const libError = new Error("Colyseus client library not found.");
        console.error("ConnectionManager: Colyseus client library (Colyseus) is not available on the window object. Make sure your bundle.js is loaded and has executed before this script.");
        this.onConnectionFailed(libError, { suppressLog: true, skipRetry: true });
        return;
    }

    this.clearReconnectTimer();
    this.manualDisconnect = false;
    this._shouldReconnect = this._allowsAutoReconnect;

    const attemptNumber = this.retryAttempt + 1;
    const initialUsername = this.getInitialUsername();
    console.log(`ConnectionManager: Attempting connection (attempt ${attemptNumber}) to ${colyseusEndpoint} as ${initialUsername}...`);
    this.app.fire('colyseus:connecting', { attempt: attemptNumber });

    this.isConnecting = true;

    try {
        const client = new Colyseus.Client(colyseusEndpoint);
        const joinOptions = { username: initialUsername };
        this.client = client;

        this.room = await client.joinOrCreate("my_room", joinOptions);

        if (!this.room) {
            throw new Error("Failed to join or create room. Room object is null.");
        }

        console.log("ConnectionManager: Successfully joined room. Session ID:", this.room.sessionId);
        this.app.room = this.room; // Expose room globally
        this.retryAttempt = 0;
        this.setupRoomLifecycleListeners();

        this.app.fire("colyseus:connected", this.room);

    } catch (e) {
        this.room = null;
        this.client = null;
        this.onConnectionFailed(e);
    } finally {
        this.isConnecting = false;
    }
};

ConnectionManager.prototype.disconnect = function() {
    this.clearReconnectTimer();
    const allowReconnect = arguments.length && arguments[0] && arguments[0].allowReconnect === true;
    this.manualDisconnect = !allowReconnect;
    this._shouldReconnect = allowReconnect ? this._allowsAutoReconnect : false;
    if (!allowReconnect) {
        this.retryAttempt = 0;
    }

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
        this.handleRoomLeave({ code: code, reason: 'leave' });
    });

    this.room.onError((code, message) => {
        console.error("ConnectionManager: Room error. Code:", code, "Message:", message);
        this.app.fire("colyseus:roomError", { code: code, message: message });
    });
};

ConnectionManager.prototype.handleRoomLeave = function(details) {
    const code = details && details.code !== undefined ? details.code : undefined;
    const reason = details && details.reason ? details.reason : 'leave';
    const wasManual = this.manualDisconnect;

    this.room = null;
    this.app.room = null;
    this.client = null;
    this.isConnecting = false;

    this.clearReconnectTimer();

    this.app.fire("colyseus:disconnected", { code: code, reason: reason, manual: wasManual });

    this.manualDisconnect = false;

    if (wasManual) {
        return;
    }

    this._shouldReconnect = this._allowsAutoReconnect;

    if (this.shouldAutoReconnect()) {
        this.scheduleReconnect({ reason: reason });
    }
};

ConnectionManager.prototype.onConnectionFailed = function(error, options) {
    options = options || {};
    const suppressLog = options.suppressLog;
    const skipRetry = options.skipRetry === true;

    if (!suppressLog) {
        console.error("ConnectionManager: Colyseus connection failed:", error);
    }

    const message = error && error.message ? error.message : 'Unknown connection error.';
    this.app.fire("colyseus:connectionError", { message: message, error: error });

    if (skipRetry) {
        return;
    }

    this.retryAttempt += 1;
    this._shouldReconnect = this._allowsAutoReconnect;

    if (this.shouldAutoReconnect()) {
        this.scheduleReconnect({ reason: 'connection-error' });
    }
};

ConnectionManager.prototype.shouldAutoReconnect = function() {
    if (!this._allowsAutoReconnect || !this._shouldReconnect) {
        return false;
    }

    const maxAttempts = typeof this.maxReconnectAttempts === 'number' ? this.maxReconnectAttempts : 0;
    if (maxAttempts > 0 && this.retryAttempt >= maxAttempts) {
        console.warn("ConnectionManager: Reached max reconnect attempts. Stopping retries.");
        return false;
    }

    if (!this.configLoader || !this.configLoader.get('colyseusEndpoint')) {
        return false;
    }

    return true;
};

ConnectionManager.prototype.scheduleReconnect = function(options) {
    if (!this.shouldAutoReconnect()) {
        return;
    }

    const immediate = options && options.immediate === true;
    const reason = options && options.reason ? options.reason : 'unknown';
    const nextAttemptNumber = this.retryAttempt + 1;
    const delay = immediate ? 0 : this.calculateBackoffDelay(nextAttemptNumber);

    if (delay > 0) {
        console.log(`ConnectionManager: Scheduling reconnect attempt ${nextAttemptNumber} in ${delay}ms (reason: ${reason}).`);
    } else {
        console.log(`ConnectionManager: Scheduling immediate reconnect attempt ${nextAttemptNumber} (reason: ${reason}).`);
    }

    this.clearReconnectTimer();

    const self = this;
    this.app.fire('colyseus:reconnecting', { attempt: nextAttemptNumber, delay: delay, reason: reason });
    this.reconnectTimer = setTimeout(function() {
        self.reconnectTimer = null;
        self.connect();
    }, Math.max(0, delay));
};

ConnectionManager.prototype.calculateBackoffDelay = function(attempt) {
    const baseDelay = typeof this.reconnectBaseDelay === 'number' && this.reconnectBaseDelay >= 0 ? this.reconnectBaseDelay : 1000;
    const maxDelay = typeof this.reconnectMaxDelay === 'number' && this.reconnectMaxDelay >= 0 ? this.reconnectMaxDelay : 10000;
    const multiplier = typeof this.reconnectBackoffMultiplier === 'number' && this.reconnectBackoffMultiplier > 1 ? this.reconnectBackoffMultiplier : 1.6;
    const jitter = typeof this.reconnectJitter === 'number' && this.reconnectJitter >= 0 ? Math.min(this.reconnectJitter, 1) : 0.25;

    let delay = baseDelay * Math.pow(multiplier, Math.max(0, attempt - 1));
    delay = Math.min(delay, maxDelay);

    if (jitter > 0 && delay > 0) {
        const jitterRange = delay * jitter;
        delay += (Math.random() * jitterRange * 2) - jitterRange;
    }

    return Math.max(0, Math.round(delay));
};

ConnectionManager.prototype.clearReconnectTimer = function() {
    if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
    }
};

ConnectionManager.prototype.onWindowOnline = function() {
    if (this.room || this.isConnecting) {
        return;
    }

    if (this.shouldAutoReconnect()) {
        console.log("ConnectionManager: Browser reported online; triggering immediate reconnect attempt.");
        this.scheduleReconnect({ immediate: true, reason: 'network-online' });
    }
};

ConnectionManager.prototype.getInitialUsername = function() {
    try {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('userName') : null;
        if (stored && stored.length) {
            return stored;
        }
    } catch (err) {
        console.warn("ConnectionManager: Failed to read username from localStorage.", err);
    }
    return `Guest_${Math.random().toString(36).substring(2, 7)}`;
};

ConnectionManager.prototype.destroy = function() {
    this.clearReconnectTimer();

    if (typeof window !== 'undefined' && window.removeEventListener && this._onWindowOnline) {
        window.removeEventListener('online', this._onWindowOnline);
    }

    this.app.off('network:disconnect', this.disconnect, this);
    this._onWindowOnline = null;
};

ConnectionManager.prototype.onAttributeChanged = function(name, value) {
    if (name === 'autoReconnect') {
        this._allowsAutoReconnect = value !== false;
        if (!this.manualDisconnect) {
            this._shouldReconnect = this._allowsAutoReconnect;
        }
        if (!this.shouldAutoReconnect()) {
            this.clearReconnectTimer();
        }
    }
};
