var CoinBalance = pc.createScript('coinBalance');

CoinBalance.prototype.initialize = function () {
    this.balance = 0;
    this.lifetime = 0;
    this.lastUpdate = 0;

    this.entity.coinBalance = this;

    this.app.on('coins:update', this.handleUpdate, this);
    this.app.on('coins:refresh', this.requestRefresh, this);
    this.app.on('coins:tutorialBonus', this.handleTutorialBonus, this);
    this.app.on('auth:stateChanged', this.handleAuthChanged, this);
    this.app.once('destroy', this.destroy, this);

    this.requestInitialRefresh();
};

CoinBalance.prototype.requestRefresh = function () {
    // This method should not fire the same event it's listening to
    // Instead, it should request data from the server or another system
    // For now, let's implement a non-recursive approach
    this.fetchCoinData();
};

CoinBalance.prototype.requestInitialRefresh = function () {
    this.fetchCoinData();
};

CoinBalance.prototype.fetchCoinData = function () {
    // This would normally fetch data from server
    // For now, just trigger an update with current values to avoid recursion
    this.app.fire('coins:update', {
        balance: this.balance,
        lifetimeEarned: this.lifetime,
    });
};

CoinBalance.prototype.handleUpdate = function (payload) {
    if (!payload || typeof payload.balance !== 'number') {
        return;
    }
    this.balance = payload.balance;
    this.lifetime = typeof payload.lifetimeEarned === 'number' ? payload.lifetimeEarned : this.lifetime;
    this.lastUpdate = Date.now();
    this.app.fire('ui:coins:update', {
        balance: this.balance,
        lifetimeEarned: this.lifetime,
    });
};

CoinBalance.prototype.handleTutorialBonus = function (payload) {
    if (!payload || typeof payload.amount !== 'number' || typeof payload.newBalance !== 'number') {
        return;
    }
    this.balance = payload.newBalance;
    this.lastUpdate = Date.now();
    this.app.fire('ui:coins:update', {
        balance: this.balance,
        lifetimeEarned: this.lifetime,
    });
};

CoinBalance.prototype.destroy = function () {
    this.app.off('coins:update', this.handleUpdate, this);
    this.app.off('coins:refresh', this.requestRefresh, this);
    this.app.off('coins:tutorialBonus', this.handleTutorialBonus, this);
    this.app.off('auth:stateChanged', this.handleAuthChanged, this);
};

CoinBalance.prototype.handleAuthChanged = function (event) {
    if (!event) {
        return;
    }
    if (event.state === 'connected' && event.isAuthenticated) {
        this.fetchCoinData();
        return;
    }
    if (event.state === 'disconnected' || event.isAuthenticated === false) {
        this.balance = 0;
        this.lifetime = 0;
        this.lastUpdate = Date.now();
        this.app.fire('ui:coins:update', {
            balance: 0,
            lifetimeEarned: 0,
        });
    }
};
