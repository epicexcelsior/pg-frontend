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
};

UIManager.prototype.setupSoundEventListeners = function() {
    // This function sets up global listeners for common UI sounds.
    // We listen on the document body to catch events from dynamically added HTML elements.
    this.lastHoveredElement = null;

    // --- Click Sound ---
    document.body.addEventListener('click', (event) => {
        // Play a click sound if the user clicks on an interactive element.
        const interactiveElement = event.target.closest('button, [role="button"], .sound-click');
        // Play a click sound, unless the element is marked to suppress it.
        if (interactiveElement && !interactiveElement.hasAttribute('data-suppress-default-sound')) {
            this.app.fire('ui:playSound', 'ui_click_default');
        }
    }, true); // Use capture phase to catch events early.

    // --- Hover Sound ---
    // The global mouseover listener has been removed to prevent repetitive sounds.
    // Hover sounds are now handled by individual UI components using 'mouseenter'.
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
    `;
    document.head.appendChild(style);
};