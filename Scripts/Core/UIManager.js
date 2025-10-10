// Scripts/Core/UIManager.js
var UIManager = pc.createScript('UIManager');

// Store registered UI components
UIManager.prototype.initialize = function () {
    this.components = [];
    this.app.uiManager = this;

    // Load the global theme
    this.theme = window.Theme || {};
    console.log("UIManager initialized. Theme:", this.theme);

    this.injectGlobalStyles();
    this.setupSoundEventListeners();
    this._setupTransitionOverlay();

    this._boundTransitionBegin = this.beginTransition.bind(this);
    this._boundTransitionEnd = this.endTransition.bind(this);
    this._boundStreamProgress = this._handleStreamProgress.bind(this);
    this.app.on('transition:begin', this._boundTransitionBegin, this);
    this.app.on('transition:end', this._boundTransitionEnd, this);
    this.app.on('load:stream:progress', this._boundStreamProgress, this);
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

    console.log("UIManager registered component:", component.name || component.constructor.name);
};

UIManager.prototype.getTheme = function () {
    return this.theme;
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
            --border-radius: ${this.theme.styles.borderRadius};
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
    if (this._boundDocumentClick) {
        document.body.removeEventListener('click', this._boundDocumentClick, true);
        this._boundDocumentClick = null;
    }
};
