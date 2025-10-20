// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Core\PrivyManager.js
var PrivyManager = pc.createScript('privyManager');

function generateNonce(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

PrivyManager.prototype.initialize = function () {
    this.user = null;
    this.authenticated = false;
    this.ready = false;
    this._pendingNonce = null;
    this.loginTimeoutMs = 60000;
    this._loginInProgress = false;
    this._loginTimeoutHandle = null;

    this.twitterHandle = null;
    this.twitterUserId = null;
    this.privyDid = null;

    this.privyHostOrigin = null;
    this.configLoader = null;
    this.defaultTransactionChain = 'solana:mainnet';

    this.transactionTimeoutMs = 120000;
    this.transactionPromises = new Map();
    this.pendingReadyCallbacks = [];
    this._gameTokenExchangePromise = null;
    this.latestPrivyAccessToken = null;

    this.popupFeatures = 'width=400,height=650,scrollbars=yes,resizable=yes';

    this.messageListenerAttached = false;

    this.handleAuthMessage = this.handleAuthMessage.bind(this);
    this.onConfigLoaded = this.onConfigLoaded.bind(this);
    this.onConfigLoaderRegistered = this.onConfigLoaderRegistered.bind(this);
    this.onServicesInitialized = this.onServicesInitialized.bind(this);
    this.onDestroyHandler = this.onDestroyHandler.bind(this);

    this.ensureServiceRegistration();

    var loader = this.tryGetConfigLoader();
    if (loader) {
        this.bootstrapConfig(loader);
    } else {
        console.warn('PrivyManager: ConfigLoader service not ready yet. Waiting for registration.');
        this.app.once('service:configLoader:registered', this.onConfigLoaderRegistered, this);
    }

    this.on('destroy', this.onDestroyHandler);
};

PrivyManager.prototype.ensureServiceRegistration = function () {
    const services = this.app.services;
    if (services && typeof services.register === 'function') {
        if (services.get('privyManager') !== this) {
            services.register('privyManager', this);
        }
    } else {
        this.app.once('services:initialized', this.onServicesInitialized, this);
    }
};

PrivyManager.prototype.onServicesInitialized = function () {
    const services = this.app.services;
    if (!services || typeof services.register !== 'function') {
        return;
    }
    if (services.get('privyManager') !== this) {
        services.register('privyManager', this);
    }
    if (!this.ready) {
        const loader = this.tryGetConfigLoader();
        if (loader) {
            this.bootstrapConfig(loader);
        }
    }
};

PrivyManager.prototype.tryGetConfigLoader = function () {
    const services = this.app.services;
    if (!services || typeof services.get !== 'function') {
        return null;
    }
    const loader = services.get('configLoader');
    return loader || null;
};

PrivyManager.prototype.onConfigLoaderRegistered = function (configLoader) {
    if (this.ready) {
        return;
    }
    this.bootstrapConfig(configLoader);
};

PrivyManager.prototype.bootstrapConfig = function (configLoader) {
    if (!configLoader) {
        console.error('PrivyManager: bootstrapConfig called without a ConfigLoader instance.');
        return;
    }

    this.configLoader = configLoader;

    const configuredDefaultChain = typeof configLoader.get === 'function' ? (configLoader.get('privyDefaultChain') || configLoader.get('solanaDefaultChain')) : null;
    if (typeof configuredDefaultChain === 'string' && configuredDefaultChain.trim().length > 0) {
        this.defaultTransactionChain = configuredDefaultChain.trim();
    }

    const originCandidate = typeof configLoader.get === 'function' ? this.resolvePrivyOrigin(configLoader.get('privyHostOrigin')) : null;
    if (originCandidate) {
        this.setupWithOrigin(originCandidate);
        return;
    }

    if (configLoader.config) {
        console.error('PrivyManager: privyHostOrigin missing from configuration. Please update config.json.');
        return;
    }

    console.warn('PrivyManager: privyHostOrigin not available yet. Waiting for config:loaded event.');
    this.app.once('config:loaded', this.onConfigLoaded, this);
};

PrivyManager.prototype.onConfigLoaded = function () {
    if (this.ready) {
        return;
    }
    const loader = this.configLoader || this.tryGetConfigLoader();
    if (!loader || typeof loader.get !== 'function') {
        console.error('PrivyManager: ConfigLoader still unavailable after config:loaded.');
        return;
    }

    const originCandidate = this.resolvePrivyOrigin(loader.get('privyHostOrigin'));
    if (!originCandidate) {
        console.error('PrivyManager: privyHostOrigin missing from configuration after config:loaded.');
        return;
    }

    this.setupWithOrigin(originCandidate);
};

PrivyManager.prototype.resolvePrivyOrigin = function (value) {
    if (!value || typeof value !== 'string') {
        return null;
    }
    try {
        const parsed = new URL(value);
        return parsed.origin;
    } catch (error) {
        console.error('PrivyManager: Invalid privyHostOrigin in configuration:', value, error);
        return null;
    }
};

PrivyManager.prototype.setupWithOrigin = function (origin) {
    if (this.ready) {
        if (this.privyHostOrigin !== origin) {
            console.warn('PrivyManager: privyHostOrigin changed. Updating to new origin.', { previous: this.privyHostOrigin, next: origin });
            this.privyHostOrigin = origin;
        }
        return;
    }

    this.privyHostOrigin = origin;
    this.ready = true;

    if (!this.messageListenerAttached) {
        window.addEventListener('message', this.handleAuthMessage);
        this.messageListenerAttached = true;
    }

    this.restoreUserSession();
    this.flushPendingReadyCallbacks();

    console.log('PrivyManager: Ready. Listening for messages from', origin, { defaultChain: this.defaultTransactionChain });
};

PrivyManager.prototype.flushPendingReadyCallbacks = function () {
    if (!this.pendingReadyCallbacks.length) {
        return;
    }
    const callbacks = this.pendingReadyCallbacks.slice();
    this.pendingReadyCallbacks.length = 0;
    callbacks.forEach((callback) => {
        try {
            callback();
        } catch (error) {
            console.error('PrivyManager: Deferred Privy action failed to execute.', error);
        }
    });
};

PrivyManager.prototype.queueWhenReady = function (callback, description) {
    console.warn(`PrivyManager: ${description || 'Action'} requested before Privy is ready. Queuing until configuration is available.`);
    this.pendingReadyCallbacks.push(callback);
};

PrivyManager.prototype.onDestroyHandler = function () {
    if (this.messageListenerAttached) {
        window.removeEventListener('message', this.handleAuthMessage);
        this.messageListenerAttached = false;
    }

    this.app.off('config:loaded', this.onConfigLoaded, this);
    this.app.off('service:configLoader:registered', this.onConfigLoaderRegistered, this);
    this.app.off('services:initialized', this.onServicesInitialized, this);

    this.rejectAllPendingTransactions('Privy manager destroyed before the transaction completed.');
    this.pendingReadyCallbacks.length = 0;
    this._setLoginInProgress(false);
};

PrivyManager.prototype.rejectAllPendingTransactions = function (message) {
    if (!this.transactionPromises.size) {
        return;
    }
    const finalMessage = typeof message === 'string' && message.length ? message : 'Transaction was cancelled.';
    this.transactionPromises.forEach((handlers, requestId) => {
        try {
            handlers.reject(new Error(finalMessage));
        } catch (error) {
            console.error('PrivyManager: Failed to reject pending transaction', requestId, error);
        }
    });
    this.transactionPromises.clear();
};

PrivyManager.prototype.normalizeError = function (errorOrMessage, fallbackMessage) {
    if (errorOrMessage instanceof Error) {
        return errorOrMessage;
    }
    if (errorOrMessage && typeof errorOrMessage === 'object') {
        const derivedMessage = errorOrMessage.message || errorOrMessage.error || fallbackMessage;
        return new Error(derivedMessage || fallbackMessage || 'Operation failed.');
    }
    if (typeof errorOrMessage === 'string' && errorOrMessage.trim().length > 0) {
        return new Error(errorOrMessage.trim());
    }
    return new Error(fallbackMessage || 'Operation failed.');
};

PrivyManager.prototype._setLoginInProgress = function (active) {
    if (active) {
        this._loginInProgress = true;
        if (this._loginTimeoutHandle) {
            window.clearTimeout(this._loginTimeoutHandle);
        }
        var timeout = typeof this.loginTimeoutMs === 'number' && this.loginTimeoutMs > 0
            ? this.loginTimeoutMs
            : 60000;
        this._loginTimeoutHandle = window.setTimeout(() => {
            console.warn('PrivyManager: Login attempt timed out. Clearing guard.');
            this._loginInProgress = false;
            this._loginTimeoutHandle = null;
        }, timeout);
        return;
    }
    this._loginInProgress = false;
    if (this._loginTimeoutHandle) {
        window.clearTimeout(this._loginTimeoutHandle);
        this._loginTimeoutHandle = null;
    }
};

PrivyManager.prototype.isLoginInProgress = function () {
    return this._loginInProgress;
};

PrivyManager.prototype.handleAuthMessage = function (event) {
    if (!this.ready) {
        console.warn('PrivyManager: Received auth message before initialization completed. Ignoring.');
        return;
    }

    if (event.origin !== this.privyHostOrigin) {
        return;
    }

    const data = event.data;
    if (!data || typeof data !== 'object') {
        return;
    }

    if (!this._pendingNonce || data.nonce !== this._pendingNonce) {
        console.warn('PrivyManager: Received message with invalid nonce. Ignoring.');
        return;
    }
    // Clear the nonce after it's been used
    this._pendingNonce = null;

    const type = data.type;
    const payload = data.payload || {};
    const requestId = data.requestId || payload.requestId;

    console.log(`PrivyManager: Received message type '${type}'`, { requestId });

    switch (type) {
        case 'PRIVY_AUTH_SUCCESS':
            this._setLoginInProgress(false);
            if (payload && typeof payload.user === 'object') {
                this.handleAuthSuccess(payload);
            } else {
                console.warn('PrivyManager: Auth success payload missing user data.');
            }
            break;
        case 'PRIVY_AUTH_LOGOUT':
            this._setLoginInProgress(false);
            this.handleAuthLogout();
            break;
        case 'PRIVY_TX_SUCCESS':
            this.resolveTransactionPromise(requestId, (handlers) => {
                const normalized = this.normalizeSignaturePayload(payload);
                if (!normalized) {
                    handlers.reject(new Error('Signature missing in Privy response.'));
                    return;
                }
                handlers.resolve(normalized);
            });
            break;
        case 'PRIVY_TX_ERROR':
            this.resolveTransactionPromise(requestId, (handlers) => {
                handlers.reject(this.normalizeError(payload, 'Transaction was rejected.'));
            });
            break;
        case 'PRIVY_LINK_SUCCESS':
            if (payload && typeof payload.user === 'object') {
                this.handleAuthSuccess(payload);
            } else {
                console.warn('PrivyManager: Link success payload missing user data.');
            }
            break;
        case 'PRIVY_LINK_ERROR':
            console.error('PrivyManager: Failed to link account.', payload);
            this.app.fire('auth:linkFailed', { error: payload.error });
            break;
        default:
            if (typeof type === 'string' && type.indexOf('PRIVY_AUTH_') === 0) {
                this._setLoginInProgress(false);
            }
            console.warn('PrivyManager: Unhandled message type from privy host:', type);
            break;
    }
};

PrivyManager.prototype.resolveTransactionPromise = function (requestId, executor) {
    if (!requestId) {
        console.warn('PrivyManager: Transaction message missing requestId.');
        return;
    }
    const handlers = this.transactionPromises.get(requestId);
    if (!handlers) {
        console.warn('PrivyManager: No pending transaction for requestId', requestId);
        return;
    }
    this.transactionPromises.delete(requestId);
    try {
        executor(handlers);
    } catch (error) {
        console.error('PrivyManager: Error resolving transaction promise:', error);
        handlers.reject(error);
    }
};

PrivyManager.prototype.normalizeSignaturePayload = function (payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    const signature = payload.signature;
    if (typeof signature === 'string' && signature.length) {
        const encoding = payload.encoding || 'base58';
        if (encoding === 'base58') {
            return { signature: signature };
        }
        if (encoding === 'base64') {
            const bytes = this.base64ToBytes(signature);
            if (!bytes) {
                return null;
            }
            return { signature: this.bytesToBase58(bytes) };
        }
        console.warn('PrivyManager: Unsupported signature encoding received:', encoding);
        return null;
    }

    if (signature instanceof Uint8Array) {
        return { signature: this.bytesToBase58(signature) };
    }

    return null;
};

PrivyManager.prototype.base64ToBytes = function (value) {
    try {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    } catch (error) {
        console.error('PrivyManager: Failed to decode base64 signature.', error);
        return null;
    }
};

PrivyManager.prototype.bytesToBase58 = function (bytes) {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    if (!bytes || !bytes.length) {
        return '';
    }

    const BASE = alphabet.length;
    const digits = [0];

    for (let i = 0; i < bytes.length; i += 1) {
        let carry = bytes[i];
        for (let j = 0; j < digits.length; j += 1) {
            carry += digits[j] << 8;
            digits[j] = carry % BASE;
            carry = (carry / BASE) | 0;
        }
        while (carry > 0) {
            digits.push(carry % BASE);
            carry = (carry / BASE) | 0;
        }
    }

    for (let k = 0; k < bytes.length && bytes[k] === 0; k += 1) {
        digits.push(0);
    }

    return digits
        .reverse()
        .map((digit) => alphabet[digit])
        .join('');
};

PrivyManager.prototype.handleAuthSuccess = function (payload) {
    console.log('PrivyManager: Authentication successful.', payload);

    this._setLoginInProgress(false);

    this.user = payload.user;
    this.authenticated = true;
    this.privyDid = (payload && payload.user && typeof payload.user.id === 'string')
        ? payload.user.id
        : null;

    var twitterIdentity = this.refreshTwitterIdentity(this.user);

    try {
        localStorage.setItem('privyUser', JSON.stringify(this.user));
    } catch (error) {
        console.error('PrivyManager: Failed to persist user session.', error);
    }

    this.app.fire('auth:stateChanged', {
        state: 'connected',
        address: this.getWalletAddress(),
        user: this.user,
        isAuthenticated: this.authenticated,
        twitterHandle: this.twitterHandle,
        twitterUserId: this.twitterUserId,
        twitterIdentity: twitterIdentity || null,
        privyDid: this.privyDid,
    });

    const self = this;
    Promise.resolve()
        .then(function () {
            return self.exchangeForGameToken(payload);
        })
        .then(function (tokenPayload) {
            if (tokenPayload) {
                self.app.fire('coins:refresh');
            }
        })
        .catch(function (error) {
            console.error('PrivyManager: Failed to exchange Privy token for game token.', error);
        });
};

PrivyManager.prototype.handleAuthLogout = function () {
    console.log('PrivyManager: Logout successful.');

    this._setLoginInProgress(false);

    this.rejectAllPendingTransactions('User logged out before the transaction completed.');

    const previousAddress = this.getWalletAddress();
    const localPlayerData = this.app.localPlayer?.script?.playerData;

    if (localPlayerData && typeof localPlayerData.getClaimedBoothId === 'function' && localPlayerData.getClaimedBoothId()) {
        this.app.fire('booth:unclaimRequest');
        if (typeof localPlayerData.clearClaimedBooth === 'function') {
            localPlayerData.clearClaimedBooth('privy:logout');
        }
    } else if (previousAddress) {
        this.app.fire('booth:unclaimRequest');
    }

    if (previousAddress) {
        this.app.fire('network:send', 'updateAddress', {
            walletAddress: '',
            twitterHandle: '',
            twitterUserId: ''
        });
    }

    this.user = null;
    this.authenticated = false;
    this.privyDid = null;
    this.latestPrivyAccessToken = null;
    this.refreshTwitterIdentity(null);

    const tokenService = this.getAuthTokenService();
    if (tokenService && typeof tokenService.clearToken === 'function') {
        tokenService.clearToken();
    }

    this.app.fire('coins:update', {
        balance: 0,
        lifetimeEarned: 0,
    });

    try {
        localStorage.removeItem('privyUser');
    } catch (error) {
        console.warn('PrivyManager: Failed to clear stored session.', error);
    }

    this.app.fire('auth:stateChanged', {
        state: 'disconnected',
        address: null,
        user: null,
        isAuthenticated: false,
        twitterHandle: null,
        twitterUserId: null,
        twitterIdentity: null,
        privyDid: null,
    });
};

PrivyManager.prototype.restoreUserSession = function () {
    try {
        const storedUser = localStorage.getItem('privyUser');
        if (storedUser) {
            this.user = JSON.parse(storedUser);
            this.authenticated = false;
            this.privyDid = (this.user && typeof this.user.id === 'string') ? this.user.id : null;
            console.log('PrivyManager: Restored user data from localStorage. Session is not active.', this.user);

            var twitterIdentity = this.refreshTwitterIdentity(this.user);

            this.app.fire('auth:stateChanged', {
                state: 'connected',
                address: this.getWalletAddress(),
                user: this.user,
                isAuthenticated: this.authenticated,
                twitterHandle: this.twitterHandle,
                twitterUserId: this.twitterUserId,
                twitterIdentity: twitterIdentity || null,
                privyDid: this.privyDid,
            });
        }
    } catch (error) {
        console.error('PrivyManager: Error restoring user session:', error);
        localStorage.removeItem('privyUser');
    }
};

PrivyManager.prototype.getAuthTokenService = function () {
    const services = this.app.services;
    if (!services || typeof services.get !== 'function') {
        return null;
    }
    try {
        return services.get('authToken') || null;
    } catch (error) {
        console.warn('PrivyManager: Failed to resolve authToken service.', error);
        return null;
    }
};

PrivyManager.prototype.resolveApiUrl = function (path) {
    var base = null;
    if (this.configLoader && typeof this.configLoader.get === 'function') {
        base = this.configLoader.get('apiBaseUrl');
        if ((!base || typeof base !== 'string' || !base.length) && typeof this.configLoader.get === 'function') {
            var endpoint = this.configLoader.get('colyseusEndpoint');
            if (typeof endpoint === 'string' && endpoint.length) {
                try {
                    var parsed = new URL(endpoint);
                    if (parsed.protocol === 'ws:' || parsed.protocol === 'wss:') {
                        parsed.protocol = parsed.protocol === 'ws:' ? 'http:' : 'https:';
                    }
                    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
                    parsed.search = '';
                    parsed.hash = '';
                    base = parsed.toString();
                } catch (error) {
                    console.warn('PrivyManager: Failed to derive API base from colyseusEndpoint.', error);
                }
            }
        }
    }

    if (!base && typeof window !== 'undefined' && window.location && window.location.origin) {
        base = window.location.origin;
    }

    if (base && typeof base === 'string' && base.length) {
        return base.replace(/\/+$/, '') + path;
    }
    return path;
};

PrivyManager.prototype.extractPrivyAccessToken = function (payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }

    var candidates = [
        payload.accessToken,
        payload.access_token,
        payload.token,
        payload.privyAccessToken,
        payload.privy_access_token,
        payload.sessionToken,
        payload.session_token,
    ];

    if (payload.session && typeof payload.session === 'object') {
        candidates.push(payload.session.accessToken);
        candidates.push(payload.session.access_token);
        candidates.push(payload.session.token);
    }

    if (payload.tokens && typeof payload.tokens === 'object') {
        candidates.push(payload.tokens.accessToken);
        candidates.push(payload.tokens.access_token);
    }

    if (payload.user && typeof payload.user === 'object') {
        const user = payload.user;
        candidates.push(user.accessToken);
        candidates.push(user.access_token);
        candidates.push(user.token);

        if (user.session && typeof user.session === 'object') {
            candidates.push(user.session.accessToken);
            candidates.push(user.session.access_token);
            candidates.push(user.session.token);
        }
    }

    for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        if (typeof candidate === 'string' && candidate.length > 20) {
            return candidate;
        }
    }

    if (typeof console !== 'undefined' && console.warn) {
        try {
            const inspected = {
                hasSession: !!payload.session,
                sessionKeys: payload.session ? Object.keys(payload.session) : null,
                hasTokens: !!payload.tokens,
                tokensKeys: payload.tokens ? Object.keys(payload.tokens) : null,
                userKeys: payload.user ? Object.keys(payload.user) : null,
            };
            console.warn('PrivyManager: Unable to locate access token in payload.', inspected);
        } catch (error) {
            console.warn('PrivyManager: Failed inspecting access token payload.', error);
        }
    }

    return null;
};

PrivyManager.prototype.exchangeForGameToken = function (payload) {
    const accessToken = this.extractPrivyAccessToken(payload);
    if (!accessToken) {
        console.warn('PrivyManager: No Privy access token found in payload. Skipping game token exchange.');
        return Promise.resolve(null);
    }

    this.latestPrivyAccessToken = accessToken;

    if (this._gameTokenExchangePromise) {
        return this._gameTokenExchangePromise;
    }

    const url = this.resolveApiUrl('/auth/exchange-privy');
    const self = this;

    this._gameTokenExchangePromise = fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Privy-Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
    })
        .then(function (response) {
            if (!response.ok) {
                throw new Error(`Exchange request failed (${response.status})`);
            }
            return response.json().catch(function () {
                return {};
            });
        })
        .then(function (data) {
            if (!data || typeof data.token !== 'string' || !data.token.length) {
                console.warn('PrivyManager: exchange-privy response missing token.');
                return null;
            }

            const tokenPayload = {
                token: data.token,
                expiresIn: typeof data.expiresIn === 'number' ? data.expiresIn : null,
                expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : null,
                user: data.user || null,
                issuedAt: Date.now(),
            };

            const tokenService = self.getAuthTokenService();
            if (tokenService && typeof tokenService.setToken === 'function') {
                tokenService.setToken(tokenPayload.token, tokenPayload);
            }

            self.app.fire('auth:gameToken', tokenPayload);
            return tokenPayload;
        })
        .catch(function (error) {
            console.error('PrivyManager: exchange-privy request failed.', error);
            throw error;
        })
        .finally(function () {
            self._gameTokenExchangePromise = null;
        });

    return this._gameTokenExchangePromise;
};

PrivyManager.prototype.buildPrivyUrl = function (parameters) {
    if (!this.ready || !this.privyHostOrigin) {
        throw new Error('PrivyManager: Cannot build Privy URL before configuration is ready.');
    }

    const urlParams = new URLSearchParams(parameters || {});
    if (!urlParams.has('redirect_uri')) {
        urlParams.set('redirect_uri', window.location.href);
    }
    return `${this.privyHostOrigin}?${urlParams.toString()}`;
};

PrivyManager.prototype.openPrivyWindow = function (url, name) {
    const popup = window.open(url, name, this.popupFeatures);
    if (!popup) {
        console.error(`PrivyManager: Failed to open ${name} window. Popup may be blocked.`);
        return null;
    }
    if (typeof popup.focus === 'function') {
        popup.focus();
    }
    return popup;
};

PrivyManager.prototype.login = function (options) {
    const force = Boolean(options && options.force);

    if (this.authenticated && !force) {
        console.log('PrivyManager: Login skipped; user already authenticated.');
        return null;
    }

    if (this._loginInProgress) {
        console.log('PrivyManager: Login request ignored; another login is in progress.');
        return null;
    }

    this._setLoginInProgress(true);

    const performLogin = () => {
        console.log('PrivyManager: Starting login process...');
        this._pendingNonce = generateNonce();
        const params = { action: 'login', nonce: this._pendingNonce };
        if (force) {
            params.force = 'true';
        }
        const loginUrl = this.buildPrivyUrl(params);
        const popup = this.openPrivyWindow(loginUrl, 'privy-auth');
        if (!popup) {
            this._setLoginInProgress(false);
        }
        return popup;
    };

    if (!this.ready) {
        this.queueWhenReady(() => {
            try {
                performLogin();
            } catch (error) {
                this._setLoginInProgress(false);
                console.error('PrivyManager: Deferred login failed.', error);
            }
        }, 'login');
        return null;
    }

    try {
        return performLogin();
    } catch (error) {
        this._setLoginInProgress(false);
        throw error;
    }
};

PrivyManager.prototype.logout = function () {
    const performLogout = () => {
        console.log('PrivyManager: Starting logout process...');

        this._pendingNonce = generateNonce();
        const logoutUrl = this.buildPrivyUrl({ action: 'logout', nonce: this._pendingNonce });
        return this.openPrivyWindow(logoutUrl, 'privy-logout');
    };

    if (!this.ready) {
        this.queueWhenReady(performLogout, 'logout');
        return null;
    }

    return performLogout();
};

PrivyManager.prototype.linkTwitter = function () {
    const performLink = () => {
        console.log('PrivyManager: Starting Twitter link process...');
        this._pendingNonce = generateNonce();
        const linkUrl = this.buildPrivyUrl({ action: 'linkTwitter', nonce: this._pendingNonce });
        return this.openPrivyWindow(linkUrl, 'privy-link-twitter');
    };

    if (!this.ready) {
        this.queueWhenReady(performLink, 'linkTwitter');
        return null;
    }

    return performLink();
};

PrivyManager.prototype.isAuthenticated = function () {
    return this.authenticated;
};

PrivyManager.prototype.getUser = function () {
    return this.user;
};

PrivyManager.prototype.sendTransaction = function (serializedBase64Tx, options) {
    if (!this.ready) {
        return Promise.reject(new Error('PrivyManager: Cannot send transaction before Privy is ready.'));
    }

    if (!serializedBase64Tx || typeof serializedBase64Tx !== 'string') {
        return Promise.reject(new Error('PrivyManager: Invalid transaction payload.'));
    }

    const chainOption = options && typeof options.chain === 'string' && options.chain.length > 0
        ? options.chain
        : this.defaultTransactionChain;

    return new Promise((resolve, reject) => {
        const requestId = `tx-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        const timeoutId = window.setTimeout(() => {
            if (!this.transactionPromises.has(requestId)) {
                return;
            }
            this.transactionPromises.delete(requestId);
            reject(this.normalizeError(null, 'Transaction approval timed out.'));
        }, this.transactionTimeoutMs);

        const handlers = {
            resolve: (value) => {
                window.clearTimeout(timeoutId);
                resolve(value);
            },
            reject: (error) => {
                window.clearTimeout(timeoutId);
                reject(this.normalizeError(error, 'Transaction failed.'));
            },
            windowRef: null,
            context: options && options.context ? options.context : null
        };

        this.transactionPromises.set(requestId, handlers);

        this._pendingNonce = generateNonce();

        const params = {
            action: 'sendTransaction',
            requestId: requestId,
            serializedBase64Tx: serializedBase64Tx,
            nonce: this._pendingNonce
        };

        if (chainOption) {
            params.chain = chainOption;
        }

        const transactionUrl = this.buildPrivyUrl(params);
        const popup = this.openPrivyWindow(transactionUrl, 'privy-tx');

        if (!popup) {
            this.transactionPromises.delete(requestId);
            window.clearTimeout(timeoutId);
            reject(this.normalizeError(new Error('PrivyManager: Popup blocked. Please enable popups for this site.'), 'Popup blocked.'));
        }
    });
};

PrivyManager.prototype.getWalletAddress = function () {
    if (!this.user) {
        return null;
    }

    if (this.user.wallet && this.user.wallet.address) {
        return this.user.wallet.address;
    }

    if (Array.isArray(this.user.linkedAccounts)) {
        const walletAccount = this.user.linkedAccounts.find((acc) => acc.type === 'wallet' && acc.address);
        if (walletAccount) {
            return walletAccount.address;
        }
    }

    return null;
};

PrivyManager.prototype.getPrivyDid = function () {
    return this.privyDid;
};

PrivyManager.prototype.getLatestPrivyToken = function () {
    if (typeof this.latestPrivyAccessToken === 'string' && this.latestPrivyAccessToken.length > 20) {
        return this.latestPrivyAccessToken;
    }
    return null;
};


PrivyManager.prototype.getTwitterHandle = function () {
    return this.twitterHandle;
};

PrivyManager.prototype.getTwitterUserId = function () {
    return this.twitterUserId;
};

PrivyManager.prototype.normalizeTwitterHandle = function (handle) {
    if (!handle || typeof handle !== "string") {
        return null;
    }
    var trimmed = handle.trim().replace(/^@+/, '');
    if (!trimmed.length || trimmed.length > 15) {
        return null;
    }
    if (!/^[_A-Za-z0-9]+$/.test(trimmed)) {
        return null;
    }
    return trimmed;
};

PrivyManager.prototype.extractTwitterIdentity = function (user) {
    if (!user || typeof user !== "object") {
        return null;
    }
    var accounts = Array.isArray(user.linkedAccounts) ? user.linkedAccounts : [];
    for (var i = 0; i < accounts.length; i += 1) {
        var account = accounts[i];
        if (!account) {
            continue;
        }
        var type = account.type || account.kind || '';
        var provider = account.provider || account.name || '';
        var isTwitter = type === 'twitter_oauth' || type === 'oauth_twitter' || type === 'twitter' || (type === 'oauth' && provider === 'twitter') || provider === 'twitter';
        if (!isTwitter) {
            continue;
        }
        var profile = account.profile || {};
        var handleCandidate = profile.handle || profile.username || account.username || account.screenName || account.handle || null;
        var normalizedHandle = this.normalizeTwitterHandle(handleCandidate);
        if (!normalizedHandle) {
            continue;
        }
        var userIdCandidate = profile.id || profile.userId || profile.user_id || account.subject || account.id || null;
        var normalizedUserId = userIdCandidate != null ? String(userIdCandidate) : null;
        return { handle: normalizedHandle, userId: normalizedUserId };
    }
    return null;
};

PrivyManager.prototype.refreshTwitterIdentity = function (user) {
    var identity = this.extractTwitterIdentity(user);
    if (identity) {
        this.twitterHandle = identity.handle;
        this.twitterUserId = identity.userId || '';
    } else {
        this.twitterHandle = null;
        this.twitterUserId = null;
    }
    return identity;
};

