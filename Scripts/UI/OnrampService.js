// Scripts/UI/OnrampService.js
var OnrampService = pc.createScript('onrampService');

// Enum for Onramp States
const OnrampState = {
    IDLE: 'idle',
    CREATING_SESSION: 'creating_session',
    SESSION_CREATED: 'session_created',
    OPENING_ONRAMP: 'opening_onramp',
    ONRAMP_OPEN: 'onramp_open',
    ONRAMP_COMPLETED: 'onramp_completed',
    ONRAMP_CANCELLED: 'onramp_cancelled',
    FAILED: 'failed',
    ERROR: 'error'
};

OnrampService.prototype.initialize = function() {
    console.log("OnrampService initializing...");
    
    this.authService = null;
    this.feedbackService = null;
    this.configLoader = null;
    this.state = OnrampState.IDLE;
    this.lastError = null;
    this.currentSessionId = null;
    this.currentOnrampUrl = null;
    this.onrampWindow = null;
    this.pollInterval = null;
    
    // Configuration
    this.gridOnrampUrl = '';
    this.popupWidth = 500;
    this.popupHeight = 700;
    this.pollIntervalMs = 2000; // Check popup status every 2 seconds
    
    // Get services from registry
    if (this.app.services) {
        this.authService = this.app.services.get('authService');
        this.feedbackService = this.app.services.get('feedbackService');
        
        if (!this.authService) console.warn("OnrampService: AuthService not found in registry.");
        if (!this.feedbackService) console.warn("OnrampService: FeedbackService not found in registry.");
    }
    
    // Get config loader
    if (this.app.config) {
        this.configLoader = this.app.config;
        this.loadConfigValues();
    } else {
        console.log("OnrampService: Waiting for config:loaded event...");
        this.app.once('config:loaded', this.loadConfigValues, this);
    }
    
    // Register with Services
    if (this.app.services && typeof this.app.services.register === 'function') {
        this.app.services.register('onrampService', this);
    }
    
    // Listen for UI requests
    this.app.on('onramp:request', this.onOnrampRequest, this);
    
    console.log("OnrampService initialized.");
};

OnrampService.prototype.loadConfigValues = function() {
    if (!this.configLoader) {
        console.error("OnrampService: ConfigLoader not available in loadConfigValues.");
        return;
    }
    
    this.gridOnrampUrl = this.configLoader.get('cloudflareWorkerGridOnrampEndpoint');
    
    if (!this.gridOnrampUrl) {
        console.error("OnrampService: cloudflareWorkerGridOnrampEndpoint missing from config.");
    }
    
    console.log("OnrampService: Config values loaded - Onramp URL:", this.gridOnrampUrl);
};

OnrampService.prototype.setState = function(newState, error = null) {
    if (this.state === newState && !error) return;
    
    console.log(`OnrampService: State changing from ${this.state} to ${newState}`);
    const previousState = this.state;
    this.state = newState;
    this.lastError = error ? error.message || String(error) : null;
    
    // Fire state change events
    this.app.fire('onramp:stateChanged', {
        state: this.state,
        previousState: previousState,
        error: this.lastError,
        sessionId: this.currentSessionId
    });
    
    // Handle UI feedback based on state
    if (this.feedbackService) {
        switch (newState) {
            case OnrampState.CREATING_SESSION:
                this.feedbackService.showInfo("Setting up secure payment session...", 8000);
                break;
                
            case OnrampState.SESSION_CREATED:
                this.feedbackService.showInfo("Opening secure payment window...", 3000);
                break;
                
            case OnrampState.ONRAMP_OPEN:
                this.feedbackService.showInfo("Complete your purchase in the secure payment window.", 10000);
                break;
                
            case OnrampState.ONRAMP_COMPLETED:
                this.feedbackService.showSuccess("Payment completed! Your funds will arrive shortly.");
                break;
                
            case OnrampState.ONRAMP_CANCELLED:
                this.feedbackService.showInfo("Payment cancelled.", 5000);
                break;
                
            case OnrampState.FAILED:
            case OnrampState.ERROR:
                console.error("OnrampService Error:", this.lastError);
                this.handleOnrampError(error || new Error("Unknown onramp error"));
                break;
        }
    }
};

OnrampService.prototype.onOnrampRequest = function(data) {
    const { amount, currency, triggerElement } = data;
    this.initiateOnramp(amount, currency, triggerElement);
};

OnrampService.prototype.initiateOnramp = async function(amount = null, currency = 'USD', triggerElement = null) {
    console.log(`OnrampService: Initiating onramp - Amount: ${amount}, Currency: ${currency}`);
    
    // Validate prerequisites
    if (!this.authService || !this.authService.isAuthenticated()) {
        console.error("OnrampService: User not authenticated.");
        this.setState(OnrampState.ERROR, new Error("Authentication required. Please sign in."));
        return;
    }
    
    if (this.authService.getAuthProvider() !== 'grid') {
        console.error("OnrampService: Onramp only available for Grid users.");
        this.setState(OnrampState.ERROR, new Error("Onramp is only available for Grid wallet users."));
        return;
    }
    
    if (!this.gridOnrampUrl) {
        console.error("OnrampService: Onramp endpoint not configured.");
        this.setState(OnrampState.ERROR, new Error("Onramp service not properly configured."));
        return;
    }
    
    if (this.state !== OnrampState.IDLE) {
        console.warn("OnrampService: Onramp already in progress.");
        if (this.feedbackService) {
            this.feedbackService.showWarning("Onramp already in progress. Please complete or cancel the current session.", 5000);
        }
        return;
    }
    
    try {
        this.setState(OnrampState.CREATING_SESSION);
        
        // Create onramp session
        const sessionToken = this.authService.getSessionToken();
        const currentUrl = window.location.href;
        
        const requestBody = {
            ...(amount && { amount: amount }),
            currency: currency,
            success_url: `${currentUrl}?onramp_status=success`,
            cancel_url: `${currentUrl}?onramp_status=cancelled`
        };
        
        const response = await fetch(this.gridOnrampUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Onramp session creation failed: ${response.status}`);
        }
        
        if (!data.onramp_url) {
            throw new Error("No onramp URL received from server");
        }
        
        // Store session details
        this.currentSessionId = data.session_id;
        this.currentOnrampUrl = data.onramp_url;
        
        console.log(`OnrampService: Session created - ID: ${this.currentSessionId}`);
        this.setState(OnrampState.SESSION_CREATED);
        
        // Open onramp in popup
        await this.openOnrampPopup();
        
    } catch (error) {
        console.error("OnrampService: Failed to initiate onramp:", error);
        this.setState(OnrampState.ERROR, error);
        this.cleanup();
    }
};

OnrampService.prototype.openOnrampPopup = async function() {
    if (!this.currentOnrampUrl) {
        throw new Error("No onramp URL available");
    }
    
    this.setState(OnrampState.OPENING_ONRAMP);
    
    // Calculate popup position (center of screen)
    const left = (window.screen.width / 2) - (this.popupWidth / 2);
    const top = (window.screen.height / 2) - (this.popupHeight / 2);
    
    const popupFeatures = `
        width=${this.popupWidth},
        height=${this.popupHeight},
        left=${left},
        top=${top},
        resizable=yes,
        scrollbars=yes,
        status=no,
        location=no,
        toolbar=no,
        menubar=no
    `.replace(/\s+/g, '');
    
    try {
        // Open popup
        this.onrampWindow = window.open(this.currentOnrampUrl, 'GridOnramp', popupFeatures);
        
        if (!this.onrampWindow) {
            throw new Error("Failed to open onramp popup. Please allow popups for this site.");
        }
        
        console.log("OnrampService: Popup opened successfully");
        this.setState(OnrampState.ONRAMP_OPEN);
        
        // Start polling popup status
        this.startPopupPolling();
        
    } catch (error) {
        console.error("OnrampService: Failed to open popup:", error);
        this.setState(OnrampState.ERROR, error);
    }
};

OnrampService.prototype.startPopupPolling = function() {
    if (this.pollInterval) {
        clearInterval(this.pollInterval);
    }
    
    this.pollInterval = setInterval(() => {
        if (!this.onrampWindow || this.onrampWindow.closed) {
            console.log("OnrampService: Popup window closed");
            this.handlePopupClosed();
            return;
        }
        
        // Try to detect URL changes (limited by same-origin policy)
        try {
            const popupUrl = this.onrampWindow.location.href;
            if (popupUrl.includes('onramp_status=success')) {
                console.log("OnrampService: Onramp completed successfully");
                this.handleOnrampSuccess();
                return;
            } else if (popupUrl.includes('onramp_status=cancelled')) {
                console.log("OnrampService: Onramp cancelled by user");
                this.handleOnrampCancelled();
                return;
            }
        } catch (e) {
            // Cross-origin error - popup is still on external domain, which is normal
            // Continue polling until popup closes or returns to our domain
        }
    }, this.pollIntervalMs);
};

OnrampService.prototype.handlePopupClosed = function() {
    this.stopPopupPolling();
    
    if (this.state === OnrampState.ONRAMP_OPEN) {
        // Popup was closed without explicit success/cancel - assume cancelled
        this.setState(OnrampState.ONRAMP_CANCELLED);
    }
    
    this.cleanup();
};

OnrampService.prototype.handleOnrampSuccess = function() {
    this.setState(OnrampState.ONRAMP_COMPLETED);
    this.stopPopupPolling();
    
    // Close popup after short delay
    setTimeout(() => {
        if (this.onrampWindow && !this.onrampWindow.closed) {
            this.onrampWindow.close();
        }
        this.cleanup();
    }, 2000);
};

OnrampService.prototype.handleOnrampCancelled = function() {
    this.setState(OnrampState.ONRAMP_CANCELLED);
    this.stopPopupPolling();
    
    // Close popup
    if (this.onrampWindow && !this.onrampWindow.closed) {
        this.onrampWindow.close();
    }
    
    this.cleanup();
};

OnrampService.prototype.stopPopupPolling = function() {
    if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
    }
};

OnrampService.prototype.cleanup = function() {
    this.stopPopupPolling();
    this.currentSessionId = null;
    this.currentOnrampUrl = null;
    this.onrampWindow = null;
    this.state = OnrampState.IDLE;
};

OnrampService.prototype.cancelOnramp = function() {
    console.log("OnrampService: Cancelling onramp");
    
    if (this.onrampWindow && !this.onrampWindow.closed) {
        this.onrampWindow.close();
    }
    
    this.setState(OnrampState.ONRAMP_CANCELLED);
    this.cleanup();
};

OnrampService.prototype.handleOnrampError = function(error) {
    let userMessage = "Failed to start payment process. Please try again.";
    
    const errorMsgLower = error.message?.toLowerCase() || '';
    
    if (errorMsgLower.includes('authentication')) {
        userMessage = "Authentication failed. Please sign in again.";
        // Trigger re-authentication if needed
        if (this.authService) {
            this.authService.handleSessionExpired();
        }
    } else if (errorMsgLower.includes('popup')) {
        userMessage = "Failed to open payment window. Please allow popups for this site and try again.";
    } else if (errorMsgLower.includes('network') || errorMsgLower.includes('timeout')) {
        userMessage = "Network error. Please check your connection and try again.";
    } else if (errorMsgLower.includes('unavailable') || errorMsgLower.includes('503')) {
        userMessage = "Payment service temporarily unavailable. Please try again later.";
    } else if (errorMsgLower.includes('restricted') || errorMsgLower.includes('403')) {
        userMessage = "Payment service is not available for your account. Please contact support.";
    } else if (errorMsgLower.includes('limit') || errorMsgLower.includes('429')) {
        userMessage = "Too many requests. Please wait a moment and try again.";
    } else if (errorMsgLower.includes('grid wallet')) {
        userMessage = "Onramp is only available for Grid wallet users. Please sign in with your email.";
    }
    
    if (this.feedbackService) {
        this.feedbackService.showError("Payment Error", userMessage, true);
    }
};

// Public API methods
OnrampService.prototype.getState = function() {
    return this.state;
};

OnrampService.prototype.isOnrampInProgress = function() {
    return this.state !== OnrampState.IDLE && 
           this.state !== OnrampState.ONRAMP_COMPLETED && 
           this.state !== OnrampState.ONRAMP_CANCELLED &&
           this.state !== OnrampState.ERROR &&
           this.state !== OnrampState.FAILED;
};

OnrampService.prototype.getSessionId = function() {
    return this.currentSessionId;
};

OnrampService.prototype.destroy = function() {
    this.app.off('onramp:request', this.onOnrampRequest, this);
    this.cleanup();
    console.log("OnrampService destroyed.");
};