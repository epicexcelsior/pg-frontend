///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var CustomDonationHandler = pc.createScript('customDonationHandler');

CustomDonationHandler.prototype.initialize = function () {
     if (this.entity.button) {
          this.entity.button.on('click', this.onClick, this);
          console.log('CustomDonationHandler attached to:', this.entity.name);
     } else {
          console.error("CustomDonationHandler: No button component found on", this.entity.name);
     }
};

CustomDonationHandler.prototype.onClick = function () {
     // Find the input element that contains the custom donation amount.
     var inputEntity = this.app.root.findByName("CustomDonationInput"); // Change name as needed.
     if (inputEntity && inputEntity.element) {
          var donationAmount = parseFloat(inputEntity.element.text); // Use .value if it's an input field.
          if (isNaN(donationAmount)) {
               console.error("CustomDonationHandler: Invalid donation amount");
               return;
          }

          // Find the central donationManager entity.
          var donationManager = this.app.root.findByName("DonationManager");
          if (donationManager && donationManager.script && donationManager.script.donationManager) {
               donationManager.script.donationManager.initiateDonation(this.donationAmount, boothOwnerAddress);
          } else {
               console.error("Custom donation handler not found");
          }
     } else {
          console.error("Custom donation input element not found");
     }
};
