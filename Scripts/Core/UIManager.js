// Scripts/Core/UIManager.js
var UIManager = pc.createScript('UIManager');

// Store registered UI components
UIManager.prototype.initialize = function () {
    this.components = [];
    this.app.uiManager = this;

    // Initialize InputManager if not already present
    this._setupInputManager();

    // Load the global theme
    this.theme = this._loadTheme();
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

UIManager.prototype._setupInputManager = function() {
    // Check if InputManager script is already attached to an entity
    if (!this.app.inputManager) {
        console.log("UIManager: Initializing InputManager...");
        // Fallback: We create a new entity for it if it doesn't exist.
        const inputEntity = new pc.Entity('InputManager');
        this.app.root.addChild(inputEntity);
        inputEntity.addComponent('script');
        inputEntity.script.create('inputManager');
    }
};

UIManager.prototype._loadTheme = function() {
    // Try to get theme from UITheme script if it exists
    const themeEntity = this.app.root.findByName('UITheme') || this.entity;
    if (themeEntity && themeEntity.script && themeEntity.script.uiTheme) {
        return themeEntity.script.uiTheme.getTheme();
    }

    // Fallback: Default Premium Theme
    return {
        colors: {
            primary: '#6366f1',
            primaryHover: '#4f46e5',
            primaryActive: '#4338ca',
            accent: '#10b981',
            accentHover: '#059669',
            background: 'rgba(15, 23, 42, 0.6)',
            surface: 'rgba(30, 41, 59, 0.7)',
            surfaceHighlight: 'rgba(51, 65, 85, 0.8)',
            text: '#f8fafc',
            textSecondary: '#94a3b8',
            textMuted: '#64748b',
            success: '#22c55e',
            warning: '#eab308',
            error: '#ef4444',
            info: '#3b82f6',
            border: 'rgba(255, 255, 255, 0.1)',
            borderHighlight: 'rgba(255, 255, 255, 0.2)'
        },
        typography: {
            fontFamily: "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            sizes: { xs: '12px', sm: '14px', base: '16px', lg: '18px', xl: '24px', xxl: '32px' },
            weights: { regular: 400, medium: 500, bold: 700 }
        },
        spacing: { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px', xxl: '48px' },
        borderRadius: { sm: '6px', md: '12px', lg: '16px', full: '9999px' },
        shadows: {
            sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            glow: '0 0 15px rgba(99, 102, 241, 0.5)'
        },
        animations: {
            fast: '0.15s ease',
            normal: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            slow: '0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        },
        layout: {
            actionDock: { gap: 14, buttonSize: 54, baseOffset: { bottom: 80, right: 24 }, mobileOffset: { bottom: 72, right: 16 } },
            avatarPanel: { width: 360, maxWidthMobile: 320 },
            quickMenu: { maxHeight: 420, width: 320 }
        }
    };
};

UIManager.prototype.setupSoundEventListeners = function() {
    this.lastHoveredElement = null;
    if (this._boundDocumentClick) {
        document.body.removeEventListener('click', this._boundDocumentClick, true);
    }
    this._boundDocumentClick = this._handleDocumentClick.bind(this);
    document.body.addEventListener('click', this._boundDocumentClick, true);
};

UIManager.prototype._handleDocumentClick = function (event) {
    const interactiveElement = event.target.closest('button, [role="button"], .sound-click');
    if (interactiveElement && !interactiveElement.hasAttribute('data-suppress-default-sound')) {
        this.app.fire('ui:playSound', 'ui_click_default');
    }
};

UIManager.prototype.registerComponent = function (component) {
    this.components.push(component);
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
    
    // Generate CSS variables from theme
    const t = this.theme;
    style.innerHTML = `
        :root {
            /* Colors */
            --color-primary: ${t.colors.primary};
            --color-primary-hover: ${t.colors.primaryHover};
            --color-primary-active: ${t.colors.primaryActive};
            --color-accent: ${t.colors.accent};
            --color-accent-hover: ${t.colors.accentHover};
            --color-background: ${t.colors.background};
            --color-surface: ${t.colors.surface};
            --color-surface-highlight: ${t.colors.surfaceHighlight};
            --color-text: ${t.colors.text};
            --color-text-secondary: ${t.colors.textSecondary};
            --color-text-muted: ${t.colors.textMuted};
            --color-success: ${t.colors.success};
            --color-warning: ${t.colors.warning};
            --color-error: ${t.colors.error};
            --color-info: ${t.colors.info};
            --color-border: ${t.colors.border};
            --color-border-highlight: ${t.colors.borderHighlight};

            /* Typography */
            --font-family: ${t.typography.fontFamily};
            --font-size-xs: ${t.typography.sizes.xs};
            --font-size-sm: ${t.typography.sizes.sm};
            --font-size-base: ${t.typography.sizes.base};
            --font-size-lg: ${t.typography.sizes.lg};
            --font-size-xl: ${t.typography.sizes.xl};
            --font-size-xxl: ${t.typography.sizes.xxl};
            --font-weight-regular: ${t.typography.weights.regular};
            --font-weight-medium: ${t.typography.weights.medium};
            --font-weight-bold: ${t.typography.weights.bold};

            /* Spacing */
            --space-xs: ${t.spacing.xs};
            --space-sm: ${t.spacing.sm};
            --space-md: ${t.spacing.md};
            --space-lg: ${t.spacing.lg};
            --space-xl: ${t.spacing.xl};
            --space-xxl: ${t.spacing.xxl};

            /* Border Radius */
            --radius-sm: ${t.borderRadius.sm};
            --radius-md: ${t.borderRadius.md};
            --radius-lg: ${t.borderRadius.lg};
            --radius-full: ${t.borderRadius.full};

            /* Shadows */
            --shadow-sm: ${t.shadows.sm};
            --shadow-md: ${t.shadows.md};
            --shadow-lg: ${t.shadows.lg};
            --shadow-glow: ${t.shadows.glow};

            /* Animations */
            --anim-fast: ${t.animations.fast};
            --anim-normal: ${t.animations.normal};
            --anim-slow: ${t.animations.slow};
            
            /* Legacy/Compat Variables */
            --primary-color: ${t.colors.primary};
            --accent-color: ${t.colors.accent};
            --surface-color: ${t.colors.surface};
            --text-color: ${t.colors.text};
            --text-muted-color: ${t.colors.textMuted};
            --border-radius: ${t.borderRadius.md};
            
            /* Layout */
            --action-dock-gap: ${t.layout.actionDock.gap}px;
            --action-dock-button-size: ${t.layout.actionDock.buttonSize}px;
            --action-dock-offset-bottom: calc(${t.layout.actionDock.baseOffset.bottom}px + env(safe-area-inset-bottom, 0px));
            --action-dock-offset-right: calc(${t.layout.actionDock.baseOffset.right}px + env(safe-area-inset-right, 0px));
        }

        @media (max-width: 768px) {
            :root {
                --action-dock-offset-bottom: calc(${t.layout.actionDock.mobileOffset.bottom}px + env(safe-area-inset-bottom, 0px));
                --action-dock-offset-right: calc(${t.layout.actionDock.mobileOffset.right}px + env(safe-area-inset-right, 0px));
            }
        }

        /* Global Utility Classes */
        .ui-glass {
            background: var(--color-surface);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid var(--color-border);
            box-shadow: var(--shadow-lg);
        }
        
        .ui-glass-hover:hover {
            background: var(--color-surface-highlight);
            border-color: var(--color-border-highlight);
        }

        .ui-text-shadow {
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }

        /* Scrollbar Styling */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
        }
        ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        /* Base Element Resets */
        button {
            font-family: var(--font-family);
        }
        input, textarea {
            font-family: var(--font-family);
        }
    `;
    
    style.innerHTML += `
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
            border-radius: var(--radius-md);
            border: none;
            background: var(--color-surface);
            box-shadow: var(--shadow-md);
            cursor: pointer;
            transition: transform var(--anim-fast), box-shadow var(--anim-fast), background var(--anim-fast);
            color: var(--color-text);
            font-size: 22px;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
        }
        .ui-action-button:hover {
            transform: scale(1.06);
            background: var(--color-surface-highlight);
            box-shadow: var(--shadow-lg);
        }
        .ui-action-button.is-active {
            background: var(--color-primary);
            color: #fff;
        }
        
        /* Transition Overlay Styles */
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
            -webkit-backdrop-filter: blur(12px);
        }
        #ui-transition-overlay::before {
            content: '';
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.98));
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
            border-radius: var(--radius-lg);
            background: var(--color-surface);
            border: 1px solid var(--color-border);
            box-shadow: var(--shadow-lg);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 18px;
            color: var(--color-text);
            font-family: var(--font-family);
            text-align: center;
            transform: translateY(24px);
            opacity: 0;
            transition: opacity 260ms ease, transform 320ms ease;
        }
        #ui-transition-overlay.visible .ui-transition-card {
            transform: translateY(0);
            opacity: 1;
        }
        .ui-transition-heading {
            font-size: var(--font-size-xl);
            font-weight: var(--font-weight-bold);
        }
        .ui-transition-subtext {
            font-size: var(--font-size-sm);
            color: var(--color-text-secondary);
            max-width: 320px;
        }
        .ui-transition-progress {
            width: 140px;
            height: 4px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.1);
            overflow: hidden;
        }
        .ui-transition-progress span {
            display: block;
            width: 100%;
            height: 100%;
            background: var(--color-primary);
            transform-origin: left center;
            transform: scaleX(0);
            transition: transform 0.2s ease;
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

    const heading = document.createElement('div');
    heading.className = 'ui-transition-heading';
    heading.textContent = 'Loading...';

    const subtext = document.createElement('div');
    subtext.className = 'ui-transition-subtext';
    subtext.textContent = 'Preparing experience';

    const progress = document.createElement('div');
    progress.className = 'ui-transition-progress';
    const progressBar = document.createElement('span');
    progress.appendChild(progressBar);

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
    if (!this.transitionOverlay) this._setupTransitionOverlay();
    
    const message = payload && payload.message ? payload.message : 'Entering...';
    const subtext = payload && payload.subtext ? payload.subtext : 'Loading core experience';
    
    if (this.transitionHeading) this.transitionHeading.textContent = message;
    if (this.transitionSubtext) this.transitionSubtext.textContent = subtext;
    
    this._transitionShowProgress = payload && payload.showProgress !== false;
    
    if (this.transitionProgressBar) {
        this.transitionProgressBar.style.transform = this._transitionShowProgress ? 'scaleX(0.1)' : 'scaleX(0)';
    }
    
    this.transitionOverlay.classList.remove('closing');
    this.transitionOverlay.classList.add('visible');
};

UIManager.prototype.endTransition = function (payload) {
    const delay = payload && typeof payload.delayMs === 'number' ? payload.delayMs : 120;
    if (!this.transitionOverlay) return;
    
    this.transitionOverlay.classList.add('closing');
    setTimeout(() => {
        this.transitionOverlay.classList.remove('visible');
        this.transitionOverlay.classList.remove('closing');
    }, Math.max(140, delay + 160));
};

UIManager.prototype._handleStreamProgress = function (payload) {
    if (!this.transitionOverlay || !this.transitionOverlay.classList.contains('visible')) return;
    if (!this._transitionShowProgress) return;
    
    const total = payload.total || 0;
    const loaded = payload.loaded || 0;
    if (total <= 0) return;
    
    const ratio = Math.min(1, Math.max(0, loaded / total));
    if (this.transitionProgressBar) {
        this.transitionProgressBar.style.transform = `scaleX(${ratio})`;
    }
};

UIManager.prototype.destroy = function () {
    this.app.off('transition:begin', this._boundTransitionBegin, this);
    this.app.off('transition:end', this._boundTransitionEnd, this);
    this.app.off('load:stream:progress', this._boundStreamProgress, this);
    this.app.off('ui:animations:toggle', this._boundAnimationToggle, this);
    if (this._boundDocumentClick) {
        document.body.removeEventListener('click', this._boundDocumentClick, true);
    }
};

UIManager.prototype._handleAnimationToggle = function (payload) {
    // Implementation for animation toggle if needed
};

UIManager.prototype._detectPerformanceProfile = function () {
    return {
        prefersReducedMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        likelyLowEnd: false // Simplified for now
    };
};

UIManager.prototype._createAnimationConfig = function () {
    return this.theme.animations;
};
