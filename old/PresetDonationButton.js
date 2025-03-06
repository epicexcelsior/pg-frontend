///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var PresetDonationButton = pc.createScript('presetDonationButton');

// Expose a donation amount attribute so you can configure it per button
PresetDonationButton.attributes.add('donationAmount', { type: 'number', default: 0.05, title: 'Donation Amount (SOL)' });

PresetDonationButton.prototype.initialize = function () {
    // Ensure the button component exists
    if (this.entity.button) {
        this.entity.button.on('click', this.onClick, this);
        console.log('PresetDonationButton attached to:', this.entity.name);
    } else {
        console.error("PresetDonationButton: No button component found on", this.entity.name);
    }
};

PresetDonationButton.prototype.onClick = function () {
    console.log("Preset donation button clicked with amount:", this.donationAmount);

    // Find the global donationManager entity.
    var donationManager = this.app.root.findByName("DonationManager");
    if (donationManager && donationManager.script && donationManager.script.donationManager) {
        // Set the donation amount to the preset value.
        //donationManager.script.donationManager.amount = this.donationAmount;
        // Immediately initiate the donation transaction.
        donationManager.script.donationManager.initiateDonation(this.donationAmount, boothOwnerAddress);
    } else {
        console.error("Donation handler not found for preset donation button");
    }

    // Hide the donation UI after initiating the transaction.
    var donationPromptEntity = this.app.root.findByName("BoothDonationUI");
    if (donationPromptEntity && donationPromptEntity.script && donationPromptEntity.script.donationPrompt) {
        donationPromptEntity.script.donationPrompt.hide();
    }
};
