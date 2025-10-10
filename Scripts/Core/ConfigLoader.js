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
    this.loadPolicy = null;
    this._cachedDeviceTier = null;
    this.loadConfig();

    console.log("ConfigLoader initialized. Waiting for config load...");
};

ConfigLoader.prototype.loadConfig = function() {
    if (!this.configAsset || !this.configAsset.resource) {
        console.error("Config JSON asset not assigned or loaded in ConfigLoader.");
        this.app.fire('config:error', 'Config asset missing');
        return;
    }

    this.app.config = this;

    this.config = this.configAsset.resource;
    this.loadPolicy = this._buildLoadPolicy();
    this._cachedDeviceTier = this._cachedDeviceTier || this._evaluateDeviceTier();

    console.log("Configuration loaded:", this.config);
    this.app.fire('config:loaded', this.config);
    this.app.fire('config:loadPolicy', this.loadPolicy);
    this.app.fire('device:tier:resolved', this._cachedDeviceTier);
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

ConfigLoader.prototype.getLoadPolicy = function() {
    if (!this.loadPolicy) {
        this.loadPolicy = this._buildLoadPolicy();
    }
    return this.loadPolicy;
};

ConfigLoader.prototype.detectDeviceTier = function() {
    if (this._cachedDeviceTier) {
        return this._cachedDeviceTier;
    }
    this._cachedDeviceTier = this._evaluateDeviceTier();
    return this._cachedDeviceTier;
};

ConfigLoader.prototype._buildLoadPolicy = function() {
    var overrides = (this.config && this.config.loadPolicy) || {};

    var policy = {
        phases: {
            playReady: ['core-ui', 'core-scene', 'core-player', 'booths-core'],
            postSpawnStream: ['world-extended', 'audio-expanded', 'avatars-variants']
        },
        concurrencyCaps: {
            default: 5,
            low: 2,
            mid: 4,
            high: 8
        },
        phaseCaps: {
            playReady: {
                default: 4
            },
            postSpawnStream: {
                low: 2,
                mid: 4,
                high: 6
            }
        },
        priorities: {
            playReady: 10,
            postSpawnStream: 1,
            default: 0
        }
    };

    if (overrides.phases) {
        policy.phases = overrides.phases;
    }
    if (overrides.concurrencyCaps) {
        policy.concurrencyCaps = Object.assign({}, policy.concurrencyCaps, overrides.concurrencyCaps);
    }
    if (overrides.phaseCaps) {
        policy.phaseCaps = Object.assign({}, policy.phaseCaps, overrides.phaseCaps);
    }
    if (overrides.priorities) {
        policy.priorities = Object.assign({}, policy.priorities, overrides.priorities);
    }

    return policy;
};

ConfigLoader.prototype._evaluateDeviceTier = function() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return 'high';
    }

    var nav = navigator;
    var cores = nav.hardwareConcurrency || 4;
    var deviceMemory = nav.deviceMemory || 0;
    var ua = String(nav.userAgent || '').toLowerCase();
    var isMobile = /android|iphone|ipad|ipod|mobile|silk/.test(ua);

    if (isMobile) {
        if (cores <= 4 || (deviceMemory > 0 && deviceMemory <= 3)) {
            return 'low';
        }
        if (cores <= 6 || (deviceMemory > 0 && deviceMemory <= 4)) {
            return 'mid';
        }
        return 'high';
    }

    if (cores >= 12 || deviceMemory >= 16) {
        return 'high';
    }
    if (cores <= 4 && (deviceMemory > 0 && deviceMemory <= 6)) {
        return 'low';
    }
    return 'mid';
};

// swap method called for script hot-reloading
// inherit your script state here
// ConfigLoader.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/
