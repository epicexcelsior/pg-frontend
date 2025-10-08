var WaveButton = pc.createScript('waveButton');

/**
 * WaveButton
 * - Creates a Wave button and ensures it ends up inside #ui-button-container (bottom-right).
 * - Uses only an emoji hand icon (no SVG).
 */
WaveButton.prototype.initialize = function () {
    // Create the button element
    this.button = document.createElement('button');
    this.button.id = 'wave-button';
    this.button.type = 'button';
    this.button.className = 'avatar-toggle-button';
    this.button.setAttribute('aria-label', 'Wave');

    // Emoji waving hand icon only
    this.button.innerHTML = '<span class="icon" aria-hidden="true">👋</span>';

    // Click handler
    this._onClick = this.onWaveButtonClick.bind(this);
    this.button.addEventListener('click', this._onClick);

    // Hover sound
    this._onMouseEnter = () => this.app.fire('ui:playSound', 'ui_hover_default');
    this.button.addEventListener('mouseenter', this._onMouseEnter);

    // Try to insert into #ui-button-container immediately…
    this._ensureInContainer();

    // …and also listen for a "container ready" signal from HtmlAvatarCustomizer.
    this._onContainerReady = this._ensureInContainer.bind(this);
    this.app.on('ui:button-container:ready', this._onContainerReady);

    // Also handle the legacy event (if HtmlAvatarCustomizer wants to pick us up)
    this.app.fire('ui:wavebutton:create', this.button);

    // Preload sounds
    if (this.app.soundManager && this.app.soundManager.preloadSound) {
        this.app.soundManager.preloadSound('ui_hover_default');
    }
};

WaveButton.prototype._ensureInContainer = function () {
    var container = document.getElementById('ui-button-container');
    if (!container) return; // Will try again when the event fires
    // Ensure Wave appears FIRST (to the left), then Avatar button next.
    // If container already has the button, do nothing.
    if (!this.button.parentNode) {
        container.insertBefore(this.button, container.firstChild);
    }
};

WaveButton.prototype.onWaveButtonClick = function () {
    this.app.fire('animation:play:local', { name: 'wave' });
};

WaveButton.prototype.destroy = function () {
    if (this.button) {
        this.button.removeEventListener('click', this._onClick);
        this.button.removeEventListener('mouseenter', this._onMouseEnter);
        if (this.button.parentNode) this.button.parentNode.removeChild(this.button);
        this.button = null;
    }
    this.app.off('ui:button-container:ready', this._onContainerReady);
    this._onContainerReady = null;
};
