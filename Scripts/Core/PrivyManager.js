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

const PRIVY_BRIDGE_DEFINED_EVENT = 'pg:privy:bridge:defined';
const PRIVY_BRIDGE_READY_EVENT = 'pg:privy:bridge:ready';

PrivyManager.prototype.initialize = function () {
    this.user = null;
    this.authenticated = false;
    this.ready = false;
    this._pendingNonce = null;
    this.loginTimeoutMs = 30000;
    this._loginState = 'idle';
    this._loginTimeoutHandle = null;
    this._popupWindowRef = null;
    this._popupCheckInterval = null;
    this._popupCheckIntervalMs = 1000;

    this.twitterHandle = null;
    this.twitterUserId = null;
    this.privyDid = null;

    this.privyHostOrigin = null;
    this.configLoader = null;
    this.defaultTransactionChain = 'solana:mainnet';
    this.integrationMode = 'popup';
    this.inlinePrivyReady = false;
    this.inlinePrivyInitPromise = null;
    this.inlinePrivyUnsubscribe = null;
    this.inlinePrivyConfig = null;
    this.latestAuthSnapshotSignature = null;
    this._lastOAuthOpenedWithoutHandle = false;
    this._lastPopupOpenedWithoutHandle = false;
    this._lastManualLogoutAt = 0;

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

    const integrationMode = this.resolveIntegrationMode(configLoader);
    if (integrationMode === 'inline') {
        const fallbackHostValue = typeof configLoader.get === 'function' ? configLoader.get('privyHostOrigin') : null;
        const fallbackHostOrigin = this.resolvePrivyOrigin(fallbackHostValue);
        if (fallbackHostOrigin) {
            this.privyHostOrigin = fallbackHostOrigin;
            if (!this.messageListenerAttached) {
                window.addEventListener('message', this.handleAuthMessage);
                this.messageListenerAttached = true;
            }
        }
    }

    if (integrationMode === 'inline') {
        this.integrationMode = 'inline';
        this.initializeInlinePrivy(configLoader)
            .catch((error) => {
                console.error('PrivyManager: Inline Privy initialization failed. Falling back to popup host app.', error);
                this.integrationMode = 'popup';
                this.initializePopupPrivy(configLoader);
            });
        return;
    }

    this.integrationMode = 'popup';
    this.initializePopupPrivy(configLoader);
};

PrivyManager.prototype.initializePopupPrivy = function (configLoader) {
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

PrivyManager.prototype.resolveIntegrationMode = function (configLoader) {
    if (!configLoader || typeof configLoader.get !== 'function') {
        return 'popup';
    }

    const explicitMode = configLoader.get('privyIntegrationMode');
    if (typeof explicitMode === 'string' && explicitMode.trim().length) {
        const normalized = explicitMode.trim().toLowerCase();
        if (normalized === 'inline' || normalized === 'embedded') {
            return 'inline';
        }
        if (normalized === 'popup' || normalized === 'host') {
            return 'popup';
        }
    }

    const useInline = configLoader.get('useInlinePrivy');
    if (useInline === true) {
        return 'inline';
    }

    const usePopup = configLoader.get('usePrivyHostPopup');
    if (usePopup === true) {
        return 'popup';
    }

    const configuredAppId = configLoader.get('privyAppId');
    if (typeof configuredAppId === 'string' && configuredAppId.trim().length > 0) {
        return 'inline';
    }

    return 'popup';
};

PrivyManager.prototype.buildInlinePrivyOptions = function (configLoader) {
    if (!configLoader || typeof configLoader.get !== 'function') {
        return null;
    }

    const appId = configLoader.get('privyAppId');
    if (typeof appId !== 'string' || !appId.trim().length) {
        console.warn('PrivyManager: buildInlinePrivyOptions missing privyAppId. Inline Privy requires configuration.');
        return null;
    }

    const options = {
        appId: appId.trim(),
        defaultChain: this.defaultTransactionChain || 'solana:mainnet'
    };

    const loginMethods = configLoader.get('privyLoginMethods');
    if (Array.isArray(loginMethods) && loginMethods.length) {
        options.loginMethods = loginMethods;
    }

    const appearance = configLoader.get('privyAppearance');
    if (appearance && typeof appearance === 'object') {
        options.appearance = appearance;
    }

    const embeddedWallets = configLoader.get('privyEmbeddedWallets');
    if (embeddedWallets && typeof embeddedWallets === 'object') {
        options.embeddedWallets = embeddedWallets;
    }

    const externalWallets = configLoader.get('privyExternalWallets');
    if (externalWallets && typeof externalWallets === 'object') {
        options.externalWallets = externalWallets;
    }

    options.solanaRpcProxyUrl = configLoader.get('privySolanaRpcProxyUrl') || configLoader.get('heliusRpcUrl') || null;
    options.solanaMainnetRpcUrl = configLoader.get('privySolanaMainnetRpcUrl') || null;
    options.solanaMainnetWsUrl = configLoader.get('privySolanaMainnetWsUrl') || null;
    options.solanaWsUrl = configLoader.get('privySolanaWsUrl') || null;
    options.solanaDevnetRpcUrl = configLoader.get('privySolanaDevnetRpcUrl') || null;
    options.solanaDevnetWsUrl = configLoader.get('privySolanaDevnetWsUrl') || null;

    const hostOrigin = configLoader.get('privyHostOrigin');
    if (typeof hostOrigin === 'string' && hostOrigin.trim().length) {
        options.privyHostOrigin = hostOrigin.trim();
    }

    const oauthProviders = configLoader.get('privyOauthProviders');
    if (Array.isArray(oauthProviders) && oauthProviders.length) {
        options.oauthProviders = oauthProviders.map((provider) => String(provider || '').toLowerCase()).filter(Boolean);
    }

    const explicitBridgeUrl = configLoader.get('privyOauthBridgeUrl');
    const bridgePath = configLoader.get('privyOauthBridgePath');
    if (typeof explicitBridgeUrl === 'string' && explicitBridgeUrl.trim().length) {
        options.oauthBridgeUrl = explicitBridgeUrl.trim();
    } else if (options.privyHostOrigin) {
        const normalizedOrigin = options.privyHostOrigin.replace(/\/+$/, '');
        if (typeof bridgePath === 'string' && bridgePath.trim().length) {
            const normalizedPath = bridgePath.startsWith('/') ? bridgePath : `/${bridgePath}`;
            options.oauthBridgeUrl = `${normalizedOrigin}${normalizedPath}`;
        } else {
            options.oauthBridgeUrl = `${normalizedOrigin}/oauth-bridge`;
        }
    } else {
        options.oauthBridgeUrl = null;
    }

    return options;
};

PrivyManager.prototype.waitForPrivyBridge = function (timeoutMs) {
    if (typeof window === 'undefined') {
        return Promise.reject(new Error('PrivyManager: window unavailable while waiting for PG_PRIVY.'));
    }

    const maxMs = typeof timeoutMs === 'number' && timeoutMs >= 0 ? timeoutMs : 5000;
    return new Promise((resolve, reject) => {
        let settled = false;
        let pollInterval = null;
        let timeoutHandle = null;
        const doc = typeof document !== 'undefined' ? document : null;
        let bridgeEventHandler = null;

        const cleanup = () => {
            settled = true;
            if (doc && bridgeEventHandler) {
                doc.removeEventListener(PRIVY_BRIDGE_DEFINED_EVENT, bridgeEventHandler, false);
                doc.removeEventListener(PRIVY_BRIDGE_READY_EVENT, bridgeEventHandler, false);
            }
            if (pollInterval) {
                window.clearInterval(pollInterval);
            }
            if (timeoutHandle) {
                window.clearTimeout(timeoutHandle);
            }
        };

        const succeed = (bridge) => {
            if (settled) {
                return;
            }
            cleanup();
            resolve(bridge);
        };

        const attemptResolve = () => {
            if (settled) {
                return;
            }
            if (window.PG_PRIVY && typeof window.PG_PRIVY.initialize === 'function') {
                succeed(window.PG_PRIVY);
            }
        };

        bridgeEventHandler = () => {
            window.setTimeout(attemptResolve, 0);
        };

        if (doc && bridgeEventHandler) {
            doc.addEventListener(PRIVY_BRIDGE_DEFINED_EVENT, bridgeEventHandler, false);
            doc.addEventListener(PRIVY_BRIDGE_READY_EVENT, bridgeEventHandler, false);
        }

        pollInterval = window.setInterval(attemptResolve, 100);
        timeoutHandle = window.setTimeout(() => {
            if (!settled) {
                cleanup();
                reject(new Error('PrivyManager: PG_PRIVY bridge unavailable.'));
            }
        }, maxMs);

        attemptResolve();
    });
};

PrivyManager.prototype.initializeInlinePrivy = function (configLoader) {
    if (this.inlinePrivyInitPromise) {
        return this.inlinePrivyInitPromise;
    }

    const options = this.buildInlinePrivyOptions(configLoader);
    if (!options) {
        return Promise.reject(new Error('PrivyManager: Inline Privy configuration missing privyAppId.'));
    }

    this.inlinePrivyConfig = options;

    const initPromise = this.waitForPrivyBridge(7000)
        .then((bridge) => bridge.initialize(options))
        .then(() => {
            this.inlinePrivyReady = true;
            this.ready = true;
            this.attachInlineEventListeners();
            const getStatePromise = (window.PG_PRIVY && typeof window.PG_PRIVY.getAuthState === 'function')
                ? window.PG_PRIVY.getAuthState()
                : Promise.resolve(null);
            return getStatePromise
                .then((snapshot) => {
                    if (snapshot) {
                        this.handleInlineSnapshot(snapshot);
                    }
                    this.flushPendingReadyCallbacks();
                    return snapshot;
                })
                .catch((error) => {
                    console.warn('PrivyManager: Failed to fetch initial inline Privy state.', error);
                    this.flushPendingReadyCallbacks();
                    return null;
                });
        })
        .catch((error) => {
            this.inlinePrivyReady = false;
            this.inlinePrivyInitPromise = null;
            throw error;
        });

    this.inlinePrivyInitPromise = initPromise;
    return initPromise;
};

PrivyManager.prototype.attachInlineEventListeners = function () {
    if (typeof window === 'undefined' || !window.PG_PRIVY || typeof window.PG_PRIVY.on !== 'function') {
        console.warn('PrivyManager: PG_PRIVY bridge not ready for event subscription.');
        return;
    }

    if (typeof this.inlinePrivyUnsubscribe === 'function') {
        try {
            this.inlinePrivyUnsubscribe();
        } catch (error) {
            console.warn('PrivyManager: Failed to clear previous inline Privy subscription.', error);
        }
        this.inlinePrivyUnsubscribe = null;
    }

    const offAuth = window.PG_PRIVY.on('auth:stateChanged', (snapshot) => {
        this.handleInlineSnapshot(snapshot);
    });

    this.inlinePrivyUnsubscribe = function () {
        if (typeof offAuth === 'function') {
            offAuth();
        }
    };
};

PrivyManager.prototype.ensureInlineReady = function () {
    if (this.inlinePrivyReady && !this.inlinePrivyInitPromise) {
        return Promise.resolve();
    }
    if (this.inlinePrivyReady && this.inlinePrivyInitPromise) {
        return this.inlinePrivyInitPromise;
    }

    const loader = this.configLoader || this.tryGetConfigLoader();
    if (!this.inlinePrivyInitPromise && loader) {
        this.initializeInlinePrivy(loader);
    }

    if (this.inlinePrivyInitPromise) {
        return this.inlinePrivyInitPromise;
    }

    return Promise.reject(new Error('PrivyManager: Inline Privy is not initialized yet.'));
};

PrivyManager.prototype.handleInlineSnapshot = function (snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return;
    }

    const authenticated = Boolean(snapshot.authenticated);
    const user = authenticated ? snapshot.user || null : null;
    const accessToken = authenticated ? (snapshot.accessToken || null) : null;

    const signatureParts = [
        authenticated ? 'auth' : 'anon',
        user && typeof user.id === 'string' ? user.id : 'no-user',
        accessToken ? accessToken.substring(0, 12) : 'no-token'
    ];
    const signature = signatureParts.join(':');

    if (this.latestAuthSnapshotSignature === signature) {
        return;
    }
    this.latestAuthSnapshotSignature = signature;

    if (authenticated && user) {
        this.handleAuthSuccess({
            user: user,
            accessToken: accessToken
        });
    } else if (!authenticated && this.authenticated) {
        this.handleAuthLogout();
    }
};

PrivyManager.prototype.onConfigLoaded = function () {
    if (this.integrationMode === 'inline') {
        return;
    }
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
    this._setLoginState('idle');
    this._stopPopupMonitor();

    if (typeof this.inlinePrivyUnsubscribe === 'function') {
        try {
            this.inlinePrivyUnsubscribe();
        } catch (error) {
            console.warn('PrivyManager: Failed to unsubscribe inline Privy listener during destroy.', error);
        }
        this.inlinePrivyUnsubscribe = null;
    }
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

PrivyManager.prototype._stopPopupMonitor = function () {
    if (this._popupCheckInterval) {
        window.clearInterval(this._popupCheckInterval);
        this._popupCheckInterval = null;
    }
    this._popupWindowRef = null;
};

PrivyManager.prototype._startPopupMonitor = function (popup) {
    this._stopPopupMonitor();
    if (!popup) {
        return;
    }
    this._popupWindowRef = popup;
    var checkIntervalMs = typeof this._popupCheckIntervalMs === 'number' && this._popupCheckIntervalMs > 0
        ? this._popupCheckIntervalMs
        : 1000;
    this._popupCheckInterval = window.setInterval(() => {
        if (this._popupWindowRef && this._popupWindowRef.closed) {
            console.log('PrivyManager: Popup closed by user. Transitioning to failed state.');
            this._handlePopupClosure();
        }
    }, checkIntervalMs);
};

PrivyManager.prototype._handlePopupClosure = function () {
    this._stopPopupMonitor();
    if (this._loginState === 'pending') {
        console.log('PrivyManager: User cancelled login. Can retry immediately.');
        this._loginState = 'failed';
        this._pendingNonce = null;
        if (this._loginTimeoutHandle) {
            window.clearTimeout(this._loginTimeoutHandle);
            this._loginTimeoutHandle = null;
        }
    }
};

PrivyManager.prototype._setLoginState = function (state) {
    if (this._loginState === state) {
        return;
    }
    console.log('PrivyManager: Login state transition:', { from: this._loginState, to: state });
    
    if (state === 'idle') {
        this._loginState = 'idle';
        if (this._loginTimeoutHandle) {
            window.clearTimeout(this._loginTimeoutHandle);
            this._loginTimeoutHandle = null;
        }
        this._stopPopupMonitor();
        this._pendingNonce = null;
    } else if (state === 'pending') {
        this._loginState = 'pending';
        if (this._loginTimeoutHandle) {
            window.clearTimeout(this._loginTimeoutHandle);
        }
        var timeout = typeof this.loginTimeoutMs === 'number' && this.loginTimeoutMs > 0
            ? this.loginTimeoutMs
            : 30000;
        this._loginTimeoutHandle = window.setTimeout(() => {
            console.warn('PrivyManager: Login attempt timed out. Transitioning to failed state.');
            this._loginState = 'failed';
            this._loginTimeoutHandle = null;
            this._stopPopupMonitor();
        }, timeout);
    } else if (state === 'failed') {
        this._loginState = 'failed';
        if (this._loginTimeoutHandle) {
            window.clearTimeout(this._loginTimeoutHandle);
            this._loginTimeoutHandle = null;
        }
        this._stopPopupMonitor();
    }
};

PrivyManager.prototype.isLoginInProgress = function () {
    return this._loginState === 'pending';
};

PrivyManager.prototype.canRetryLogin = function () {
    return this._loginState === 'idle' || this._loginState === 'failed';
};

PrivyManager.prototype.handleAuthMessage = function (event) {
    if (this.integrationMode !== 'popup') {
        return;
    }
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
            this._setLoginState('idle');
            if (payload && typeof payload.user === 'object') {
                this.handleAuthSuccess(payload);
            } else {
                console.warn('PrivyManager: Auth success payload missing user data.');
            }
            break;
        case 'PRIVY_AUTH_LOGOUT':
            this._setLoginState('idle');
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
        case 'PRIVY_USERPILL_ACTION':
            console.log('PrivyManager: UserPill action received', payload);
            this.app.fire('privy:userPillAction', { actionType: payload.actionType, data: payload.data });
            break;
        default:
            if (typeof type === 'string' && type.indexOf('PRIVY_AUTH_') === 0) {
                this._setLoginState('idle');
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

    this._setLoginState('idle');

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

    this._setLoginState('idle');
    this.latestAuthSnapshotSignature = null;

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
    if (this.integrationMode === 'inline') {
        if (typeof window !== 'undefined' && window.PG_PRIVY && typeof window.PG_PRIVY.getAuthState === 'function') {
            window.PG_PRIVY.getAuthState()
                .then((snapshot) => {
                    if (snapshot && snapshot.authenticated && snapshot.user) {
                        this.handleInlineSnapshot(snapshot);
                    } else {
                        this.restoreUserSessionFromStorage();
                    }
                })
                .catch((error) => {
                    console.warn('PrivyManager: Failed to restore inline session from Privy bridge.', error);
                    this.restoreUserSessionFromStorage();
                });
            return;
        }
        console.warn('PrivyManager: Inline Privy bridge not ready during session restore, falling back to stored session.');
    }
    this.restoreUserSessionFromStorage();
};

PrivyManager.prototype.restoreUserSessionFromStorage = function () {
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
            this.latestAuthSnapshotSignature = null;
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
    const self = this;

    const resolveAccessToken = function () {
        const directToken = self.extractPrivyAccessToken(payload);
        if (directToken) {
            return Promise.resolve(directToken);
        }

        if (self.integrationMode === 'inline' && typeof window !== 'undefined' && window.PG_PRIVY && typeof window.PG_PRIVY.getAuthState === 'function') {
            return window.PG_PRIVY.getAuthState()
                .then(function (snapshot) {
                    if (snapshot && snapshot.accessToken) {
                        return snapshot.accessToken;
                    }
                    return null;
                })
                .catch(function (error) {
                    console.warn('PrivyManager: Failed to fetch inline access token snapshot.', error);
                    return null;
                });
        }

        return Promise.resolve(null);
    };

    if (this._gameTokenExchangePromise) {
        return this._gameTokenExchangePromise;
    }

    this._gameTokenExchangePromise = resolveAccessToken()
        .then(function (accessToken) {
            if (!accessToken) {
                console.warn('PrivyManager: No Privy access token available. Skipping game token exchange.');
                return null;
            }

            self.latestPrivyAccessToken = accessToken;
            const url = self.resolveApiUrl('/auth/exchange-privy');

            return fetch(url, {
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
                });
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
    return this.openPrivyWindowWithOptions(url, name, null);
};

PrivyManager.prototype.openPrivyOAuthWindow = function (url, name) {
    return this.openPrivyOAuthWindowWithOptions(url, name, null);
};

PrivyManager.prototype._canUsePopupHost = function () {
    return Boolean(this.privyHostOrigin);
};

PrivyManager.prototype._preOpenWindow = function (name, options) {
    const features = (options && typeof options.features === 'string' && options.features.length)
        ? options.features
        : this.popupFeatures;
    let popup = null;
    try {
        popup = window.open('about:blank', name || '_blank', features);
    } catch (error) {
        console.warn('PrivyManager: Failed to pre-open window.', error);
        popup = null;
    }

    if (!popup) {
        try {
            popup = window.open('about:blank', '_blank', 'noopener=yes,noreferrer=yes');
        } catch (error) {
            console.warn('PrivyManager: Secondary pre-open attempt failed.', error);
        }
    }

    if (!popup) {
        return null;
    }

    try {
        if (popup.document && popup.document.body) {
            if (!popup.document.body.children.length) {
                const placeholder = popup.document.createElement('div');
                placeholder.textContent = (options && options.placeholderText) || 'Preparing authentication...';
                placeholder.style.fontFamily = 'sans-serif';
                placeholder.style.fontSize = '14px';
                placeholder.style.padding = '16px';
                popup.document.body.appendChild(placeholder);
            }
        }
    } catch (error) {
        console.debug('PrivyManager: Unable to update pre-opened window placeholder.', error);
    }

    if (typeof popup.focus === 'function') {
        try {
            popup.focus();
        } catch (error) {
            console.debug('PrivyManager: Failed to focus pre-opened window.', error);
        }
    }

    return popup;
};

PrivyManager.prototype.openPrivyWindowWithOptions = function (url, name, existingWindow) {
    this._lastPopupOpenedWithoutHandle = false;
    let popup = null;
    if (existingWindow && !existingWindow.closed) {
        try {
            existingWindow.location.href = url;
            popup = existingWindow;
        } catch (error) {
            console.warn('PrivyManager: Failed to reuse pre-opened window.', error);
            try {
                existingWindow.close();
            } catch (closeError) {
                console.debug('PrivyManager: Failed to close stale pre-opened window.', closeError);
            }
            popup = null;
        }
    }

    if (!popup) {
        try {
            popup = window.open(url, name, this.popupFeatures);
        } catch (error) {
            console.warn('PrivyManager: Failed to open window with configured features.', error);
            popup = null;
        }
    }

    if (!popup) {
        try {
            popup = window.open(url, '_blank', 'noopener=yes,noreferrer=yes');
        } catch (error) {
            console.warn('PrivyManager: Failed to open fallback tab for', name || 'privy', error);
        }
    }

    if (!popup && typeof document !== 'undefined' && document.body) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.dataset.privyPopup = name || 'privy';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        this._lastPopupOpenedWithoutHandle = true;
        console.log(`PrivyManager: ${name || 'Privy'} flow opened in a new browser tab.`);
    }

    if (!popup && !this._lastPopupOpenedWithoutHandle) {
        console.error(`PrivyManager: Failed to open ${name || 'privy'} window. Popup may be blocked.`);
        return null;
    }

    if (typeof popup.focus === 'function') {
        try {
            popup.focus();
        } catch (error) {
            console.debug('PrivyManager: Failed to focus popup window.', error);
        }
    }

    return popup;
};

PrivyManager.prototype.openPrivyOAuthWindowWithOptions = function (url, name, existingWindow) {
    this._lastOAuthOpenedWithoutHandle = false;
    let popup = null;

    if (existingWindow && !existingWindow.closed) {
        try {
            existingWindow.location.href = url;
            popup = existingWindow;
        } catch (error) {
            console.warn('PrivyManager: Failed to reuse pre-opened OAuth window.', error);
            try {
                existingWindow.close();
            } catch (closeError) {
                console.debug('PrivyManager: Failed to close stale OAuth window.', closeError);
            }
            popup = null;
        }
    }

    if (!popup) {
        try {
            popup = window.open(url, name || 'privy-oauth', this.popupFeatures);
        } catch (error) {
            console.warn('PrivyManager: Failed opening OAuth popup with configured features.', error);
        }
    }

    if (!popup) {
        try {
            popup = window.open(url, '_blank', 'noopener=yes,noreferrer=yes');
        } catch (error) {
            console.warn('PrivyManager: Failed opening OAuth window in new tab.', error);
        }
    }

    if (!popup && typeof document !== 'undefined' && document.body) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.dataset.privyOauth = 'true';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        this._lastOAuthOpenedWithoutHandle = true;
        console.log('PrivyManager: OAuth flow opened in a new browser tab.');
    }

    if (popup && typeof popup.focus === 'function') {
        popup.focus();
    }
    return popup;
};

PrivyManager.prototype.login = function (options) {
    if (this.integrationMode === 'inline') {
        return this.loginInline(options);
    }
    const canUsePopup = this._canUsePopupHost();
    if (!canUsePopup) {
        console.warn('PrivyManager: privyHostOrigin is missing; cannot open login popup.');
        return null;
    }

    const force = Boolean(options && options.force);

    if (this.authenticated && !force) {
        console.log('PrivyManager: Login skipped; user already authenticated.');
        return null;
    }

    if (!this.canRetryLogin()) {
        console.log('PrivyManager: Login already in progress. Cannot initiate new login.');
        return null;
    }

    this._setLoginState('pending');
    const preOpenedPopup = !this.ready
        ? this._preOpenWindow('privy-auth', { placeholderText: 'Opening Privy login...' })
        : null;

    const performLogin = (preOpenedHandle) => {
        console.log('PrivyManager: Starting login process...');
        this._pendingNonce = generateNonce();
        const params = { action: 'login', nonce: this._pendingNonce };
        if (force) {
            params.force = 'true';
        }
        const loginUrl = this.buildPrivyUrl(params);
        const popup = this.openPrivyWindowWithOptions(
            loginUrl,
            'privy-auth',
            preOpenedHandle && !preOpenedHandle.closed ? preOpenedHandle : null
        );
        if (!popup && !this._lastPopupOpenedWithoutHandle) {
            console.error('PrivyManager: Failed to open login popup.');
            this._setLoginState('failed');
        } else if (popup) {
            this._startPopupMonitor(popup);
        }
        return popup;
    };

    if (!this.ready) {
        this.queueWhenReady(() => {
            try {
                const popup = performLogin(preOpenedPopup && !preOpenedPopup.closed ? preOpenedPopup : null);
            } catch (error) {
                this._setLoginState('failed');
                console.error('PrivyManager: Deferred login failed.', error);
            }
        }, 'login');
        return preOpenedPopup || null;
    }

    try {
        const popup = performLogin(preOpenedPopup && !preOpenedPopup.closed ? preOpenedPopup : null);
        return popup;
    } catch (error) {
        this._setLoginState('failed');
        console.error('PrivyManager: Login popup error.', error);
        throw error;
    }
};

PrivyManager.prototype.logout = function () {
    this._lastManualLogoutAt = Date.now();
    this.app.fire('auth:manualLogout', { timestamp: this._lastManualLogoutAt });

    if (this.integrationMode === 'inline') {
        return this.logoutInline();
    }
    const canUsePopup = this._canUsePopupHost();
    if (!canUsePopup) {
        console.warn('PrivyManager: privyHostOrigin missing; cannot perform popup logout.');
        return null;
    }

    const preOpenedPopup = !this.ready
        ? this._preOpenWindow('privy-logout', { placeholderText: 'Signing out...' })
        : null;

    const performLogout = (preOpenedHandle) => {
        console.log('PrivyManager: Starting logout process...');

        this._pendingNonce = generateNonce();
        const logoutUrl = this.buildPrivyUrl({ action: 'logout', nonce: this._pendingNonce });
        return this.openPrivyWindowWithOptions(
            logoutUrl,
            'privy-logout',
            preOpenedHandle && !preOpenedHandle.closed ? preOpenedHandle : null
        );
    };

    if (!this.ready) {
        this.queueWhenReady(() => {
            const popup = performLogout(preOpenedPopup && !preOpenedPopup.closed ? preOpenedPopup : null);
        }, 'logout');
        return preOpenedPopup || null;
    }

    const popup = performLogout(preOpenedPopup && !preOpenedPopup.closed ? preOpenedPopup : null);
    return popup;
};

PrivyManager.prototype.openUserPill = function () {
    if (this.integrationMode === 'inline') {
        return this.openUserPillInline();
    }
    const performOpenUserPill = () => {
        console.log('PrivyManager: Opening UserPill...');
        this._pendingNonce = generateNonce();
        const userPillUrl = this.buildPrivyUrl({ action: 'user-pill', nonce: this._pendingNonce });
        return this.openPrivyWindow(userPillUrl, 'privy-userpill');
    };

    if (!this.ready) {
        this.queueWhenReady(performOpenUserPill, 'openUserPill');
        return null;
    }

    return performOpenUserPill();
};

PrivyManager.prototype.linkTwitter = function () {
    const preferInline = this.integrationMode === 'inline';
    const canUsePopup = this._canUsePopupHost();
    if (preferInline && !canUsePopup) {
        return this.linkTwitterInline();
    }
    if (!canUsePopup) {
        console.warn('PrivyManager: privyHostOrigin missing; cannot open Twitter linking popup.');
        return null;
    }

    const preOpenedPopup = !this.ready
        ? this._preOpenWindow('privy-link-twitter', { placeholderText: 'Connecting to X...' })
        : null;

    const performLink = (preOpenedHandle) => {
        console.log('PrivyManager: Starting Twitter link process...');
        this._pendingNonce = generateNonce();
        const linkUrl = this.buildPrivyUrl({ action: 'linkTwitter', nonce: this._pendingNonce });
        return this.openPrivyOAuthWindowWithOptions(
            linkUrl,
            'privy-link-twitter',
            preOpenedHandle && !preOpenedHandle.closed ? preOpenedHandle : null
        );
    };

    const handleLinkFallback = () => {
        if (!preferInline) {
            console.error('PrivyManager: Failed to open Twitter linking popup.');
            return null;
        }
        console.warn('PrivyManager: Twitter popup blocked. Falling back to inline Privy flow.');
        return this.linkTwitterInline();
    };

    if (!this.ready) {
        this.queueWhenReady(() => {
            const popup = performLink(preOpenedPopup && !preOpenedPopup.closed ? preOpenedPopup : null);
            if (!popup && !this._lastOAuthOpenedWithoutHandle) {
                const fallbackResult = handleLinkFallback();
                if (fallbackResult && typeof fallbackResult.catch === 'function') {
                    fallbackResult.catch((error) => {
                        console.error('PrivyManager: Deferred inline Twitter link failed.', error);
                    });
                }
            }
        }, 'linkTwitter');
        return preOpenedPopup || null;
    }

    const popup = performLink(preOpenedPopup && !preOpenedPopup.closed ? preOpenedPopup : null);
    if (!popup && !this._lastOAuthOpenedWithoutHandle) {
        return handleLinkFallback();
    }
    return popup;
};

PrivyManager.prototype.isAuthenticated = function () {
    return this.authenticated;
};

PrivyManager.prototype.getUser = function () {
    return this.user;
};

PrivyManager.prototype.sendTransaction = function (serializedBase64Tx, options) {
    if (this.integrationMode === 'inline') {
        return this.sendTransactionInline(serializedBase64Tx, options);
    }
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

PrivyManager.prototype.loginInline = function (options) {
    const force = Boolean(options && options.force);
    return this.ensureInlineReady()
        .then(() => {
            this._setLoginState('pending');
            return window.PG_PRIVY.login({ force: force });
        })
        .then((snapshot) => {
            this._setLoginState('idle');
            return snapshot;
        })
        .catch((error) => {
            this._setLoginState('failed');
            throw this.normalizeError(error, 'Login failed.');
        });
};

PrivyManager.prototype.logoutInline = function () {
    return this.ensureInlineReady()
        .then(() => window.PG_PRIVY.logout())
        .then((snapshot) => {
            if (!snapshot || snapshot.authenticated === false) {
                if (this.authenticated) {
                    try {
                        this.handleAuthLogout();
                    } catch (error) {
                        console.warn('PrivyManager: Failed to finalize inline logout state.', error);
                    }
                }
            }
            return snapshot;
        })
        .catch((error) => {
            throw this.normalizeError(error, 'Logout failed.');
        });
};

PrivyManager.prototype.openUserPillInline = function () {
    return this.ensureInlineReady()
        .then(() => {
            if (window.PG_PRIVY && typeof window.PG_PRIVY.openUserPill === 'function') {
                window.PG_PRIVY.openUserPill();
            } else {
                console.warn('PrivyManager: PG_PRIVY.openUserPill is unavailable.');
            }
            return null;
        })
        .catch((error) => {
            console.error('PrivyManager: Failed to open inline UserPill.', error);
            return null;
        });
};

PrivyManager.prototype.linkTwitterInline = function () {
    const invokeInlineLink = () => this.ensureInlineReady()
        .then(() => window.PG_PRIVY.linkTwitter())
        .then((result) => result)
        .catch((error) => {
            this.app.fire('auth:linkFailed', { error: error instanceof Error ? error.message : String(error) });
            throw this.normalizeError(error, 'Failed to link Twitter account.');
        });

    const fallbackOrigin = this.privyHostOrigin;
    const preOpenedPopup = !this.ready
        ? this._preOpenWindow('privy-link-twitter', { placeholderText: 'Connecting to X...' })
        : null;
    const openPopupFlow = (preOpenedHandle) => {
        this._pendingNonce = generateNonce();
        const params = { action: 'linkTwitter', nonce: this._pendingNonce };
        let linkUrl = null;
        try {
            linkUrl = this.buildPrivyUrl(params);
        } catch (error) {
            console.warn('PrivyManager: Failed to build Privy link URL for popup flow. Falling back to inline flow.', error);
            return null;
        }
        const popup = this.openPrivyOAuthWindowWithOptions(
            linkUrl,
            'privy-link-twitter',
            preOpenedHandle && !preOpenedHandle.closed ? preOpenedHandle : null
        );
        return popup;
    };

    if (fallbackOrigin) {
        if (!this.ready) {
            this.queueWhenReady(() => {
                const popup = openPopupFlow(preOpenedPopup && !preOpenedPopup.closed ? preOpenedPopup : null);
                if (!popup && !this._lastOAuthOpenedWithoutHandle) {
                    invokeInlineLink().catch((error) => {
                        console.error('PrivyManager: Deferred inline Twitter link failed.', error);
                    });
                }
            }, 'linkTwitter');
            return preOpenedPopup || null;
        }
        const popup = openPopupFlow(null);
        if (popup || this._lastOAuthOpenedWithoutHandle) {
            return popup;
        }
        console.warn('PrivyManager: Twitter linking popup blocked. Falling back to inline Privy flow.');
        return invokeInlineLink();
    }

    return invokeInlineLink();
};

PrivyManager.prototype.sendTransactionInline = function (serializedBase64Tx, options) {
    if (!serializedBase64Tx || typeof serializedBase64Tx !== 'string') {
        return Promise.reject(new Error('PrivyManager: Invalid transaction payload.'));
    }

    const chainOption = options && typeof options.chain === 'string' && options.chain.length > 0
        ? options.chain
        : this.defaultTransactionChain;

    return this.ensureInlineReady()
        .then(() => window.PG_PRIVY.sendSolanaTransaction({
            transactionBase64: serializedBase64Tx,
            chain: chainOption
        }));
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

