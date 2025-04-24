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

    // --- Feedback Service Integration ---
    // Hide any persistent prompts/loading states before showing new feedback
    if (feedbackService) {
        feedbackService.hideBlockingPrompt();
        // Consider adding a reference to the button that triggered the flow
        // feedbackService.hideInlineLoading('connectButtonSelector'); // Example
    } else {
        console.warn("FeedbackService not available in AuthService.setState");
    }

    // Fire specific state events & Trigger Feedback
    switch (newState) {
        case AuthState.CONNECTING_WALLET:
            this.app.fire('auth:connecting');
            // Feedback handled in connectWalletFlow start
            break;
        case AuthState.FETCHING_SIWS:
            this.app.fire('auth:fetching_siws'); // Fire specific event
            // Feedback handled in connectWalletFlow step 2
            break;
        case AuthState.SIGNING_SIWS:
            this.app.fire('auth:signing_siws'); // Fire specific event
            // Feedback handled in connectWalletFlow step 3
            break;
        case AuthState.VERIFYING_SIWS:
            this.app.fire('auth:verifying_siws'); // Fire specific event
            // Feedback handled in connectWalletFlow step 4
            break;
        case AuthState.CONNECTED:
            if (feedbackService) feedbackService.showSuccess("Successfully signed in!");
            this.app.fire('auth:connected', { address: this.walletAddress, sessionToken: this.sessionToken });
            break;
        case AuthState.DISCONNECTED:
            // Only show feedback if explicitly logged out, not on initial load?
            // We'll add feedback in the logout function for clarity.
            this.app.fire('auth:disconnected');
            break;
        case AuthState.ERROR:
            console.error("AuthService Error:", this.lastError);
            if (feedbackService) feedbackService.showError("Authentication Error", this.lastError);
            this.app.fire('auth:error', { message: this.lastError });
            break;
    }

    // Fire generic state change event
    this.app.fire('auth:stateChanged', { state: this.state, address: this.walletAddress, error: this.lastError });
};

AuthService.prototype.connectWalletFlow = async function () {
    // TODO: Pass the triggering element (e.g., button) reference for inline loading
    // const triggerElement = arguments[0]; // Example if passed as argument

    if (this.state !== AuthState.DISCONNECTED && this.state !== AuthState.ERROR) {
        console.warn("AuthService: connectWalletFlow called while not in DISCONNECTED or ERROR state:", this.state);
        return this.walletAddress; // Already connected or connecting
    }

    // Ensure config is loaded and endpoint is available
    if (!this.app.config || !this.app.config.get('cloudflareWorkerAuthEndpoint')) {
        const errorMsg = "Configuration not loaded or cloudflareWorkerAuthEndpoint missing.";
        if (feedbackService) feedbackService.showError("Configuration Error", errorMsg);
        this.setState(AuthState.ERROR, new Error(errorMsg));
        return; // Stop flow
    }
    const baseAuthUrl = this.app.config.get('cloudflareWorkerAuthEndpoint');

    // --- Start Flow Feedback ---
    // Example: Assuming a button with id 'connect-wallet-button' triggered this
    const connectButtonSelector = '#connect-wallet-button'; // Replace with actual selector or pass element ref
    if (feedbackService) feedbackService.showInlineLoading(connectButtonSelector, 'Connecting...');


    try {
        // --- Step 1: Connect wallet ---
        this.setState(AuthState.CONNECTING_WALLET); // State update first
        try {
            if (!window.SolanaSDK || !window.SolanaSDK.wallet) {
                 // Check for wallet extension existence
                if (feedbackService) feedbackService.showError("Please install a Solana wallet extension (e.g., Phantom).");
                throw new Error("Solana SDK or wallet not initialized.");
            }
            if (!window.SolanaSDK.wallet.connected) {
                console.log("AuthService: Wallet not connected, attempting connection...");
                // No specific message here, covered by 'Connecting...'
                await window.SolanaSDK.wallet.connect();
            } else {
                console.log("AuthService: Wallet already connected.");
            }
        } catch (err) {
            console.error("AuthService: Wallet connection failed:", err);
            let userMessage = "Wallet connection failed.";
            if (err.message?.toLowerCase().includes('user rejected')) {
                userMessage = "Wallet connection cancelled.";
            } else if (err.message?.toLowerCase().includes('not initialized')) {
                 userMessage = "Please install a Solana wallet extension (e.g., Phantom).";
            }
            if (feedbackService) feedbackService.showError(userMessage, err.message);
            throw err; // Re-throw to be caught by outer try-catch and set ERROR state
        }

        const publicKey = window.SolanaSDK.wallet.publicKey;
        if (!publicKey) {
            if (feedbackService) feedbackService.showError("Wallet connection issue", "Connected but public key is unavailable.");
            throw new Error("Wallet connected but public key is still unavailable.");
        }
        const currentWalletAddress = publicKey.toBase58();
        console.log("AuthService: Wallet Connected:", currentWalletAddress);
        // Wallet is connected, move to SIWS

        // --- Step 2: Fetch SIWS input from server ---
        if (feedbackService) feedbackService.showInlineLoading(connectButtonSelector, 'Preparing sign-in...'); // Update inline message
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
            if (feedbackService) feedbackService.showError("Sign-in Prep Failed", `Could not get sign-in details from server: ${err.message}`);
            throw err;
        }

        // --- Step 3: Have the wallet sign the SIWS input ---
        // Hide inline loading, show modal prompt
        if (feedbackService) {
             feedbackService.hideInlineLoading(connectButtonSelector);
             feedbackService.showBlockingPrompt("Wallet Signature Required", "Please sign the message in your wallet to continue.");
        }
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
            const userCancelled = err.message?.toLowerCase().includes('cancelled') || err.message?.toLowerCase().includes('rejected');
            if (feedbackService) feedbackService.showError(userCancelled ? "Sign-in cancelled." : "Failed to sign message.", err.message);
            // Modal is hidden by setState -> ERROR transition
            throw err;
        }

        // --- Step 4: Verify SIWS with Cloudflare Worker ---
        // Hide modal, show inline loading again
        if (feedbackService) {
            feedbackService.hideBlockingPrompt();
            feedbackService.showInlineLoading(connectButtonSelector, 'Verifying...');
        }
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
                let serverErrorDetail = verifyResponse.statusText;
                try {
                    const errorData = await verifyResponse.json();
                    serverErrorDetail = errorData.error || serverErrorDetail;
                    errorMsg = `Verification failed: ${serverErrorDetail}`;
                } catch (parseError) { /* Ignore parsing error */ }
                if (feedbackService) feedbackService.showError("Verification Failed", serverErrorDetail);
                throw new Error(errorMsg); // Throw the detailed message
            }

            const verifyData = await verifyResponse.json();
            sessionToken = verifyData.sessionToken;
            refreshToken = verifyData.refreshToken;

            if (!sessionToken) {
                 if (feedbackService) feedbackService.showError("Verification Issue", "Verification succeeded but no session token was received.");
                throw new Error("Verification successful, but no session token received.");
            }
            console.log("AuthService: SIWS Verification Successful.");

        } catch (err) {
            console.error("AuthService: Error verifying SIWS:", err);
            // Error shown in the block above or will be handled by outer catch
            throw err;
        }

        // --- Step 5: Store tokens and update state ---
        this.sessionToken = sessionToken;
        this.refreshToken = refreshToken;
        this.walletAddress = currentWalletAddress; // Set address only on full success

        // Send wallet address update to Network Layer (using events is preferred)
        this.app.fire('auth:addressAvailable', { address: this.walletAddress }); // Event for network layer

        // Update local player entity data (using events is preferred)
        this.app.fire('player:data:update', { walletAddress: this.walletAddress });

        console.log("AuthService: Wallet authentication flow completed successfully.");
        if (feedbackService) feedbackService.hideInlineLoading(connectButtonSelector); // Hide loading before success toast
        this.setState(AuthState.CONNECTED); // Final state update (triggers success toast)

        return this.walletAddress;

    } catch (error) {
        console.error("AuthService: Authentication flow failed.", error);
        // Ensure any lingering UI feedback is cleared before showing the final error
        if (feedbackService) {
            feedbackService.hideBlockingPrompt();
            feedbackService.hideInlineLoading(connectButtonSelector);
        }
        this.setState(AuthState.ERROR, error); // This will trigger the error feedback via setState
        // Reset partial state
        this.sessionToken = null;
        this.refreshToken = null;
        this.walletAddress = null;
        return null; // Indicate failure
    }
};

AuthService.prototype.logout = function() {
    console.log("AuthService: Logout requested.");
    if (feedbackService) feedbackService.showInfo("Logging out...");

    // Clear session state
    this.sessionToken = null;
    this.refreshToken = null;
    this.walletAddress = null;
    this.lastError = null;

    // Optionally disconnect the wallet adapter itself
    if (window.SolanaSDK && window.SolanaSDK.wallet && window.SolanaSDK.wallet.connected) {
        window.SolanaSDK.wallet.disconnect().catch(err => {
            console.error("AuthService: Error during wallet disconnect:", err);
            // Optionally show feedback for disconnect error, though user is logging out anyway
            // if (feedbackService) feedbackService.showError("Wallet disconnect failed", err.message);
        });
    }

    // Update state and fire events
    this.setState(AuthState.DISCONNECTED); // Update state first
    if (feedbackService) feedbackService.showSuccess("Successfully logged out."); // Show success after state update

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