// Scripts/Core/UIManager.js
var UIManager = pc.createScript('UIManager');

// Store registered UI components
UIManager.prototype.initialize = function () {
    this.components = [];
    this.app.uiManager = this;

    // Load the global theme
    this.theme = this._normalizeTheme(window.Theme || {});
    this.performanceProfile = this._detectPerformanceProfile();
    this.animations = this._createAnimationConfig();
    console.log("UIManager initialized. Theme:", this.theme);

    this.injectGlobalStyles();
    this.setupSoundEventListeners();
    this._setupTransitionOverlay();

    this._boundTransitionBegin = this.beginTransition.bind(this);
    this._boundTransitionEnd = this.endTransition.bind(this);
    this._boundStreamProgress = this._handleStreamProgress.bind(this);
    this._boundAnimationToggle = this._handleAnimationToggle.bind(this);
    this.app.on('transition:begin', this._boundTransitionBegin, this);
    this.app.on('transition:end', this._boundTransitionEnd, this);
    this.app.on('load:stream:progress', this._boundStreamProgress, this);
    this.app.on('ui:animations:toggle', this._boundAnimationToggle, this);
};

UIManager.prototype.setupSoundEventListeners = function() {
    // This function sets up global listeners for common UI sounds.
    // We listen on the document body to catch events from dynamically added HTML elements.
    this.lastHoveredElement = null;

    if (this._boundDocumentClick) {
        document.body.removeEventListener('click', this._boundDocumentClick, true);
    }
    this._boundDocumentClick = this._handleDocumentClick.bind(this);

    // --- Click Sound ---
    document.body.addEventListener('click', this._boundDocumentClick, true); // Use capture phase to catch events early.

    // --- Hover Sound ---
    // The global mouseover listener has been removed to prevent repetitive sounds.
    // Hover sounds are now handled by individual UI components using 'mouseenter'.
};

UIManager.prototype._handleDocumentClick = function (event) {
    // Play a click sound if the user clicks on an interactive element.
    const interactiveElement = event.target.closest('button, [role="button"], .sound-click');
    // Play a click sound, unless the element is marked to suppress it.
    if (interactiveElement && !interactiveElement.hasAttribute('data-suppress-default-sound')) {
        this.app.fire('ui:playSound', 'ui_click_default');
    }
};

UIManager.prototype.registerComponent = function (component) {
    this.components.push(component);

    // If the component supports theming, apply the theme
    if (component.setTheme) {
        component.setTheme(this.theme);
    }

    if (component.setAnimationConfig) {
        component.setAnimationConfig(this.animations);
    }

    console.log("UIManager registered component:", component.name || component.constructor.name);
};

UIManager.prototype.getTheme = function () {
    return this.theme;
};

UIManager.prototype.getAnimationConfig = function () {
    return this.animations;
};

UIManager.prototype.isAnimationEnabled = function () {
    return !!(this.animations && this.animations.enabled);
};

UIManager.prototype.injectGlobalStyles = function () {
    if (document.getElementById('global-ui-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'global-ui-styles';
    style.innerHTML = `
        :root {
            --font-family: ${this.theme.fonts.family};
            --primary-color: ${this.theme.colors.primary};
            --accent-color: ${this.theme.colors.accent};
            --surface-color: ${this.theme.colors.surface};
            --text-color: ${this.theme.colors.text};
            --text-muted-color: ${this.theme.colors.textMuted};
            --text-dark-color: ${this.theme.colors.textDark};
            --border-radius: ${this.theme.styles.borderRadius};
            --animation-duration-instant: ${this.animations.durations.instant}s;
            --animation-duration-quick: ${this.animations.durations.quick}s;
            --animation-duration-standard: ${this.animations.durations.standard}s;
            --animation-duration-extended: ${this.animations.durations.extended}s;
            --animation-ease-entrance: ${this.animations.easings.entrance};
            --animation-ease-exit: ${this.animations.easings.exit};
            --animation-ease-emphasize: ${this.animations.easings.emphasize};
            --action-dock-gap: ${this._getLayoutValue('actionDock', 'gap', 14)}px;
            --action-dock-button-size: ${this._getLayoutValue('actionDock', 'buttonSize', 54)}px;
            --action-dock-offset-bottom: calc(${this._getLayoutOffset('actionDock', 'bottom', 80)}px + env(safe-area-inset-bottom, 0px));
            --action-dock-offset-right: calc(${this._getLayoutOffset('actionDock', 'right', 24)}px + env(safe-area-inset-right, 0px));
            --toggle-surface: ${this.theme.colors.surface};
        }
        @media (max-width: 768px) {
            :root {
                --action-dock-offset-bottom: calc(${this._getLayoutMobileOffset('actionDock', 'bottom', 72)}px + env(safe-area-inset-bottom, 0px));
                --action-dock-offset-right: calc(${this._getLayoutMobileOffset('actionDock', 'right', 16)}px + env(safe-area-inset-right, 0px));
            }
        }
        #ui-button-container {
            position: fixed;
            left: 24px;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: var(--action-dock-gap);
            z-index: 5002;
            pointer-events: none;
        }
        #ui-button-container .ui-action-button {
            pointer-events: auto;
        }
        .ui-action-button {
            width: var(--action-dock-button-size);
            height: var(--action-dock-button-size);
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 14px;
            border: none;
            background: var(--toggle-surface, rgba(26, 32, 46, 0.9));
            box-shadow: 0 14px 32px rgba(0, 0, 0, 0.28);
            cursor: pointer;
            transition: transform var(--animation-duration-quick) var(--animation-ease-entrance),
                        box-shadow var(--animation-duration-quick) ease,
                        background var(--animation-duration-quick) ease;
            color: var(--text-color);
            font-size: 22px;
            backdrop-filter: blur(12px);
        }
        .ui-action-button .icon {
            width: 26px;
            height: 26px;
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }
        .ui-action-button .label {
            display: none;
        }
        .ui-action-button:hover {
            transform: scale(1.06);
            background: rgba(26, 32, 46, 0.96);
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.32);
        }
        .ui-action-button.is-open,
        .ui-action-button.is-active {
            background: var(--accent-color);
            color: var(--text-dark-color);
        }
        .wave-action-wrapper,
        .quick-menu-toggle {
            position: relative;
        }
        .fanout-menu {
            position: absolute;
            top: 50%;
            left: calc(100% + 16px);
            transform: translateY(-50%);
            pointer-events: none;
            z-index: 5001;
            min-width: 1px;
            min-height: 1px;
        }
        .fanout-menu.is-open {
            pointer-events: auto;
        }
        .fanout-menu__button {
            pointer-events: none;
            position: absolute;
            inset: 0 auto auto 0;
            min-width: auto;
            width: 64px;
            height: 72px;
            padding: 10px 8px;
            border-radius: 16px;
            background: rgba(26, 32, 46, 0.92);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 500;
            line-height: 1.2;
            cursor: pointer;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
            transform-origin: left center;
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.75);
            visibility: hidden;
            transition: all var(--animation-duration-quick) ease;
        }
        .fanout-menu.is-open .fanout-menu__button {
            pointer-events: auto;
            visibility: visible;
        }
        .fanout-menu__button:hover:not(:disabled),
        .fanout-menu__button:not(.is-disabled):hover {
            background: rgba(36, 44, 62, 0.96);
            box-shadow: 0 16px 36px rgba(0, 0, 0, 0.36);
            transform: translate3d(0, 0, 0) scale(1.08);
            transition: all 120ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .fanout-menu__button:focus-visible {
            outline: 2px solid rgba(29, 242, 164, 0.5);
            outline-offset: 2px;
        }
        .fanout-menu__button:disabled,
        .fanout-menu__button.is-disabled {
            pointer-events: none;
            opacity: 0.48;
            cursor: not-allowed;
        }
        .fanout-menu__button:disabled:hover,
        .fanout-menu__button.is-disabled:hover {
            background: rgba(26, 32, 46, 0.92);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
            transform: translate3d(0, 0, 0) scale(0.85);
        }
        .fanout-menu__glyph {
            width: 36px;
            height: 36px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.1);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            line-height: 1;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
            flex-shrink: 0;
        }
        .fanout-menu__label {
            font-size: 12px;
            font-weight: 500;
            letter-spacing: 0.02em;
            text-align: center;
            width: 100%;
            word-break: break-word;
        }
        @media (max-width: 768px) {
            #ui-button-container {
                left: 20px;
                top: 50%;
                bottom: auto;
                right: auto;
                transform: translateY(-50%);
            }
        }
        #ui-transition-overlay {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            opacity: 0;
            transform: scale(1.02);
            transition: opacity 220ms ease, transform 420ms cubic-bezier(0.45, 0, 0.2, 1);
            z-index: 1100;
            backdrop-filter: blur(12px);
        }
        #ui-transition-overlay::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
                radial-gradient(circle at 20% 20%, rgba(93, 63, 211, 0.35), transparent 60%),
                radial-gradient(circle at 80% 25%, rgba(20, 241, 149, 0.28), transparent 55%),
                linear-gradient(130deg, rgba(8, 12, 24, 0.94), rgba(10, 14, 27, 0.97));
            opacity: 0.96;
            filter: saturate(120%);
        }
        #ui-transition-overlay::after {
            content: '';
            position: absolute;
            inset: 0;
            background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'%3E%3Cdefs%3E%3CradialGradient id='g' cx='0.5' cy='0.5' r='0.5'%3E%3Cstop offset='0' stop-color='%23ffffff' stop-opacity='0.045'/%3E%3Cstop offset='1' stop-color='%23ffffff' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='240' height='240' fill='url(%23g)'/%3E%3C/svg%3E");
            opacity: 0.82;
            mix-blend-mode: screen;
            animation: ui-transition-noise 9600ms linear infinite;
        }
        #ui-transition-overlay.visible {
            opacity: 1;
            pointer-events: auto;
            transform: scale(1);
        }
        #ui-transition-overlay.closing {
            opacity: 0;
            transform: scale(0.985);
        }
        .ui-transition-card {
            position: relative;
            padding: 32px 48px;
            border-radius: 28px;
            background: rgba(7, 10, 20, 0.72);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow:
                0 25px 65px rgba(10, 14, 27, 0.45),
                0 10px 24px rgba(10, 14, 27, 0.65) inset,
                0 0 0 1px rgba(255, 255, 255, 0.04) inset;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 18px;
            color: var(--text-color);
            font-family: var(--font-family), sans-serif;
            text-align: center;
            transform: translateY(24px);
            opacity: 0;
            transition: opacity 260ms ease, transform 320ms ease;
        }
        #ui-transition-overlay.visible .ui-transition-card {
            transform: translateY(0);
            opacity: 1;
        }
        .ui-transition-badge {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.05));
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .ui-transition-badge::before {
            content: '';
            position: absolute;
            inset: -12px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(153, 69, 255, 0.5), rgba(20, 241, 149, 0.5));
            filter: blur(18px);
            opacity: 0.85;
            animation: ui-transition-glow 2800ms ease-in-out infinite;
        }
        .ui-transition-badge::after {
            content: '';
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.92);
            border-top-color: transparent;
            animation: ui-transition-spin 1250ms linear infinite;
        }
        .ui-transition-heading {
            font-size: 22px;
            letter-spacing: 0.04em;
            font-weight: 600;
        }
        .ui-transition-subtext {
            font-size: 15px;
            letter-spacing: 0.02em;
            color: var(--text-muted-color);
            max-width: 320px;
            line-height: 1.35;
            animation: ui-transition-subtle-pulse 4800ms ease-in-out infinite;
        }
        .ui-transition-progress {
            width: 140px;
            height: 4px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.09);
            overflow: hidden;
        }
        .ui-transition-progress span {
            display: block;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, rgba(153, 69, 255, 0.85), rgba(20, 241, 149, 0.85));
            transform-origin: left center;
            transform: scaleX(0.18);
            animation: ui-transition-progress 1600ms ease-in-out infinite;
        }
        @keyframes ui-transition-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes ui-transition-glow {
            0%, 100% { transform: scale(0.98); opacity: 0.72; }
            48% { transform: scale(1.05); opacity: 0.96; }
        }
        @keyframes ui-transition-noise {
            0% { transform: translate(0, 0); }
            25% { transform: translate(-8px, -10px); }
            50% { transform: translate(6px, 8px); }
            75% { transform: translate(-12px, 4px); }
            100% { transform: translate(0, 0); }
        }
        @keyframes ui-transition-subtle-pulse {
            0%, 100% { opacity: 0.82; }
            50% { opacity: 1; }
        }
        @keyframes ui-transition-progress {
            0% { transform: scaleX(0.18); }
            52% { transform: scaleX(0.82); }
            100% { transform: scaleX(0.22); }
        }
        @media (max-width: 560px) {
            .ui-transition-card {
                margin: 0 18px;
                padding: 28px;
                gap: 14px;
            }
            .ui-transition-heading {
                font-size: 20px;
            }
            .ui-transition-subtext {
                font-size: 14px;
            }
        }
    `;
    document.head.appendChild(style);
};

UIManager.prototype._setupTransitionOverlay = function () {
    if (document.getElementById('ui-transition-overlay')) {
        this.transitionOverlay = document.getElementById('ui-transition-overlay');
        this.transitionHeading = this.transitionOverlay.querySelector('.ui-transition-heading');
        this.transitionSubtext = this.transitionOverlay.querySelector('.ui-transition-subtext');
        this.transitionProgressBar = this.transitionOverlay.querySelector('.ui-transition-progress span');
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'ui-transition-overlay';

    const card = document.createElement('div');
    card.className = 'ui-transition-card';

    const badge = document.createElement('div');
    badge.className = 'ui-transition-badge';

    const heading = document.createElement('div');
    heading.className = 'ui-transition-heading';
    heading.textContent = 'Preparing world...';

    const subtext = document.createElement('div');
    subtext.className = 'ui-transition-subtext';
    subtext.textContent = 'Loading core systems';

    const progress = document.createElement('div');
    progress.className = 'ui-transition-progress';
    const progressBar = document.createElement('span');
    progress.appendChild(progressBar);

    card.appendChild(badge);
    card.appendChild(heading);
    card.appendChild(subtext);
    card.appendChild(progress);
    overlay.appendChild(card);

    document.body.appendChild(overlay);

    this.transitionOverlay = overlay;
    this.transitionHeading = heading;
    this.transitionSubtext = subtext;
    this.transitionProgressBar = progressBar;
};

UIManager.prototype.beginTransition = function (payload) {
    if (!this.transitionOverlay) {
        this._setupTransitionOverlay();
    }
    const message = payload && payload.message ? payload.message : 'Entering...';
    const subtext = payload && payload.subtext ? payload.subtext : 'Loading core experience';
    this._transitionBaseSubtext = subtext;
    this._transitionLockedText = payload && payload.lockSubtext === true;
    if (this.transitionHeading) {
        this.transitionHeading.textContent = message;
    }
    if (this.transitionSubtext) {
        this.transitionSubtext.textContent = subtext;
    }
    this._transitionShowProgress = payload && payload.showProgress === false ? false : true;
    if (this.transitionProgressBar) {
        if (this._transitionShowProgress) {
            this.transitionProgressBar.style.animation = 'none';
            this.transitionProgressBar.style.transform = 'scaleX(0.18)';
        } else {
            this.transitionProgressBar.style.animation = '';
            this.transitionProgressBar.style.transform = '';
        }
    }
    this.transitionOverlay.classList.remove('closing');
    this.transitionOverlay.classList.add('visible');
};

UIManager.prototype.endTransition = function (payload) {
    const delay = payload && typeof payload.delayMs === 'number' ? payload.delayMs : 120;
    const overlay = this.transitionOverlay;
    if (!overlay) {
        return;
    }
    this._transitionShowProgress = false;
    overlay.classList.add('closing');
    setTimeout(() => {
        overlay.classList.remove('visible');
        overlay.classList.remove('closing');
        if (this.transitionProgressBar) {
            this.transitionProgressBar.style.animation = '';
            this.transitionProgressBar.style.transform = '';
        }
    }, Math.max(140, delay + 160));
};

UIManager.prototype._handleStreamProgress = function (payload) {
    if (!this.transitionOverlay || !this.transitionOverlay.classList.contains('visible')) {
        return;
    }
    if (!this._transitionShowProgress) {
        return;
    }
    const total = typeof payload.total === 'number' ? payload.total : 0;
    if (total <= 0) {
        return;
    }
    const loaded = typeof payload.loaded === 'number' ? payload.loaded : 0;
    const ratio = Math.min(1, Math.max(0, loaded / total));
    if (this.transitionProgressBar) {
        this.transitionProgressBar.style.animation = 'none';
        const eased = 0.15 + ratio * 0.82;
        this.transitionProgressBar.style.transform = `scaleX(${eased})`;
    }
    if (this.transitionSubtext && !this._transitionLockedText) {
        const pct = Math.round(ratio * 100);
        const base = this._transitionBaseSubtext || 'Streaming assets';
        this.transitionSubtext.textContent = `${base} • ${pct}%`;
    }
};

UIManager.prototype.destroy = function () {
    this.app.off('transition:begin', this._boundTransitionBegin, this);
    this.app.off('transition:end', this._boundTransitionEnd, this);
    this.app.off('load:stream:progress', this._boundStreamProgress, this);
    this.app.off('ui:animations:toggle', this._boundAnimationToggle, this);
    if (this._boundDocumentClick) {
        document.body.removeEventListener('click', this._boundDocumentClick, true);
        this._boundDocumentClick = null;
    }
};

UIManager.prototype._handleAnimationToggle = function (payload) {
    if (!this.animations) {
        return;
    }
    if (payload && Object.prototype.hasOwnProperty.call(payload, 'enabled')) {
        this.animations.enabled = !!payload.enabled;
        this.animations.forced = true;
    }
    if (payload && typeof payload.multiplier === 'number') {
        this.animations.multiplier = Math.max(0, payload.multiplier);
    }
    this.components.forEach(function (component) {
        if (component && typeof component.setAnimationConfig === 'function') {
            component.setAnimationConfig(this.animations);
        }
    }, this);
};

UIManager.prototype._normalizeTheme = function (theme) {
    const defaultColors = {
        primary: '#1d9bf0',
        primary2: '#1d77f2',
        accent: '#1df2a4',
        accent2: '#1de8f2',
        surface: 'rgba(17, 17, 17, 0.92)',
        surface2: 'rgba(34, 34, 34, 0.95)',
        text: '#ffffff',
        textMuted: 'rgba(255, 255, 255, 0.85)',
        textDark: '#111111',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545'
    };

    const defaultFonts = {
        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        size: {
            small: '12px',
            medium: '14px',
            large: '16px',
            xlarge: '20px'
        },
        weight: {
            light: 300,
            regular: 400,
            semibold: 600,
            bold: 700
        }
    };

    const defaultStyles = {
        borderRadius: '14px',
        boxShadow: '0 18px 36px rgba(0, 0, 0, 0.35)',
        button: {
            padding: '10px 14px',
            borderRadius: '10px',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
        },
        input: {
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)'
        }
    };

    const normalized = Object.assign({}, theme);
    normalized.colors = Object.assign({}, defaultColors, theme.colors || {});
    normalized.fonts = Object.assign({}, defaultFonts, theme.fonts || {});
    normalized.fonts.size = Object.assign({}, defaultFonts.size, theme.fonts && theme.fonts.size ? theme.fonts.size : {});
    normalized.fonts.weight = Object.assign({}, defaultFonts.weight, theme.fonts && theme.fonts.weight ? theme.fonts.weight : {});
    normalized.styles = Object.assign({}, defaultStyles, theme.styles || {});
    normalized.styles.button = Object.assign({}, defaultStyles.button, theme.styles && theme.styles.button ? theme.styles.button : {});
    normalized.styles.input = Object.assign({}, defaultStyles.input, theme.styles && theme.styles.input ? theme.styles.input : {});

    const defaultLayout = {
        actionDock: {
            gap: 14,
            buttonSize: 54,
            baseOffset: { bottom: 80, right: 24 },
            mobileOffset: { bottom: 72, right: 16 }
        },
        avatarPanel: {
            width: 360,
            maxWidthMobile: 320
        },
        quickMenu: {
            maxHeight: 420,
            width: 320
        }
    };

    normalized.layout = Object.assign({}, defaultLayout, theme.layout || {});
    if (normalized.layout.actionDock) {
        normalized.layout.actionDock.baseOffset = Object.assign({}, defaultLayout.actionDock.baseOffset, theme.layout && theme.layout.actionDock && theme.layout.actionDock.baseOffset ? theme.layout.actionDock.baseOffset : {});
        normalized.layout.actionDock.mobileOffset = Object.assign({}, defaultLayout.actionDock.mobileOffset, theme.layout && theme.layout.actionDock && theme.layout.actionDock.mobileOffset ? theme.layout.actionDock.mobileOffset : {});
    }

    const defaultPerformance = {
        enableAutoQuality: true,
        reducedMotionFallback: 'fade'
    };

    normalized.performance = Object.assign({}, defaultPerformance, theme.performance || {});

    return normalized;
};

UIManager.prototype._detectPerformanceProfile = function () {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const deviceMemory = typeof navigator !== 'undefined' && navigator.deviceMemory ? navigator.deviceMemory : null;
    const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : null;
    const autoQuality = this.theme.performance && this.theme.performance.enableAutoQuality !== false;

    const likelyLowEnd = autoQuality && (
        prefersReducedMotion ||
        (deviceMemory && deviceMemory <= 4) ||
        (cores && cores <= 4) ||
        (window.innerWidth < 820 && window.devicePixelRatio && window.devicePixelRatio > 2)
    );

    return {
        prefersReducedMotion,
        likelyLowEnd
    };
};

UIManager.prototype._createAnimationConfig = function () {
    const base = {
        enabled: true,
        durations: {
            instant: 0.1,
            quick: 0.16,
            standard: 0.26,
            extended: 0.44
        },
        easings: {
            entrance: 'power3.out',
            exit: 'power2.in',
            emphasize: 'power4.out'
        },
        stagger: 0.05,
        lowPerformanceMultiplier: 0.75,
        multiplier: 1
    };

    const themeAnimations = this.theme.animations || {};
    const merged = Object.assign({}, base, themeAnimations);
    merged.durations = Object.assign({}, base.durations, themeAnimations.durations || {});
    merged.easings = Object.assign({}, base.easings, themeAnimations.easings || {});
    merged.stagger = typeof themeAnimations.stagger === 'number' ? themeAnimations.stagger : base.stagger;
    merged.lowPerformanceMultiplier = typeof themeAnimations.lowPerformanceMultiplier === 'number'
        ? themeAnimations.lowPerformanceMultiplier
        : base.lowPerformanceMultiplier;

    if (this.performanceProfile && this.performanceProfile.prefersReducedMotion) {
        merged.enabled = false;
    }

    if (this.performanceProfile && this.performanceProfile.likelyLowEnd) {
        merged.multiplier = merged.lowPerformanceMultiplier;
    }

    merged.reducedMotionFallback = (this.theme.performance && this.theme.performance.reducedMotionFallback) || 'fade';
    return merged;
};

UIManager.prototype._getLayoutValue = function (section, key, fallback) {
    const layout = this.theme && this.theme.layout && this.theme.layout[section];
    if (!layout || typeof layout[key] === 'undefined') {
        return fallback;
    }
    return layout[key];
};

UIManager.prototype._getLayoutOffset = function (section, key, fallback) {
    const layout = this.theme && this.theme.layout && this.theme.layout[section];
    if (!layout || !layout.baseOffset || typeof layout.baseOffset[key] === 'undefined') {
        return fallback;
    }
    return layout.baseOffset[key];
};

UIManager.prototype._getLayoutMobileOffset = function (section, key, fallback) {
    const layout = this.theme && this.theme.layout && this.theme.layout[section];
    if (!layout || !layout.mobileOffset || typeof layout.mobileOffset[key] === 'undefined') {
        return fallback;
    }
    return layout.mobileOffset[key];
};
