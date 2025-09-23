// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Booths\BoothController.js
var BoothController = pc.createScript("boothController");

BoothController.prototype.initialize = function () {
    console.log("BoothController initializing as the orchestrator...");
    this.currentZoneScript = null;
    this.pendingClaimBoothId = null;

    this.app.on("booth:entered", this.onEnterZone, this);
    this.app.on("booth:left", this.onLeaveZone, this);
    this.app.on("booth:updated", this.onBoothUpdated, this);
    this.app.on("auth:stateChanged", this.onAuthStateChanged, this);
    this.app.on("player:data:changed", this.onLocalPlayerDataChanged, this);
    this.app.on("booth:claim:request", this.handleClaimRequest, this);
    this.app.on("booth:claimSuccess", this.onClaimSuccess, this);
    this.app.on("effects:donation", this.onDonationEffect, this);
};

BoothController.prototype.handleClaimRequest = function(boothId) {
    const privyManager = this.app.services.get('privyManager');
    if (privyManager.isAuthenticated() && privyManager.getWalletAddress()) {
        this.app.fire('booth:claimRequest', { boothId: boothId });
    } else {
        this.pendingClaimBoothId = boothId;
        privyManager.login();
    }
};

// FIX: This function no longer fires the claim. It just sets up the expectation.
BoothController.prototype.onAuthStateChanged = function (authStateData) {
    if (this.pendingClaimBoothId && authStateData.isAuthenticated && authStateData.address) {
        console.log("BoothController: Auth complete. Waiting for PlayerData to confirm address sync.");
        // We now wait for onLocalPlayerDataChanged to fire the pending claim.
    }
    if (this.currentZoneScript) {
        this.decideAndShowPrompt();
    }
};

// FIX: This is the new final step in the claim flow.
BoothController.prototype.onLocalPlayerDataChanged = function() {
    // If a claim was pending AND our local data now has a wallet address...
    if (this.pendingClaimBoothId && this.app.localPlayer.script.playerData.getWalletAddress()) {
        console.log("BoothController: PlayerData updated. Firing pending claim now.");
        this.app.fire('booth:claimRequest', { boothId: this.pendingClaimBoothId });
        this.pendingClaimBoothId = null; // Clear the pending action
    }

    if (this.currentZoneScript) {
        this.decideAndShowPrompt();
    }
};

BoothController.prototype.onEnterZone = function (boothZoneScript) {
    this.currentZoneScript = boothZoneScript;
    this.decideAndShowPrompt();
};

BoothController.prototype.onLeaveZone = function (boothZoneScript) {
    if (this.currentZoneScript === boothZoneScript) {
        this.currentZoneScript = null;
        this.app.fire("ui:hideClaimPrompt");
        this.app.fire("ui:hideDonationPrompt");
    }
};

BoothController.prototype.onBoothUpdated = function (boothData) {
    // This logic correctly updates the 3D text in the scene.
    const boothEntity = this.app.root.findByName(boothData.boothId);
    if (boothEntity) {
        boothEntity.script.boothClaimZone.claimedBy = boothData.claimedBy; // Ensure local script is in sync
        const screenEntity = boothEntity.findByName("3D Screen");
        if (screenEntity) {
            const upperTxt = screenEntity.findByName("UpperTxt")?.element;
            const usernameTxt = screenEntity.findByName("UsernameTxt")?.element;
            if (upperTxt && usernameTxt) {
                upperTxt.text = boothData.claimedBy ? "Give to" : "CLAIM";
                usernameTxt.text = boothData.claimedBy ? (boothData.claimedByUsername || "") : "ME!";
            }
        }
        if (this.currentZoneScript?.boothId === boothData.boothId) {
            this.decideAndShowPrompt();
        }
    }
};

BoothController.prototype.decideAndShowPrompt = function () {
    if (!this.currentZoneScript) return;
    const claimedBy = this.currentZoneScript.claimedBy;
    const localPlayerData = this.app.localPlayer?.script?.playerData;
    if (!localPlayerData) return;

    const localAddress = localPlayerData.getWalletAddress();
    const localClaimedBooth = localPlayerData.getClaimedBoothId();

    if (!claimedBy) {
        this.app.fire("ui:hideDonationPrompt");
        this.app.fire(localClaimedBooth ? "ui:hideClaimPrompt" : "ui:showClaimPrompt", this.currentZoneScript);
    } else {
        this.app.fire("ui:hideClaimPrompt");
        if (claimedBy === localAddress) {
            this.app.fire("ui:hideDonationPrompt");
        } else {
            this.app.fire(localAddress ? "ui:showDonationPrompt" : "ui:hideDonationPrompt", this.currentZoneScript);
        }
    }
};

BoothController.prototype.onClaimSuccess = function (data) {
    const boothEntity = this.app.root.findByName(data.boothId);
    boothEntity?.findByName("BoothClaimEffect")?.particlesystem.play();
    boothEntity?.sound?.play("claimSound");
};

BoothController.prototype.onDonationEffect = function (data) {
    if (!data.recipient) return;
    this.app.root.findByTag("booth").forEach((boothEntity) => {
        if (boothEntity.script?.boothClaimZone?.claimedBy === data.recipient) {
            boothEntity.findByName("BoothDonateEffect")?.particlesystem.play();
            boothEntity.sound?.play("donationSound");
        }
    });
};