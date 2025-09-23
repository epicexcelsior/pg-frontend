// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Core\PrivyManager.js
var PrivyManager = pc.createScript('privyManager');

PrivyManager.prototype.initialize = function () {
    console.log("PrivyManager: Initializing...");
    
    const configLoader = this.app.services.get('configLoader');
    if (!configLoader) {
        console.error("PrivyManager: ConfigLoader service not found!");
        return;
    }
    
    this.privyHostOrigin = configLoader.get('privyHostOrigin');
    if (!this.privyHostOrigin) {
        console.error("PrivyManager: privyHostOrigin not found in config.json!");
        return;
    }

    // Internal State
    this.user = null;
    this.authenticated = false;
    this.transactionPromises = new Map();

    // Setup message listener
    this.handleAuthMessage = this.handleAuthMessage.bind(this);
    window.addEventListener('message', this.handleAuthMessage);
    
    // Restore session synchronously on init
    this.restoreUserSession();
    
    this.on('destroy', () => {
        window.removeEventListener('message', this.handleAuthMessage);
    });
    
    console.log("PrivyManager: Initialized.");
};

PrivyManager.prototype.handleAuthMessage = function (event) {
    if (event.origin !== this.privyHostOrigin) return; // Security: Ignore messages from other origins

    const { type, payload, requestId } = event.data;
    console.log(`PrivyManager: Received message type '${type}'`);

    switch (type) {
        case 'PRIVY_AUTH_SUCCESS':
            this.handleAuthSuccess(payload);
            break;
        case 'PRIVY_AUTH_LOGOUT':
            this.handleAuthLogout();
            break;
        // Transaction cases can be added here later
    }
};

PrivyManager.prototype.handleAuthSuccess = function (payload) {
    console.log("PrivyManager: Authentication successful.", payload);

    // 1. Update internal state immediately. This is the new source of truth.
    this.user = payload.user;
    this.authenticated = true;
    
    // 2. Persist the session.
    localStorage.setItem('privyUser', JSON.stringify(this.user));
    
    // 3. Announce the change to the rest of the application.
    //    We get the wallet address *after* setting this.user to ensure it's correct.
    this.app.fire('auth:stateChanged', {
        state: 'connected',
        address: this.getWalletAddress(),
        user: this.user,
        isAuthenticated: this.authenticated
    });
};

PrivyManager.prototype.handleAuthLogout = function () {
    console.log("PrivyManager: Logout successful.");
    
    this.user = null;
    this.authenticated = false;
    localStorage.removeItem('privyUser');
    
    this.app.fire('auth:stateChanged', {
        state: 'disconnected',
        address: null,
        user: null,
        isAuthenticated: false
    });
};

PrivyManager.prototype.restoreUserSession = function () {
    try {
        const storedUser = localStorage.getItem('privyUser');
        if (storedUser) {
            this.user = JSON.parse(storedUser);
            // IMPORTANT: A restored session is NOT considered actively authenticated
            // until the user performs an action that requires re-verification.
            this.authenticated = false; 
            console.log("PrivyManager: Restored user data from localStorage. Session is not active.", this.user);
            
            // Fire an initial event so UI can display the wallet info, but knows it's not "hot".
            this.app.fire('auth:stateChanged', {
                state: 'connected',
                address: this.getWalletAddress(),
                user: this.user,
                isAuthenticated: this.authenticated
            });
        }
    } catch (error) {
        console.error("PrivyManager: Error restoring user session:", error);
        localStorage.removeItem('privyUser');
    }
};

// --- PUBLIC API METHODS ---

PrivyManager.prototype.login = function () {
    console.log("PrivyManager: Starting login process...");
    const loginUrl = `${this.privyHostOrigin}?action=login`;
    window.open(loginUrl, 'privy-auth', 'width=400,height=650,scrollbars=yes,resizable=yes');
};

PrivyManager.prototype.logout = function () {
    console.log("PrivyManager: Starting logout process...");
    // Let the server know we are unclaiming before we clear local data
    const localPlayerData = this.app.localPlayer?.script?.playerData;
    if (localPlayerData && localPlayerData.getClaimedBoothId()) {
        this.app.fire('network:send:unclaimBooth');
    }
    const logoutUrl = `${this.privyHostOrigin}?action=logout`;
    window.open(logoutUrl, 'privy-logout', 'width=400,height=650,scrollbars=yes,resizable=yes');
};

PrivyManager.prototype.isAuthenticated = function () {
    return this.authenticated;
};

PrivyManager.prototype.getUser = function () {
    return this.user;
};

PrivyManager.prototype.getWalletAddress = function () {
    if (!this.user) return null;

    // Primary method: Privy's 'wallet' object is the active one.
    if (this.user.wallet && this.user.wallet.address) {
        return this.user.wallet.address;
    }
    
    // Fallback for different structures.
    if (Array.isArray(this.user.linkedAccounts)) {
        const walletAccount = this.user.linkedAccounts.find(acc => acc.type === 'wallet');
        if (walletAccount) return walletAccount.address;
    }
    
    return null;
};