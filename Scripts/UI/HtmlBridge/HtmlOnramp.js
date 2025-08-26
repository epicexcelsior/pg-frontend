// Scripts/UI/HtmlBridge/HtmlOnramp.js
var HtmlOnramp = pc.createScript('htmlOnramp');

HtmlOnramp.attributes.add('cssAsset', {
    type: 'asset',
    assetType: 'css',
    title: 'Onramp CSS Asset'
});

HtmlOnramp.attributes.add('htmlAsset', {
    type: 'asset',
    assetType: 'html',
    title: 'Onramp HTML Asset'
});

HtmlOnramp.prototype.initialize = function() {
    console.log("HtmlOnramp initializing...");
    
    // Inject CSS
    if (this.cssAsset?.resource) {
        const style = document.createElement('style');
        document.head.appendChild(style);
        style.innerHTML = this.cssAsset.resource;
    } else {
        console.warn("HtmlOnramp: CSS Asset not found or loaded.");
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
        console.warn("HtmlOnramp: HTML Asset not found or loaded.");
        this.htmlAsset?.ready(asset => this.injectHtml(asset.resource));
    }

    // Get services
    this.authService = null;
    this.onrampService = null;
    this.feedbackService = null;
    
    if (this.app.services) {
        this.authService = this.app.services.get('authService');
        this.onrampService = this.app.services.get('onrampService');
        this.feedbackService = this.app.services.get('feedbackService');
    }

    // State management
    this.isVisible = false;
    this.suggestedAmount = null;

    // Listen for events
    this.app.on('ui:showOnrampModal', this.onShowOnrampModal, this);
    this.app.on('ui:hideOnrampModal', this.onHideOnrampModal, this);
    this.app.on('onramp:stateChanged', this.onOnrampStateChanged, this);

    console.log("HtmlOnramp initialized.");
};

HtmlOnramp.prototype.injectHtml = function(htmlResource) {
    if (this.container) return; // Already injected

    this.container = document.createElement('div');
    this.container.innerHTML = htmlResource;
    document.body.appendChild(this.container);

    // Find elements
    this.overlay = this.container.querySelector('#onramp-modal-overlay');
    this.modal = this.container.querySelector('#onramp-modal');
    this.closeBtn = this.container.querySelector('#onramp-close');
    this.amountInput = this.container.querySelector('#onramp-amount');
    this.currencySelect = this.container.querySelector('#onramp-currency');
    this.addFundsBtn = this.container.querySelector('#add-funds-btn');
    this.statusText = this.container.querySelector('#onramp-status');
    this.cancelBtn = this.container.querySelector('#cancel-onramp-btn');
    
    // Preset amount buttons
    this.presetBtns = this.container.querySelectorAll('.preset-amount-btn');

    if (!this.overlay || !this.modal) {
        console.error("HtmlOnramp: Required elements not found in HTML.");
        return;
    }

    // Set up event listeners
    this.setupEventListeners();

    console.log("HtmlOnramp: HTML injected and elements found.");
};

HtmlOnramp.prototype.setupEventListeners = function() {
    // Close modal
    if (this.closeBtn) {
        this.closeBtn.addEventListener('click', () => this.hide());
    }
    
    if (this.overlay) {
        this.overlay.addEventListener('click', (event) => {
            if (event.target === this.overlay) {
                this.hide();
            }
        });
    }

    // Amount input validation
    if (this.amountInput) {
        this.amountInput.addEventListener('input', (event) => {
            this.validateAmount(event.target.value);
        });
        
        this.amountInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                this.handleAddFunds();
            }
        });
    }

    // Preset amount buttons
    this.presetBtns.forEach(btn => {
        btn.addEventListener('click', (event) => {
            const amount = parseFloat(event.target.dataset.amount);
            if (amount && this.amountInput) {
                this.amountInput.value = amount;
                this.validateAmount(amount);
            }
        });
    });

    // Add funds button
    if (this.addFundsBtn) {
        this.addFundsBtn.addEventListener('click', () => this.handleAddFunds());
    }

    // Cancel button
    if (this.cancelBtn) {
        this.cancelBtn.addEventListener('click', () => this.handleCancel());
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        if (this.isVisible && event.key === 'Escape') {
            this.hide();
        }
    });
};

HtmlOnramp.prototype.onShowOnrampModal = function(data) {
    this.suggestedAmount = data?.suggestedAmount || null;
    this.show();
};

HtmlOnramp.prototype.onHideOnrampModal = function() {
    this.hide();
};

HtmlOnramp.prototype.show = function() {
    if (!this.overlay || !this.authService) return;

    // Check if user is authenticated with Grid
    if (!this.authService.isAuthenticated() || this.authService.getAuthProvider() !== 'grid') {
        if (this.feedbackService) {
            this.feedbackService.showError("Grid Required", "Please sign in with your email to add funds to your Grid wallet.");
        }
        return;
    }

    this.isVisible = true;
    this.overlay.classList.remove('onramp-modal-hidden');
    
    // Set suggested amount if provided
    if (this.suggestedAmount && this.amountInput) {
        this.amountInput.value = this.suggestedAmount;
        this.validateAmount(this.suggestedAmount);
    }

    // Reset UI state
    this.resetUIState();
    
    // Focus amount input
    setTimeout(() => {
        if (this.amountInput) {
            this.amountInput.focus();
            this.amountInput.select();
        }
    }, 100);
};

HtmlOnramp.prototype.hide = function() {
    if (!this.overlay) return;
    
    this.isVisible = false;
    this.overlay.classList.add('onramp-modal-hidden');
    this.suggestedAmount = null;
    
    // Cancel any ongoing onramp if modal is closed
    if (this.onrampService && this.onrampService.isOnrampInProgress()) {
        this.onrampService.cancelOnramp();
    }
};

HtmlOnramp.prototype.resetUIState = function() {
    // Reset form state
    if (this.addFundsBtn) {
        this.addFundsBtn.disabled = false;
        this.addFundsBtn.textContent = 'Add Funds';
        this.addFundsBtn.classList.remove('loading');
    }
    
    if (this.cancelBtn) {
        this.cancelBtn.style.display = 'none';
    }
    
    if (this.statusText) {
        this.statusText.textContent = '';
        this.statusText.style.display = 'none';
    }

    // Enable form controls
    this.setFormEnabled(true);
};

HtmlOnramp.prototype.setFormEnabled = function(enabled) {
    if (this.amountInput) this.amountInput.disabled = !enabled;
    if (this.currencySelect) this.currencySelect.disabled = !enabled;
    if (this.addFundsBtn) this.addFundsBtn.disabled = !enabled;
    
    this.presetBtns.forEach(btn => {
        btn.disabled = !enabled;
    });
};

HtmlOnramp.prototype.validateAmount = function(amount) {
    const numAmount = parseFloat(amount);
    const isValid = !isNaN(numAmount) && numAmount > 0 && numAmount <= 10000; // Reasonable limits
    
    if (this.addFundsBtn) {
        this.addFundsBtn.disabled = !isValid;
    }
    
    return isValid;
};

HtmlOnramp.prototype.handleAddFunds = function() {
    if (!this.onrampService) {
        console.error("HtmlOnramp: OnrampService not available");
        return;
    }

    const amount = parseFloat(this.amountInput?.value || 0);
    const currency = this.currencySelect?.value || 'USD';

    if (!this.validateAmount(amount)) {
        if (this.feedbackService) {
            this.feedbackService.showError("Invalid Amount", "Please enter a valid amount between $1 and $10,000.");
        }
        return;
    }

    console.log(`HtmlOnramp: Starting onramp for ${amount} ${currency}`);

    // Update UI to show loading state
    if (this.addFundsBtn) {
        this.addFundsBtn.disabled = true;
        this.addFundsBtn.textContent = 'Creating Session...';
        this.addFundsBtn.classList.add('loading');
    }

    if (this.statusText) {
        this.statusText.textContent = 'Setting up secure payment...';
        this.statusText.style.display = 'block';
    }

    // Disable form during process
    this.setFormEnabled(false);

    // Initiate onramp
    this.onrampService.initiateOnramp(amount, currency);
};

HtmlOnramp.prototype.handleCancel = function() {
    if (this.onrampService && this.onrampService.isOnrampInProgress()) {
        this.onrampService.cancelOnramp();
    }
    
    this.hide();
};

HtmlOnramp.prototype.onOnrampStateChanged = function(data) {
    const { state, error } = data;
    
    // Update UI based on onramp state
    switch (state) {
        case 'creating_session':
            if (this.statusText) {
                this.statusText.textContent = 'Creating secure payment session...';
                this.statusText.style.display = 'block';
            }
            
            if (this.addFundsBtn) {
                this.addFundsBtn.textContent = 'Creating Session...';
            }
            break;

        case 'session_created':
            if (this.statusText) {
                this.statusText.textContent = 'Opening secure payment window...';
            }
            
            if (this.addFundsBtn) {
                this.addFundsBtn.textContent = 'Opening Payment...';
            }
            break;

        case 'onramp_open':
            if (this.statusText) {
                this.statusText.textContent = 'Complete your purchase in the secure payment window.';
            }
            
            if (this.addFundsBtn) {
                this.addFundsBtn.textContent = 'Payment Window Open';
            }
            
            if (this.cancelBtn) {
                this.cancelBtn.style.display = 'inline-block';
            }
            break;

        case 'onramp_completed':
            // Hide modal on successful completion
            setTimeout(() => this.hide(), 2000);
            break;

        case 'onramp_cancelled':
        case 'idle':
            this.resetUIState();
            break;

        case 'failed':
        case 'error':
            console.error("HtmlOnramp: Onramp error:", error);
            this.resetUIState();
            // Error feedback is handled by OnrampService
            break;
    }
};

HtmlOnramp.prototype.destroy = function() {
    this.app.off('ui:showOnrampModal', this.onShowOnrampModal, this);
    this.app.off('ui:hideOnrampModal', this.onHideOnrampModal, this);
    this.app.off('onramp:stateChanged', this.onOnrampStateChanged, this);
    
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
    
    console.log("HtmlOnramp destroyed.");
};