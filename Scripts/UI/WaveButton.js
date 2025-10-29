var WaveButton = pc.createScript('waveButton');

WaveButton.prototype.initialize = function () {
    this.menuOpen = false;
    this.menuButtons = [];
    this.animationConfig = AnimationUtils && AnimationUtils.mergeConfig ? AnimationUtils.mergeConfig((window.Theme && window.Theme.animations), {
        durations: { standard: 0.20, quick: 0.14 },
        easings: { emphasize: 'power4.out' },
        stagger: 0.025
    }) : {
        enabled: true,
        durations: { standard: 0.20, quick: 0.14 },
        easings: { entrance: 'power4.out', exit: 'power3.in', emphasize: 'power4.out' },
        stagger: 0.025,
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
    this.menuContainer.style.visibility = 'hidden';
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
        this.app.soundManager.preloadSound('ui_toggle_emphasize');
    }

    if (this.app.uiManager && this.app.uiManager.registerComponent) {
        this.app.uiManager.registerComponent(this);
    }
};

WaveButton.prototype._buildActions = function () {
    var resolved = this._resolveConfiguredActions();
    if (resolved && resolved.length) {
        return resolved;
    }
    return [
        { id: 'wave', label: 'Wave', icon: '🙋', payload: { name: 'wave' } },
        { id: 'dance_a', label: 'Dance A', icon: '💃', payload: { name: 'dance_a' } },
        { id: 'dance_b', label: 'Dance B', icon: '🕺', payload: { name: 'dance_b' } },
        { id: 'cheer', label: 'Cheer', icon: '🎉', payload: { name: 'cheer' } }
    ];
};

WaveButton.prototype._resolveConfiguredActions = function () {
    var themeEmotes = window.Theme && Array.isArray(window.Theme.emotes) ? window.Theme.emotes : null;
    if (!themeEmotes || !themeEmotes.length) {
        return null;
    }
    var self = this;
    var actions = themeEmotes.map(function (entry, index) {
        if (!entry) {
            return null;
        }
        if (typeof entry === 'string') {
            var name = entry.trim();
            if (!name) {
                return null;
            }
            return {
                id: name,
                label: self._formatActionLabel(name),
                icon: '👋',
                payload: { name: name }
            };
        }
        var actionName = typeof entry.name === 'string' ? entry.name.trim() : '';
        if (!actionName) {
            return null;
        }
        return {
            id: entry.id || actionName || ('emote-' + index),
            label: entry.label || self._formatActionLabel(actionName),
            icon: entry.icon,
            payload: { name: actionName },
            description: entry.description || ''
        };
    }).filter(Boolean);
    return actions.length ? actions : null;
};

WaveButton.prototype._formatActionLabel = function (name) {
    return name.replace(/[_-]+/g, ' ').replace(/^[a-z]|\s[a-z]/g, function (match) {
        return match.toUpperCase();
    });
};

WaveButton.prototype._createFanoutButtons = function () {
    var self = this;
    this.actions.forEach(function (action) {
        var btn = document.createElement('button');
        btn.className = 'fanout-menu__button';
        btn.type = 'button';
        btn.setAttribute('role', 'menuitem');
        btn.setAttribute('tabindex', '-1');
        
        if (action.disabled) {
            btn.disabled = true;
            btn.classList.add('is-disabled');
            btn.setAttribute('aria-disabled', 'true');
        }

        var label = action.label || 'Action';
        var iconGlyph = (typeof action.icon === 'string' && action.icon.trim()) ? action.icon.trim() : '';

        btn.setAttribute('aria-label', label);
        btn.innerHTML =
            '<span class="fanout-menu__glyph" aria-hidden="true">' + iconGlyph + '</span>' +
            '<span class="fanout-menu__label">' + label + '</span>';

        var clickHandler = self._handleActionClick.bind(self, action);
        btn.addEventListener('click', clickHandler);
        btn.addEventListener('mouseenter', self._handlers.hover);

        self._actionHandlers.set(btn, clickHandler);
        self.menuButtons.push(btn);
        self.menuContainer.appendChild(btn);
    });
};

WaveButton.prototype._calculateRadialPositions = function (count, radius, startAngle) {
    if (window.AnimationUtils && AnimationUtils.calculateRadialPositions) {
        return AnimationUtils.calculateRadialPositions(count, radius, Math.min(160, 80 + count * 28), (typeof startAngle === 'number' ? startAngle : 0));
    }

    var positions = [];
    var arcSpread = Math.min(120, 40 + count * 22);
    var baseAngle = typeof startAngle === 'number' ? startAngle : 0;
    var start = baseAngle - arcSpread / 2;
    var step = count > 1 ? arcSpread / (count - 1) : 0;

    for (var i = 0; i < count; i++) {
        var angleDeg = start + step * i;
        var angleRad = angleDeg * (Math.PI / 180);
        var cos = Math.cos(angleRad);
        var sin = Math.sin(angleRad);
        positions.push({
            x: cos * radius,
            y: sin * radius,
            fromX: cos * (radius * 0.35),
            fromY: sin * (radius * 0.35)
        });
    }

    return positions;
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
    this.menuContainer.style.visibility = 'visible';
    this.menuContainer.classList.add('is-open');
    this.menuContainer.setAttribute('aria-hidden', 'false');
    this.app.fire('ui:playSound', 'ui_toggle_emphasize');
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
    var duration = this._animateMenu(false);
    if (duration > 0 && window.gsap) {
        var self = this;
        gsap.delayedCall(duration, function () {
            self.menuContainer.classList.remove('is-open');
            self.menuContainer.setAttribute('aria-hidden', 'true');
            self.menuContainer.style.visibility = 'hidden';
        });
    } else {
        this.menuContainer.classList.remove('is-open');
        this.menuContainer.setAttribute('aria-hidden', 'true');
        this.menuContainer.style.visibility = 'hidden';
    }
};

WaveButton.prototype._animateMenu = function (isOpening) {
    if (!window.gsap || !this._shouldAnimate() || !this.menuButtons.length) {
        if (!isOpening) {
            this.menuButtons.forEach(function (btn) {
                btn.style.opacity = '';
                btn.style.transform = '';
                btn.style.willChange = '';
            });
        }
        return 0;
    }

    var buttons = this.menuButtons;
    gsap.killTweensOf(buttons);

    var positions = this._calculateRadialPositions(buttons.length, 112, 0);
    var getPosition = function (idx) {
        return positions[idx] || { x: 0, y: 0, fromX: 0, fromY: 0 };
    };

    if (isOpening) {
        buttons.forEach(function (btn) {
            btn.style.willChange = 'transform, opacity';
        });

        var openDuration = 0.35;
        var staggerAmount = 0.025;

        if (window.AnimationUtils && AnimationUtils.applyEntrance) {
            AnimationUtils.applyEntrance(buttons, {
                fromOpacity: 0,
                fromScale: 0.3,
                fromX: function (idx) { return getPosition(idx).fromX; },
                fromY: function (idx) { return getPosition(idx).fromY; },
                opacity: 1,
                scale: 1,
                x: function (idx) { return getPosition(idx).x; },
                y: function (idx) { return getPosition(idx).y; },
                duration: openDuration,
                ease: 'back.out',
                stagger: staggerAmount
            });
        } else {
            gsap.set(buttons, {
                opacity: 0,
                scale: 0.3,
                rotation: -12,
                x: function (_, idx) { return getPosition(idx).fromX; },
                y: function (_, idx) { return getPosition(idx).fromY; }
            });
            gsap.to(buttons, {
                opacity: 1,
                scale: 1,
                rotation: 0,
                x: function (_, idx) { return getPosition(idx).x; },
                y: function (_, idx) { return getPosition(idx).y; },
                duration: openDuration,
                ease: 'back.out',
                stagger: {
                    each: staggerAmount,
                    ease: 'sine.out'
                }
            });
        }
        return openDuration + staggerAmount * (buttons.length - 1);
    }

    buttons.forEach(function (btn) {
        btn.style.willChange = 'transform, opacity';
    });

    var closeDuration = 0.22;
    var staggerAmount = 0.015;

    if (window.AnimationUtils && AnimationUtils.applyExit) {
        AnimationUtils.applyExit(buttons, {
            toOpacity: 0,
            toScale: 0.2,
            toX: function (idx) { return getPosition(idx).fromX; },
            toY: function (idx) { return getPosition(idx).fromY; },
            duration: closeDuration,
            ease: 'back.in',
            stagger: { each: staggerAmount, from: 'end' },
            onComplete: function () {
                buttons.forEach(function (btn) {
                    btn.style.opacity = '';
                    btn.style.transform = '';
                    btn.style.willChange = '';
                });
            }
        });
    } else {
        gsap.to(buttons, {
            opacity: 0,
            scale: 0.2,
            rotation: 12,
            x: function (idx) { return getPosition(idx).fromX; },
            y: function (idx) { return getPosition(idx).fromY; },
            duration: closeDuration,
            ease: 'back.in',
            stagger: { each: staggerAmount, from: 'end' },
            onComplete: function () {
                buttons.forEach(function (btn) {
                    btn.style.opacity = '';
                    btn.style.transform = '';
                    btn.style.willChange = '';
                });
            }
        });
    }

    return closeDuration + staggerAmount * (buttons.length - 1);
};

WaveButton.prototype._handleHover = function () {
    this.app.fire('ui:playSound', 'ui_hover_default');
};

WaveButton.prototype._handleActionClick = function (action, event) {
    event.preventDefault();
    if (!action || action.disabled) {
        return;
    }
    if (action.payload && action.payload.name) {
        var playerEntity = this.app.localPlayer;
        if (playerEntity && playerEntity.script && playerEntity.script.playerAnimation) {
            var emoteId = this._mapPayloadToEmoteId(action.payload.name);
            playerEntity.script.playerAnimation.requestEmote(emoteId);
        }
    }
    this._closeMenu();
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

WaveButton.prototype._mapPayloadToEmoteId = function (name) {
    var map = { 'wave': 'WAVE', 'dance_a': 'DANCE_A', 'dance_b': 'DANCE_B', 'cheer': 'CHEER' };
    return map[name] || name.toUpperCase();
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
