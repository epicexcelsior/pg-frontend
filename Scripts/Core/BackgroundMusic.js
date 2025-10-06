var BackgroundMusic = pc.createScript('backgroundMusic');

BackgroundMusic.attributes.add('audioAsset', {
    type: 'asset',
    assetType: 'audio',
    title: 'Audio Asset'
});

BackgroundMusic.attributes.add('volume', {
    type: 'number',
    default: 0.5,
    min: 0,
    max: 1,
    title: 'Volume'
});

// initialize code called once per entity
BackgroundMusic.prototype.initialize = function() {
    // --- Listen for the asset being set or changed
    this.on('attr:audioAsset', this.onAssetChanged, this);
    
    // --- If the asset is already set, fire the event manually
    if (this.audioAsset) {
        this.onAssetChanged(this.audioAsset, null);
    }
    
    // --- If the volume is changed, update the volume
    this.on('attr:volume', function (value, prev) {
        this.setVolume(value);
    });
};

// --- Called when the audioAsset attribute is changed
BackgroundMusic.prototype.onAssetChanged = function(newAsset, oldAsset) {
    // Stop listening to the old asset
    if (oldAsset) {
        oldAsset.off('load', this.playMusic, this);
        this.stopMusic();
    }

    // Start listening to the new asset
    if (newAsset) {
        // If asset is already loaded, play it
        if (newAsset.resource) {
            this.playMusic();
        } else {
            // Otherwise, wait for it to load
            newAsset.once('load', this.playMusic, this);
            // And trigger the load
            this.app.assets.load(newAsset);
        }
    }
};

BackgroundMusic.prototype.playMusic = function () {
    // Ensure the asset and its resource are available
    if (this.audioAsset && this.audioAsset.resource) {
        // Stop any currently playing music first
        this.stopMusic();
        
        this.entity.sound.addSlot('background', {
            asset: this.audioAsset.id,
            loop: true,
            autoPlay: true,
            volume: this.volume
        });
    }
};

BackgroundMusic.prototype.stopMusic = function () {
    // Check if the slot exists before trying to remove it
    if (this.entity.sound.slot('background')) {
        this.entity.sound.removeSlot('background');
    }
};

BackgroundMusic.prototype.setVolume = function (volume) {
    this.volume = volume;
    if (this.entity.sound.slot('background')) {
        this.entity.sound.slot('background').volume = this.volume;
    }
};