///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas\build\playcanvas.d.ts"
var HtmlClaimPrompt = pc.createScript('htmlClaimPrompt');

// === ATTRIBUTES ===
HtmlClaimPrompt.attributes.add('css', { type: 'asset', assetType: 'css', title: 'CSS Asset' });
HtmlClaimPrompt.attributes.add('html', { type: 'asset', assetType: 'html', title: 'HTML Asset' });

// === INITIALIZE ===
HtmlClaimPrompt.prototype.initialize = function () {
    // 1. Inject HTML and CSS
    if (this.css && this.css.resource) {
        const style = document.createElement('style');
        document.head.appendChild(style);
        style.innerHTML = this.css.resource;
    }
    this.container = document.createElement('div');
    this.container.innerHTML = this.html.resource;
    document.body.appendChild(this.container);

    // 2. Get DOM Elements
    this.claimPromptEl = this.container.querySelector('#claimPrompt');
    this.claimButton = this.container.querySelector('#claimButton');

    if (!this.claimPromptEl || !this.claimButton) {
        console.error("HtmlClaimPrompt: Required DOM elements (#claimPrompt, #claimButton) not found!");
        return;
    }

    // 3. Get PrivyService
    this.privyService = this.app.services?.get('privyService');
    if (!this.privyService) {
        this.app.once('services:initialized', () => {
            this.privyService = this.app.services.get('privyService');
        });
    }

    // 4. Setup Listeners
    this.claimButton.addEventListener('click', this.onClaimClick.bind(this));
    this.app.keyboard.on(pc.EVENT_KEYDOWN, this.onKeyDown, this);
    this.app.on('ui:showClaimPrompt', this.onShowPrompt, this);
    this.app.on('ui:hideClaimPrompt', this.hide, this);
    this.app.on('auth:stateChanged', this.onAuthStateChanged, this);

    // 5. Initial State
    this.currentBoothId = null;
    gsap.set(this.claimPromptEl, { y: 50, opacity: 0, pointerEvents: 'none' });

    console.log("HtmlClaimPrompt initialized (Privy Version).");
};

// === EVENT HANDLERS ===
HtmlClaimPrompt.prototype.onShowPrompt = function (boothZoneScript) {
    if (!boothZoneScript || !boothZoneScript.boothId) return;
    this.currentBoothId = boothZoneScript.boothId;
    gsap.to(this.claimPromptEl, { duration: 0.5, y: 0, opacity: 1, pointerEvents: 'auto', ease: 'expo.out' });
};

HtmlClaimPrompt.prototype.hide = function () {
    this.currentBoothId = null;
    gsap.to(this.claimPromptEl, { duration: 0.5, y: 50, opacity: 0, pointerEvents: 'none', ease: 'expo.in' });
    
    // Also hide the Privy iframe if it's open
    if (this.privyService && this.privyService.forceHide) {
        this.privyService.forceHide();
    }
};

HtmlClaimPrompt.prototype.onClaimClick = function () {
    if (!this.currentBoothId || !this.privyService) {
        console.error("HtmlClaimPrompt: Cannot claim - no booth ID or PrivyService.");
        return;
    }

    if (this.privyService.isAuthenticated()) {
        console.log(`HtmlClaimPrompt: Firing claim request for ${this.currentBoothId}`);
        this.app.fire('booth:claimRequest', this.currentBoothId);
        this.hide();
    } else {
        console.log("HtmlClaimPrompt: User not authenticated. Triggering login.");
        // Store the booth ID for after authentication
        this.pendingBoothClaim = this.currentBoothId;
        // Use generic login. The Privy UI will handle provider selection.
        this.privyService.login();
        // Don't hide immediately - let the auth flow complete
    }
};


HtmlClaimPrompt.prototype.onKeyDown = function (event) {
    if (event.key === pc.KEY_E && this.currentBoothId) {
        this.onClaimClick();
        event.event.preventDefault();
        event.event.stopPropagation();
    }
};

HtmlClaimPrompt.prototype.onAuthStateChanged = function (stateData) {
    // If user just became authenticated and we have a pending booth claim
    if (stateData.state === 'connected' && this.pendingBoothClaim) {
        console.log(`HtmlClaimPrompt: Authentication completed. Auto-claiming booth ${this.pendingBoothClaim}`);
        // Small delay to ensure all state is updated
        setTimeout(() => {
            this.app.fire('booth:claimRequest', this.pendingBoothClaim);
            this.pendingBoothClaim = null;
            this.hide();
        }, 100);
    }
};

// === CLEANUP ===
HtmlClaimPrompt.prototype.destroy = function() {
    this.app.off('ui:showClaimPrompt', this.onShowPrompt, this);
    this.app.off('ui:hideClaimPrompt', this.hide, this);
    this.app.off('auth:stateChanged', this.onAuthStateChanged, this);
    this.app.keyboard.off(pc.EVENT_KEYDOWN, this.onKeyDown, this);
    if (this.claimButton) {
        this.claimButton.removeEventListener('click', this.onClaimClick.bind(this));
    }
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};