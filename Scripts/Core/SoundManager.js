// Scripts/Core/SoundManager.js
var SoundManager = pc.createScript('soundManager');

// Attribute to define a list of named sound assets
SoundManager.attributes.add('sounds', {
    type: 'json',
    array: true,
    title: 'UI Sounds',
    description: 'A list of named sound effects for the UI.',
    schema: [{
        name: 'name',
        type: 'string',
        description: 'The name to use when triggering the sound (e.g., "click").'
    }, {
        name: 'asset',
        type: 'asset',
        assetType: 'audio',
        description: 'The audio asset to play.'
    }]
});

SoundManager.attributes.add('masterVolume', {
    type: 'number',
    default: 1,
    min: 0,
    max: 1,
    title: 'Master Volume',
    description: 'The master volume for all UI sounds.'
});

SoundManager.attributes.add('globalCooldown', {
    type: 'number',
    default: 50,
    min: 0,
    title: 'Global Cooldown (ms)',
    description: 'Prevents the same sound from being spammed.'
});

SoundManager.attributes.add('pitchVariation', {
    type: 'number',
    default: 0.05,
    min: 0,
    max: 1,
    title: 'Pitch Variation (+/-)',
    description: 'Adds a random pitch variation to make sounds less repetitive.'
});

SoundManager.prototype.initialize = function() {
    // The SoundManager requires a 'sound' component on the same entity.
    if (!this.entity.sound) {
        this.entity.addComponent('sound');
    }

    // This is the crucial fix: disable 3D positional audio for the entire component.
    this.entity.sound.positional = false;

    this.lastPlayed = new Map();

    // Create sound slots from the configured assets
    this.soundMap = new Map();
    if (this.sounds) {
        this.sounds.forEach(soundData => {
            if (soundData.name && soundData.asset) {
                // Add a slot to the sound component with the given name
                this.entity.sound.addSlot(soundData.name, {
                    asset: soundData.asset.id,
                    autoPlay: false,
                    loop: false,
                    volume: this.masterVolume
                });
                this.soundMap.set(soundData.name, soundData.asset);
            }
        });
    }

    // Listen for the global event that other scripts will fire
    this.app.on('ui:playSound', this.playSound, this);

    // Register with the global services if it exists
    if (this.app.services && typeof this.app.services.register === 'function') {
        this.app.services.register('soundManager', this);
    } else {
        // Fallback to attaching directly to the app
        this.app.soundManager = this;
        console.warn("SoundManager: Services registry not found, registered on app.soundManager.");
    }

    console.log("SoundManager initialized.");
};

/**
 * Plays a sound by its registered name.
 * @param {string} soundName - The name of the sound to play (e.g., "click").
 */
SoundManager.prototype.playSound = function(soundName) {
    if (!this.soundMap.has(soundName)) {
        console.warn(`SoundManager: Sound with name '${soundName}' not found.`);
        return;
    }

    // Cooldown check
    const now = Date.now();
    const lastTime = this.lastPlayed.get(soundName) || 0;
    if (now - lastTime < this.globalCooldown) {
        return; // Sound is on cooldown
    }
    this.lastPlayed.set(soundName, now);

    // Apply pitch variation
    if (this.pitchVariation > 0) {
        const pitch = 1 + (Math.random() - 0.5) * 2 * this.pitchVariation;
        this.entity.sound.slots[soundName].pitch = pitch;
    }

    // The sound component automatically handles loading the asset if it's not already loaded.
    this.entity.sound.play(soundName);
};

/**
 * Preloads a sound asset without playing it.
 * @param {string} soundName - The name of the sound to preload.
 */
SoundManager.prototype.preloadSound = function(soundName) {
    if (!this.soundMap.has(soundName)) {
        console.warn(`SoundManager: Cannot preload sound '${soundName}', not found.`);
        return;
    }

    const asset = this.soundMap.get(soundName);
    // If the asset is not loaded yet, start loading it.
    if (asset && !asset.resource && !asset.loading) {
        this.app.assets.load(asset);
    }
};

// Clean up the event listener when the script is destroyed or swapped
SoundManager.prototype.swap = function(old) {
    this.app.off('ui:playSound', old.playSound, old);
};

SoundManager.prototype.onDisable = function () {
    this.app.off('ui:playSound', this.playSound, this);
};

SoundManager.prototype.onEnable = function () {
    this.app.on('ui:playSound', this.playSound, this);
};