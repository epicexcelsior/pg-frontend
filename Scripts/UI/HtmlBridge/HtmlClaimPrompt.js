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
          ease: this._animSettings('easeIn')
     });
};

ClaimPromptHtml.prototype.hide = function () {
     gsap.to(this.claimPromptEl, {
          duration: this._animSettings('duration'),
          y: 50,
          opacity: 0,
          pointerEvents: 'none',
          ease: this._animSettings('easeOut')
     });
};

// === REGISTER / UNREGISTER BOOTHS ===
ClaimPromptHtml.prototype.registerClaimableBooth = function (boothScript) {
     if (!this.currentBooth) {
          this.currentBooth = boothScript;
          console.log("ClaimPromptHtml: Booth registered ->", boothScript.boothId);
          this.show();
     }
};

ClaimPromptHtml.prototype.unregisterClaimableBooth = function (boothScript) {
     if (this.currentBooth === boothScript) {
          this.currentBooth = null;
          this.hide();
     }
};

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
               // Do NOT proceed with the claim yet. User needs to press E again after successful connection.
               // Prevent default browser behavior even if not claiming yet
               event.event.preventDefault();
               event.event.stopPropagation();
               return; // Stop the current claim process, wait for user to connect and press E again
          }

          // User is authenticated, proceed with claim request
          const boothIdToClaim = this.currentBooth.boothId;
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