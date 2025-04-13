// Scripts/Core/ConfigLoader.js
var ConfigLoader = pc.createScript('configLoader');

ConfigLoader.attributes.add('configAsset', {
    type: 'asset',
    assetType: 'json',
    title: 'Config JSON Asset'
});

// initialize code called once per entity
ConfigLoader.prototype.initialize = function() {
    this.config = null;
    this.loadConfig();

    console.log("ConfigLoader initialized. Waiting for config load...");
};

ConfigLoader.prototype.loadConfig = function() {
    if (!this.configAsset || !this.configAsset.resource) {
        console.error("Config JSON asset not assigned or loaded in ConfigLoader.");
        this.app.fire('config:error', 'Config asset missing');
        return;
    }

    // Make config accessible globally (consider using Services registry later)
    // For now, attaching to app for broad access during refactoring.
    // This might be refined later based on the Services.js implementation.
    this.app.config = this;

    this.config = this.configAsset.resource;
    console.log("Configuration loaded:", this.config);
    this.app.fire('config:loaded', this.config);

    // Example of how to access config later:
    // var endpoint = this.app.config.get('colyseusEndpoint');
};

// Method to get configuration values
ConfigLoader.prototype.get = function(key) {
    if (!this.config) {
        console.warn("Attempted to get config value before config was loaded:", key);
        return null;
    }
    if (this.config.hasOwnProperty(key)) {
        return this.config[key];
    } else {
        console.warn("Config key not found:", key);
        return null; // Or throw an error, depending on desired strictness
    }
};

// swap method called for script hot-reloading
// inherit your script state here
// ConfigLoader.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/