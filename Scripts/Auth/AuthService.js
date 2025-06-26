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
    SESSION_EXPIRED: 'session_expired', // Added state
    ERROR: 'error'
};

AuthService.prototype.initialize = function () {
    console.log("AuthService initializing...");
    this.state = AuthState.DISCONNECTED;
    this.sessionToken = null;
    this.refreshToken = null;
    this.walletAddress = null;
    this.lastError = null;
    this.feedbackService = null; // Property to hold the feedback service instance

    // Function to get services after app.services is ready
    const getServices = () => {
        if (this.app.services) {
            this.feedbackService = this.app.services.get('feedbackService'); // Correct service name
            if (!this.feedbackService) {
                console.warn("AuthService: FeedbackService not found in app.services registry.");
            } else {
                 console.log("AuthService: FeedbackService found in app.services registry.");
            }

            // Register AuthService itself
            if (typeof this.app.services.register === 'function') {
                 this.app.services.register('authService', this);
                 console.log("AuthService: Registered with Services registry.");
            } else {
                 console.error("AuthService: Services registry found, but register function missing.");
            }

        } else {
            console.warn("AuthService: Services registry (app.services) not found during initialization.");
        }
    };


    // Attempt to get services immediately
    getServices();

    // Also listen for services initialization in case it happens later
    this.app.once('services:initialized', getServices);


    // Listen for logout requests
    this.app.on('auth:logout:request', this.logout, this);

    // Listen for wallet adapter events (if SolanaSDK is available)
    this.setupWalletEventListeners();


    console.log("AuthService initialized. Current state:", this.state);
};

AuthService.prototype.setState = function(newState, error = null) {
    if (this.state === newState && !error) return; // No change unless there's a new error

    console.log(`AuthService: State changing from ${this.state} to ${newState}`);
    this.state = newState;
    this.lastError = error ? error.message || String(error) : null;

    // --- Feedback Service Integration ---
    // Hide any persistent prompts/loading states before showing new feedback
    if (this.feedbackService) { // Use this.feedbackService
        // Hide any persistent prompts/loading states before showing new feedback,
        // UNLESS the new state is an ERROR state specifically handled by a modal.
        const errorLower = error?.message?.toLowerCase() || '';
        const isWalletNotReadyError = errorLower === 'solana wallet not ready.';
        const isWalletNotInstalledError = errorLower.includes('solana sdk or wallet not initialized');

        if (!(newState === AuthState.ERROR && (isWalletNotReadyError || isWalletNotInstalledError))) {
            this.feedbackService.hideBlockingPrompt(); // Use this.feedbackService
        }
        // Consider adding a reference to the button that triggered the flow
        // this.feedbackService.hideInlineLoading('connectButtonSelector'); // Example
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
            if (this.feedbackService) this.feedbackService.showSuccess("Successfully signed in!"); // Use this.feedbackService
            this.app.fire('auth:connected', { address: this.walletAddress, sessionToken: this.sessionToken });
            break;
        case AuthState.DISCONNECTED:
            // Only show feedback if explicitly logged out, not on initial load?
            // We'll add feedback in the logout function for clarity.
            this.app.fire('auth:disconnected');
            break;
        case AuthState.SESSION_EXPIRED:
             console.warn("AuthService: Session expired.");
             if (this.feedbackService) {
                 this.feedbackService.showBlockingPrompt( // Use modal for required action
                     "Session Expired",
                     "Your session has expired. Please sign in again to continue.",
                     [{ label: 'Sign In', callback: () => this.connectWalletFlow(), type: 'primary' }] // Assuming connectWalletFlow handles re-auth
                 );
             }
             this.app.fire('auth:sessionExpired');
             break;
        case AuthState.ERROR:
            console.error("AuthService Error:", this.lastError);
            let userFriendlyError = "An unexpected authentication error occurred.";

            // Check if this is a specific error we're already showing a modal for
            const errorLower = this.lastError?.toLowerCase() || '';
            const isWalletNotReady = errorLower === 'solana wallet not ready.';
            const isWalletNotInstalled = errorLower.includes('solana sdk or wallet not initialized');
            
            // Only show toast for errors that aren't already showing a modal
            if (!isWalletNotReady && !isWalletNotInstalled) {
                // Provide more specific feedback based on the error context
                if (this.lastError) {
                     if (errorLower.includes('wallet connection cancelled')) {
                        userFriendlyError = "Wallet connection cancelled.";
                        if (this.feedbackService) {
                            this.feedbackService.showInfo("Wallet connection cancelled.", 5000); // Use showInfo for user cancellation
                        }
                     } else if (errorLower.includes('wallet connection failed')) {
                        userFriendlyError = "Could not connect to the wallet. Please ensure it's unlocked and try again.";
                        if (this.feedbackService) {
                            this.feedbackService.showError("Authentication Error", userFriendlyError, true);
                        }
                     } else if (errorLower.includes('sign-in prep failed')) {
                        userFriendlyError = "Could not prepare sign-in. The server might be unavailable.";
                        if (this.feedbackService) {
                            this.feedbackService.showError("Authentication Error", userFriendlyError, true);
                        }
                     } else if (errorLower.includes('sign-in cancelled')) {
                        userFriendlyError = "Sign-in cancelled."; // More concise message
                         if (this.feedbackService) {
                            this.feedbackService.showInfo("Sign-in cancelled.", 5000); // Use showInfo for user cancellation
                        }
                     } else if (errorLower.includes('failed to sign message')) {
                        userFriendlyError = "Failed to sign the message in the wallet.";
                        if (this.feedbackService) {
                            this.feedbackService.showError("Authentication Error", userFriendlyError, true);
                        }
                     } else if (errorLower.includes('verification failed')) {
                        // Extract detail if possible, otherwise generic
                        const detailMatch = this.lastError.match(/Verification failed: (.*)/);
                        userFriendlyError = detailMatch ? `Sign-in verification failed: ${detailMatch[1]}` : "Sign-in verification failed.";
                        if (this.feedbackService) {
                            this.feedbackService.showError("Authentication Error", userFriendlyError, true);
                        }
                     } else if (errorLower.includes('verification issue')) {
                         userFriendlyError = "Sign-in verification succeeded, but couldn't establish a session.";
                         if (this.feedbackService) {
                            this.feedbackService.showError("Authentication Error", userFriendlyError, true);
                        }
                     } else {
                         // Generic error handling for other cases
                         userFriendlyError = "An unexpected authentication error occurred.";
                         if (this.feedbackService) {
                            this.feedbackService.showError("Authentication Error", userFriendlyError, true);
                        }
                     }
                } else {
                    // Fallback for when this.lastError is null or empty, but state is ERROR
                     userFriendlyError = "An unexpected authentication error occurred.";
                     if (this.feedbackService) {
                        this.feedbackService.showError("Authentication Error", userFriendlyError, true);
                    }
                }
            }
            // Always fire the error event regardless of UI feedback
            this.app.fire('auth:error', { message: this.lastError, userMessage: userFriendlyError }); // Use userFriendlyError for the userMessage in the event
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
        if (this.feedbackService) this.feedbackService.showError("Configuration Error", errorMsg); // Use this.feedbackService
        this.setState(AuthState.ERROR, new Error(errorMsg));
        return; // Stop flow
    }
    const baseAuthUrl = this.app.config.get('cloudflareWorkerAuthEndpoint');

    // --- Start Flow Feedback ---
    // No specific inline loading on a button, as flow is triggered by other actions.
    // General feedback (toasts, modals) will be used.


    try {
        // --- Step 1: Connect wallet ---
        this.setState(AuthState.CONNECTING_WALLET); // State update first
        // Initial feedback for connecting
        if (this.feedbackService) this.feedbackService.showInfo("Connecting wallet...");
        try {
            if (!window.SolanaSDK || !window.SolanaSDK.wallet) {
                 // Check for wallet extension existence
                if (this.feedbackService) {
                    this.feedbackService.showBlockingPrompt(
                        "Do you have a Solana wallet?",
                        "Please install the Phantom wallet browser extension. More wallets will be supported in the future.",
                        [
                            { label: 'Install Phantom', callback: () => window.open('https://phantom.app/', '_blank'), style: { backgroundColor: '#aa9fec', color: 'white' } },
                            { label: 'OK', callback: () => {}, type: 'secondary' }
                        ]
                    );
                }
                throw new Error("Solana SDK or wallet not initialized.");
            }
            if (!window.SolanaSDK.wallet.connected) {
                console.log("AuthService: Wallet not connected, attempting connection...");
                await window.SolanaSDK.wallet.connect();
            } else {
                console.log("AuthService: Wallet already connected.");
                console.log("AuthService: Wallet already connected.");
                if (this.feedbackService) this.feedbackService.showInfo("Wallet already connected.", 3000); // Inform user
            }
        } catch (err) {
            console.error("AuthService: Wallet connection failed:", err);
            let errorForState = err; // Default to original error

            // Check for specific WalletNotReadyError
            if (err.name === 'WalletNotReadyError') {
                 console.warn("AuthService: WalletNotReadyError caught. Showing specific prompt.");
                 if (this.feedbackService) {
                     this.feedbackService.showBlockingPrompt(
                         "Do you have a Solana wallet?",
                         "Your Solana wallet is not ready. Please unlock or initialize it in your browser extension. More wallets will be supported in the future.",
                         [
                             { label: 'Install Phantom', callback: () => window.open('https://phantom.app/', '_blank'), style: { backgroundColor: '#aa9fec', color: 'white' } },
                             { label: 'OK', callback: () => {}, type: 'secondary' }
                         ]
                     );
                 }
                 // Set a specific error message that won't trigger the generic toast in setState
                 errorForState = new Error("Solana wallet not ready.");
                 // We don't re-throw here, as the modal is the primary feedback
                 this.setState(AuthState.ERROR, errorForState);
                 return null; // Stop the flow
            } else if (err.message?.toLowerCase().includes('user rejected')) {
                errorForState = new Error("Wallet connection cancelled."); // More specific error for setState
            } else if (err.message?.toLowerCase().includes('not initialized')) {
                 errorForState = new Error("Solana SDK or wallet not initialized."); // More specific error for setState
            } else {
                 errorForState = new Error(`Wallet connection failed: ${err.message}`);
            }
            // Feedback is now handled by the ERROR state in setState for other errors
            throw errorForState; // Re-throw other errors to be caught by outer try-catch and set ERROR state
        }

        const publicKey = window.SolanaSDK.wallet.publicKey;
        if (!publicKey) {
            if (this.feedbackService) this.feedbackService.showError("Wallet connection issue", "Connected but public key is unavailable."); // Use this.feedbackService
            throw new Error("Wallet connected but public key is still unavailable.");
        }
        const currentWalletAddress = publicKey.toBase58();
        console.log("AuthService: Wallet Connected:", currentWalletAddress);
        // Wallet is connected, move to SIWS

        // --- Step 2: Fetch SIWS input from server ---
        if (this.feedbackService) this.feedbackService.showInfo('Preparing sign-in...'); // Update info message
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
            const errorForState = new Error(`Sign-in Prep Failed: ${err.message}`);
            // Feedback handled by ERROR state in setState
            throw errorForState;
        }

        // --- Step 3: Have the wallet sign the SIWS input ---
        // Show modal prompt
        if (this.feedbackService) { // Use this.feedbackService
             this.feedbackService.showBlockingPrompt("Wallet Signature Required", "Please sign the message in your wallet to continue."); // Use this.feedbackService
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
            let errorForState = err;
            const userCancelled = err.message?.toLowerCase().includes('cancelled') || err.message?.toLowerCase().includes('rejected');
            if (userCancelled) {
                 errorForState = new Error("Sign-in cancelled.");
            } else {
                 errorForState = new Error(`Failed to sign message: ${err.message}`);
            }
            // Modal is hidden by setState -> ERROR transition
            // Feedback handled by ERROR state in setState
            throw errorForState;
        }

        // --- Step 4: Verify SIWS with Cloudflare Worker ---
        // Hide modal, show info message again
        if (this.feedbackService) { // Use this.feedbackService
            this.feedbackService.hideBlockingPrompt(); // Use this.feedbackService
            this.feedbackService.showInfo('Verifying sign-in...'); // Use this.feedbackService
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
                // Feedback handled by ERROR state in setState
                throw new Error(`Verification failed: ${serverErrorDetail}`); // Throw the detailed message
            }

            const verifyData = await verifyResponse.json();
            sessionToken = refreshToken = verifyData.sessionToken;
            

            if (!sessionToken) {
                // Feedback handled by ERROR state in setState
                throw new Error("Verification Issue: Verification succeeded but no session token was received.");
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
        // No specific hide inline loading needed here as it wasn't shown for a button
        this.setState(AuthState.CONNECTED); // Final state update (triggers success toast)

        return this.walletAddress;

    } catch (error) {
        console.error("AuthService: Authentication flow failed.", error);
        // Ensure any lingering UI feedback is cleared before showing the final error
        if (this.feedbackService) { // Use this.feedbackService
            this.feedbackService.hideBlockingPrompt(); // Use this.feedbackService
            // No specific hide inline loading needed here
        }
        this.setState(AuthState.ERROR, error); // This will trigger the error feedback via setState
        // Reset partial state
        this.sessionToken = null;
        this.refreshToken = null;
        this.walletAddress = null;
        return null; // Indicate failure
    }
};

// --- Wallet Event Listeners ---
AuthService.prototype.setupWalletEventListeners = function() {
    // Ensure SolanaSDK and wallet exist before adding listeners
    if (window.SolanaSDK && window.SolanaSDK.wallet && typeof window.SolanaSDK.wallet.on === 'function') {
        console.log("AuthService: Setting up wallet event listeners...");

        // Handle disconnect event
        window.SolanaSDK.wallet.on('disconnect', () => {
            console.log("AuthService: Wallet disconnected event received.");
            if (this.state !== AuthState.DISCONNECTED) { // Only act if we thought we were connected
                if (this.feedbackService) this.feedbackService.showWarning("Wallet disconnected.", 7000);
                this.logout(false); // Perform logout without showing redundant feedback
            }
        });

        // Handle account change event
        window.SolanaSDK.wallet.on('accountChanged', (newPublicKey) => {
            console.log("AuthService: Wallet account changed event received.");
            if (this.state === AuthState.CONNECTED) {
                const newAddress = newPublicKey ? newPublicKey.toBase58() : null;
                if (newAddress && newAddress !== this.walletAddress) {
                    console.warn(`AuthService: Wallet address changed from ${this.walletAddress} to ${newAddress}. Session is now invalid.`);
                    if (this.feedbackService) {
                         this.feedbackService.showBlockingPrompt( // Use modal for required action
                            "Account Changed",
                            "Your wallet account has changed. Please sign in with the new account to continue.",
                            [{ label: 'Sign In', callback: () => this.connectWalletFlow(), type: 'primary' }]
                        );
                    }
                    // Force logout locally as the session is tied to the old address
                    this.logout(false); // Logout without feedback, modal provides info
                    this.setState(AuthState.DISCONNECTED); // Ensure state reflects reality
                } else if (!newAddress) {
                    // This case might be similar to disconnect
                     console.warn("AuthService: Account changed to null/undefined. Treating as disconnect.");
                     if (this.feedbackService) this.feedbackService.showWarning("Wallet disconnected or account unavailable.", 7000);
                     this.logout(false);
                }
            } else {
                 console.log("AuthService: Account changed event ignored (not in CONNECTED state).");
            }
        });

    } else {
        // Poll or wait for SolanaSDK to be ready if needed, or rely on initialization order
        console.warn("AuthService: SolanaSDK or wallet not ready during setupWalletEventListeners.");
        // Optionally, retry setup later
        // setTimeout(() => this.setupWalletEventListeners(), 2000);
    }
};


// --- Logout ---
AuthService.prototype.logout = function(showFeedback = true) {
    console.log("AuthService: Logging out...");
    this.sessionToken = null;
    this.refreshToken = null;
    this.walletAddress = null;
    // Don't necessarily disconnect the wallet adapter itself, just clear our session
    // if (window.SolanaSDK && window.SolanaSDK.wallet && window.SolanaSDK.wallet.connected) {
    //     window.SolanaSDK.wallet.disconnect().catch(err => console.error("Error during wallet disconnect:", err));
    // }
    if (showFeedback && this.feedbackService) {
        this.feedbackService.showInfo("You have been logged out.", 4000);
    }
    this.setState(AuthState.DISCONNECTED); // Set state last
};

// --- Session Expiry Handling ---
AuthService.prototype.handleSessionExpired = function() {
    console.warn("AuthService: Handling session expiry trigger.");
    if (this.state === AuthState.CONNECTED) { // Only if we thought we were connected
        this.sessionToken = null; // Clear invalid token
        this.refreshToken = null;
        // Don't clear walletAddress here, user might want to re-auth with same wallet
        this.setState(AuthState.SESSION_EXPIRED); // Trigger specific feedback/modal
    }
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