// Scripts/Auth/PrivyService.js
var PrivyService = pc.createScript('privyService');

PrivyService.attributes.add('privyHostAsset', {
    type: 'asset',
    assetType: 'html',
    title: 'Privy Host HTML Asset',
    description: 'DEPRECATED: The HTML asset for the privy-host-app. This is no longer used.'
});

const PrivyAuthState = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    ERROR: 'error'
};

PrivyService.prototype.initialize = function() {
    console.log("PrivyService initializing...");
    this.state = PrivyAuthState.DISCONNECTED;
    this.popupWindow = null;
    this.walletAddress = null;
    this.user = null; // To store the full Privy user object
    this.accessToken = null; // We will fetch this on-demand
    const cfg = (this.app && this.app.config && typeof this.app.config.get === 'function') ? this.app.config.get() : null;
    const configuredOrigin = cfg && cfg.privyHostOrigin;
    
    const isDev = window.location.hostname === 'localhost' ||
                 window.location.hostname === '127.0.0.1' ||
                 window.location.hostname.includes('launch.playcanvas.com'); // PlayCanvas editor
    
    this.privyHostOrigin = configuredOrigin || (isDev
        ? 'https://localhost:5173'     // Vite dev server with HTTPS
        : 'https://privy.plsgive.com'); // Production deployment

    // Listen for messages from the popup
    window.addEventListener('message', this.handlePrivyMessage.bind(this));

    // Give iframe more time to initialize - no early popup fallback

    // Register with the global services registry
    if (this.app.services) {
        this.app.services.register('privyService', this);
        console.log("PrivyService: Registered with Services registry.");
    } else {
        console.warn("PrivyService: Services registry (app.services) not found.");
        // Fallback: attach to app directly
        this.app.privyService = this;
    }
};

PrivyService.prototype.handlePrivyMessage = function(event) {
    // ALWAYS validate the origin - use strict checking
    if (!this.privyHostOrigin || event.origin !== this.privyHostOrigin) {
        // Silently ignore messages from other origins, including the PlayCanvas editor
        return;
    }

    const data = event.data;
    if (!data || typeof data.type !== 'string') {
        return; // Ignore invalid messages
    }

    console.log("PrivyService: Received message from popup:", data.type, data.payload || '');

    switch (data.type) {
        case 'PRIVY_AUTH_SUCCESS':
            this.user = data.payload.user;
            this.walletAddress = data.payload.walletAddress;
            this.setState(PrivyAuthState.CONNECTED);
            this.app.fire('auth:userAvailable', this.user);
            this.hideLogin();
            break;
        case 'PRIVY_AUTH_LOGOUT':
            this.walletAddress = null;
            this.user = null;
            this.accessToken = null;
            this.setState(PrivyAuthState.DISCONNECTED);
            this.hideLogin(); // Hide the iframe on logout
            break;
        case 'PRIVY_AUTH_ERROR':
            console.error('PrivyService: Authentication error from popup:', data.payload.error);
            this.setState(PrivyAuthState.ERROR);
            this.hideLogin(); // Hide the iframe on error
            // Fire error event for UI feedback
            this.app.fire('auth:error', { error: data.payload.error });
            // Log embedding errors but don't fallback to popup
            try {
                const messageText = (data.payload && data.payload.error) ? String(data.payload.error).toLowerCase() : '';
                if (messageText.includes('frame ancestor is not allowed') || messageText.includes('x-frame-options') || messageText.includes('frame-ancestors')) {
                    console.warn('PrivyService: Detected frame-ancestor restriction. Check CSP settings.');
                }
            } catch (_) {}
            break;
    }
};

PrivyService.prototype.setState = function(newState) {
    if (this.state === newState) return;
    console.log(`PrivyService: State changing from ${this.state} to ${newState}`);
    this.state = newState;
    this.app.fire('auth:stateChanged', { state: this.state, address: this.walletAddress, error: null });
};


// --- Public API ---

// Default: open unified Privy modal inside game overlay (iframe)
// Generic login method that shows the Privy modal.
// Can optionally specify a provider like 'twitter'.
PrivyService.prototype.login = function() {
    console.log(`PrivyService: Opening Privy modal in popup.`);
    const popupUrl = new URL(this.privyHostOrigin);
    popupUrl.searchParams.set('popup', 'true');

    // Center the popup on the screen
    const popupWidth = 400;
    const popupHeight = 650;
    const left = (screen.width / 2) - (popupWidth / 2);
    const top = (screen.height / 2) - (popupHeight / 2);

    this.popupWindow = window.open(popupUrl.toString(), 'PrivyLogin', `width=${popupWidth},height=${popupHeight},left=${left},top=${top}`);
    
    this.setState(PrivyAuthState.CONNECTING);

    if (this.popupWindow) {
        const checkPopupClosed = setInterval(() => {
            if (this.popupWindow && this.popupWindow.closed) {
                clearInterval(checkPopupClosed);
                if (this.state === PrivyAuthState.CONNECTING) {
                    console.log('PrivyService: Popup closed by user.');
                    this.forceHide();
                }
            }
        }, 500);
    }
};

PrivyService.prototype.hideLogin = function() {
    if (this.popupWindow && !this.popupWindow.closed) {
        this.popupWindow.close();
        this.popupWindow = null;
    }
};

PrivyService.prototype.forceHide = function() {
    console.log("PrivyService: Force hiding login popup");
    this.hideLogin();
    // Reset state if we're in connecting state
    if (this.state === PrivyAuthState.CONNECTING) {
        this.setState(PrivyAuthState.DISCONNECTED);
    }
};

PrivyService.prototype.logout = function() {
    // Allow logout via popup as well
    console.log("PrivyService: Requesting logout from popup...");
    // Ensure network connection persists; request the next disconnect (if any) to auto-reconnect
    this.app.fire('network:preventNextDisconnect');
    this.setState(PrivyAuthState.DISCONNECTED);
    // We can't post a message to a closed popup, so we just reset the state
    this.walletAddress = null;
    this.user = null;
    this.accessToken = null;
    this.setState(PrivyAuthState.DISCONNECTED);
};

PrivyService.prototype.signTransaction = function(transaction) {
    return new Promise((resolve, reject) => {
        if (!this.isAuthenticated()) {
            return reject(new Error("PrivyService: User is not authenticated. Cannot sign transaction."));
        }

        // Generate a unique ID for this transaction request
        const txRequestId = `tx-${Date.now()}-${Math.random()}`;

        // Set a timeout for the signing request
        const timeout = setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            reject(new Error("Transaction signing request timed out."));
        }, 30000); // 30 second timeout for transaction signing

        const messageHandler = (event) => {
            const data = event.data;
            if (data.type === 'PRIVY_SIGN_SUCCESS' && data.txRequestId === txRequestId) {
                clearTimeout(timeout);
                window.removeEventListener('message', messageHandler);
                try {
                    // The payload should be the serialized, signed transaction bytes
                    const signedTx = window.SolanaSDK.web3.Transaction.from(data.payload.signedTransaction);
                    resolve(signedTx);
                } catch (parseError) {
                    reject(new Error("Failed to parse signed transaction: " + parseError.message));
                }
            } else if (data.type === 'PRIVY_SIGN_ERROR' && data.txRequestId === txRequestId) {
                clearTimeout(timeout);
                window.removeEventListener('message', messageHandler);
                reject(new Error(data.payload.error || "Transaction signing failed."));
            }
        };

        window.addEventListener('message', messageHandler);

        console.log("PrivyService: Requesting transaction sign from popup...");
        // Serialize the transaction to send it over postMessage
        const serializedTx = transaction.serialize({ requireAllSignatures: false });

        // This logic would need to be adapted if signing is required,
        // as it would need to open a popup and communicate with it.
        // For now, we will reject as this is not part of the current scope.
        return reject(new Error("PrivyService: Signing via popup not yet implemented."));
    });
};

PrivyService.prototype.getAccessToken = function() {
    return new Promise((resolve, reject) => {
        // This logic would also need to be adapted for a popup flow.
        return reject(new Error("PrivyService: Getting access token via popup not yet implemented."));

        if (!this.isAuthenticated()) {
            return reject(new Error("PrivyService: User is not authenticated."));
        }

        // Generate a unique ID for this token request
        const tokenRequestId = `token-${Date.now()}-${Math.random()}`;

        const messageHandler = (event) => {
            const data = event.data;
            if (data.type === 'PRIVY_ACCESS_TOKEN' && data.tokenRequestId === tokenRequestId) {
                clearTimeout(timeout);
                window.removeEventListener('message', messageHandler);
                resolve(data.payload.accessToken);
            } else if (data.type === 'PRIVY_ACCESS_TOKEN_ERROR' && data.tokenRequestId === tokenRequestId) {
                clearTimeout(timeout);
                window.removeEventListener('message', messageHandler);
                reject(new Error(data.payload.error || "Failed to get access token."));
            }
        };

        // Set a timeout for the request
        const timeout = setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            reject(new Error("Access token request timed out."));
        }, 10000); // 10 second timeout

        window.addEventListener('message', messageHandler);

        this.privyIframe.contentWindow.postMessage({
            action: 'getAccessToken',
            payload: { tokenRequestId: tokenRequestId }
        }, this.privyIframeOrigin);
    });
};

PrivyService.prototype.isAuthenticated = function() {
    return this.state === PrivyAuthState.CONNECTED && !!this.walletAddress;
};

PrivyService.prototype.getWalletAddress = function() {
    return this.walletAddress;
};

PrivyService.prototype.getState = function() {
    return this.state;
};

PrivyService.prototype.getUser = function() {
    return this.user;
};

PrivyService.prototype.isExternalWallet = function(provider) {
    // For now, any provider that is not 'twitter' and is not null/undefined will be treated as an external wallet.
    return provider && provider !== 'twitter';
};

// Helper function to apply multiple styles to an element
PrivyService.prototype.applyStyles = function(element, styles) {
    for (const property in styles) {
        element.style[property] = styles[property];
    }
};

