var HtmlQuickMenu = pc.createScript('htmlQuickMenu');

HtmlQuickMenu.attributes.add('cssAsset', {
    type: 'asset',
    assetType: 'css',
    title: 'Quick Menu CSS'
});

HtmlQuickMenu.attributes.add('htmlAsset', {
    type: 'asset',
    assetType: 'html',
    title: 'Quick Menu HTML'
});

HtmlQuickMenu.prototype.initialize = function () {
    this.theme = null;
    this.animationConfig = {
        enabled: true,
        durations: { standard: 0.26, quick: 0.18 },
        easings: { entrance: 'power3.out', exit: 'power2.in' },
        multiplier: 1,
        lowPerformanceMultiplier: 0.75
    };
    this.state = { 
        scrollTop: 0,
        animationsEnabled: true,
        hasClaimedBooth: false
    };
    this.isOpen = false;
    this.toggleButton = null;
    this.rootEl = null;
    this._panelEl = null;
    this._styleEl = null;
    this._containerEl = null;
    this._elements = {};
    this._handlers = {};

    this._storage = {
        animations: 'pg:ui:animationsEnabled'
    };
    this._prepareHandlers();
    this._loadAssets();
    this._initializeAnimationPreference();

    this._handlers.onPlayerDataChanged = this._updateUsername.bind(this);
    this._handlers.onBoothClaimed = this._handleBoothClaim.bind(this);
    this._handlers.onBoothUnclaimed = this._handleBoothUnclaim.bind(this);
    
    this.app.on('player:data:changed', this._handlers.onPlayerDataChanged, this);
    this.app.on('booth:claimed', this._handlers.onBoothClaimed, this);
    this.app.on('booth:unclaimed', this._handlers.onBoothUnclaimed, this);
};

HtmlQuickMenu.prototype._prepareHandlers = function () {
    this._handlers.onToggleClick = this.toggleMenu.bind(this);
    this._handlers.onHover = this._playHoverSound.bind(this);
    this._handlers.onClose = this.closeMenu.bind(this);
    this._handlers.onAnimationsToggle = this._handleAnimationToggle.bind(this);
    this._handlers.onNavClick = this._handleTileNavigation.bind(this);
    this._handlers.onGlobalPointer = this._handleGlobalPointer.bind(this);
    this._handlers.onEscape = this._handleEscape.bind(this);
    this._handlers.onScrollFocus = this._handleScrollFocus.bind(this);
};


HtmlQuickMenu.prototype._loadAssets = function () {
    var self = this;
    var pending = 0;

    function onReady() {
        pending--;
        if (pending === 0) {
            self._buildDom();
            self._createToggleButton();
            self._applyThemeStyles();
            self._syncAnimationToggle();
            self._updateUsername();
        }
    }

    if (this.cssAsset) {
        pending++;
        this._ensureAsset(this.cssAsset, function (asset) {
            self._injectCss(asset);
            onReady();
        });
    }

    if (this.htmlAsset) {
        pending++;
        this._ensureAsset(this.htmlAsset, function (asset) {
            self._htmlTemplate = asset;
            onReady();
        });
    }

    if (pending === 0) {
        this._buildDom();
        this._createToggleButton();
        this._applyThemeStyles();
        this._syncAnimationToggle();
        this._updateUsername();
    }
};

HtmlQuickMenu.prototype._ensureAsset = function (asset, callback) {
    if (!asset) {
        callback(null);
        return;
    }
    if (asset.resource) {
        callback(asset.resource.data || asset.resource);
        return;
    }
    asset.once('load', function (loaded) {
        callback(loaded.resource ? (loaded.resource.data || loaded.resource) : null);
    });
    asset.once('error', function (err) {
        console.error('HtmlQuickMenu: Failed to load asset.', err);
        callback(null);
    });
    this.app.assets.load(asset);
};

HtmlQuickMenu.prototype._injectCss = function (cssText) {
    if (!cssText) {
        return;
    }
    this._styleEl = document.createElement('style');
    this._styleEl.innerHTML = cssText;
    document.head.appendChild(this._styleEl);
};

HtmlQuickMenu.prototype._buildDom = function () {
    if (this._containerEl || !this._htmlTemplate) {
        return;
    }

    this._containerEl = document.createElement('div');
    this._containerEl.innerHTML = this._htmlTemplate;
    document.body.appendChild(this._containerEl);

    this.rootEl = this._containerEl.querySelector('#quick-menu-root');
    this._panelEl = this._containerEl.querySelector('[data-quick-menu-panel]');
    this._elements.scrollRegion = this._containerEl.querySelector('[data-quick-menu-scroll-region]');
    this._elements.closeButton = this._containerEl.querySelector('[data-quick-menu-close]');
    this._elements.animationsToggle = this._containerEl.querySelector('[data-quick-menu-animations]');
    this._elements.usernameLabel = this._containerEl.querySelector('[data-quick-menu-username]');
    this._elements.boothSection = this._containerEl.querySelector('[data-booth-section]');
    this._elements.tiles = Array.prototype.slice.call(this._containerEl.querySelectorAll('[data-quick-menu-nav]'));

    if (this._elements.closeButton) {
        this._elements.closeButton.addEventListener('click', this._handlers.onClose);
    }

    if (this._elements.animationsToggle) {
        this._elements.animationsToggle.addEventListener('change', this._handlers.onAnimationsToggle);
    }

    if (this._elements.tiles && this._elements.tiles.length) {
        var self = this;
        this._elements.tiles.forEach(function (tile) {
            tile.addEventListener('click', self._handlers.onNavClick);
            tile.addEventListener('mouseenter', self._handlers.onHover);
        });
    }

    if (this._elements.scrollRegion) {
        this._elements.scrollRegion.addEventListener('focusin', this._handlers.onScrollFocus);
    }

    this._applyThemeStyles();
    this._checkBoothStatus();
};

HtmlQuickMenu.prototype._createToggleButton = function () {
    if (this.toggleButton) {
        return;
    }

    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'ui-action-button quick-menu-toggle';
    this.toggleButton.type = 'button';
    this.toggleButton.setAttribute('aria-label', 'Open quick menu');
    this.toggleButton.setAttribute('aria-expanded', 'false');
    this.toggleButton.innerHTML = '<span class="icon" aria-hidden="true">☰</span>';

    this.toggleButton.addEventListener('click', this._handlers.onToggleClick);
    this.toggleButton.addEventListener('mouseenter', this._handlers.onHover);

    var buttonContainer = document.getElementById('ui-button-container');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.id = 'ui-button-container';
        document.body.appendChild(buttonContainer);
    }
    
    buttonContainer.appendChild(this.toggleButton);
};


HtmlQuickMenu.prototype._applyThemeStyles = function () {
    if (!this.rootEl) {
        return;
    }
    var theme = this.theme || (this.app.uiManager && this.app.uiManager.getTheme && this.app.uiManager.getTheme());
    if (!theme) {
        return;
    }

    var colors = theme.colors || {};
    var layout = theme.layout && theme.layout.quickMenu ? theme.layout.quickMenu : { width: 320, maxHeight: 420 };

    this.rootEl.style.setProperty('--quick-menu-width', (layout.width || 320) + 'px');
    this.rootEl.style.setProperty('--quick-menu-max-height', (layout.maxHeight || 420) + 'px');
    this.rootEl.style.setProperty('--quick-menu-surface', colors.surface2 || colors.surface || 'rgba(12,16,26,0.94)');
    this.rootEl.style.setProperty('--quick-menu-border', 'rgba(255,255,255,0.08)');
};


HtmlQuickMenu.prototype.setAnimationConfig = function (config) {
    if (!config) {
        return;
    }
    this.animationConfig = Object.assign({}, this.animationConfig, config);
};

HtmlQuickMenu.prototype.toggleMenu = function () {
    if (this.isOpen) {
        this.closeMenu();
    } else {
        this.openMenu();
    }
    this._playClickSound();
};

HtmlQuickMenu.prototype.openMenu = function () {
    if (this.isOpen || !this.rootEl || !this._panelEl) {
        return;
    }

    this.isOpen = true;
    this.rootEl.classList.add('is-open');
    this.rootEl.setAttribute('aria-hidden', 'false');
    if (this.toggleButton) {
        this.toggleButton.classList.add('is-open');
        this.toggleButton.setAttribute('aria-expanded', 'true');
    }

    this._bindGlobalEvents();
    this._updateUsername();
    this._syncAnimationToggle();
    this._checkBoothStatus();
    this._restoreScrollPosition();

    var duration = (this.animationConfig.durations && this.animationConfig.durations.standard) || 0.26;
    duration *= this.animationConfig.multiplier || 1;
    var easeIn = (this.animationConfig.easings && this.animationConfig.easings.entrance) || 'power3.out';

    if (window.gsap && this.animationConfig.enabled !== false) {
        gsap.killTweensOf(this._panelEl);
        gsap.fromTo(this._panelEl,
            { opacity: 0, x: -28, scale: 0.94 },
            {
                opacity: 1,
                x: 0,
                scale: 1,
                duration: Math.max(0.12, duration),
                ease: easeIn
            }
        );
    } else {
        this._panelEl.style.opacity = '1';
        this._panelEl.style.transform = 'none';
    }
};

HtmlQuickMenu.prototype.closeMenu = function () {
    if (!this.isOpen || !this.rootEl || !this._panelEl) {
        return;
    }

    this._storeScrollPosition();
    this.isOpen = false;
    this.rootEl.classList.remove('is-open');
    this.rootEl.setAttribute('aria-hidden', 'true');
    if (this.toggleButton) {
        this.toggleButton.classList.remove('is-open');
        this.toggleButton.setAttribute('aria-expanded', 'false');
    }

    this._unbindGlobalEvents();

    var duration = (this.animationConfig.durations && this.animationConfig.durations.quick) || 0.18;
    duration *= this.animationConfig.multiplier || 1;
    var easeOut = (this.animationConfig.easings && this.animationConfig.easings.exit) || 'power2.in';

    if (window.gsap && this.animationConfig.enabled !== false) {
        gsap.killTweensOf(this._panelEl);
        gsap.to(this._panelEl, {
            opacity: 0,
            x: -24,
            scale: 0.96,
            duration: Math.max(0.1, duration),
            ease: easeOut,
            onComplete: function (panel) {
                panel.style.opacity = '';
                panel.style.transform = '';
            },
            onCompleteParams: [this._panelEl]
        });
    } else {
        this._panelEl.style.opacity = '0';
        this._panelEl.style.transform = 'translateX(-24px) scale(0.96)';
    }
};

HtmlQuickMenu.prototype._bindGlobalEvents = function () {
    document.addEventListener('mousedown', this._handlers.onGlobalPointer, true);
    window.addEventListener('keydown', this._handlers.onEscape, true);
};

HtmlQuickMenu.prototype._unbindGlobalEvents = function () {
    document.removeEventListener('mousedown', this._handlers.onGlobalPointer, true);
    window.removeEventListener('keydown', this._handlers.onEscape, true);
};

HtmlQuickMenu.prototype._handleGlobalPointer = function (event) {
    if (!this.isOpen || !this._panelEl) {
        return;
    }
    if (this._panelEl.contains(event.target)) {
        return;
    }
    if (this.toggleButton && this.toggleButton.contains(event.target)) {
        return;
    }
    this.closeMenu();
};

HtmlQuickMenu.prototype._handleEscape = function (event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
        this.closeMenu();
    }
};

HtmlQuickMenu.prototype._handleAnimationToggle = function (event) {
    this.state.animationsEnabled = !!event.target.checked;
    this._broadcastAnimationPreference();
    this._persistPreference(this._storage.animations, String(this.state.animationsEnabled));
    this._playClickSound();
};
HtmlQuickMenu.prototype._handleTileNavigation = function (event) {
    var target = event.currentTarget;
    if (!target) {
        return;
    }
    var navKey = target.getAttribute('data-quick-menu-nav');
    if (!navKey) {
        return;
    }
    this._playClickSound();
    switch (navKey) {
        case 'username':
            this.closeMenu();
            this.app.fire('ui:usernamePanel:open');
            break;
        case 'booth':
            if (this.state.hasClaimedBooth) {
                this.closeMenu();
                var boothId = this.state.claimedBoothId || this._resolveClaimedBoothId();
                this.app.fire('ui:showBoothDescriptionEditor', { boothId: boothId });
            }
            break;
        case 'referrals':
            this.closeMenu();
            this.app.fire('ui:referralPanel:toggle', { open: true });
            break;
        default:
            break;
    }
};


HtmlQuickMenu.prototype._initializeAnimationPreference = function () {
    try {
        var stored = localStorage.getItem(this._storage.animations);
        if (stored !== null) {
            this.state.animationsEnabled = stored === 'true';
        }
    } catch (err) {
        console.warn('HtmlQuickMenu: Failed to read animation preference.', err);
    }
};

HtmlQuickMenu.prototype._syncAnimationToggle = function () {
    if (!this._elements.animationsToggle) {
        return;
    }
    this._elements.animationsToggle.checked = this.state.animationsEnabled !== false;
};

HtmlQuickMenu.prototype._handleBoothClaim = function (data) {
    this.state.hasClaimedBooth = true;
    this.state.claimedBoothId = data && data.boothId ? data.boothId : this._resolveClaimedBoothId();
    this._updateBoothVisibility();
};

HtmlQuickMenu.prototype._handleBoothUnclaim = function () {
    this.state.hasClaimedBooth = false;
    this.state.claimedBoothId = null;
    this._updateBoothVisibility();
};

HtmlQuickMenu.prototype._updateBoothVisibility = function () {
    if (!this._elements.boothSection) {
        return;
    }
    this._elements.boothSection.style.display = this.state.hasClaimedBooth ? '' : 'none';
};

HtmlQuickMenu.prototype._resolveClaimedBoothId = function () {
    try {
        if (this.app.services && typeof this.app.services.get === 'function') {
            var playerDataService = this.app.services.get('playerData');
            if (playerDataService && typeof playerDataService.getClaimedBoothId === 'function') {
                var boothId = playerDataService.getClaimedBoothId();
                if (boothId) {
                    return boothId;
                }
            }
        }
        if (this.app.localPlayer && this.app.localPlayer.script && this.app.localPlayer.script.playerData) {
            var scriptData = this.app.localPlayer.script.playerData;
            if (typeof scriptData.getClaimedBoothId === 'function') {
                return scriptData.getClaimedBoothId();
            }
        }
    } catch (err) {
        console.warn('HtmlQuickMenu: Failed to resolve claimed booth ID.', err);
    }
    return null;
};

HtmlQuickMenu.prototype._checkBoothStatus = function () {
    try {
        var boothId = this._resolveClaimedBoothId();
        this.state.hasClaimedBooth = !!boothId;
        this.state.claimedBoothId = boothId;
        this._updateBoothVisibility();
    } catch (err) {
        console.warn('HtmlQuickMenu: Failed to check booth status.', err);
    }
};

HtmlQuickMenu.prototype._storeScrollPosition = function () {
    if (!this._elements.scrollRegion) {
        return;
    }
    this.state.scrollTop = this._elements.scrollRegion.scrollTop || 0;
};

HtmlQuickMenu.prototype._restoreScrollPosition = function () {
    if (!this._elements.scrollRegion) {
        return;
    }
    var top = this.state.scrollTop || 0;
    if (Math.abs(top - this._elements.scrollRegion.scrollTop) < 3) {
        return;
    }
    this._elements.scrollRegion.scrollTop = top;
};

HtmlQuickMenu.prototype._handleScrollFocus = function (event) {
    if (!this._elements.scrollRegion) {
        return;
    }
    var region = this._elements.scrollRegion;
    var target = event.target;
    if (!target || !region.contains(target)) {
        return;
    }
    var bounds = region.getBoundingClientRect();
    var targetBounds = target.getBoundingClientRect();
    if (targetBounds.top < bounds.top) {
        region.scrollTop -= (bounds.top - targetBounds.top) + 12;
    } else if (targetBounds.bottom > bounds.bottom) {
        region.scrollTop += (targetBounds.bottom - bounds.bottom) + 12;
    }
};

HtmlQuickMenu.prototype._broadcastAnimationPreference = function () {
    var multiplier = this.state.animationsEnabled ? 1 : (this.animationConfig.lowPerformanceMultiplier || 0.75);
    this.app.fire('ui:animations:toggle', {
        enabled: this.state.animationsEnabled,
        multiplier: multiplier
    });
};

HtmlQuickMenu.prototype._updateUsername = function () {
    if (!this._elements.usernameLabel) {
        return;
    }
    var username = this._resolveCurrentUsername();
    this._elements.usernameLabel.textContent = username || 'Unknown';
};

HtmlQuickMenu.prototype._resolveCurrentUsername = function () {
    try {
        if (this.app.services && typeof this.app.services.get === 'function') {
            var playerDataService = this.app.services.get('playerData');
            if (playerDataService) {
                if (typeof playerDataService.getUsername === 'function') {
                    var result = playerDataService.getUsername();
                    if (result) {
                        return result;
                    }
                }
                if (typeof playerDataService.username === 'string' && playerDataService.username) {
                    return playerDataService.username;
                }
            }
        }

        if (this.app.localPlayer && this.app.localPlayer.script && this.app.localPlayer.script.playerData) {
            var scriptData = this.app.localPlayer.script.playerData;
            if (typeof scriptData.getUsername === 'function') {
                return scriptData.getUsername();
            }
            if (typeof scriptData.username === 'string' && scriptData.username) {
                return scriptData.username;
            }
        }
    } catch (err) {
        console.warn('HtmlQuickMenu: Unable to resolve username.', err);
    }
    return window.userName || '';
};

HtmlQuickMenu.prototype._persistPreference = function (key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (err) {
        console.warn('HtmlQuickMenu: Failed to persist preference.', err);
    }
};

HtmlQuickMenu.prototype._playHoverSound = function () {
    this.app.fire('ui:playSound', 'ui_hover_default');
};

HtmlQuickMenu.prototype._playClickSound = function () {
    this.app.fire('ui:playSound', 'ui_click_default');
};


HtmlQuickMenu.prototype.destroy = function () {
    this._unbindGlobalEvents();

    this.app.off('player:data:changed', this._handlers.onPlayerDataChanged, this);
    this.app.off('booth:claimed', this._handlers.onBoothClaimed, this);
    this.app.off('booth:unclaimed', this._handlers.onBoothUnclaimed, this);

    if (this.toggleButton) {
        this.toggleButton.removeEventListener('click', this._handlers.onToggleClick);
        this.toggleButton.removeEventListener('mouseenter', this._handlers.onHover);
        if (this.toggleButton.parentNode) {
            this.toggleButton.parentNode.removeChild(this.toggleButton);
        }
    }

    if (this._elements.closeButton) {
        this._elements.closeButton.removeEventListener('click', this._handlers.onClose);
        this._elements.closeButton.removeEventListener('mouseenter', this._handlers.onHover);
    }
    if (this._elements.animationsToggle) {
        this._elements.animationsToggle.removeEventListener('change', this._handlers.onAnimationsToggle);
    }
    if (this._elements.tiles && this._elements.tiles.length) {
        this._elements.tiles.forEach(function (tile) {
            tile.removeEventListener('click', this._handlers.onNavClick);
            tile.removeEventListener('mouseenter', this._handlers.onHover);
        }, this);
    }
    if (this._elements.scrollRegion) {
        this._elements.scrollRegion.removeEventListener('focusin', this._handlers.onScrollFocus);
    }

    if (this._containerEl && this._containerEl.parentNode) {
        this._containerEl.parentNode.removeChild(this._containerEl);
    }
    if (this._styleEl && this._styleEl.parentNode) {
        this._styleEl.parentNode.removeChild(this._styleEl);
    }
};
