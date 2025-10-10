var HtmlLoginManager = pc.createScript('htmlLoginManager');

HtmlLoginManager.attributes.add('cssAsset', { type: 'asset', assetType: 'css', title: 'Login UI CSS' });
HtmlLoginManager.attributes.add('htmlAsset', { type: 'asset', assetType: 'html', title: 'Login UI HTML' });
HtmlLoginManager.attributes.add('loginLogoTexture', { type: 'asset', assetType: 'texture', title: 'Login Logo Texture' });
HtmlLoginManager.attributes.add('targetSceneName', {
    type: 'string',
    default: 'Main',
    title: 'Target Scene Name',
    description: 'The name of the scene to switch to when the player logs in.'
});

// Helper function for asset loading
HtmlLoginManager.prototype._loadAsset = function(asset, callback) {
    if (!asset) return;
    if (asset.resource) {
        callback(asset.resource);
    } else {
        asset.ready(a => callback(a.resource));
    }
};

HtmlLoginManager.prototype.initialize = function() {
    // Bind methods that will be used as callbacks
    this._boundOnSubmitClick = this.onSubmitClick.bind(this);
    this._boundOnTutorialClosed = this.onTutorialClosed.bind(this);
    this._onOrchestratorReady = this._handleOrchestratorReady.bind(this);
    this._sceneChangeDone = false;
    this._pendingPostSpawnStream = false;
    this._orchestratorReady = false;
    this._isTransitioning = false;
    this.sceneItem = null;
    this._localStreamListenerAttached = false;
    this._handleLocalStreamProgress = this._handleLocalStreamProgress.bind(this);
    this.transitionOverlayEl = null;
    this.transitionHeadingEl = null;
    this.transitionSubtextEl = null;
    this.transitionProgressEl = null;
    this.targetSceneName = (this.targetSceneName && this.targetSceneName.trim()) || 'Main';

    this.app.on('load:orchestrator:ready', this._onOrchestratorReady, this);

    // Set up tutorial closed handler with bound method
    this.app.once('tutorial:closed', this._boundOnTutorialClosed);

    this._resolveTargetScene();

    // Load assets
    this._loadInitialAssets();
};

HtmlLoginManager.prototype._loadInitialAssets = function() {
    this._loadAsset(this.cssAsset, this._injectCss.bind(this));
    this._loadAsset(this.htmlAsset, this._createHtml.bind(this));
};

HtmlLoginManager.prototype._injectCss = function(cssResource) {
    if (!cssResource) return;
    const style = document.createElement('style');
    style.type = 'text/css';
    style.textContent = cssResource;
    document.head.appendChild(style);
    this._ensureTransitionStyles();
};

HtmlLoginManager.prototype._createHtml = function(htmlResource) {
    if (!htmlResource || this.container) return;

    // Create container and inject HTML
    this.container = document.createElement('div');
    this.container.innerHTML = htmlResource;
    var orphanLinks = this.container.querySelectorAll('link[rel="stylesheet"]');
    if (orphanLinks && orphanLinks.length) {
        orphanLinks.forEach(function (linkEl) {
            linkEl.parentNode && linkEl.parentNode.removeChild(linkEl);
        });
    }
    document.body.appendChild(this.container);

    // Cache element references
    this.loginContainerEl = document.getElementById('login-container');
    this.usernameInputEl = document.getElementById('username-input');
    this.playButtonEl = document.getElementById('play-button');
    this.loginLogoEl = document.getElementById('login-logo');

    // Set up logo if available
    if (this.loginLogoTexture && this.loginLogoEl) {
        this._loadAsset(this.loginLogoTexture, () => this.setLoginLogoSource());
    }

    // Add click handler with bound method
    if (this.playButtonEl) {
        this.playButtonEl.addEventListener('click', this._boundOnSubmitClick);
        // Add hover sound effect
        this.playButtonEl.addEventListener('mouseenter', () => {
            this.app.fire('ui:playSound', 'ui_hover_default');
        });
    }

    // Add sound effects to input field
    if (this.usernameInputEl) {
        this.usernameInputEl.addEventListener('focus', () => {
            this.app.fire('ui:playSound', 'ui_click_default');
        });
    }

    // Apply theme if available
    this._applyTheme();
};

HtmlLoginManager.prototype.setLoginLogoSource = function() {
    if (this.loginLogoEl && this.loginLogoTexture?.resource) {
        this.loginLogoEl.src = this.loginLogoTexture.getFileUrl();
    }
};

HtmlLoginManager.prototype._applyTheme = function() {
    // Apply theme variables to CSS custom properties if theme is available
    if (this.app.uiManager && this.app.uiManager.getTheme) {
        const theme = this.app.uiManager.getTheme();
        const root = document.documentElement;
        
        if (theme.colors) {
            root.style.setProperty('--login-primary', theme.colors.primary);
            root.style.setProperty('--login-primary-2', theme.colors.primary2);
            root.style.setProperty('--login-accent', theme.colors.accent);
            root.style.setProperty('--login-accent-2', theme.colors.accent2);
            root.style.setProperty('--login-surface', theme.colors.surface);
            root.style.setProperty('--login-surface-2', theme.colors.surface2);
            root.style.setProperty('--login-text', theme.colors.text);
            root.style.setProperty('--login-text-muted', theme.colors.textMuted);
            root.style.setProperty('--login-text-dark', theme.colors.textDark);
        }
        
        if (theme.fonts) {
            root.style.setProperty('--login-font-family', theme.fonts.family);
            root.style.setProperty('--login-font-size-small', theme.fonts.size.small);
            root.style.setProperty('--login-font-size-medium', theme.fonts.size.medium);
            root.style.setProperty('--login-font-size-large', theme.fonts.size.large);
            root.style.setProperty('--login-font-size-xlarge', theme.fonts.size.xlarge);
        }
        
        if (theme.styles) {
            root.style.setProperty('--login-border-radius', theme.styles.borderRadius);
            root.style.setProperty('--login-box-shadow', theme.styles.boxShadow);
        }
    }
};

HtmlLoginManager.prototype.onSubmitClick = function() {
    if (!this.usernameInputEl) return;
    if (this._isTransitioning) {
        return;
    }
    
    const username = this.usernameInputEl.value.trim();
    if (!username) return;

    // Play click sound
    this.app.fire('ui:playSound', 'ui_click_default');

    // Store username in localStorage
    localStorage.setItem('userName', username);
    this.app.fire('user:setname', username);
    window.userName = username;

    // Instead of directly connecting to a wallet, we just show the main UI
    // The user will be prompted to log in when they try to perform an action (like claiming a booth).
    // Or, we can have a dedicated login button. For now, we proceed to the game.

    this._beginSceneTransition(username);
};

HtmlLoginManager.prototype._beginSceneTransition = function (username) {
    if (!this._resolveTargetScene()) {
        console.error("HtmlLoginManager: Target scene '" + this.targetSceneName + "' not found in registry.");
        if (this.playButtonEl) {
            this.playButtonEl.innerText = "Scene Missing";
        }
        return;
    }

    this._isTransitioning = true;
    this._showLocalTransitionOverlay('Entering world…', 'Syncing core experience');
    this.app.fire('transition:begin', {
        from: 'Login',
        to: this.targetSceneName,
        message: 'Entering world...',
        subtext: 'Syncing core experience',
        showProgress: true
    });

    this._lockLoginUi();

    this._pendingPostSpawnStream = true;

    this._changeScene(this.sceneItem)
        .then(() => {
            this._sceneChangeDone = true;
            this._removeLoginDom();
            this.app.fire('game:sceneLoaded');
            setTimeout(() => {
                this.app.fire('ui:showTutorial');
            }, 250);
            this._maybeStartPostSpawnStream();
            this._hideLocalTransitionOverlay(220);
            this.app.fire('transition:end', { to: this.targetSceneName });
        })
        .catch((err) => {
            console.error('HtmlLoginManager: Failed to switch scenes.', err);
            this._pendingPostSpawnStream = false;
            this._isTransitioning = false;
            this._unlockLoginUi({ label: 'Retry' });
            this._hideLocalTransitionOverlay(120);
            this.app.fire('transition:end', { to: 'Login', error: err });
        });
};

HtmlLoginManager.prototype._changeScene = function (sceneItem) {
    var self = this;
    return new Promise(function (resolve, reject) {
        if (!sceneItem || !sceneItem.url) {
            reject(new Error('HtmlLoginManager: Invalid scene registry item.'));
            return;
        }

        var resolved = false;
        function finalize(error) {
            if (resolved) {
                return;
            }
            resolved = true;
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        }

        try {
            var result = self.app.scenes.changeScene(sceneItem.url, function (err) {
                if (err) {
                    finalize(err);
                } else {
                    finalize(null);
                }
            });
            if (result && typeof result.then === 'function') {
                result.then(function () {
                    finalize(null);
                }).catch(function (err) {
                    finalize(err);
                });
            }
        } catch (err) {
            console.warn('HtmlLoginManager: changeScene threw, falling back to manual load.', err);
            self._manualSceneLoad(sceneItem).then(resolve).catch(reject);
        }
    });
};

HtmlLoginManager.prototype._manualSceneLoad = function (sceneItem) {
    var self = this;
    return new Promise(function (resolve, reject) {
        self.app.scenes.loadSceneSettings(sceneItem.url, function (settingsErr) {
            if (settingsErr) {
                reject(settingsErr);
                return;
            }
            self.app.scenes.loadSceneHierarchy(sceneItem.url, function (hierarchyErr, root) {
                if (hierarchyErr) {
                    reject(hierarchyErr);
                    return;
                }
                self.app.root.addChild(root);
                setTimeout(function () {
                    var existing = self.app.root.children.slice();
                    existing.forEach(function (child) {
                        if (child !== root && child !== self.entity) {
                            child.destroy();
                        }
                    });
                    if (self.entity && !self.entity.destroyed) {
                        self.entity.destroy();
                    }
                }, 0);
                resolve();
            });
        });
    });
};

HtmlLoginManager.prototype._lockLoginUi = function () {
    if (this.playButtonEl) {
        this.playButtonEl.disabled = true;
        this.playButtonEl.innerText = 'Entering...';
    }
    if (this.usernameInputEl) {
        this.usernameInputEl.disabled = true;
    }
    if (this.loginContainerEl) {
        this.loginContainerEl.classList.add('login-disabled');
    }
};

HtmlLoginManager.prototype._unlockLoginUi = function (options) {
    options = options || {};
    if (this.playButtonEl) {
        this.playButtonEl.disabled = false;
        if (options.label) {
            this.playButtonEl.innerText = options.label;
        } else {
            this.playButtonEl.innerText = 'Play';
        }
    }
    if (this.usernameInputEl) {
        this.usernameInputEl.disabled = false;
    }
    if (this.loginContainerEl) {
        this.loginContainerEl.classList.remove('login-disabled');
    }
};

HtmlLoginManager.prototype._removeLoginDom = function () {
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.loginContainerEl = null;
    this.usernameInputEl = null;
    this.playButtonEl = null;
    this.loginLogoEl = null;
};

HtmlLoginManager.prototype._ensureTransitionStyles = function () {
    if (document.getElementById('login-transition-styles')) {
        return;
    }
    const style = document.createElement('style');
    style.id = 'login-transition-styles';
    style.textContent = `
        .login-transition-overlay {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            opacity: 0;
            transform: scale(1.02);
            transition: opacity 200ms ease, transform 350ms ease;
            z-index: 1200;
            backdrop-filter: blur(10px);
        }
        .login-transition-overlay::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
                radial-gradient(circle at 18% 20%, rgba(153, 69, 255, 0.35), transparent 60%),
                radial-gradient(circle at 80% 28%, rgba(20, 241, 149, 0.28), transparent 55%),
                linear-gradient(130deg, rgba(6, 8, 18, 0.93), rgba(11, 14, 28, 0.95));
            opacity: 0.95;
        }
        .login-transition-overlay.visible {
            opacity: 1;
            pointer-events: auto;
            transform: scale(1);
        }
        .login-transition-overlay.closing {
            opacity: 0;
            transform: scale(0.985);
        }
        .login-transition-card {
            position: relative;
            padding: 28px 42px;
            border-radius: 26px;
            background: rgba(8, 10, 18, 0.78);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow:
                0 20px 55px rgba(6, 10, 25, 0.38),
                0 8px 16px rgba(6, 10, 25, 0.45) inset,
                0 0 0 1px rgba(255, 255, 255, 0.04) inset;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            color: #f2f4ff;
            font-family: var(--login-font-family, 'Inter', sans-serif);
            text-align: center;
            transform: translateY(24px);
            opacity: 0;
            transition: opacity 240ms ease, transform 300ms ease;
        }
        .login-transition-overlay.visible .login-transition-card {
            transform: translateY(0);
            opacity: 1;
        }
        .login-transition-badge {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: radial-gradient(circle at 32% 30%, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.08));
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .login-transition-badge::after {
            content: '';
            width: 16px;
            height: 16px;
            border-radius: 50%;
            border: 2px solid rgba(255, 255, 255, 0.92);
            border-top-color: transparent;
            animation: login-transition-spin 1200ms linear infinite;
        }
        .login-transition-heading {
            font-size: 21px;
            letter-spacing: 0.04em;
            font-weight: 600;
        }
        .login-transition-subtext {
            font-size: 14px;
            letter-spacing: 0.02em;
            color: rgba(220, 224, 240, 0.78);
            max-width: 280px;
            line-height: 1.35;
        }
        .login-transition-progress {
            width: 130px;
            height: 4px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.12);
            overflow: hidden;
        }
        .login-transition-progress span {
            display: block;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, rgba(153, 69, 255, 0.9), rgba(20, 241, 149, 0.9));
            transform-origin: left center;
            transform: scaleX(0.2);
            transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes login-transition-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @media (max-width: 560px) {
            .login-transition-card {
                margin: 0 18px;
                padding: 24px;
                gap: 14px;
            }
            .login-transition-heading {
                font-size: 19px;
            }
            .login-transition-subtext {
                font-size: 13px;
            }
        }
    `;
    document.head.appendChild(style);
};

HtmlLoginManager.prototype._showLocalTransitionOverlay = function (heading, subtext) {
    this._attachLocalStreamListener();
    if (!this.transitionOverlayEl) {
        this._ensureTransitionStyles();
        const overlay = document.createElement('div');
        overlay.className = 'login-transition-overlay';

        const card = document.createElement('div');
        card.className = 'login-transition-card';

        const badge = document.createElement('div');
        badge.className = 'login-transition-badge';

        const headingEl = document.createElement('div');
        headingEl.className = 'login-transition-heading';

        const subtextEl = document.createElement('div');
        subtextEl.className = 'login-transition-subtext';

        const progress = document.createElement('div');
        progress.className = 'login-transition-progress';
        const progressBar = document.createElement('span');
        progress.appendChild(progressBar);

        card.appendChild(badge);
        card.appendChild(headingEl);
        card.appendChild(subtextEl);
        card.appendChild(progress);
        overlay.appendChild(card);

        document.body.appendChild(overlay);

        this.transitionOverlayEl = overlay;
        this.transitionHeadingEl = headingEl;
        this.transitionSubtextEl = subtextEl;
        this.transitionProgressEl = progressBar;
    }

    if (this.transitionHeadingEl) {
        this.transitionHeadingEl.textContent = heading || 'Loading...';
    }
    if (this.transitionSubtextEl) {
        this.transitionSubtextEl.textContent = subtext || '';
    }
    if (this.transitionProgressEl) {
        this.transitionProgressEl.style.transform = 'scaleX(0.2)';
    }

    requestAnimationFrame(() => {
        if (this.transitionOverlayEl) {
            this.transitionOverlayEl.classList.remove('closing');
            this.transitionOverlayEl.classList.add('visible');
        }
    });
};

HtmlLoginManager.prototype._updateLocalTransitionProgress = function (ratio, text) {
    if (!this.transitionOverlayEl || !this.transitionOverlayEl.classList.contains('visible')) {
        return;
    }
    if (this.transitionProgressEl) {
        const eased = 0.2 + Math.max(0, Math.min(1, ratio)) * 0.8;
        this.transitionProgressEl.style.transform = 'scaleX(' + eased + ')';
    }
    if (this.transitionSubtextEl && text) {
        this.transitionSubtextEl.textContent = text;
    }
};

HtmlLoginManager.prototype._hideLocalTransitionOverlay = function (delayMs) {
    if (!this.transitionOverlayEl) {
        return;
    }
    this._detachLocalStreamListener();
    const overlay = this.transitionOverlayEl;
    overlay.classList.add('closing');
    setTimeout(() => {
        overlay.classList.remove('visible');
        overlay.classList.remove('closing');
    }, Math.max(120, delayMs || 160));
};

HtmlLoginManager.prototype._resolveTargetScene = function () {
    if (this.sceneItem) {
        return this.sceneItem;
    }
    if (!this.app || !this.app.scenes) {
        return null;
    }
    if (!this.targetSceneName || !this.targetSceneName.trim()) {
        return null;
    }
    var scene = this.app.scenes.find(this.targetSceneName.trim());
    if (scene) {
        this.sceneItem = scene;
    }
    return this.sceneItem;
};

HtmlLoginManager.prototype._handleOrchestratorReady = function () {
    this._orchestratorReady = true;
    this._maybeStartPostSpawnStream();
};

HtmlLoginManager.prototype._maybeStartPostSpawnStream = function () {
    if (!this._pendingPostSpawnStream || !this._orchestratorReady || !this._sceneChangeDone) {
        return;
    }
    this._pendingPostSpawnStream = false;
    this.app.fire('load:requestPhase', 'postSpawnStream');
};

HtmlLoginManager.prototype._attachLocalStreamListener = function () {
    if (this._localStreamListenerAttached) {
        return;
    }
    this.app.on('load:stream:progress', this._handleLocalStreamProgress, this);
    this._localStreamListenerAttached = true;
};

HtmlLoginManager.prototype._detachLocalStreamListener = function () {
    if (!this._localStreamListenerAttached) {
        return;
    }
    this.app.off('load:stream:progress', this._handleLocalStreamProgress, this);
    this._localStreamListenerAttached = false;
};

HtmlLoginManager.prototype._handleLocalStreamProgress = function (payload) {
    const total = typeof payload.total === 'number' ? payload.total : 0;
    if (total <= 0) {
        return;
    }
    const loaded = typeof payload.loaded === 'number' ? payload.loaded : 0;
    const ratio = loaded / total;
    const message = 'Streaming assets • ' + Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%';
    this._updateLocalTransitionProgress(ratio, message);
};

HtmlLoginManager.prototype.onTutorialClosed = function() {
    const username = window.userName;
    this.app.fire('game:start');
    if (username) {
        this.app.fire('user:setname', username);
    }
};

HtmlLoginManager.prototype.destroy = function() {
    // Remove event listeners
    if (this.playButtonEl) {
        this.playButtonEl.removeEventListener('click', this._boundOnSubmitClick);
    }
    
    this.app.off('tutorial:closed', this._boundOnTutorialClosed);
    this.app.off('load:orchestrator:ready', this._onOrchestratorReady, this);
    this._detachLocalStreamListener();
    
    // Clean up DOM
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
    
    // Clear references
    this.container = null;
    this.loginContainerEl = null;
    this.usernameInputEl = null;
    this.playButtonEl = null;
    this.loginLogoEl = null;
    this.sceneItem = null;
    if (this.transitionOverlayEl && this.transitionOverlayEl.parentNode) {
        this.transitionOverlayEl.parentNode.removeChild(this.transitionOverlayEl);
    }
    this.transitionOverlayEl = null;
    this.transitionHeadingEl = null;
    this.transitionSubtextEl = null;
    this.transitionProgressEl = null;
    
    // Clear bound methods
    this._boundOnSubmitClick = null;
    this._boundOnTutorialClosed = null;
};
