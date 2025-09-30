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