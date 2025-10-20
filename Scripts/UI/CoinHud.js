var CoinHud = pc.createScript('coinHud');

CoinHud.attributes.add('css', { type: 'asset', assetType: 'css', title: 'Coin HUD CSS' });
CoinHud.attributes.add('html', { type: 'asset', assetType: 'html', title: 'Coin HUD HTML' });

CoinHud.prototype.initialize = function () {
    const style = document.createElement('style');
    style.innerHTML = this.css && this.css.resource ? this.css.resource : '';
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.innerHTML = this.html && this.html.resource ? this.html.resource : '';
    document.body.appendChild(container);

    this.styleEl = style;
    this.containerEl = container;
    this.rootEl = container.querySelector('[data-coin-hud]');
    this.balanceEl = container.querySelector('[data-coin-balance]');
    this.lifetimeEl = container.querySelector('[data-coin-lifetime]');

    if (this.rootEl) {
        this.rootEl.style.display = 'none';
    }

    this.balance = 0;
    this.lifetime = 0;

    this.app.on('ui:coins:update', this.updateDisplay, this);
    this.app.on('auth:stateChanged', this.handleAuthChanged, this);
};

CoinHud.prototype.handleAuthChanged = function (event) {
    const show = event && event.isAuthenticated;
    if (this.rootEl) {
        this.rootEl.style.display = show ? 'flex' : 'none';
    }
};

CoinHud.prototype.updateDisplay = function (payload) {
    if (!payload || typeof payload.balance !== 'number') {
        return;
    }
    this.balance = payload.balance;
    this.lifetime = typeof payload.lifetimeEarned === 'number' ? payload.lifetimeEarned : this.lifetime;

    if (this.balanceEl) {
        this.balanceEl.textContent = this.format(this.balance);
    }
    if (this.lifetimeEl) {
        this.lifetimeEl.textContent = this.format(this.lifetime);
    }
};

CoinHud.prototype.format = function (value) {
    return Number(value).toLocaleString();
};

CoinHud.prototype.destroy = function () {
    this.app.off('ui:coins:update', this.updateDisplay, this);
    this.app.off('auth:stateChanged', this.handleAuthChanged, this);

    if (this.containerEl && this.containerEl.parentNode) {
        this.containerEl.parentNode.removeChild(this.containerEl);
    }
    if (this.styleEl && this.styleEl.parentNode) {
        this.styleEl.parentNode.removeChild(this.styleEl);
    }
};
