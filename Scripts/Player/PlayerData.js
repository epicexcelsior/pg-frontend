// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Player\PlayerData.js
var PlayerData = pc.createScript('playerData');

PlayerData.prototype.initialize = function() {
    this.walletAddress = null;
    this.username = localStorage.getItem('userName') || "";
    this.claimedBoothId = "";

    this.app.on('auth:stateChanged', this.handleAuthStateChange, this);
    this.app.on('booth:claimSuccess', this.handleBoothClaimSuccess, this);
};

PlayerData.prototype.handleAuthStateChange = function(authStateData) {
    const newAddress = authStateData.address || null;

    if (this.walletAddress !== newAddress) {
        this.walletAddress = newAddress;
        if (this.walletAddress) {
            console.log(`PlayerData: Wallet address set to ${this.walletAddress}. Notifying server.`);
            this.app.fire('network:send:updateAddress', this.walletAddress);
        }
        this.app.fire('player:data:changed', this);
    }

    // FIX: When disconnecting, we must also clear the claimed booth ID from local state.
    if (authStateData.state === 'disconnected' && this.claimedBoothId) {
        console.log("PlayerData: Disconnected. Clearing local claimedBoothId.");
        this.claimedBoothId = "";
        this.app.fire('player:data:changed', this);
    }
};

PlayerData.prototype.handleBoothClaimSuccess = function(data) {
    if (data && data.claimedBy && data.boothId && data.claimedBy === this.walletAddress) {
        if (this.claimedBoothId !== data.boothId) {
            this.claimedBoothId = data.boothId;
            console.log(`PlayerData: Confirmed claim of booth ${this.claimedBoothId}.`);
            this.app.fire('player:data:changed', this);
        }
    }
};

// --- GETTERS ---
PlayerData.prototype.getWalletAddress = function() { return this.walletAddress; };
PlayerData.prototype.getUsername = function() { return this.username; };
PlayerData.prototype.getClaimedBoothId = function() { return this.claimedBoothId; };