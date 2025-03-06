///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
// boothClaimZone.js
var BoothClaimZone = pc.createScript('boothClaimZone');

// Called once when the script is attached
BoothClaimZone.prototype.initialize = function () {
     // Set a unique identifier (using entity name or GUID)
     this.boothId = this.entity.name || 'booth_' + this.entity.getGuid();

     // Initialize claimedBy property to null (or false)
     this.claimedBy = null;

     // Listen to trigger events on this entity’s collision component
     this.entity.collision.on('triggerenter', this.onTriggerEnter, this);
     this.entity.collision.on('triggerleave', this.onTriggerLeave, this);
};

BoothClaimZone.prototype.onTriggerEnter = function (otherEntity) {
     if (otherEntity.tags && otherEntity.tags.has('player')) {
          console.log('Player entered booth zone: ' + this.boothId);
          var localPlayer = this.app.localPlayer;
          if (!localPlayer) return;

          // If the booth is not claimed and the player hasn't claimed one, show claim UI.
          if (!this.claimedBy && !localPlayer.claimBoothId) {
               var claimPromptEntity = this.app.root.findByName("HTMLClaimPrompt");
               if (claimPromptEntity && claimPromptEntity.script && claimPromptEntity.script.claimPromptHtml) {
                    console.log("Showing claim UI for booth:", this.boothId);
                    claimPromptEntity.script.claimPromptHtml.registerClaimableBooth(this);
               }
          }
          // If the booth is claimed and not by the local player, show donation UI.
          else if (true || this.claimedBy && this.claimedBy !== localPlayer.address) {
               var donationUI = this.app.root.findByName("HTMLDonationUI");
               if (donationUI && donationUI.script && donationUI.script.donationPromptHtml) {
                    console.log("Showing donation UI for booth: " + this.boothId);
                    donationUI.script.donationPromptHtml.setRecipient(this.claimedBy);
                    donationUI.script.donationPromptHtml.show();
               }
          } else {
               console.log("Player is the owner of booth: " + this.boothId + " or other conditions met; no donation UI.");
          }
     }
};

BoothClaimZone.prototype.onTriggerLeave = function (otherEntity) {
     if (otherEntity.tags && otherEntity.tags.has('player')) {
          // Hide claim UI if it was active
          var claimPromptEntity = this.app.root.findByName("HTMLClaimPrompt");
          if (claimPromptEntity && claimPromptEntity.script && claimPromptEntity.script.claimPromptHtml) {
               console.log("Hiding claim UI for booth:", this.boothId);
               claimPromptEntity.script.claimPromptHtml.unregisterClaimableBooth(this);
          }

          // Hide donation UI if it was active
          var donationUI = this.app.root.findByName("HTMLDonationUI");
          if (donationUI && donationUI.script && donationUI.script.donationPromptHtml) {
               console.log("Hiding donation UI for booth: " + this.boothId);
               donationUI.script.donationPromptHtml.hide();
          }
     }
};

