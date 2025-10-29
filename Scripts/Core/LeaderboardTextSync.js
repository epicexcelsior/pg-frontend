var LeaderboardTextSync = pc.createScript('leaderboardTextSync');

LeaderboardTextSync.attributes.add('debugMode', { type: 'boolean', default: false });

LeaderboardTextSync.prototype.initialize = function () {
    this.data = {
        topDonators: [],
        topReceivers: [],
        topReferrals: []
    };

    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);

    if (this.app.room) {
        this.onConnected();
    }
};

LeaderboardTextSync.prototype.onConnected = function () {
    if (!this.app.room) return;
    
    this.app.room.onMessage('leaderboard:updated', this.onLeaderboardUpdated.bind(this));
};

LeaderboardTextSync.prototype.onDisconnected = function () {
    this.data = {
        topDonators: [],
        topReceivers: [],
        topReferrals: []
    };
};

LeaderboardTextSync.prototype.onLeaderboardUpdated = function (data) {
    if (!data || typeof data !== 'object') return;

    this.data.topDonators = Array.isArray(data.topDonators) ? data.topDonators : [];
    this.data.topReceivers = Array.isArray(data.topReceivers) ? data.topReceivers : [];
    this.data.topReferrals = Array.isArray(data.topReferrals) ? data.topReferrals : [];

    if (this.debugMode) {
        console.log('[LeaderboardTextSync] Updated:', this.data);
    }

    this.app.fire('leaderboard:data:updated', this.data);
};

LeaderboardTextSync.prototype.getFormattedEntry = function (category, rankIndex) {
    const entries = this.data[category];
    if (!entries || !Array.isArray(entries) || rankIndex < 0 || rankIndex >= entries.length) {
        return '';
    }
    return entries[rankIndex] || '';
};

LeaderboardTextSync.prototype.getEntry = function (category, rankIndex) {
    return this.getFormattedEntry(category, rankIndex);
};

LeaderboardTextSync.prototype.destroy = function () {
    this.app.off('colyseus:connected', this.onConnected, this);
    this.app.off('colyseus:disconnected', this.onDisconnected, this);
};
