// Scripts/Core/UIManager.js
var UIManager = pc.createScript('UIManager'); // Renamed script

// Global theme and animation settings
UIManager.attributes.add('theme', {
     type: 'json',
     schema: [
          { name: 'primaryColor', type: 'string', default: "#007bff" },
          { name: 'backgroundColor', type: 'string', default: "#f8f9fa" },
          { name: 'fontFamily', type: 'string', default: "Segoe UI, sans-serif" }
     ],
     title: 'Theme Config'
});

UIManager.attributes.add('animation', {
     type: 'json',
     schema: [
          { name: 'duration', type: 'number', default: 0.7 },
          { name: 'easeIn', type: 'string', default: "expo.in" },
          { name: 'easeOut', type: 'string', default: "expo.out" }
     ],
     title: 'Animation Config'
});

// Store registered UI components
UIManager.prototype.initialize = function () {
     this.components = [];

     // Make it globally accessible for convenience
     this.app.uiManager = this;
     console.log("UIManager initialized. Theme:", this.theme, "Animation:", this.animation);
};

UIManager.prototype.registerComponent = function (component) {
     this.components.push(component);

     // If the component supports theming, apply the theme
     if (component.setTheme) {
          component.setTheme(this.theme);
     }

     // Debug log
     console.log("UIManager registered component:", component.name || component.constructor.name);
};

UIManager.prototype.getAnimationSettings = function () {
     return this.animation;
};