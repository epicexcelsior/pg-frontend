// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Player\PlayerData.js
var PlayerData = pc.createScript('playerData');

PlayerData.prototype.initialize = function() {
    this.walletAddress = null;
    this.username = localStorage.getItem('userName') || "";
    this.claimedBoothId = "";
    this.twitterHandle = "";
    this.twitterUserId = "";
    this.privyDid = "";

    this.app.on('auth:stateChanged', this.onAuthStateChanged, this);
    this.app.on('booth:claimSuccess', this.handleBoothClaimSuccess, this);
    this.app.on('booth:updated', this.handleBoothStateChange, this);
    this.app.on('booth:added', this.handleBoothStateChange, this);
};

PlayerData.prototype.onAuthStateChanged = function (event) {
    const { state, address, user } = event;
    const isConnected = state === 'connected';

    console.log('PlayerData: onAuthStateChanged event received.', { isConnected, walletAddress: address, user });

    const newAddress = (isConnected && address) ? address : '';
    const normalizedTwitterHandle = typeof event.twitterHandle === 'string'
        ? event.twitterHandle
        : (event.twitterIdentity && typeof event.twitterIdentity.handle === 'string' ? event.twitterIdentity.handle : '');
    const normalizedTwitterUserId = typeof event.twitterUserId === 'string'
        ? event.twitterUserId
        : (event.twitterIdentity && event.twitterIdentity.userId != null ? String(event.twitterIdentity.userId) : '');
    const normalizedPrivyDid = typeof event.privyDid === 'string'
        ? event.privyDid
        : (user && typeof user.id === 'string' ? user.id : '');

    const walletChanged = this.walletAddress !== newAddress;
    const twitterHandleChanged = this.twitterHandle !== normalizedTwitterHandle;
    const twitterUserIdChanged = this.twitterUserId !== normalizedTwitterUserId;
    const privyDidChanged = this.privyDid !== normalizedPrivyDid;

    if (walletChanged) {
        this.walletAddress = newAddress;
        console.log(`PlayerData: Wallet address set to: ${this.walletAddress}`);
    }

    if (twitterHandleChanged) {
        this.twitterHandle = normalizedTwitterHandle;
        console.log(`PlayerData: Twitter handle set to: ${this.twitterHandle || '(none)'}`);
    }

    if (twitterUserIdChanged) {
        this.twitterUserId = normalizedTwitterUserId;
    }

    if (privyDidChanged) {
        this.privyDid = normalizedPrivyDid;
    }

    if (walletChanged || twitterHandleChanged || twitterUserIdChanged || privyDidChanged) {
        // Inform the server of the new address / social state
        this.app.fire('network:send', 'updateAddress', {
            walletAddress: this.walletAddress || '',
            twitterHandle: this.twitterHandle || '',
            twitterUserId: this.twitterUserId || '',
            privyDid: this.privyDid || ''
        });

        // Inform the rest of the client app that data has changed
        console.log('PlayerData: Firing player:data:changed event.');
        this.app.fire('player:data:changed', this);
    }

    // If logging out, ensure claimed booth is cleared
    if (!isConnected) {
        this.claimedBoothId = '';
        this.twitterHandle = '';
        this.twitterUserId = '';
        this.privyDid = '';
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

    if (this.walletAddress && data.claimedBy === this.walletAddress && this.claimedBoothId !== data.boothId) {
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
    this.app.off('auth:stateChanged', this.onAuthStateChanged, this);
    this.app.off('booth:claimSuccess', this.handleBoothClaimSuccess, this);
    this.app.off('booth:updated', this.handleBoothStateChange, this);
    this.app.off('booth:added', this.handleBoothStateChange, this);
};

// --- GETTERS ---
PlayerData.prototype.getWalletAddress = function() { return this.walletAddress; };
PlayerData.prototype.getUsername = function() { return this.username; };
PlayerData.prototype.getClaimedBoothId = function() { return this.claimedBoothId; };
PlayerData.prototype.getPrivyDid = function() { return this.privyDid; };

