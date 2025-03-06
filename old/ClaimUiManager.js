///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var ClaimUiManager = pc.createScript('claimUiManager');

// New HTML Claim Prompt entity (must have the claimPromptHtml script attached)
ClaimUiManager.attributes.add('htmlClaimPrompt', { type: 'entity', title: 'HTML Claim Prompt Entity' });

ClaimUiManager.prototype.initialize = function () {
     // Enable and initialize the HTML claim prompt
     if (this.htmlClaimPrompt) {
          this.htmlClaimPrompt.enabled = true;
          if (this.htmlClaimPrompt.script && this.htmlClaimPrompt.script.claimPromptHtml) {
               this.htmlClaimPrompt.script.claimPromptHtml.hide();
               // Register this UI component with the central UI manager
               if (this.app.uiManager) {
                    this.app.uiManager.registerComponent(this.htmlClaimPrompt.script.claimPromptHtml);
               }
          }
     } else {
          console.error("HTML Claim Prompt Entity not assigned in ClaimUiManager!");
     }

     // Listen for key events (E key)
     this.app.keyboard.on(pc.EVENT_KEYDOWN, this.onKeyDown, this);
     // Track the current booth that can be claimed
     this.currentBooth = null;
};

ClaimUiManager.prototype.registerClaimableBooth = function (boothScript) {
     if (!this.currentBooth) {
          this.currentBooth = boothScript;
          console.log("Claimable booth registered: " + boothScript.boothId);
          if (this.htmlClaimPrompt && this.htmlClaimPrompt.script && this.htmlClaimPrompt.script.claimPromptHtml) {
               console.log("Showing HTML claim prompt for booth: " + boothScript.boothId);
               this.htmlClaimPrompt.script.claimPromptHtml.show();
          }
     }
};

ClaimUiManager.prototype.unregisterClaimableBooth = function (boothScript) {
     if (this.currentBooth === boothScript) {
          this.currentBooth = null;
          if (this.htmlClaimPrompt && this.htmlClaimPrompt.script && this.htmlClaimPrompt.script.claimPromptHtml) {
               this.htmlClaimPrompt.script.claimPromptHtml.hide();
          }
     }
};

ClaimUiManager.prototype.onKeyDown = function (event) {
     if (event.key === pc.KEY_E && this.currentBooth) {
          this.sendClaimRequest(this.currentBooth.boothId);
          this.currentBooth = null;
          if (this.htmlClaimPrompt && this.htmlClaimPrompt.script && this.htmlClaimPrompt.script.claimPromptHtml) {
               this.htmlClaimPrompt.script.claimPromptHtml.hide();
          }
     }
};

ClaimUiManager.prototype.sendClaimRequest = function (boothId) {
     var claimData = {
          boothId: boothId,
          // Additional data (e.g., player's wallet) can be added here.
     };
     if (this.app.room) {
          this.app.room.send('claimBooth', claimData);
     } else {
          console.warn("No Colyseus room available for sending claim request!");
     }
};
