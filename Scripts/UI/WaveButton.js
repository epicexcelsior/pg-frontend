var WaveButton = pc.createScript('waveButton');

WaveButton.prototype.initialize = function () {
    this.menuOpen = false;
    this.menuButtons = [];
    this.animationConfig = {
        enabled: true,
        durations: { standard: 0.26, quick: 0.18 },
        easings: { entrance: 'power3.out', exit: 'power2.in' },
        stagger: 0.06,
        multiplier: 1
    };
    this.actions = this._buildActions();
    this._handlers = {
        toggle: this._handleToggle.bind(this),
        hover: this._handleHover.bind(this),
        docClick: this._handleDocumentClick.bind(this),
        escape: this._handleEscape.bind(this)
    };
    this._actionHandlers = new Map();
    this._listeningOutside = false;

    this.wrapper = document.createElement('div');
    this.wrapper.className = 'wave-action-wrapper';
    this.wrapper.style.position = 'relative';

    this.button = document.createElement('button');
    this.button.id = 'wave-button';
    this.button.type = 'button';
    this.button.className = 'ui-action-button wave-toggle-button';
    this.button.setAttribute('aria-label', 'Avatar animations');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-haspopup', 'true');
    this.button.innerHTML = '<span class="icon" aria-hidden="true">👋</span>';

    this.button.addEventListener('click', this._handlers.toggle);
    this.button.addEventListener('mouseenter', this._handlers.hover);

    this.wrapper.appendChild(this.button);

    this.menuContainer = document.createElement('div');
    this.menuContainer.className = 'fanout-menu';
    this.menuContainer.setAttribute('role', 'menu');
    this.menuContainer.setAttribute('aria-hidden', 'true');
    this.menuContainer.id = 'wave-menu';
    this.button.setAttribute('aria-controls', this.menuContainer.id);
    this.wrapper.appendChild(this.menuContainer);

    this._createFanoutButtons();
    this._ensureInContainer();

    this._onContainerReady = this._ensureInContainer.bind(this);
    this.app.on('ui:button-container:ready', this._onContainerReady);

    this.app.fire('ui:wavebutton:create', this.wrapper);

    if (this.app.soundManager && this.app.soundManager.preloadSound) {
        this.app.soundManager.preloadSound('ui_hover_default');
        this.app.soundManager.preloadSound('ui_click_default');
    }

    if (this.app.uiManager && this.app.uiManager.registerComponent) {
        this.app.uiManager.registerComponent(this);
    }
};

WaveButton.prototype._buildActions = function () {
    return [
        { id: 'wave', label: 'Wave', icon: '👋', payload: { name: 'wave' } },
        { id: 'spark', label: 'Spark', icon: '✨', placeholder: true, message: 'Spark animation is on the way.' },
        { id: 'cheer', label: 'Cheer', icon: '🎉', placeholder: true, message: 'Cheer animation coming soon.' }
    ];
};

WaveButton.prototype._createFanoutButtons = function () {
    var self = this;
    this.actions.forEach(function (action) {
        var btn = document.createElement('button');
        btn.className = 'fanout-menu__button' + (action.placeholder ? ' placeholder' : '');
        btn.type = 'button';
        btn.setAttribute('role', 'menuitem');
        btn.setAttribute('tabindex', '-1');
        btn.setAttribute('aria-label', action.placeholder ? action.label + ' (coming soon)' : action.label);
        btn.textContent = action.icon;

        var clickHandler = self._handleActionClick.bind(self, action);
        btn.addEventListener('click', clickHandler);
        btn.addEventListener('mouseenter', self._handlers.hover);

        self._actionHandlers.set(btn, clickHandler);
        self.menuButtons.push(btn);
        self.menuContainer.appendChild(btn);
    });
};

WaveButton.prototype._ensureInContainer = function () {
    var container = document.getElementById('ui-button-container');
    if (!container) {
        return;
    }
    if (this.wrapper.parentNode !== container) {
        container.insertBefore(this.wrapper, container.firstChild);
    }
};

WaveButton.prototype._handleToggle = function () {
    if (this.menuOpen) {
        this._closeMenu();
    } else {
        this._openMenu();
    }
};

WaveButton.prototype._openMenu = function () {
    if (this.menuOpen) {
        return;
    }
    this.menuOpen = true;
    this.button.classList.add('is-open');
    this.button.setAttribute('aria-expanded', 'true');
    this.menuContainer.classList.add('is-open');
    this.menuContainer.setAttribute('aria-hidden', 'false');
    this.menuContainer.style.pointerEvents = 'auto';
    this.app.fire('ui:playSound', 'ui_click_default');
    this._bindGlobalEvents();
    this._animateMenu(true);
};

WaveButton.prototype._closeMenu = function () {
    if (!this.menuOpen) {
        return;
    }
    this.menuOpen = false;
    this.button.classList.remove('is-open');
    this.button.setAttribute('aria-expanded', 'false');
    this._unbindGlobalEvents();
    this.app.fire('ui:playSound', 'ui_click_default');
    this.menuContainer.style.pointerEvents = 'none';
    var duration = this._animateMenu(false);
    if (duration > 0 && window.gsap) {
        var self = this;
        gsap.delayedCall(duration, function () {
            self.menuContainer.classList.remove('is-open');
            self.menuContainer.setAttribute('aria-hidden', 'true');
            self.menuContainer.style.pointerEvents = '';
        });
    } else {
        this.menuContainer.classList.remove('is-open');
        this.menuContainer.setAttribute('aria-hidden', 'true');
        this.menuContainer.style.pointerEvents = '';
    }
};

WaveButton.prototype._animateMenu = function (isOpening) {
    if (!window.gsap || !this._shouldAnimate() || !this.menuButtons.length) {
        if (!isOpening) {
            this.menuButtons.forEach(function (btn) {
                btn.style.opacity = '';
                btn.style.transform = '';
            });
        }
        return 0;
    }

    var base = (this.animationConfig.durations && (isOpening ? this.animationConfig.durations.standard : this.animationConfig.durations.quick)) || 0.2;
    var duration = Math.max(0.12, base * (this.animationConfig.multiplier || 1));
    var ease = this.animationConfig.easings ? (isOpening ? this.animationConfig.easings.entrance : this.animationConfig.easings.exit) : (isOpening ? 'power3.out' : 'power2.in');
    var stagger = this.animationConfig.stagger || 0.06;
    var buttons = this.menuButtons;

    gsap.killTweensOf(buttons);
    if (isOpening) {
        gsap.set(buttons, { opacity: 0, scale: 0.6, y: 14 });
        gsap.to(buttons, {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: duration,
            ease: ease,
            stagger: stagger
        });
        return duration + stagger * (buttons.length - 1);
    }

    gsap.to(buttons, {
        opacity: 0,
        scale: 0.7,
        y: 10,
        duration: duration * 0.85,
        ease: ease,
        stagger: { each: stagger, from: 'end' },
        onComplete: function () {
            buttons.forEach(function (btn) {
                btn.style.opacity = '';
                btn.style.transform = '';
            });
        }
    });

    return (duration * 0.85) + stagger * (buttons.length - 1);
};

WaveButton.prototype._handleHover = function () {
    this.app.fire('ui:playSound', 'ui_hover_default');
};

WaveButton.prototype._handleActionClick = function (action, event) {
    event.preventDefault();
    if (action.placeholder) {
        this._showPlaceholderNotice(action);
    } else {
        this.app.fire('animation:play:local', { name: action.payload.name });
    }
    this._closeMenu();
};

WaveButton.prototype._showPlaceholderNotice = function (action) {
    var message = action.message || (action.label + ' animation coming soon.');
    var feedbackService = (this.app.services && typeof this.app.services.get === 'function') ? this.app.services.get('feedbackService') : null;
    if (feedbackService && typeof feedbackService.showInfo === 'function') {
        feedbackService.showInfo(message, 3200);
    } else {
        console.info(message);
    }
};

WaveButton.prototype._bindGlobalEvents = function () {
    if (this._listeningOutside) {
        return;
    }
    document.addEventListener('mousedown', this._handlers.docClick, true);
    window.addEventListener('keydown', this._handlers.escape, true);
    this._listeningOutside = true;
};

WaveButton.prototype._unbindGlobalEvents = function () {
    if (!this._listeningOutside) {
        return;
    }
    document.removeEventListener('mousedown', this._handlers.docClick, true);
    window.removeEventListener('keydown', this._handlers.escape, true);
    this._listeningOutside = false;
};

WaveButton.prototype._handleDocumentClick = function (event) {
    if (!this.menuOpen) {
        return;
    }
    if (this.wrapper.contains(event.target)) {
        return;
    }
    this._closeMenu();
};

WaveButton.prototype._handleEscape = function (event) {
    if (event.key === 'Escape' || event.key === 'Esc') {
        this._closeMenu();
    }
};

WaveButton.prototype._shouldAnimate = function () {
    return this.animationConfig && this.animationConfig.enabled !== false;
};

WaveButton.prototype.setAnimationConfig = function (config) {
    if (!config) {
        return;
    }
    this.animationConfig = Object.assign({}, this.animationConfig, config);
};

WaveButton.prototype.destroy = function () {
    this._unbindGlobalEvents();
    if (this.button) {
        this.button.removeEventListener('click', this._handlers.toggle);
        this.button.removeEventListener('mouseenter', this._handlers.hover);
    }
    var self = this;
    this.menuButtons.forEach(function (btn) {
        var handler = self._actionHandlers.get(btn);
        if (handler) {
            btn.removeEventListener('click', handler);
        }
        btn.removeEventListener('mouseenter', self._handlers.hover);
    });
    this._actionHandlers.clear();
    if (this.wrapper && this.wrapper.parentNode) {
        this.wrapper.parentNode.removeChild(this.wrapper);
    }
    this.menuButtons = [];
    this.app.off('ui:button-container:ready', this._onContainerReady);
    this._onContainerReady = null;
};
