///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas\build\playcanvas.d.ts"
var ClaimPromptHtml = pc.createScript('claimPromptHtml');

// === ATTRIBUTES ===
ClaimPromptHtml.attributes.add('css', { type: 'asset', assetType: 'css', title: 'CSS Asset' });
ClaimPromptHtml.attributes.add('html', { type: 'asset', assetType: 'html', title: 'HTML Asset' });
ClaimPromptHtml.attributes.add('claimIcon', { type: 'asset', assetType: 'texture', title: 'Claim Icon' });
ClaimPromptHtml.attributes.add('servicesEntity', { type: 'entity', title: 'Services Entity', description: 'Entity with core services (AuthService, ConfigLoader, etc.)' });
// === INITIALIZE ===
ClaimPromptHtml.prototype.initialize = function () {
     if (this.css && this.css.resource) {
          const style = document.createElement('style');
          document.head.appendChild(style);
          style.innerHTML = this.css.resource.data || this.css.resource;
     }

     let htmlContent = "";
     if (this.html && this.html.resource) {
          htmlContent = this.html.resource.data || this.html.resource;
     }
     this.container = document.createElement('div');
     this.container.innerHTML = htmlContent;
     document.body.appendChild(this.container);

     this.claimPromptEl = this.container.querySelector('#claimPrompt');
     if (!this.claimPromptEl) {
          console.error("ClaimPromptHtml: Element with id 'claimPrompt' not found!");
          return;
     }

     if (this.claimIcon && this.claimIcon.resource) {
          const iconElem = this.container.querySelector('.claim-icon');
          if (iconElem) {
               iconElem.src = this.claimIcon.getFileUrl();
          }
     }

     gsap.set(this.claimPromptEl, {
          y: 50,
          opacity: 0,
          pointerEvents: 'none'
     });

     if (this.app.uiManager) {
          this.app.uiManager.registerComponent(this);
     }

     this.currentBooth = null;

     this.app.keyboard.on(pc.EVENT_KEYDOWN, this.onKeyDown, this);

     // Get AuthService reference
     this.authService = null;
     if (this.servicesEntity && this.servicesEntity.script && this.servicesEntity.script.authService) {
         this.authService = this.servicesEntity.script.authService;
         console.log("ClaimPromptHtml: Found AuthService.");
     } else {
         console.error("ClaimPromptHtml: Services Entity or AuthService script not found!");
         // Optionally listen for services:initialized if late initialization is possible
         this.app.once('services:initialized', () => {
              if (this.servicesEntity && this.servicesEntity.script && this.servicesEntity.script.authService) {
                  this.authService = this.servicesEntity.script.authService;
                  console.log("ClaimPromptHtml: Found late-initialized AuthService.");
              } else {
                   console.error("ClaimPromptHtml: Still couldn't find AuthService after initialization event.");
              }
         });
     }
     this.pendingClaimBoothId = null; // Initialize

     // Listen for auth:connected event to auto-trigger claim after auth flow
     this.app.on('auth:connected', this.onAuthConnected, this);

     // Listen for UI events from BoothController (or UIManager)
     this.app.on('ui:showClaimPrompt', this.onShowPrompt, this);
     this.app.on('ui:hideClaimPrompt', this.onHidePrompt, this);
};

// === THEMING ===
ClaimPromptHtml.prototype.setTheme = function (theme) {
     if (this.claimPromptEl) {
          this.claimPromptEl.style.fontFamily = theme.fontFamily;
     }
};

// === SHOW / HIDE METHODS ===
ClaimPromptHtml.prototype.show = function () {
     gsap.to(this.claimPromptEl, {
          duration: this._animSettings('duration'),
          y: 0,
          opacity: 1,
          pointerEvents: 'auto',
          ease: this._animSettings('expo.in')
     });
};

ClaimPromptHtml.prototype.hide = function () {
     gsap.to(this.claimPromptEl, {
          duration: this._animSettings('duration'),
          y: 50,
          opacity: 0,
          pointerEvents: 'none',
          ease: this._animSettings('expo.out')
     });
};

// === EVENT HANDLERS for UI events ===
ClaimPromptHtml.prototype.onShowPrompt = function (boothScript) {
    // Only show if not already showing for a different booth (or same booth)
    if (!this.currentBooth) {
        this.currentBooth = boothScript;
        console.log("ClaimPromptHtml: Received ui:showClaimPrompt for booth ->", boothScript.boothId);
        this.show(); // Use existing show method
    } else if (this.currentBooth !== boothScript) {
        // If showing for a different booth, update context but don't re-animate if already visible
        console.log("ClaimPromptHtml: Switching context to booth ->", boothScript.boothId);
        this.currentBooth = boothScript;
        // Ensure it's visible if somehow hidden
        if (this.claimPromptEl.style.opacity < 1) {
            this.show();
        }
    }
};

ClaimPromptHtml.prototype.onHidePrompt = function () {
    if (this.currentBooth) {
        console.log("ClaimPromptHtml: Received ui:hideClaimPrompt. Hiding for booth ->", this.currentBooth.boothId);
        this.currentBooth = null;
        this.hide(); // Use existing hide method
    }
};

// --- Removed register/unregister methods ---

// Claim booth (press E)
ClaimPromptHtml.prototype.onKeyDown = function (event) { // Removed async
     if (event.key === pc.KEY_E && this.currentBooth && this.claimPromptEl.style.opacity > 0) {

          if (!this.authService) {
               console.error("ClaimPromptHtml: AuthService not available.");
               // Optionally fire a generic UI error event
               // this.app.fire('ui:show:error', 'Internal Error: Auth Service unavailable.');
               return;
          }

          // Check if the user is authenticated via AuthService
          if (!this.authService.isAuthenticated()) {
               console.log("ClaimPromptHtml: User not authenticated. Initiating wallet connection flow...");
               // Show a message indicating connection is starting
               this.app.fire('ui:show:message', 'Connecting wallet... Press E again after connecting to claim.');
               // Initiate the connection flow
               this.authService.connectWalletFlow().catch(err => {
                   // Error handling is mostly done within AuthService, but log here too.
                   console.error("ClaimPromptHtml: Error during connectWalletFlow initiated by claim attempt:", err);
                   // Optionally show a specific error message via ui:show:message if needed
               });
               // Store the boothId to claim for after successful authentication
               this.pendingClaimBoothId = this.currentBooth.boothId;
               // Do NOT proceed with the claim yet. Wait for auth:connected event.
               // No need to instruct user to press 'E' again. Claim will be auto-triggered after auth.
               event.event.preventDefault();
               event.event.stopPropagation();
               return; // Stop the current claim process, wait for auth to connect
          }
  
          // User is authenticated, proceed with claim request
          // const boothIdToClaim = this.currentBooth.boothId; // No longer get from currentBooth here
          const boothIdToClaim = this.pendingClaimBoothId; // Get from pending, should be set during connectWalletFlow
          if (!boothIdToClaim) {
              console.error("ClaimPromptHtml: No pending booth ID to claim after authentication!");
              return; // Should not happen, but safety check
          }
          this.pendingClaimBoothId = null; // Clear pending claim
          const userAddress = this.authService.getWalletAddress(); // Get address from the source of truth

          console.log(`ClaimPromptHtml: Firing booth:claimRequest for booth '${boothIdToClaim}' by user ${userAddress}`);
          // Fire the application event that MessageBroker listens for
          this.app.fire('booth:claimRequest', boothIdToClaim);

          // Hide prompt immediately after firing request
          this.currentBooth = null;
          this.hide();

          // Prevent default browser behavior (like typing 'e' in an input field)
          event.event.preventDefault();
          event.event.stopPropagation();
     }
};

// --- New handler for auth:connected event ---
ClaimPromptHtml.prototype.onAuthConnected = function(authStateData) {
    if (this.pendingClaimBoothId) {
        const boothIdToClaim = this.pendingClaimBoothId;
        this.pendingClaimBoothId = null; // Clear it immediately

        console.log(`ClaimPromptHtml: AuthService connected. Auto-firing booth:claimRequest for pending booth '${boothIdToClaim}'`);
        // Fire the application event to claim the booth
        this.app.fire('booth:claimRequest', boothIdToClaim);

        // Hide prompt immediately as claim request is sent
        this.hide(); // Hide the claim prompt
    } else {
        console.warn("ClaimPromptHtml: AuthService connected, but no pending booth claim.");
    }
};

// Removed sendClaimRequest function - Replaced by firing 'booth:claimRequest' event in onKeyDown

// === UTILITY: Retrieve Animation Settings from UIManager ===
ClaimPromptHtml.prototype._animSettings = function (prop) {
     const uiMgr = this.app.uiManager;
     if (!uiMgr) {
          const fallback = { duration: 0.5, easeIn: 'expo.out', easeOut: 'expo.in' };
          return fallback[prop];
     }
     return uiMgr.getAnimationSettings()[prop];
};

// Clean up listeners
ClaimPromptHtml.prototype.destroy = function() {
    this.app.off('ui:showClaimPrompt', this.onShowPrompt, this);
    this.app.off('ui:hideClaimPrompt', this.onHidePrompt, this);
    this.app.off('auth:connected', this.onAuthConnected, this); // Clean up new listener
    this.app.keyboard.off(pc.EVENT_KEYDOWN, this.onKeyDown, this);

    // Remove HTML element if needed
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};

// Clean up listeners
ClaimPromptHtml.prototype.destroy = function() {
    this.app.off('ui:showClaimPrompt', this.onShowPrompt, this);
    this.app.off('ui:hideClaimPrompt', this.onHidePrompt, this);
    this.app.keyboard.off(pc.EVENT_KEYDOWN, this.onKeyDown, this);

    // Remove HTML element if needed
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};