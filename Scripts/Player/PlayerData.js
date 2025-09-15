// Scripts/Player/PlayerData.js
var PlayerData = pc.createScript('playerData');

PlayerData.prototype.initialize = function() {
    console.log("PlayerData initializing for entity:", this.entity.name);

    // Initialize player-specific data
    this.walletAddress = "";
    this.username = "";
    this.claimedBoothId = "";
    this.twitterHandle = ""; // To store the user's Twitter handle
    // Add other relevant player data fields as needed

    // Listen for updates from AuthService or Network sync events
    this.app.on('player:data:update', this.updateData, this);
    this.app.on('auth:stateChanged', this.handleAuthStateChange, this); // Listen for auth changes too
    this.app.on('auth:userAvailable', this.handleUserAvailable, this); // Listen for the full user object
    this.app.on('booth:claimSuccess', this.handleBoothClaimSuccess, this); // Listen for successful claims

    // Initial population if privy service is already connected when this initializes
    const privyService = this.app.services?.get('privyService');
    if (privyService && privyService.isAuthenticated()) {
        this.walletAddress = privyService.getWalletAddress();
        console.log("PlayerData: Initial wallet address set from PrivyService:", this.walletAddress);
    }
     // Initial username (might come from localStorage or network later)
     this.username = window.userName || ""; // Use global temporarily, replace with event/service later
     console.log("PlayerData: Initial username set:", this.username);

};

PlayerData.prototype.updateData = function(data) {
    console.log("PlayerData: Received data update:", data);
    let changed = false;
    if (data.hasOwnProperty('walletAddress') && this.walletAddress !== data.walletAddress) {
        this.walletAddress = data.walletAddress;
        console.log("PlayerData: Wallet address updated to:", this.walletAddress);
        changed = true;
    }
    if (data.hasOwnProperty('username') && this.username !== data.username) {
        this.username = data.username;
        console.log("PlayerData: Username updated to:", this.username);
        changed = true;
    }
    if (data.hasOwnProperty('claimedBoothId') && this.claimedBoothId !== data.claimedBoothId) {
        this.claimedBoothId = data.claimedBoothId;
        console.log("PlayerData: Claimed Booth ID updated to:", this.claimedBoothId);
        changed = true;
    }
    if (data.hasOwnProperty('twitterHandle') && this.twitterHandle !== data.twitterHandle) {
        this.twitterHandle = data.twitterHandle;
        console.log("PlayerData: Twitter handle updated to:", this.twitterHandle);
        changed = true;
    }
    // Add checks for other data fields

    if (changed) {
        // Fire an event if data actually changed, so other components can react
        this.app.fire('player:data:changed', this);
    }
};

PlayerData.prototype.handleBoothClaimSuccess = function(data) {
    // data likely contains { boothId: string, claimedBy: string } from the server via MessageBroker
    console.log("PlayerData: Received booth:claimSuccess event:", data);
    // Use 'claimedBy' to match the property name sent by the server/MessageBroker
    if (data && data.claimedBy && data.boothId) {
        // Check if the claimer is the local player using the correct property name
        if (this.walletAddress && data.claimedBy === this.walletAddress) {
            console.log(`PlayerData: Local player (${this.walletAddress}) claimed booth ${data.boothId}. Updating claimedBoothId via claimSuccess event.`);
            this.updateData({ claimedBoothId: data.boothId });
        } else if (this.walletAddress) {
             console.log(`PlayerData: Booth ${data.boothId} claimed by another player (${data.claimedBy}), not local player (${this.walletAddress}). No local update needed from claimSuccess event.`);
        } else {
             console.log(`PlayerData: Booth ${data.boothId} claimed by ${data.claimedBy}, but local player address is not set yet. No local update needed from claimSuccess event.`);
        }
    } else {
        console.warn("PlayerData: Received booth:claimSuccess event with missing data:", data);
    }
};

PlayerData.prototype.handleAuthStateChange = function(authStateData) {
    // Update wallet address based on auth state
    if (authStateData.state === 'connected') {
        if (this.walletAddress !== authStateData.address) {
            this.updateData({ walletAddress: authStateData.address });
        }
    } else if (authStateData.state === 'disconnected') {
         if (this.walletAddress !== null) {
            this.updateData({ walletAddress: null }); // Clear address on disconnect
         }
    }
};

PlayerData.prototype.handleUserAvailable = function(data) {
    if (data && data.user && data.user.twitter) {
        this.updateData({ twitterHandle: data.user.twitter.username });
    }
};

// --- Getters for convenience ---
PlayerData.prototype.getWalletAddress = function() {
    return this.walletAddress;
};

PlayerData.prototype.getUsername = function() {
    return this.username;
};

PlayerData.prototype.getClaimedBoothId = function() {
    return this.claimedBoothId;
};

PlayerData.prototype.getTwitterHandle = function() {
    return this.twitterHandle;
};


// swap method called for script hot-reloading
// inherit your script state here
// PlayerData.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/