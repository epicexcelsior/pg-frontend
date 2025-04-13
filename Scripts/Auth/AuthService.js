// Scripts/Auth/AuthService.js
var AuthService = pc.createScript('authService');

// Enum for Auth States
const AuthState = {
    DISCONNECTED: 'disconnected',
    CONNECTING_WALLET: 'connecting_wallet',
    FETCHING_SIWS: 'fetching_siws',
    SIGNING_SIWS: 'signing_siws',
    VERIFYING_SIWS: 'verifying_siws',
    CONNECTED: 'connected',
    ERROR: 'error'
};

AuthService.prototype.initialize = function () {
    console.log("AuthService initializing...");
    this.state = AuthState.DISCONNECTED;
    this.sessionToken = null;
    this.refreshToken = null;
    this.walletAddress = null;
    this.lastError = null;

    // Register with the Services registry if it exists
    // This assumes AuthService is attached to the same entity as Services.js
    if (this.app.services && typeof this.app.services.register === 'function') {
        this.app.services.register('authService', this);
    } else {
        console.warn("AuthService: Services registry (app.services) not found or register function missing during initialization.");
        // Attempt registration later if services initializes after auth
        this.app.once('services:initialized', () => {
            if (this.app.services && typeof this.app.services.register === 'function') {
                 console.log("AuthService: Registering with late-initialized Services registry.");
                 this.app.services.register('authService', this);
            } else {
                 console.error("AuthService: Failed to register with Services registry even after initialization event.");
            }
        });
    }

    // Listen for logout requests
    this.app.on('auth:logout:request', this.logout, this);

    console.log("AuthService initialized. Current state:", this.state);
};

AuthService.prototype.setState = function(newState, error = null) {
    if (this.state === newState && !error) return; // No change unless there's a new error

    console.log(`AuthService: State changing from ${this.state} to ${newState}`);
    this.state = newState;
    this.lastError = error ? error.message || String(error) : null;

    // Fire specific state events
    switch (newState) {
        case AuthState.CONNECTING_WALLET:
            this.app.fire('auth:connecting');
            break;
        case AuthState.CONNECTED:
            this.app.fire('auth:connected', { address: this.walletAddress, sessionToken: this.sessionToken });
            break;
        case AuthState.DISCONNECTED:
            this.app.fire('auth:disconnected');
            break;
        case AuthState.ERROR:
            console.error("AuthService Error:", this.lastError);
            this.app.fire('auth:error', { message: this.lastError });
            break;
        // Add events for other states if needed by UI (e.g., 'auth:verifying')
    }

    // Fire generic state change event
    this.app.fire('auth:stateChanged', { state: this.state, address: this.walletAddress, error: this.lastError });
};

AuthService.prototype.connectWalletFlow = async function () {
    if (this.state !== AuthState.DISCONNECTED && this.state !== AuthState.ERROR) {
        console.warn("AuthService: connectWalletFlow called while not in DISCONNECTED or ERROR state:", this.state);
        return this.walletAddress; // Already connected or connecting
    }

    // Ensure config is loaded and endpoint is available
    if (!this.app.config || !this.app.config.get('cloudflareWorkerAuthEndpoint')) {
        const errorMsg = "Configuration not loaded or cloudflareWorkerAuthEndpoint missing.";
        this.setState(AuthState.ERROR, new Error(errorMsg));
        // Removed: this.app.fire("ui:auth:error", "Configuration error. Cannot authenticate."); // UI should listen to auth:error
        return; // Stop flow
    }
    const baseAuthUrl = this.app.config.get('cloudflareWorkerAuthEndpoint');

    try {
        // --- Step 1: Connect wallet ---
        this.setState(AuthState.CONNECTING_WALLET);
        try {
            if (!window.SolanaSDK || !window.SolanaSDK.wallet) {
                throw new Error("Solana SDK or wallet not initialized.");
            }
            if (!window.SolanaSDK.wallet.connected) {
                console.log("AuthService: Wallet not connected, attempting connection...");
                await window.SolanaSDK.wallet.connect();
            } else {
                console.log("AuthService: Wallet already connected.");
            }
        } catch (err) {
            console.error("AuthService: Wallet connection failed:", err);
            // Removed: this.app.fire("ui:wallet:error", `Connection failed: ${err.message}`); // UI should listen to auth:error
            throw err; // Re-throw to be caught by outer try-catch
        }

        const publicKey = window.SolanaSDK.wallet.publicKey;
        if (!publicKey) {
            throw new Error("Wallet connected but public key is still unavailable.");
        }
        const currentWalletAddress = publicKey.toBase58();
        console.log("AuthService: Wallet Connected:", currentWalletAddress);

        // --- Step 2: Fetch SIWS input from server ---
        this.setState(AuthState.FETCHING_SIWS);
        let initialSiwsInput;
        const siwsInputUrl = `${baseAuthUrl}/request_siws_input`;
        try {
            console.log(`AuthService: Fetching SIWS input from ${siwsInputUrl}...`);
            const inputResponse = await fetch(siwsInputUrl);
            if (!inputResponse.ok) {
                throw new Error(`Failed to fetch SIWS input: ${inputResponse.status} ${inputResponse.statusText}`);
            }
            initialSiwsInput = await inputResponse.json();
            console.log("AuthService: Received Initial SIWS Input:", initialSiwsInput);
            if (!initialSiwsInput || typeof initialSiwsInput.nonce !== 'string') {
                throw new Error("Invalid SIWS input received from server.");
            }
        } catch (err) {
            console.error("AuthService: Error fetching SIWS input:", err);
            // Removed: this.app.fire("ui:auth:error", "Failed to get sign-in details."); // UI should listen to auth:error
            throw err;
        }

        // --- Step 3: Have the wallet sign the SIWS input ---
        this.setState(AuthState.SIGNING_SIWS);
        let signInResult;
        try {
            if (typeof window.SolanaSDK.wallet.signIn !== 'function') {
                throw new Error("Wallet adapter does not support the required 'signIn' method.");
            }
            console.log("AuthService: Requesting signature from wallet via signIn...");
            signInResult = await window.SolanaSDK.wallet.signIn(initialSiwsInput);
            if (!signInResult || !signInResult.input || !signInResult.output || !signInResult.output.account) {
                throw new Error("Invalid response structure received from wallet's signIn method.");
            }
            console.log("AuthService: SIWS Sign Result:", signInResult);
        } catch (err) {
            console.error("AuthService: Error during SIWS signIn:", err);
            // Removed: const userCancelled = err.message?.includes('cancelled');
            // Removed: this.app.fire("ui:auth:error", userCancelled ? "Sign-in cancelled." : "Failed to sign message."); // UI should listen to auth:error
            throw err;
        }

        // --- Step 4: Verify SIWS with Cloudflare Worker ---
        this.setState(AuthState.VERIFYING_SIWS);
        let sessionToken, refreshToken;
        const verifyUrl = `${baseAuthUrl}/verify_siws`;
        try {
            console.log(`AuthService: Verifying SIWS signature via ${verifyUrl}...`);
            const verifyPayload = { input: signInResult.input, output: signInResult.output };
            const verifyResponse = await fetch(verifyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(verifyPayload)
            });

            if (!verifyResponse.ok) {
                let errorMsg = `Verification failed: ${verifyResponse.status} ${verifyResponse.statusText}`;
                try {
                    const errorData = await verifyResponse.json();
                    errorMsg = `Verification failed: ${errorData.error || verifyResponse.statusText}`;
                } catch (parseError) { /* Ignore parsing error */ }
                throw new Error(errorMsg);
            }

            const verifyData = await verifyResponse.json();
            sessionToken = verifyData.sessionToken;
            refreshToken = verifyData.refreshToken;

            if (!sessionToken) {
                throw new Error("Verification successful, but no session token received.");
            }
            console.log("AuthService: SIWS Verification Successful.");

        } catch (err) {
            console.error("AuthService: Error verifying SIWS:", err);
            // Removed: this.app.fire("ui:auth:error", `Verification failed: ${err.message}`); // UI should listen to auth:error
            throw err;
        }

        // --- Step 5: Store tokens and update state ---
        this.sessionToken = sessionToken;
        this.refreshToken = refreshToken;
        this.walletAddress = currentWalletAddress; // Set address only on full success

        // Send wallet address update to Network Layer (using events is preferred)
        this.app.fire('auth:addressAvailable', { address: this.walletAddress }); // Event for network layer
        // Example of how NetworkManager would listen:
        // this.app.on('auth:addressAvailable', (data) => {
        //      if (this.app.room) this.app.room.send("updateAddress", { walletAddress: data.address });
        // });


        // Update local player entity data (using events is preferred)
        this.app.fire('player:data:update', { walletAddress: this.walletAddress });
        // Example of how PlayerData would listen:
        // this.app.on('player:data:update', (data) => {
        //      if (data.walletAddress) this.entity.script.playerData.walletAddress = data.walletAddress;
        // });

        console.log("AuthService: Wallet authentication flow completed successfully.");
        this.setState(AuthState.CONNECTED); // Final state update

        return this.walletAddress;

    } catch (error) {
        console.error("AuthService: Authentication flow failed.", error);
        this.setState(AuthState.ERROR, error);
        // Reset partial state
        this.sessionToken = null;
        this.refreshToken = null;
        // Keep walletAddress if connection succeeded but SIWS failed? Or clear it?
        // Clearing seems safer to represent a failed auth attempt.
        this.walletAddress = null;
        return null; // Indicate failure
    }
};

AuthService.prototype.logout = function() {
    console.log("AuthService: Logout requested.");
    // Clear session state
    this.sessionToken = null;
    this.refreshToken = null;
    this.walletAddress = null;
    this.lastError = null;

    // Optionally disconnect the wallet adapter itself
    if (window.SolanaSDK && window.SolanaSDK.wallet && window.SolanaSDK.wallet.connected) {
        window.SolanaSDK.wallet.disconnect().catch(err => {
            console.error("AuthService: Error during wallet disconnect:", err);
        });
    }

    // Update state and fire events
    this.setState(AuthState.DISCONNECTED);

    // Notify other systems (e.g., network layer to clear address on server)
    this.app.fire('auth:loggedOut');
    this.app.fire('player:data:update', { walletAddress: null }); // Clear player data address

    console.log("AuthService: Logout complete.");
};

// --- Getters for state and data ---
AuthService.prototype.getState = function() {
    return this.state;
};

AuthService.prototype.getWalletAddress = function() {
    return this.walletAddress;
};

AuthService.prototype.getSessionToken = function() {
    return this.sessionToken;
};

AuthService.prototype.isAuthenticated = function() {
    return this.state === AuthState.CONNECTED && !!this.sessionToken;
};

AuthService.prototype.getLastError = function() {
    return this.lastError;
};

// swap method called for script hot-reloading
// inherit your script state here
// AuthService.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/