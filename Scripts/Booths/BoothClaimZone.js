///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var BoothClaimZone = pc.createScript('boothClaimZone');

BoothClaimZone.prototype.initialize = function () {
     // Set a unique identifier (using entity name or GUID)
     this.boothId = this.entity.name;
     // Initialize claimedBy property to null (or false)
     this.claimedBy = null;
     // Listen to trigger events on this entity’s collision component
     this.entity.collision.on('triggerenter', this.onTriggerEnter, this);
     this.entity.collision.on('triggerleave', this.onTriggerLeave, this);

     // Listen for booth state updates from BoothSync
     this.app.on('booth:updated', this.handleBoothUpdate, this);
};

// In BoothClaimZone.js onTriggerEnter (unchanged, with added logging)
BoothClaimZone.prototype.onTriggerEnter = function (otherEntity) {
     if (otherEntity.tags && otherEntity.tags.has('player')) {
          console.log('Player entered booth zone: ' + this.boothId);
          var localPlayerEntity = this.app.localPlayer; // Get the entity
          if (!localPlayerEntity || !localPlayerEntity.script || !localPlayerEntity.script.playerData) {
               console.warn("BoothClaimZone: Local player entity or PlayerData script not found.");
               return;
          }
          const localPlayerData = localPlayerEntity.script.playerData; // Get the PlayerData script instance

          // Access data via PlayerData script methods/properties
          const localWalletAddress = localPlayerData.getWalletAddress();
          const localClaimedBoothId = localPlayerData.getClaimedBoothId();

          console.log(`BoothClaimZone (${this.boothId}): Trigger Enter. Firing booth:entered event.`);
          // Fire an event for BoothController to handle UI logic
          this.app.fire('booth:entered', this);

          // --- UI Logic Removed - Moved to BoothController ---
     } // <-- This closes the 'if (otherEntity.tags...' block
     // Remove the extra closing brace that was here
};

BoothClaimZone.prototype.onTriggerLeave = function (otherEntity) {
     // Only fire event if it's the local player leaving
     const localPlayerEntity = this.app.localPlayer;
     if (otherEntity === localPlayerEntity) {
          console.log(`BoothClaimZone (${this.boothId}): Trigger Leave. Firing booth:left event.`);
          // Fire an event for BoothController to handle UI logic
          this.app.fire('booth:left', this);
     }
     // --- UI Logic Removed - Moved to BoothController ---
     // if (otherEntity.tags && otherEntity.tags.has('player')) {
     //      // Hide claim UI if active.
     //      var claimPromptEntity = this.app.root.findByName("HTMLClaimPrompt");
     //      if (claimPromptEntity && claimPromptEntity.script && claimPromptEntity.script.claimPromptHtml) {
     //           // console.log("Hiding claim UI for booth:", this.boothId); // Handled by Controller
     //           // claimPromptEntity.script.claimPromptHtml.unregisterClaimableBooth(this); // Handled by Controller
     //      }
     //      // Hide donation UI if active.
     //      var donationUI = this.app.root.findByName("HTMLDonationUI");
     //      if (donationUI && donationUI.script && donationUI.script.donationPromptHtml) {
     //           // console.log("Hiding donation UI for booth: " + this.boothId); // Handled by Controller
     //           // donationUI.script.donationPromptHtml.hide(); // Handled by Controller
     //      }
     // }
 };

 // Called when BoothSync fires 'booth:updated'
 BoothClaimZone.prototype.handleBoothUpdate = function(boothData) {
     // Check if the update is for this specific booth
     if (boothData && boothData.boothId === this.boothId) {
         // Update the claimedBy status
         const newClaimedBy = boothData.claimedBy || null; // Ensure null if undefined/empty
         if (this.claimedBy !== newClaimedBy) {
             console.log(`BoothClaimZone (${this.boothId}): ClaimedBy updated from '${this.claimedBy}' to '${newClaimedBy}'`);
             this.claimedBy = newClaimedBy;
             // BoothController will listen for this 'booth:updated' event too
             // and call its updateBoothPrompts function if the player is currently in this zone.
         }
     }
 };

 // Clean up listeners when the script is destroyed
 BoothClaimZone.prototype.destroy = function() {
     this.app.off('booth:updated', this.handleBoothUpdate, this);
     // Collision listeners are usually handled automatically by the engine if attached to the entity component
 };