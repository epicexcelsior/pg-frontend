// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Player\PlayerData.js
var PlayerData = pc.createScript('playerData');

PlayerData.prototype.initialize = function() {
    this.walletAddress = null;
    this.username = localStorage.getItem('userName') || "";
    this.claimedBoothId = "";

    this.app.on('auth:stateChanged', this.handleAuthStateChange, this);
    this.app.on('booth:claimSuccess', this.handleBoothClaimSuccess, this);
    this.app.on('booth:updated', this.handleBoothStateChange, this);
    this.app.on('booth:added', this.handleBoothStateChange, this);
};

PlayerData.prototype.handleAuthStateChange = function(authStateData) {
    const previousAddress = this.walletAddress;
    const newAddress = authStateData && authStateData.address ? authStateData.address : null;

    const hasTwitterHandleKey = authStateData && Object.prototype.hasOwnProperty.call(authStateData, 'twitterHandle');
    const hasTwitterUserIdKey = authStateData && Object.prototype.hasOwnProperty.call(authStateData, 'twitterUserId');

    const nextWalletAddress = newAddress || null;
    const shouldSendTwitterUpdate = hasTwitterHandleKey || hasTwitterUserIdKey;

    if (previousAddress !== nextWalletAddress || shouldSendTwitterUpdate) {
        this.walletAddress = nextWalletAddress;

        const updatePayload = {
            walletAddress: nextWalletAddress || ''
        };

        if (hasTwitterHandleKey) {
            updatePayload.twitterHandle = authStateData.twitterHandle || '';
        }
        if (hasTwitterUserIdKey) {
            updatePayload.twitterUserId = authStateData.twitterUserId || '';
        }

        this.app.fire('network:send:updateAddress', updatePayload);

        if (!nextWalletAddress && previousAddress) {
            this.clearClaimedBooth('auth:wallet_cleared');
        }

        this.app.fire('player:data:changed', this);
    }

    if (!authStateData?.isAuthenticated && this.claimedBoothId) {
        this.clearClaimedBooth('auth:unauthenticated');
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

PlayerData.prototype.handleBoothStateChange = function(data) {
    if (!data || !data.boothId) {
        return;
    }

    if (data.claimedBy === this.walletAddress && this.claimedBoothId !== data.boothId) {
        this.claimedBoothId = data.boothId;
        this.app.fire('player:data:changed', this);
        return;
    }

    if (this.claimedBoothId === data.boothId && data.claimedBy !== this.walletAddress) {
        this.clearClaimedBooth('booth:state_sync');
    }
};

PlayerData.prototype.clearClaimedBooth = function(reason) {
    if (!this.claimedBoothId) {
        return;
    }

    console.log(`PlayerData: Clearing claimed booth due to ${reason}.`);
    this.claimedBoothId = "";
    this.app.fire('player:data:changed', this);
};

PlayerData.prototype.destroy = function() {
    this.app.off('auth:stateChanged', this.handleAuthStateChange, this);
    this.app.off('booth:claimSuccess', this.handleBoothClaimSuccess, this);
    this.app.off('booth:updated', this.handleBoothStateChange, this);
    this.app.off('booth:added', this.handleBoothStateChange, this);
};

// --- GETTERS ---
PlayerData.prototype.getWalletAddress = function() { return this.walletAddress; };
PlayerData.prototype.getUsername = function() { return this.username; };
PlayerData.prototype.getClaimedBoothId = function() { return this.claimedBoothId; };

