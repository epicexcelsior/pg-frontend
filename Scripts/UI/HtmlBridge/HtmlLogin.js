var HtmlLoginManager = pc.createScript('htmlLoginManager');

HtmlLoginManager.attributes.add('cssAsset', { type: 'asset', assetType: 'css', title: 'Login UI CSS' });
HtmlLoginManager.attributes.add('htmlAsset', { type: 'asset', assetType: 'html', title: 'Login UI HTML' });
HtmlLoginManager.attributes.add('loginLogoTexture', { type: 'asset', assetType: 'texture', title: 'Login Logo Texture' });
HtmlLoginManager.attributes.add('preloaderEntity', { type: 'entity', title: 'Scene Preloader Entity' });

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

    if (this.preloaderEntity) {
        this.scenePreloader = this.preloaderEntity.script.scenePreloader;
    } else {
        console.error("HtmlLoginManager: Could not find the ScenePreloader script instance!");
    }

    // Set up tutorial closed handler with bound method
    this.app.once('tutorial:closed', this._boundOnTutorialClosed);

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
};

HtmlLoginManager.prototype._createHtml = function(htmlResource) {
    if (!htmlResource || this.container) return;

    // Create container and inject HTML
    this.container = document.createElement('div');
    this.container.innerHTML = htmlResource;
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
    }
};

HtmlLoginManager.prototype.setLoginLogoSource = function() {
    if (this.loginLogoEl && this.loginLogoTexture?.resource) {
        this.loginLogoEl.src = this.loginLogoTexture.getFileUrl();
    }
};

HtmlLoginManager.prototype.onSubmitClick = function() {
    if (!this.usernameInputEl) return;
    
    const username = this.usernameInputEl.value.trim();
    if (!username) return;

    // Store username in localStorage
    localStorage.setItem('userName', username);
    this.app.fire('user:setname', username);

    // Instead of directly connecting to a wallet, we just show the main UI
    // The user will be prompted to log in when they try to perform an action (like claiming a booth).
    // Or, we can have a dedicated login button. For now, we proceed to the game.

    // Hide the login screen
    this.hideLoginScreen();

    // Start scene preload if it hasn't started already
    if (!this.scenePreloader) {
        console.error("HtmlLoginManager: Preloader not found during submit.");
        if (this.playButtonEl) this.playButtonEl.innerText = "Error!";
        return;
    }

    if (!this.scenePreloader.isLoaded()) {
        const error = this.scenePreloader.getError();
        if (error) {
            console.error("HtmlLoginManager: Preload failed:", error);
            if (this.playButtonEl) this.playButtonEl.innerText = "Preload Error!";
            return;
        }

        this.app.once('scene:preload:success', () => this.proceedToGame(), this);
        this.app.once('scene:preload:error', (sceneName, err) => {
            console.error("HtmlLoginManager: Preload failed while waiting:", err);
            if (this.playButtonEl) this.playButtonEl.innerText = "Preload Error!";
        }, this);
        return;
    }

    this.proceedToGame();
};

HtmlLoginManager.prototype.proceedToGame = function() {
    if (!this.scenePreloader || !this.scenePreloader.isLoaded()) {
        console.error("HtmlLoginManager: Cannot proceed, preload not ready");
        if (this.playButtonEl) this.playButtonEl.innerText = "Error!";
        return;
    }

    const loadedRoot = this.scenePreloader.getLoadedRoot();
    if (!loadedRoot) {
        console.error("HtmlLoginManager: Failed to get loaded root entity");
        if (this.playButtonEl) this.playButtonEl.innerText = "Error!";
        return;
    }

    // Clean up login UI
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
        this.container = null;
        this.loginContainerEl = null;
        this.usernameInputEl = null;
        this.playButtonEl = null;
        this.loginLogoEl = null;
    }

    // Add game scene and show tutorial
    this.app.root.addChild(loadedRoot);
    this.app.fire('game:sceneLoaded');
    
    setTimeout(() => {
        this.app.fire('ui:showTutorial');
    }, 250);
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
    this.scenePreloader = null;
    
    // Clear bound methods
    this._boundOnSubmitClick = null;
    this._boundOnTutorialClosed = null;
};