// Scripts/UI/HtmlBridge/HtmlAuthChoice.js
var HtmlAuthChoice = pc.createScript('htmlAuthChoice');

HtmlAuthChoice.attributes.add('cssAsset', {
    type: 'asset',
    assetType: 'css',
    title: 'Auth Choice CSS Asset'
});

HtmlAuthChoice.attributes.add('htmlAsset', {
    type: 'asset',
    assetType: 'html',
    title: 'Auth Choice HTML Asset'
});

HtmlAuthChoice.attributes.add('servicesEntity', {
    type: 'entity',
    title: 'Services Entity',
    description: 'Entity with core services (AuthService, ConfigLoader, etc.)'
});

HtmlAuthChoice.prototype.initialize = function() {
    console.log("HtmlAuthChoice initializing...");
    
    // Inject CSS
    if (this.cssAsset?.resource) {
        const style = document.createElement('style');
        document.head.appendChild(style);
        style.innerHTML = this.cssAsset.resource;
    } else {
        console.warn("HtmlAuthChoice: CSS Asset not found or loaded.");
        this.cssAsset?.ready(asset => {
            const style = document.createElement('style');
            document.head.appendChild(style);
            style.innerHTML = asset.resource;
        });
    }

    // Inject HTML
    if (this.htmlAsset?.resource) {
        this.injectHtml(this.htmlAsset.resource);
    } else {
        console.warn("HtmlAuthChoice: HTML Asset not found or loaded.");
        this.htmlAsset?.ready(asset => this.injectHtml(asset.resource));
    }

    // Get services
    this.authService = null;
    this.configLoader = null;
    this.feedbackService = null;
    
    if (this.servicesEntity && this.servicesEntity.script) {
        this.authService = this.servicesEntity.script.authService;
        this.configLoader = this.servicesEntity.script.configLoader;
        if (this.app.services) {
            this.feedbackService = this.app.services.get('feedbackService');
        }
    }

    // State management
    this.pendingBoothId = null;
    this.emailValue = '';

    // Listen for events
    this.app.on('ui:showAuthChoice', this.onShowAuthChoice, this);
    this.app.on('ui:hideAuthChoice', this.onHideAuthChoice, this);

    console.log("HtmlAuthChoice initialized.");
};

HtmlAuthChoice.prototype.injectHtml = function(htmlResource) {
    if (this.container) return; // Already injected

    this.container = document.createElement('div');
    this.container.innerHTML = htmlResource;
    document.body.appendChild(this.container);

    // Find elements
    this.overlay = this.container.querySelector('#auth-choice-overlay');
    this.modal = this.container.querySelector('#auth-choice-modal');
    this.closeBtn = this.container.querySelector('#auth-choice-close');
    this.emailOption = this.container.querySelector('#auth-choice-email');
    this.walletOption = this.container.querySelector('#auth-choice-wallet');
    this.emailInput = this.container.querySelector('#email-input');
    this.otpInput = this.container.querySelector('#otp-input');
    this.emailSubmitBtn = this.container.querySelector('#email-submit');
    this.walletConnectBtn = this.container.querySelector('#wallet-connect');

    if (!this.overlay || !this.modal) {
        console.error("HtmlAuthChoice: Required elements not found in HTML.");
        return;
    }

    // Set up event listeners
    this.setupEventListeners();

    console.log("HtmlAuthChoice: HTML injected and elements found.");
};

HtmlAuthChoice.prototype.setupEventListeners = function() {
    // Close modal
    this.closeBtn.addEventListener('click', () => this.hide());
    this.overlay.addEventListener('click', (event) => {
        if (event.target === this.overlay) {
            this.hide();
        }
    });

    // Email flow
    this.emailSubmitBtn.addEventListener('click', () => this.handleEmailSubmit());
    this.emailInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            this.handleEmailSubmit();
        }
    });
    this.otpInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            this.handleEmailSubmit();
        }
    });

    // Wallet flow
    this.walletConnectBtn.addEventListener('click', () => this.handleWalletConnect());

    // Accessibility
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !this.overlay.classList.contains('auth-choice-modal-hidden')) {
            this.hide();
        }
    });
};

HtmlAuthChoice.prototype.onShowAuthChoice = function(data) {
    this.pendingBoothId = data?.boothId || null;
    this.show();
};

HtmlAuthChoice.prototype.onHideAuthChoice = function() {
    this.hide();
};

HtmlAuthChoice.prototype.show = function() {
    if (!this.overlay) return;
    
    this.resetToChoice();
    this.overlay.classList.remove('auth-choice-modal-hidden');
    
    // Focus first interactive element
    setTimeout(() => {
        const firstInput = this.modal.querySelector('input:not([style*="display: none"]), button');
        if (firstInput) firstInput.focus();
    }, 100);
};

HtmlAuthChoice.prototype.hide = function() {
    if (!this.overlay) return;
    
    this.overlay.classList.add('auth-choice-modal-hidden');
    this.resetToChoice();
    this.pendingBoothId = null;
    this.emailValue = '';
};

HtmlAuthChoice.prototype.resetToChoice = function() {
    if (this.emailInput) this.emailInput.style.display = 'block';
    if (this.otpInput) this.otpInput.style.display = 'none';
    if (this.emailSubmitBtn) {
        this.emailSubmitBtn.textContent = 'Sign in with Email';
        this.emailSubmitBtn.disabled = false;
        this.emailSubmitBtn.classList.remove('loading');
    }
    if (this.emailInput) this.emailInput.value = this.emailValue;
    if (this.otpInput) this.otpInput.value = '';
};

HtmlAuthChoice.prototype.handleEmailSubmit = async function() {
    if (!this.authService || !this.configLoader) {
        console.error("HtmlAuthChoice: Required services not available.");
        return;
    }

    const gridAuthUrl = this.configLoader.get('cloudflareWorkerGridAuthEndpoint');
    if (!gridAuthUrl) {
        console.error("HtmlAuthChoice: Grid auth endpoint not configured.");
        if (this.feedbackService) {
            this.feedbackService.showError("Configuration Error", "Grid authentication not configured.");
        }
        return;
    }

    // Single step Grid authentication - no OTP on frontend
    const email = this.emailInput.value.trim();
    if (!email || !this.isValidEmail(email)) {
        if (this.feedbackService) {
            this.feedbackService.showError("Invalid Email", "Please enter a valid email address.");
        }
        return;
    }

    this.emailValue = email;
    this.setLoading(true, 'Authenticating with Grid...');

    try {
        // Use the AuthService Grid authentication method (handles the complete flow)
        const walletAddress = await this.authService.connectWithGrid(email);
        
        if (walletAddress) {
            this.hide();
            
            // Trigger booth claim if we have a pending booth
            if (this.pendingBoothId) {
                this.app.fire('booth:claimRequest', this.pendingBoothId);
            }
        } else {
            throw new Error('Grid authentication failed - no wallet address returned');
        }

    } catch (error) {
        console.error("Grid authentication error:", error);
        this.setLoading(false);
        if (this.feedbackService) {
            this.feedbackService.showError("Authentication Failed", error.message);
        }
    }
};

HtmlAuthChoice.prototype.handleWalletConnect = async function() {
    if (!this.authService) {
        console.error("HtmlAuthChoice: AuthService not available.");
        return;
    }

    this.hide();
    
    try {
        await this.authService.connectWalletFlow();
        
        // Trigger booth claim if we have a pending booth
        if (this.pendingBoothId) {
            this.app.fire('booth:claimRequest', this.pendingBoothId);
        }
    } catch (error) {
        console.error("Wallet connection error:", error);
        // AuthService handles error feedback
    }
};

HtmlAuthChoice.prototype.setLoading = function(loading, text = null) {
    if (!this.emailSubmitBtn) return;
    
    this.emailSubmitBtn.disabled = loading;
    if (loading) {
        this.emailSubmitBtn.classList.add('loading');
        if (text) this.emailSubmitBtn.textContent = text;
    } else {
        this.emailSubmitBtn.classList.remove('loading');
    }
};

HtmlAuthChoice.prototype.isValidEmail = function(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

HtmlAuthChoice.prototype.destroy = function() {
    this.app.off('ui:showAuthChoice', this.onShowAuthChoice, this);
    this.app.off('ui:hideAuthChoice', this.onHideAuthChoice, this);
    
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};
