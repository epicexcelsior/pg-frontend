var HtmlTutorial = pc.createScript('htmlTutorial');

// Add script attributes
HtmlTutorial.attributes.add('cssAsset', {
    type: 'asset',
    assetType: 'css',
    title: 'Tutorial UI CSS'
});

HtmlTutorial.attributes.add('htmlAsset', {
    type: 'asset',
    assetType: 'html',
    title: 'Tutorial UI HTML'
});

HtmlTutorial.prototype.initialize = function() {
    console.log('HtmlTutorial: Initializing');

    // Bind methods for event handlers
    this._onSceneChange = (newScene) => {
        if (this.isVisible) {
            this.hide();
        }
    };

    this._onShowTutorial = () => {
        if (!this.initialized) {
            console.error('HtmlTutorial: Cannot show tutorial - not initialized');
            return;
        }
        this.show();
    };

    this._onGameStateChange = (newState) => {
        if (newState === 'loading') {
            this.cleanupAll();
        }
    };

    // Initialize state
    this.initialized = false;
    this.isVisible = false;
    this.container = null;
    this.tutorialContainer = null;
    this.contentWrapper = null;

    // Check assets
    if (!this.cssAsset || !this.htmlAsset) {
        console.error('HtmlTutorial: Missing required assets');
        return;
    }

    // Set up event listeners
    this.app.on('scene:change', this._onSceneChange);
    this.app.on('ui:showTutorial', this._onShowTutorial);
    this.app.on('gameState:change', this._onGameStateChange);

    // Load assets
    this._loadAssets();
};

HtmlTutorial.prototype._loadAssets = function() {
    const loadAsset = (asset, callback) => {
        if (!asset) return;
        if (asset.resource) {
            callback(asset.resource);
        } else {
            asset.ready(a => callback(a.resource));
        }
    };

    loadAsset(this.cssAsset, this._injectCss.bind(this));
    loadAsset(this.htmlAsset, this._createHtml.bind(this));
};

HtmlTutorial.prototype._injectCss = function(cssContent) {
    if (!cssContent) {
        console.error('HtmlTutorial: No CSS content to inject');
        return;
    }

    const style = document.createElement('style');
    style.type = 'text/css';
    style.textContent = cssContent;
    document.head.appendChild(style);
};

HtmlTutorial.prototype._createHtml = function(htmlContent) {
    try {
        if (!htmlContent) {
            throw new Error('No HTML content provided');
        }

        if (this.container) {
            if (document.body.contains(this.container)) {
                document.body.removeChild(this.container);
            }
            this.container = null;
            this.tutorialContainer = null;
            this.contentWrapper = null;
        }

        const temp = document.createElement('div');
        temp.innerHTML = htmlContent.trim();

        const tutorialContainer = temp.querySelector('#tutorial-container');
        const contentWrapper = tutorialContainer?.querySelector('#tutorial-content-wrapper');
        const closeButton = tutorialContainer?.querySelector('#tutorial-close-button');

        if (!tutorialContainer || !contentWrapper || !closeButton) {
            throw new Error('Missing required tutorial elements');
        }

        this.container = temp;
        this.tutorialContainer = tutorialContainer;
        this.contentWrapper = contentWrapper;

        this.tutorialContainer.style.display = 'none';
        this.tutorialContainer.classList.add('hidden');

        document.body.appendChild(this.tutorialContainer);

        closeButton.addEventListener('click', () => this.hide());
        this.initialized = true;
        return true;
    } catch (error) {
        console.error('HtmlTutorial: Failed to create HTML:', error.message);
        if (this.tutorialContainer && document.body.contains(this.tutorialContainer)) {
            document.body.removeChild(this.tutorialContainer);
        }
        this.container = null;
        this.tutorialContainer = null;
        this.contentWrapper = null;
        return false;
    }
};

HtmlTutorial.prototype.show = function() {
    if (!this.tutorialContainer || !this.contentWrapper || this.isVisible) return;

    this.isVisible = true;
    this.app.fire('tutorial:active', true);

    requestAnimationFrame(() => {
        this.tutorialContainer.style.display = 'flex';
        this.tutorialContainer.classList.remove('hidden');
        
        requestAnimationFrame(() => {
            this.contentWrapper.classList.add('tutorial-visible');
        });
    });
};

HtmlTutorial.prototype.hide = function() {
    if (!this.tutorialContainer || !this.contentWrapper || !this.isVisible) return;

    this.isVisible = false;

    requestAnimationFrame(() => {
        this.contentWrapper.classList.remove('tutorial-visible');
        
        setTimeout(() => {
            if (!this.tutorialContainer) return;
            this.tutorialContainer.classList.add('hidden');
            this.tutorialContainer.style.display = 'none';
            
            this.app.fire('tutorial:active', false);
            this.app.fire('tutorial:closed');
            
            if (this.app.gameState === 'loading') {
                this.cleanupAll();
            }
        }, 500);
    });
};

HtmlTutorial.prototype.cleanupAll = function() {
    if (this._onSceneChange) {
        this.app.off('scene:change', this._onSceneChange);
    }
    if (this._onShowTutorial) {
        this.app.off('ui:showTutorial', this._onShowTutorial);
    }
    if (this._onGameStateChange) {
        this.app.off('gameState:change', this._onGameStateChange);
    }

    if (this.tutorialContainer && document.body.contains(this.tutorialContainer)) {
        document.body.removeChild(this.tutorialContainer);
    }

    const styles = document.querySelectorAll('style');
    styles.forEach(style => {
        if (style.textContent.includes('#tutorial-container')) {
            style.remove();
        }
    });

    this.initialized = false;
    this.isVisible = false;
    this.container = null;
    this.tutorialContainer = null;
    this.contentWrapper = null;
};

HtmlTutorial.prototype.destroy = function() {
    this.cleanupAll();
};