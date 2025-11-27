var AuthTokenService = pc.createScript('authToken');

AuthTokenService.prototype.initialize = function () {
    this.storageKey = 'pgGameJwt';
    this.token = null;
    this.expiresAt = 0;
    this.metadata = null;

    this.loadFromStorage();

    const services = this.app.services;
    if (services && typeof services.register === 'function') {
        services.register('authToken', this);
    }

    this.handleAuthStateChanged = this.handleAuthStateChanged.bind(this);

    this.app.on('auth:gameToken', this.handleGameTokenEvent, this);
    this.app.on('auth:stateChanged', this.handleAuthStateChanged, this);
};

AuthTokenService.prototype.destroy = function () {
    this.app.off('auth:gameToken', this.handleGameTokenEvent, this);
    this.app.off('auth:stateChanged', this.handleAuthStateChanged, this);
};

AuthTokenService.prototype.swap = function(old) {
    console.log("AuthTokenService: Swapping script instance for hot reload.");
    
    // Transfer state
    this.token = old.token;
    this.expiresAt = old.expiresAt;
    this.metadata = old.metadata;
    this.storageKey = old.storageKey;

    // Re-bind methods
    this.handleGameTokenEvent = this.handleGameTokenEvent.bind(this);
    this.handleAuthStateChanged = this.handleAuthStateChanged.bind(this);
    
    // Re-attach listeners
    this.app.on('auth:gameToken', this.handleGameTokenEvent, this);
    this.app.on('auth:stateChanged', this.handleAuthStateChanged, this);
    
    // Ensure service registration
    if (this.app.services && typeof this.app.services.register === 'function') {
        this.app.services.register('authToken', this);
    }
};

AuthTokenService.prototype.handleGameTokenEvent = function (payload) {
    if (!payload || typeof payload.token !== 'string') {
        return;
    }
    this.setToken(payload.token, payload);
};

AuthTokenService.prototype.handleAuthStateChanged = function (event) {
    if (!event) {
        return;
    }
    const leaving =
        event.state === 'disconnected' ||
        event.isAuthenticated === false ||
        !event.user;

    if (leaving) {
        this.clearToken();
    }
};

AuthTokenService.prototype.setToken = function (token, options) {
    if (typeof token !== 'string' || !token.length) {
        return;
    }

    const expiresAt = this.resolveExpiry(options);
    this.token = token;
    this.expiresAt = expiresAt;
    this.metadata = {
        expiresAt: expiresAt,
        expiresIn: typeof options?.expiresIn === 'number' ? options.expiresIn : null,
        user: options?.user || null,
        issuedAt: options?.issuedAt || Date.now(),
    };

    this.persistToStorage();
};

AuthTokenService.prototype.getToken = function () {
    if (!this.token) {
        return null;
    }
    if (this.expiresAt && Date.now() > this.expiresAt) {
        this.clearToken();
        return null;
    }
    return this.token;
};

AuthTokenService.prototype.clearToken = function () {
    this.token = null;
    this.expiresAt = 0;
    this.metadata = null;
    try {
        localStorage.removeItem(this.storageKey);
    } catch (error) {
        console.warn('AuthTokenService: Failed to clear stored token.', error);
    }
};

AuthTokenService.prototype.getMetadata = function () {
    return this.metadata;
};

AuthTokenService.prototype.resolveExpiry = function (options) {
    if (!options) {
        return 0;
    }
    if (typeof options.expiresAt === 'number' && Number.isFinite(options.expiresAt)) {
        return options.expiresAt;
    }
    if (typeof options.expiresIn === 'number' && Number.isFinite(options.expiresIn)) {
        return Date.now() + Math.max(0, options.expiresIn * 1000);
    }
    return 0;
};

AuthTokenService.prototype.persistToStorage = function () {
    try {
        if (!this.token) {
            localStorage.removeItem(this.storageKey);
            return;
        }
        const payload = {
            token: this.token,
            expiresAt: this.expiresAt,
            metadata: this.metadata,
        };
        localStorage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (error) {
        console.warn('AuthTokenService: Failed to persist token to storage.', error);
    }
};

AuthTokenService.prototype.loadFromStorage = function () {
    try {
        const stored = localStorage.getItem(this.storageKey);
        if (!stored) {
            return;
        }
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed.token !== 'string') {
            localStorage.removeItem(this.storageKey);
            return;
        }

        this.token = parsed.token;
        this.expiresAt =
            typeof parsed.expiresAt === 'number' && Number.isFinite(parsed.expiresAt)
                ? parsed.expiresAt
                : 0;
        this.metadata = typeof parsed.metadata === 'object' ? parsed.metadata : null;

        if (this.expiresAt && Date.now() > this.expiresAt) {
            this.clearToken();
        }
    } catch (error) {
        console.warn('AuthTokenService: Failed to load stored token.', error);
        try {
            localStorage.removeItem(this.storageKey);
        } catch (err) {
            console.warn('AuthTokenService: Failed to clear corrupted storage entry.', err);
        }
    }
};
