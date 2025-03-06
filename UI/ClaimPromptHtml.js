///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var ClaimPromptHtml = pc.createScript('claimPromptHtml');

// === ATTRIBUTES ===
ClaimPromptHtml.attributes.add('css', { type: 'asset', assetType: 'css', title: 'CSS Asset' });
ClaimPromptHtml.attributes.add('html', { type: 'asset', assetType: 'html', title: 'HTML Asset' });
ClaimPromptHtml.attributes.add('claimIcon', { type: 'asset', assetType: 'texture', title: 'Claim Icon' });

// === INITIALIZE ===
ClaimPromptHtml.prototype.initialize = function () {
     // Inject CSS
     if (this.css && this.css.resource) {
          const style = document.createElement('style');
          document.head.appendChild(style);
          style.innerHTML = this.css.resource.data || this.css.resource;
     } else {
          console.warn("ClaimPromptHtml: No CSS asset or resource is missing!");
     }

     // Create container and load HTML
     let htmlContent = "";
     if (this.html && this.html.resource) {
          htmlContent = this.html.resource.data || this.html.resource;
     }
     this.container = document.createElement('div');
     this.container.innerHTML = htmlContent;
     document.body.appendChild(this.container);

     // Locate the main prompt element
     this.claimPromptEl = this.container.querySelector('#claimPrompt');
     if (!this.claimPromptEl) {
          console.error("ClaimPromptHtml: Element with id 'claimPrompt' not found!");
          return;
     }

     // If there's a claim icon element, set it
     if (this.claimIcon && this.claimIcon.resource) {
          const iconElem = this.container.querySelector('.claim-icon');
          if (iconElem) {
               iconElem.src = this.claimIcon.getFileUrl();
          }
     }

     // GSAP initial off-screen state
     gsap.set(this.claimPromptEl, {
          y: 50,
          opacity: 0,
          pointerEvents: 'none'
     });

     // Register with UI manager for theming
     if (this.app.uiManager) {
          this.app.uiManager.registerComponent(this);
     }

     // Track the current booth that can be claimed
     this.currentBooth = null;

     // Listen for E key
     this.app.keyboard.on(pc.EVENT_KEYDOWN, this.onKeyDown, this);
};

// === THEMING ===
ClaimPromptHtml.prototype.setTheme = function (theme) {
     if (this.claimPromptEl) {
          this.claimPromptEl.style.fontFamily = theme.fontFamily;
          // You could also use theme.primaryColor, etc., as needed
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
     // If we don't have a current booth, set it
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

// === KEY HANDLING & SEND CLAIM ===
ClaimPromptHtml.prototype.onKeyDown = function (event) {
     if (event.key === pc.KEY_E && this.currentBooth) {
          // Attempt to send the claim request
          this.sendClaimRequest(this.currentBooth.boothId);
          // Clear the booth
          this.currentBooth = null;
          this.hide();
     }
};

ClaimPromptHtml.prototype.sendClaimRequest = function (boothId) {
     // Provide your server logic here
     const claimData = {
          boothId: boothId,
          // Additional data (e.g., player's wallet) can be added
     };

     if (this.app.room) {
          this.app.room.send('claimBooth', claimData);
     } else {
          console.warn("ClaimPromptHtml: No Colyseus room available!");
     }
};

// === UTILITY: Retrieve Animation Settings from UIManager ===
ClaimPromptHtml.prototype._animSettings = function (prop) {
     const uiMgr = this.app.uiManager;
     if (!uiMgr) {
          // fallback
          const fallback = { duration: 0.5, easeIn: 'expo.out', easeOut: 'expo.in' };
          return fallback[prop];
     }
     return uiMgr.getAnimationSettings()[prop];
};
