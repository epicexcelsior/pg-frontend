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
    this._slotReadyPromises = new Map();

    // Create sound slots from the configured assets
    this.soundMap = new Map();
    if (this.sounds) {
        this.sounds.forEach(soundData => {
            if (!soundData || !soundData.name) {
                return;
            }
            const descriptor = {
                asset: null,
                assetId: null
            };

            const resolvedAsset = this._resolveAssetReference(soundData.asset);
            if (resolvedAsset) {
                descriptor.asset = resolvedAsset;
                descriptor.assetId = resolvedAsset.id;
            } else {
                descriptor.assetId = this._extractAssetId(soundData.asset);
            }

            if (!descriptor.assetId) {
                console.warn(`SoundManager: Skipping sound '${soundData.name}' because asset reference is invalid.`);
                return;
            }

            if (!this.entity.sound.slot(soundData.name)) {
                this.entity.sound.addSlot(soundData.name, {
                    asset: descriptor.assetId,
                    autoPlay: false,
                    loop: false,
                    volume: this.masterVolume
                });
            } else {
                const slot = this.entity.sound.slot(soundData.name);
                slot.asset = descriptor.assetId;
                slot.autoPlay = false;
                slot.loop = false;
                slot.volume = this.masterVolume;
            }

            this.soundMap.set(soundData.name, descriptor);
        });
    }

    this._listenerActive = false;
    this._onAudioReady = this._handleAudioReady.bind(this);

    this.on('attr:masterVolume', this._applyMasterVolume, this);

    // Register with the global services if it exists
    if (this.app.services && typeof this.app.services.register === 'function') {
        this.app.services.register('soundManager', this);
    } else {
        console.warn("SoundManager: Services registry not found, registered on app.soundManager.");
    }

    this.app.soundManager = this;

    this._bindUiSoundEvents();
    this.app.on('audio:expanded:ready', this._onAudioReady, this);
    this._preloadConfiguredSounds();

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

    var self = this;
    this._ensureSlotReady(soundName)
        .then(function (result) {
            const slot = result.slot;
            const asset = result.asset;
            if (!slot || !asset) {
                throw new Error('SoundManager: Slot or asset unavailable.');
            }

            return self._ensureAudioContextRunning().then(function () {
                return slot;
            });
        })
        .then(function (slot) {
            if (self.pitchVariation > 0) {
                slot.pitch = 1 + (Math.random() - 0.5) * 2 * self.pitchVariation;
            }

            try {
                if (slot.isPlaying) {
                    slot.stop();
                }
                slot.play();
            } catch (err) {
                console.error(`SoundManager: Failed to play '${soundName}'.`, err);
            }
        })
        .catch(function (err) {
            console.error(`SoundManager: Unable to prepare sound '${soundName}'.`, err);
        });
};

/**
 * Preloads a sound asset without playing it.
 * @param {string} soundName - The name of the sound to preload.
 */
SoundManager.prototype.preloadSound = function(soundName) {
    this._ensureSlotReady(soundName).catch(function (err) {
        console.warn(`SoundManager: Preload failed for '${soundName}'.`, err);
    });
};

// Clean up the event listener when the script is destroyed or swapped
SoundManager.prototype.swap = function(old) {
    this.app.off('ui:playSound', old.playSound, old);
};

SoundManager.prototype.onDisable = function () {
    this._unbindUiSoundEvents();
};

SoundManager.prototype.onEnable = function () {
    this._bindUiSoundEvents();
};

SoundManager.prototype._bindUiSoundEvents = function () {
    if (this._listenerActive || !this.app) {
        return;
    }
    this.app.on('ui:playSound', this.playSound, this);
    this._listenerActive = true;
};

SoundManager.prototype._unbindUiSoundEvents = function () {
    if (!this._listenerActive || !this.app) {
        return;
    }
    this.app.off('ui:playSound', this.playSound, this);
    this._listenerActive = false;
};

SoundManager.prototype._getAudioContext = function () {
    const soundSystem = this.app.systems && this.app.systems.sound;
    if (soundSystem && soundSystem.manager && soundSystem.manager.context) {
        return soundSystem.manager.context;
    }
    return null;
};

SoundManager.prototype._ensureAudioContextRunning = function () {
    const context = this._getAudioContext();
    if (!context) {
        return Promise.resolve();
    }
    if (context.state === 'running') {
        return Promise.resolve();
    }

    try {
        const resumeResult = context.resume();
        if (resumeResult && typeof resumeResult.then === 'function') {
            return resumeResult;
        }
        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
};

SoundManager.prototype._ensureSlotReady = function (soundName) {
    if (!this.entity.sound || !this.soundMap.has(soundName)) {
        return Promise.reject(new Error(`SoundManager: Slot '${soundName}' is not configured.`));
    }

    const slot = this.entity.sound.slot(soundName);
    const descriptor = this.soundMap.get(soundName);

    if (!slot || !descriptor) {
        return Promise.reject(new Error(`SoundManager: Slot '${soundName}' is missing.`));
    }

    const asset = this._resolveAssetReference(descriptor.asset || descriptor.assetId);
    if (!asset) {
        return Promise.reject(new Error(`SoundManager: Asset reference for '${soundName}' is invalid.`));
    }

    descriptor.asset = asset;
    descriptor.assetId = asset.id;

    slot.asset = asset.id;
    slot.volume = this.masterVolume;

    if (asset.resource || asset.loaded) {
        return Promise.resolve({ slot: slot, asset: asset });
    }

    if (this._slotReadyPromises.has(soundName)) {
        return this._slotReadyPromises.get(soundName);
    }

    const self = this;
    const promise = new Promise(function (resolve, reject) {
        const onLoad = function (loadedAsset) {
            asset.off('error', onError);
            descriptor.asset = loadedAsset;
            descriptor.assetId = loadedAsset.id;
            slot.asset = loadedAsset.id;
            slot.volume = self.masterVolume;
            self._slotReadyPromises.delete(soundName);
            resolve({ slot: slot, asset: loadedAsset });
        };

        const onError = function (err) {
            asset.off('load', onLoad);
            self._slotReadyPromises.delete(soundName);
            reject(err || new Error(`SoundManager: Asset load failed for '${soundName}'.`));
        };

        asset.once('load', onLoad);
        asset.once('error', onError);

        if (!asset.loading) {
            self.app.assets.load(asset);
        }
    });

    this._slotReadyPromises.set(soundName, promise);
    return promise;
};

SoundManager.prototype._handleAudioReady = function () {
    this._preloadConfiguredSounds();
};

SoundManager.prototype._preloadConfiguredSounds = function () {
    if (!this.soundMap || this.soundMap.size === 0) {
        return;
    }

    const self = this;
    this.soundMap.forEach(function (_descriptor, name) {
        self.preloadSound(name);
    });
};

SoundManager.prototype._resolveAssetReference = function (reference) {
    if (!reference) {
        return null;
    }
    if (reference instanceof pc.Asset) {
        return reference;
    }
    if (typeof reference === 'number' || typeof reference === 'string') {
        return this.app.assets && this.app.assets.get ? this.app.assets.get(reference) : null;
    }
    if (reference.id && this.app.assets && this.app.assets.get) {
        return this.app.assets.get(reference.id) || null;
    }
    return null;
};

SoundManager.prototype._extractAssetId = function (reference) {
    if (!reference) {
        return null;
    }
    if (reference instanceof pc.Asset) {
        return reference.id;
    }
    if (typeof reference === 'number' || typeof reference === 'string') {
        return reference;
    }
    if (reference.id) {
        return reference.id;
    }
    return null;
};

SoundManager.prototype._applyMasterVolume = function (value) {
    this.masterVolume = value;
    if (!this.entity.sound || !this.entity.sound.slots) {
        return;
    }
    for (const slotName in this.entity.sound.slots) {
        if (Object.prototype.hasOwnProperty.call(this.entity.sound.slots, slotName)) {
            this.entity.sound.slots[slotName].volume = value;
        }
    }
};

SoundManager.prototype.destroy = function () {
    this.onDisable();
    if (this._onAudioReady) {
        this.app.off('audio:expanded:ready', this._onAudioReady, this);
    }
    this.off('attr:masterVolume', this._applyMasterVolume, this);
    if (this.app.soundManager === this) {
        delete this.app.soundManager;
    }
    if (this._slotReadyPromises) {
        this._slotReadyPromises.clear();
    }
    if (this.soundMap) {
        this.soundMap.clear();
    }
};
