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
    // --- Play the music on initialization
    this.playMusic();

    // --- If the asset is changed, swap the music
    this.on('attr:audioAsset', function (value, prev) {
        this.swapMusic();
    });
    
    // --- If the volume is changed, update the volume
    this.on('attr:volume', function (value, prev) {
        this.setVolume(value);
    });
};

BackgroundMusic.prototype.playMusic = function () {
    if (this.audioAsset && this.audioAsset.resource) {
        this.entity.sound.addSlot('background', {
            asset: this.audioAsset.id,
            loop: true,
            autoPlay: true,
            volume: this.volume
        });
    }
};

BackgroundMusic.prototype.stopMusic = function () {
    this.entity.sound.removeSlot('background');
};

BackgroundMusic.prototype.swapMusic = function () {
    this.stopMusic();
    this.playMusic();
};

BackgroundMusic.prototype.setVolume = function (volume) {
    this.volume = volume;
    if (this.entity.sound.slot('background')) {
        this.entity.sound.slot('background').volume = this.volume;
    }
};