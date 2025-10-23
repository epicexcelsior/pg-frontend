var CoinHud = pc.createScript('coinHud');

CoinHud.attributes.add('css', { type: 'asset', assetType: 'css', title: 'Coin HUD CSS' });
CoinHud.attributes.add('html', { type: 'asset', assetType: 'html', title: 'Coin HUD HTML' });
CoinHud.attributes.add('coinIcon', { type: 'asset', assetType: 'texture', title: 'Coin Icon' });

CoinHud.prototype.initialize = function () {
    this.theme = null;
    this.animationConfig = null;
    this.coinIconEl = null;

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
    this.coinIconEl = container.querySelector('[data-coin-icon]');

    if (this.app.uiManager && typeof this.app.uiManager.registerComponent === 'function') {
        this.app.uiManager.registerComponent(this);
        this.theme = this.app.uiManager.getTheme && this.app.uiManager.getTheme();
        this.animationConfig = this.app.uiManager.getAnimationConfig && this.app.uiManager.getAnimationConfig();
    }

    if (this.rootEl) {
        this.rootEl.style.display = 'none';
    }

    this.balance = 0;

    this.app.on('ui:coins:update', this.updateDisplay, this);
    this.app.on('auth:stateChanged', this.handleAuthChanged, this);

    if (this.coinIcon) {
        this.applyCoinIcon(this.coinIcon);
    }

    this.playShowAnimation();
};

CoinHud.prototype.handleAuthChanged = function (event) {
    const show = event && event.isAuthenticated;
    if (this.rootEl) {
        if (show) {
            this.rootEl.style.display = 'flex';
            this.playShowAnimation();
        } else {
            this.rootEl.style.display = 'none';
        }
    }
};

CoinHud.prototype.updateDisplay = function (payload) {
    if (!payload || typeof payload.balance !== 'number') {
        return;
    }
    this.balance = payload.balance;

    if (this.balanceEl) {
        this.balanceEl.textContent = this.format(this.balance);
    }
};

CoinHud.prototype.format = function (value) {
    return Number(value).toLocaleString();
};

CoinHud.prototype.playShowAnimation = function () {
    if (!this.rootEl || !this.animationConfig || this.animationConfig.enabled === false || !window.gsap) {
        return;
    }

    gsap.killTweensOf(this.rootEl);
    gsap.fromTo(this.rootEl,
        { opacity: 0, y: 12 },
        {
            opacity: 1,
            y: 0,
            duration: Math.max(0.16, (this.animationConfig.durations?.standard || 0.26) * (this.animationConfig.multiplier || 1)),
            ease: this.animationConfig.easings?.entrance || 'power3.out'
        }
    );
};

CoinHud.prototype.applyCoinIcon = function (textureAsset) {
    if (!this.coinIconEl || !textureAsset) {
        return;
    }
    var applyImage = function (url) {
        if (!url) {
            return;
        }
        this.coinIconEl.style.backgroundImage = 'url("' + url + '")';
        this.coinIconEl.classList.add('coin-hud__icon--image');
    }.bind(this);

    if (typeof textureAsset.getFileUrl === 'function') {
        applyImage(textureAsset.getFileUrl());
        return;
    }

    if (textureAsset.file && typeof textureAsset.file.url === 'string') {
        applyImage(textureAsset.file.url);
        return;
    }

    if (textureAsset.resource && textureAsset.resource.getFileUrl) {
        applyImage(textureAsset.resource.getFileUrl());
    }
};

CoinHud.prototype.setTheme = function (theme) {
    this.theme = theme;
};

CoinHud.prototype.setAnimationConfig = function (config) {
    this.animationConfig = config;
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
