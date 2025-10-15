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
        masterVolume: 1,
        effectsEnabled: true,
        animationsEnabled: true
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
        volume: 'pg:ui:masterVolume',
        effects: 'pg:ui:effectsEnabled',
        animations: 'pg:ui:animationsEnabled'
    };

    this._restoreStoredSettings();
    this._prepareHandlers();
    this._loadAssets();

    this._handlers.onPlayerDataChanged = this._updateUsername.bind(this);
    this.app.on('player:data:changed', this._handlers.onPlayerDataChanged, this);
    this.app.on('player:spawned', this._handlers.onPlayerDataChanged, this);
    this.app.on('sound:masterVolume:updated', this._handleVolumeBroadcast, this);
    this.app.on('sound:effects:state', this._handleEffectsBroadcast, this);

    if (this.app.uiManager && this.app.uiManager.registerComponent) {
        this.app.uiManager.registerComponent(this);
    }
};

HtmlQuickMenu.prototype._prepareHandlers = function () {
    this._handlers.onToggleClick = this.toggleMenu.bind(this);
    this._handlers.onHover = this._playHoverSound.bind(this);
    this._handlers.onClose = this.closeMenu.bind(this);
    this._handlers.onVolumeInput = this._handleVolumeInput.bind(this);
    this._handlers.onVolumeCommit = this._handleVolumeCommit.bind(this);
    this._handlers.onSfxToggle = this._handleSfxToggle.bind(this);
    this._handlers.onAnimationsToggle = this._handleAnimationToggle.bind(this);
    this._handlers.onEditUsername = this._handleEditUsername.bind(this);
    this._handlers.onGlobalPointer = this._handleGlobalPointer.bind(this);
    this._handlers.onEscape = this._handleEscape.bind(this);
};

HtmlQuickMenu.prototype._restoreStoredSettings = function () {
    try {
        var storedVolume = localStorage.getItem(this._storage.volume);
        if (storedVolume !== null) {
            var volume = parseFloat(storedVolume);
            if (!isNaN(volume)) {
                this.state.masterVolume = pc.math.clamp(volume, 0, 1);
            }
        }
        var storedEffects = localStorage.getItem(this._storage.effects);
        if (storedEffects !== null) {
            this.state.effectsEnabled = storedEffects === 'true';
        }
        var storedAnimations = localStorage.getItem(this._storage.animations);
        if (storedAnimations !== null) {
            this.state.animationsEnabled = storedAnimations === 'true';
        this._broadcastAnimationPreference();
        }
    } catch (err) {
        console.warn('HtmlQuickMenu: Unable to restore UI preferences.', err);
    }
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
            self._syncSoundState();
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
        this._syncSoundState();
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
    this._elements.closeButton = this._containerEl.querySelector('[data-quick-menu-close]');
    this._elements.volumeSlider = this._containerEl.querySelector('[data-quick-menu-volume]');
    this._elements.volumeValue = this._containerEl.querySelector('[data-quick-menu-volume-value]');
    this._elements.sfxToggle = this._containerEl.querySelector('[data-quick-menu-sfx]');
    this._elements.animationsToggle = this._containerEl.querySelector('[data-quick-menu-animations]');
    this._elements.usernameLabel = this._containerEl.querySelector('[data-quick-menu-username]');
    this._elements.editUsernameBtn = this._containerEl.querySelector('[data-quick-menu-edit-username]');

    if (this._elements.closeButton) {
        this._elements.closeButton.addEventListener('click', this._handlers.onClose);
        this._elements.closeButton.addEventListener('mouseenter', this._handlers.onHover);
    }

    if (this._elements.volumeSlider) {
        this._elements.volumeSlider.addEventListener('input', this._handlers.onVolumeInput);
        this._elements.volumeSlider.addEventListener('change', this._handlers.onVolumeCommit);
    }

    if (this._elements.sfxToggle) {
        this._elements.sfxToggle.addEventListener('change', this._handlers.onSfxToggle);
    }

    if (this._elements.animationsToggle) {
        this._elements.animationsToggle.addEventListener('change', this._handlers.onAnimationsToggle);
    }

    if (this._elements.editUsernameBtn) {
        this._elements.editUsernameBtn.addEventListener('click', this._handlers.onEditUsername);
        this._elements.editUsernameBtn.addEventListener('mouseenter', this._handlers.onHover);
    }

    this._applyThemeStyles();
};

HtmlQuickMenu.prototype._createToggleButton = function () {
    if (this.toggleButton) {
        return;
    }

    var dock = this._ensureActionDock();

    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'ui-action-button quick-menu-toggle';
    this.toggleButton.type = 'button';
    this.toggleButton.setAttribute('aria-label', 'Open quick menu');
    this.toggleButton.setAttribute('aria-expanded', 'false');
    this.toggleButton.innerHTML = '<span class="icon" aria-hidden="true">☰</span>';

    this.toggleButton.addEventListener('click', this._handlers.onToggleClick);
    this.toggleButton.addEventListener('mouseenter', this._handlers.onHover);

    dock.appendChild(this.toggleButton);
};

HtmlQuickMenu.prototype._ensureActionDock = function () {
    var dock = document.getElementById('ui-button-container');
    if (!dock) {
        dock = document.createElement('div');
        dock.id = 'ui-button-container';
        document.body.appendChild(dock);
        this.app.fire('ui:button-container:ready');
    }
    return dock;
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

HtmlQuickMenu.prototype.setTheme = function (theme) {
    this.theme = theme;
    this._applyThemeStyles();
};

HtmlQuickMenu.prototype.setAnimationConfig = function (config) {
    if (!config) {
        return;
    }
    this.animationConfig = Object.assign({}, this.animationConfig, config);
    if (typeof this.animationConfig.enabled === 'boolean') {
        this.state.animationsEnabled = this.animationConfig.enabled;
        this._syncAnimationToggle();
        this._persistPreference(this._storage.animations, String(this.state.animationsEnabled));
    }
};

HtmlQuickMenu.prototype.toggleMenu = function () {
    if (this.isOpen) {
        this.closeMenu();
    } else {
        this.openMenu();
    }
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
        this.toggleButton.setAttribute('aria-label', 'Close quick menu');
    }

    this._bindGlobalEvents();
    this._syncSoundState();
    this._updateUsername();
    this._syncAnimationToggle();

    this._playClickSound();

    var duration = (this.animationConfig.durations && this.animationConfig.durations.standard) || 0.26;
    duration *= this.animationConfig.multiplier || 1;
    var easeIn = (this.animationConfig.easings && this.animationConfig.easings.entrance) || 'power3.out';

    if (window.gsap && this.animationConfig.enabled !== false) {
        gsap.killTweensOf(this._panelEl);
        gsap.fromTo(this._panelEl,
            { opacity: 0, y: 28, scale: 0.94 },
            {
                opacity: 1,
                y: 0,
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

    this.isOpen = false;
    this.rootEl.classList.remove('is-open');
    this.rootEl.setAttribute('aria-hidden', 'true');
    if (this.toggleButton) {
        this.toggleButton.classList.remove('is-open');
        this.toggleButton.setAttribute('aria-expanded', 'false');
        this.toggleButton.setAttribute('aria-label', 'Open quick menu');
    }

    this._unbindGlobalEvents();
    this._playClickSound();

    var duration = (this.animationConfig.durations && this.animationConfig.durations.quick) || 0.18;
    duration *= this.animationConfig.multiplier || 1;
    var easeOut = (this.animationConfig.easings && this.animationConfig.easings.exit) || 'power2.in';

    if (window.gsap && this.animationConfig.enabled !== false) {
        gsap.killTweensOf(this._panelEl);
        gsap.to(this._panelEl, {
            opacity: 0,
            y: 24,
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
        this._panelEl.style.transform = 'translateY(24px) scale(0.96)';
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

HtmlQuickMenu.prototype._handleVolumeInput = function (event) {
    var value = parseFloat(event.target.value);
    if (isNaN(value)) {
        return;
    }
    this.state.masterVolume = pc.math.clamp(value, 0, 1);
    this._updateVolumeLabel();
    this.app.fire('ui:sound:setMasterVolume', this.state.masterVolume);
};

HtmlQuickMenu.prototype._handleVolumeCommit = function () {
    this._persistPreference(this._storage.volume, this.state.masterVolume.toFixed(2));
};

HtmlQuickMenu.prototype._handleSfxToggle = function (event) {
    this.state.effectsEnabled = !!event.target.checked;
    this.app.fire('ui:sound:setEffectsEnabled', this.state.effectsEnabled);
    this._persistPreference(this._storage.effects, String(this.state.effectsEnabled));
    this._playClickSound();
};

HtmlQuickMenu.prototype._handleAnimationToggle = function (event) {
    this.state.animationsEnabled = !!event.target.checked;
    this._broadcastAnimationPreference();
    this._persistPreference(this._storage.animations, String(this.state.animationsEnabled));
    this._playClickSound();
};

HtmlQuickMenu.prototype._handleEditUsername = function () {
    this.app.fire('ui:usernamePanel:open');
    this._playClickSound();
};

HtmlQuickMenu.prototype._updateVolumeLabel = function () {
    if (this._elements.volumeValue) {
        var pct = Math.round(this.state.masterVolume * 100);
        this._elements.volumeValue.textContent = pct + '%';
    }
    if (this._elements.volumeSlider && this._elements.volumeSlider.value !== String(this.state.masterVolume)) {
        this._elements.volumeSlider.value = this.state.masterVolume;
    }
};

HtmlQuickMenu.prototype._syncSoundState = function () {
    if (this.app.soundManager) {
        this.state.masterVolume = typeof this.app.soundManager.masterVolume === 'number'
            ? pc.math.clamp(this.app.soundManager.masterVolume, 0, 1)
            : this.state.masterVolume;
        if (typeof this.app.soundManager.effectsEnabled === 'boolean') {
            this.state.effectsEnabled = this.app.soundManager.effectsEnabled;
        }
    }
    if (this._elements.volumeSlider) {
        this._elements.volumeSlider.value = this.state.masterVolume;
    }
    if (this._elements.sfxToggle) {
        this._elements.sfxToggle.checked = this.state.effectsEnabled;
    }
    this._updateVolumeLabel();
};

HtmlQuickMenu.prototype._handleVolumeBroadcast = function (value) {
    if (typeof value !== 'number') {
        return;
    }
    this.state.masterVolume = pc.math.clamp(value, 0, 1);
    if (this._elements.volumeSlider && this._elements.volumeSlider !== document.activeElement) {
        this._elements.volumeSlider.value = this.state.masterVolume;
    }
    this._updateVolumeLabel();
};

HtmlQuickMenu.prototype._handleEffectsBroadcast = function (state) {
    if (typeof state !== 'boolean') {
        return;
    }
    this.state.effectsEnabled = state;
    if (this._elements.sfxToggle) {
        this._elements.sfxToggle.checked = state;
    }
};

HtmlQuickMenu.prototype._syncAnimationToggle = function () {
    if (!this._elements.animationsToggle) {
        return;
    }
    this._elements.animationsToggle.checked = this.state.animationsEnabled !== false;
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

HtmlQuickMenu.prototype.swap = function (old) {
    this.theme = old.theme;
    this.animationConfig = old.animationConfig;
    this.state = old.state;
};

HtmlQuickMenu.prototype.destroy = function () {
    this._unbindGlobalEvents();

    this.app.off('player:data:changed', this._handlers.onPlayerDataChanged, this);
    this.app.off('player:spawned', this._handlers.onPlayerDataChanged, this);
    this.app.off('sound:masterVolume:updated', this._handleVolumeBroadcast, this);
    this.app.off('sound:effects:state', this._handleEffectsBroadcast, this);

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
    if (this._elements.volumeSlider) {
        this._elements.volumeSlider.removeEventListener('input', this._handlers.onVolumeInput);
        this._elements.volumeSlider.removeEventListener('change', this._handlers.onVolumeCommit);
    }
    if (this._elements.sfxToggle) {
        this._elements.sfxToggle.removeEventListener('change', this._handlers.onSfxToggle);
    }
    if (this._elements.animationsToggle) {
        this._elements.animationsToggle.removeEventListener('change', this._handlers.onAnimationsToggle);
    }
    if (this._elements.editUsernameBtn) {
        this._elements.editUsernameBtn.removeEventListener('click', this._handlers.onEditUsername);
        this._elements.editUsernameBtn.removeEventListener('mouseenter', this._handlers.onHover);
    }

    if (this._containerEl && this._containerEl.parentNode) {
        this._containerEl.parentNode.removeChild(this._containerEl);
    }
    if (this._styleEl && this._styleEl.parentNode) {
        this._styleEl.parentNode.removeChild(this._styleEl);
    }
};
