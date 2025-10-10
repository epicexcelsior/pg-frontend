var ConnectionOverlay = pc.createScript('connectionOverlay');

ConnectionOverlay.prototype.initialize = function () {
    this.isVisible = false;
    this.desiredVisible = false;
    this.countdownTimer = null;
    this.countdownDeadline = 0;
    this.lastAttempt = 0;
    this.transitionMaskActive = false;
    this.transitionUnmaskTimer = null;

    this.ensureDom();
    this.bindEvents();
};

ConnectionOverlay.prototype.ensureDom = function () {
    if (typeof document === 'undefined') {
        return;
    }

    var styleId = 'connection-overlay-styles';
    if (!document.getElementById(styleId)) {
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            :root {
                --co-font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                --co-surface: rgba(17, 17, 17, 0.92);
                --co-surface-strong: rgba(34, 34, 34, 0.98);
                --co-accent: #1d9bf0;
                --co-accent-2: #1df2a4;
                --co-text: #ffffff;
                --co-text-muted: rgba(255, 255, 255, 0.85);
                --co-shadow: 0 28px 60px rgba(12, 12, 12, 0.55);
            }

            #connection-overlay {
                position: fixed;
                inset: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(-45deg, rgba(17, 17, 17, 0.85), rgba(29, 155, 240, 0.25), rgba(17, 17, 17, 0.88));
                background-size: 220% 220%;
                animation: connectionOverlayGradient 18s ease infinite;
                z-index: 1200;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.25s ease-in-out;
                font-family: var(--co-font-family);
            }

            #connection-overlay.connection-overlay--visible {
                opacity: 1;
                pointer-events: auto;
            }

            #connection-overlay .connection-card {
                min-width: min(420px, 90vw);
                padding: 28px 32px;
                background: linear-gradient(145deg, var(--co-surface), var(--co-surface-strong));
                border-radius: 18px;
                box-shadow: var(--co-shadow);
                color: var(--co-text);
                text-align: center;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            #connection-overlay .connection-title {
                font-size: 22px;
                margin: 0;
                color: var(--co-text);
                letter-spacing: 0.02em;
            }

            #connection-overlay .connection-message,
            #connection-overlay .connection-countdown,
            #connection-overlay .connection-attempt {
                margin: 0;
                font-size: 15px;
                color: var(--co-text-muted);
            }

            #connection-overlay .connection-countdown {
                font-size: 14px;
                margin-top: 6px;
            }

            #connection-overlay .connection-attempt {
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                margin-top: 12px;
                color: rgba(255, 255, 255, 0.7);
            }

            #connection-overlay .connection-spinner {
                width: 48px;
                height: 48px;
                margin: 0 auto 12px;
                border-radius: 50%;
                border: 4px solid rgba(255, 255, 255, 0.2);
                border-top-color: var(--co-accent);
                border-right-color: var(--co-accent-2);
                animation: connectionOverlaySpin 1.1s linear infinite;
            }

            @keyframes connectionOverlaySpin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            @keyframes connectionOverlayGradient {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }

            @media (max-width: 520px) {
                #connection-overlay .connection-card {
                    padding: 24px 20px;
                    border-radius: 16px;
                }

                #connection-overlay .connection-title {
                    font-size: 20px;
                }
            }

            @media (prefers-reduced-motion: reduce) {
                #connection-overlay {
                    animation: none;
                }

                #connection-overlay .connection-spinner {
                    animation: none;
                    border-top-color: var(--co-accent);
                    border-right-color: var(--co-accent);
                }
            }
        `;
        document.head.appendChild(style);
    }

    var existing = document.getElementById('connection-overlay');
    if (existing) {
        this.overlayEl = existing;
        this.spinnerEl = existing.querySelector('.connection-spinner');
        this.titleEl = existing.querySelector('.connection-title');
        this.messageEl = existing.querySelector('.connection-message');
        this.countdownEl = existing.querySelector('.connection-countdown');
        this.attemptEl = existing.querySelector('.connection-attempt');
        return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'connection-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');

    var card = document.createElement('div');
    card.className = 'connection-card';

    var spinner = document.createElement('div');
    spinner.className = 'connection-spinner';

    var title = document.createElement('h2');
    title.className = 'connection-title';
    title.textContent = 'Connecting to server';

    var message = document.createElement('p');
    message.className = 'connection-message';
    message.textContent = 'Hang tight, preparing your session.';

    var countdown = document.createElement('p');
    countdown.className = 'connection-countdown';
    countdown.textContent = '';

    var attempt = document.createElement('p');
    attempt.className = 'connection-attempt';
    attempt.textContent = '';

    card.appendChild(spinner);
    card.appendChild(title);
    card.appendChild(message);
    card.appendChild(countdown);
    card.appendChild(attempt);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    this.overlayEl = overlay;
    this.spinnerEl = spinner;
    this.titleEl = title;
    this.messageEl = message;
    this.countdownEl = countdown;
    this.attemptEl = attempt;
};

ConnectionOverlay.prototype.bindEvents = function () {
    this.app.on('colyseus:connecting', this.onConnecting, this);
    this.app.on('colyseus:reconnecting', this.onReconnecting, this);
    this.app.on('colyseus:connectionError', this.onConnectionError, this);
    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
    this.app.on('colyseus:roomError', this.onRoomError, this);
    this.app.on('transition:begin', this.onSceneTransitionBegin, this);
    this.app.on('transition:end', this.onSceneTransitionEnd, this);
};

ConnectionOverlay.prototype.show = function () {
    this.desiredVisible = true;
    this.applyVisibility();
};

ConnectionOverlay.prototype.hide = function () {
    this.desiredVisible = false;
    this.stopCountdown();
    this.applyVisibility();
};

ConnectionOverlay.prototype.applyVisibility = function () {
    if (!this.overlayEl) {
        return;
    }
    if (!this.desiredVisible || this.transitionMaskActive || this.isUiBlocking()) {
        if (this.isVisible) {
            this.overlayEl.classList.remove('connection-overlay--visible');
            this.isVisible = false;
        }
        return;
    }

    if (!this.isVisible) {
        this.overlayEl.classList.add('connection-overlay--visible');
        this.isVisible = true;
    }
};

ConnectionOverlay.prototype.setTransitionMask = function (active) {
    if (this.transitionMaskActive === active) {
        return;
    }
    this.transitionMaskActive = active;
    if (!active && this.transitionUnmaskTimer) {
        clearTimeout(this.transitionUnmaskTimer);
        this.transitionUnmaskTimer = null;
    }
    this.applyVisibility();
};

ConnectionOverlay.prototype.stopCountdown = function () {
    if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
    }
    this.countdownDeadline = 0;
    if (this.countdownEl) {
        this.countdownEl.textContent = '';
    }
};

ConnectionOverlay.prototype.updateCountdown = function () {
    if (!this.countdownDeadline || !this.countdownEl) {
        return;
    }
    var remaining = this.countdownDeadline - Date.now();
    if (remaining <= 0) {
        this.countdownEl.textContent = 'Retrying now...';
        this.stopCountdown();
        return;
    }
    var seconds = Math.ceil(remaining / 1000);
    this.countdownEl.textContent = 'Retrying in ' + seconds + 's';
};

ConnectionOverlay.prototype.onConnecting = function (payload) {
    var attempt = payload && typeof payload.attempt === 'number' ? payload.attempt : 1;
    this.lastAttempt = attempt;
    if (this.titleEl) {
        this.titleEl.textContent = attempt > 1 ? 'Reconnecting to server' : 'Connecting to server';
    }
    if (this.messageEl) {
        this.messageEl.textContent = attempt > 1
            ? 'Attempt ' + attempt + '. Optimizing the route to get you back in.'
            : 'Hang tight, preparing your session.';
    }
    if (this.attemptEl) {
        this.attemptEl.textContent = attempt > 1 ? 'Attempt ' + attempt : '';
    }
    this.stopCountdown();
    this.show();
};

ConnectionOverlay.prototype.onReconnecting = function (payload) {
    var delay = payload && typeof payload.delay === 'number' ? Math.max(0, payload.delay) : 0;
    var attempt = payload && typeof payload.attempt === 'number' ? payload.attempt : this.lastAttempt || 1;
    this.lastAttempt = attempt;

    if (this.titleEl) {
        this.titleEl.textContent = 'Connection lost';
    }
    if (this.messageEl) {
        this.messageEl.textContent = delay > 0
            ? 'We\'ll try again once the network settles.'
            : 'Re-establishing your session now.';
    }
    if (this.attemptEl) {
        this.attemptEl.textContent = attempt > 1 ? 'Attempt ' + attempt : 'Attempt 1';
    }

    this.stopCountdown();
    if (delay > 0) {
        this.countdownDeadline = Date.now() + delay;
        this.updateCountdown();
        var self = this;
        this.countdownTimer = setInterval(function () {
            self.updateCountdown();
        }, 250);
    } else if (this.countdownEl) {
        this.countdownEl.textContent = 'Retrying now...';
    }

    this.show();
};

ConnectionOverlay.prototype.onConnectionError = function (payload) {
    if (this.messageEl) {
        var message = payload && payload.message ? payload.message : 'Connection error.';
        this.messageEl.textContent = message + ' We\'ll retry shortly.';
    }
    if (this.titleEl) {
        this.titleEl.textContent = 'Connection issue';
    }
    this.show();
};

ConnectionOverlay.prototype.onDisconnected = function (payload) {
    if (payload && payload.manual) {
        this.hide();
        return;
    }

    if (this.titleEl) {
        this.titleEl.textContent = 'Connection lost';
    }
    if (this.messageEl) {
        this.messageEl.textContent = 'Trying to reconnect to the server.';
    }
    if (this.attemptEl) {
        this.attemptEl.textContent = this.lastAttempt > 1 ? 'Attempt ' + this.lastAttempt : '';
    }
    this.show();
};

ConnectionOverlay.prototype.onRoomError = function (payload) {
    if (this.titleEl) {
        this.titleEl.textContent = 'Server reported an issue';
    }
    if (this.messageEl) {
        var message = payload && payload.message ? payload.message : 'An unexpected error occurred.';
        this.messageEl.textContent = message + ' Trying to reconnect.';
    }
    this.show();
};

ConnectionOverlay.prototype.onConnected = function () {
    if (this.messageEl) {
        this.messageEl.textContent = 'Connection restored. Resuming gameplay.';
    }
    var self = this;
    setTimeout(function () {
        self.hide();
    }, 400);
};

ConnectionOverlay.prototype.onSceneTransitionBegin = function (payload) {
    if (payload && payload.from === 'Login') {
        this.setTransitionMask(true);
    }
};

ConnectionOverlay.prototype.isUiBlocking = function () {
    if (typeof document === 'undefined') {
        return false;
    }
    var loginOverlay = document.querySelector('.login-transition-overlay.visible');
    if (loginOverlay) {
        return true;
    }
    var globalTransition = document.getElementById('ui-transition-overlay');
    if (globalTransition && globalTransition.classList.contains('visible')) {
        return true;
    }
    return false;
};

ConnectionOverlay.prototype.onSceneTransitionEnd = function () {
    if (this.transitionMaskActive) {
        var self = this;
        this.transitionUnmaskTimer = setTimeout(function () {
            self.transitionUnmaskTimer = null;
            self.setTransitionMask(false);
        }, 250);
    }
};

ConnectionOverlay.prototype.postInitialize = function () {
    if (this.app.room) {
        this.hide();
    }
};

ConnectionOverlay.prototype.destroy = function () {
    this.stopCountdown();
    if (this.transitionUnmaskTimer) {
        clearTimeout(this.transitionUnmaskTimer);
        this.transitionUnmaskTimer = null;
    }
    this.app.off('colyseus:connecting', this.onConnecting, this);
    this.app.off('colyseus:reconnecting', this.onReconnecting, this);
    this.app.off('colyseus:connectionError', this.onConnectionError, this);
    this.app.off('colyseus:connected', this.onConnected, this);
    this.app.off('colyseus:disconnected', this.onDisconnected, this);
    this.app.off('colyseus:roomError', this.onRoomError, this);
    this.app.off('transition:begin', this.onSceneTransitionBegin, this);
    this.app.off('transition:end', this.onSceneTransitionEnd, this);

    if (this.overlayEl && this.overlayEl.parentNode) {
        this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.overlayEl = null;
    this.spinnerEl = null;
    this.titleEl = null;
    this.messageEl = null;
    this.countdownEl = null;
    this.attemptEl = null;
};

(function bootstrapConnectionOverlay() {
    if (typeof pc === 'undefined' || !pc.Application || !pc.Application.getApplication) {
        return;
    }

    var entityName = '__ConnectionOverlayAuto__';

    var ensureOverlay = function () {
        var app = pc.Application.getApplication();
        if (!app || !app.root) {
            return false;
        }

        var entity = app.root.findByName(entityName);
        if (!entity) {
            entity = new pc.Entity(entityName);
            app.root.addChild(entity);
        }

        if (!entity.script) {
            entity.addComponent('script');
        }

        if (!entity.script.connectionOverlay) {
            entity.script.create('connectionOverlay');
        }

        return true;
    };

    var attempts = 0;
    var tryAttach = function () {
        if (ensureOverlay()) {
            return;
        }
        attempts += 1;
        if (attempts < 6) {
            setTimeout(tryAttach, 200);
        }
    };

    var app = pc.Application.getApplication();
    if (app && app.once) {
        app.once('start', tryAttach);
    }
    tryAttach();
})();
