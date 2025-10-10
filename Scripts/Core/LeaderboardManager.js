// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Core\LeaderboardManager.js
var LeaderboardManager = pc.createScript('leaderboardManager');

LeaderboardManager.prototype.initialize = function () {
    this.pollIntervalMs = 1000;
    this.pollTimer = null;
    this.latestData = null;

    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
    this.app.on('leaderboard:data', this.onLeaderboardData, this);

    if (this.app.room) {
        this.onConnected();
    }
};

LeaderboardManager.prototype.onConnected = function () {
    this.requestLeaderboard(10);
    this.startPolling();
};

LeaderboardManager.prototype.onDisconnected = function () {
    this.stopPolling();
};

LeaderboardManager.prototype.startPolling = function () {
    this.stopPolling();
    var self = this;
    this.pollTimer = window.setInterval(function () {
        self.requestLeaderboard(10);
    }, this.pollIntervalMs);
};

LeaderboardManager.prototype.stopPolling = function () {
    if (this.pollTimer) {
        window.clearInterval(this.pollTimer);
        this.pollTimer = null;
    }
};

LeaderboardManager.prototype.requestLeaderboard = function (limit) {
    this.app.fire('leaderboard:request', { limit: limit || 10 });
};

LeaderboardManager.prototype.onLeaderboardData = function (payload) {
    this.latestData = payload || {};
    this.app.fire('ui:leaderboard:data', this.latestData);
};

LeaderboardManager.prototype.destroy = function () {
    this.stopPolling();
    this.app.off('colyseus:connected', this.onConnected, this);
    this.app.off('colyseus:disconnected', this.onDisconnected, this);
    this.app.off('leaderboard:data', this.onLeaderboardData, this);
};
