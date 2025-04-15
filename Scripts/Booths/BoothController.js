// Scripts/Booths/BoothController.js
var BoothController = pc.createScript('boothController');

BoothController.attributes.add('servicesEntity', { type: 'entity', title: 'Services Entity' });
// Add attributes for the different UI prompt entities if needed,
// or rely on firing events for a UIManager to handle.
// Example:
// BoothController.attributes.add('claimPromptEntity', { type: 'entity', title: 'Claim Prompt UI Entity' });
// BoothController.attributes.add('donationPromptEntity', { type: 'entity', title: 'Donation Prompt UI Entity' });

BoothController.prototype.initialize = function() {
    console.log("BoothController initializing...");

    this.authService = this.app.services?.get('authService'); // Get AuthService via registry
    if (!this.authService) {
        console.error("BoothController: AuthService not found via app.services. Booth interactions might fail.");
    }

    // Store the booth zone the player is currently inside
    this.currentZoneScript = null;

    // Listen for booth zone enter/leave events (fired by BoothClaimZone)
    this.app.on('booth:entered', this.onEnterZone, this);
    this.app.on('booth:left', this.onLeaveZone, this);

    // Listen for booth state updates from the network (fired by NetworkManager/BoothSync)
    this.app.on('booth:updated', this.onBoothUpdated, this);

    // Listen for claim errors from the network
    this.app.on('booth:claimError', this.onClaimError, this);

    // Listen for auth state changes
    this.app.on('auth:stateChanged', this.onAuthStateChanged, this);

    // Listen for local player data changes (e.g., claimedBoothId updated)
    this.app.on('player:data:changed', this.onLocalPlayerDataChanged, this);

    console.log("BoothController initialized.");
};

BoothController.prototype.onEnterZone = function(boothZoneScript) {
    console.log(`BoothController: Entered zone for booth ${boothZoneScript.boothId}`);
    this.currentZoneScript = boothZoneScript;
    this.decideAndShowPrompt();
};

BoothController.prototype.onLeaveZone = function(boothZoneScript) {
    if (this.currentZoneScript === boothZoneScript) {
        console.log(`BoothController: Left zone for booth ${boothZoneScript.boothId}`);
        this.currentZoneScript = null;
        // Hide any active prompts immediately
        this.app.fire('ui:hideClaimPrompt');
        this.app.fire('ui:hideDonationPrompt');
    }
};

BoothController.prototype.onBoothUpdated = function(boothData) {
    // If the update is for the booth the player is currently in, re-evaluate the prompt
    if (this.currentZoneScript && this.currentZoneScript.boothId === boothData.boothId) {
        console.log(`BoothController: Booth ${boothData.boothId} updated while player inside. Re-evaluating prompt.`);
        // Update the zone script's internal state (redundant if NetworkManager already does this, but safe)
        this.currentZoneScript.claimedBy = boothData.claimedBy;
        this.decideAndShowPrompt();
    }
};

BoothController.prototype.onClaimError = function(errorData) {
    // Show error feedback to the user, potentially via a UIManager event
    console.warn(`BoothController: Received claim error for booth ${errorData.boothId}: ${errorData.reason}`);
    this.app.fire('ui:showError', `Claim Failed: ${errorData.reason}`); // Example event
};

BoothController.prototype.onAuthStateChanged = function(authStateData) {
     // If the player is currently in a zone, re-evaluate the prompt based on the new auth state
    if (this.currentZoneScript) {
        console.log("BoothController: Auth state changed while player in zone. Re-evaluating prompt.");
        this.decideAndShowPrompt();
    }
 };

 BoothController.prototype.onLocalPlayerDataChanged = function(playerDataScript) {
     // Check if the player is currently in a zone when their data changes
     if (this.currentZoneScript) {
         console.log("BoothController: Local player data changed while in zone. Re-evaluating prompt.");
         this.decideAndShowPrompt();
     }
 };


BoothController.prototype.decideAndShowPrompt = function() {
    if (!this.currentZoneScript) {
        // Not in a zone, hide prompts
        this.app.fire('ui:hideClaimPrompt');
        this.app.fire('ui:hideDonationPrompt');
        return;
    }

    const boothId = this.currentZoneScript.boothId;
    const claimedBy = this.currentZoneScript.claimedBy; // Get current claim status
    // Get local player data script
    const localPlayerEntity = this.app.localPlayer;
    const localPlayerData = localPlayerEntity?.script?.playerData;

    if (!localPlayerData) {
        console.warn("BoothController: Cannot decide prompt, local PlayerData script not found.");
        this.app.fire('ui:hideClaimPrompt');
        this.app.fire('ui:hideDonationPrompt');
        return;
    }

    const localPlayerAddress = localPlayerData.getWalletAddress();
    const localClaimedBoothId = localPlayerData.getClaimedBoothId(); // Get the crucial state

    console.log(`BoothController: Deciding prompt for ${boothId}. Booth Claimed by: ${claimedBy || 'None'}, Local Addr: ${localPlayerAddress || 'None'}, Local Claimed Booth: ${localClaimedBoothId || 'None'}`);

    // --- Logic ---
    if (!claimedBy) {
        // --- Booth is Unclaimed ---
        // Show claim prompt ONLY if the local player hasn't claimed a booth yet
        if (!localClaimedBoothId) {
             this.app.fire('ui:hideDonationPrompt');
             console.log(`BoothController: Firing ui:showClaimPrompt for ${boothId}`);
             this.app.fire('ui:showClaimPrompt', this.currentZoneScript);
        } else {
            // Booth is unclaimed, but player already claimed one. Hide both.
             console.log(`BoothController: Booth ${boothId} is unclaimed, but player already claimed ${localClaimedBoothId}. Hiding prompts.`);
             this.app.fire('ui:hideClaimPrompt');
             this.app.fire('ui:hideDonationPrompt');
        }
    } else {
        // --- Booth is Claimed ---
        this.app.fire('ui:hideClaimPrompt'); // Always hide claim prompt if booth is claimed

        if (claimedBy === localPlayerAddress) {
            // Player owns this booth - hide donation prompt
            console.log(`BoothController: Player owns booth ${boothId}. Hiding donation prompt.`);
            this.app.fire('ui:hideDonationPrompt');
            // Future: Show owner options?
        } else if (localPlayerAddress) {
            // Booth claimed by another player AND local player is authenticated - show donation prompt
            console.log(`BoothController: Firing ui:showDonationPrompt for ${boothId}, recipient: ${claimedBy}`);
            this.app.fire('ui:showDonationPrompt', this.currentZoneScript);
        } else {
            // Booth claimed by another player BUT local player is NOT authenticated - hide donation prompt
            console.log(`BoothController: Booth ${boothId} claimed by another, but local player not authenticated. Hiding donation prompt.`);
            this.app.fire('ui:hideDonationPrompt');
            // Future: Maybe prompt to authenticate to donate?
        }
    }
};


// swap method called for script hot-reloading
// inherit your script state here
// BoothController.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/