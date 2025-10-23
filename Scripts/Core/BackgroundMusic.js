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

    this._assetReady = false;
    this._assetReadyPromise = null;
    this._pendingStart = false;
    this._pendingTimeout = null;
    this._isPlaying = false;
    this._contextUnlockPromise = null;
    this._contextUnlockResolve = null;
    this._shouldResumeOnContextRunning = false;
    this._pausedDueToContext = false;
    this._resumeOnContextRunning = false;
    this._audioAsset = this._resolveAssetReference(this.audioAsset);

    this._onExpandedReady = this._handleExpandedReady.bind(this);
    this._onVisibilityChange = this._handleVisibilityChange.bind(this);
    this._onContextStateChange = this._handleContextStateChange.bind(this);
    this._onUserInteraction = this._handleUserInteraction.bind(this);

    if (!this.entity.sound) {
        this.entity.addComponent('sound');
    }
    this.entity.sound.positional = false;

    if (this._audioAsset) {
        this.onAssetChanged(this._audioAsset, null);
    }

    this.on('attr:volume', function (value) {
        this.setVolume(value);
    });

    document.addEventListener('visibilitychange', this._onVisibilityChange, false);
    var context = this._getAudioContext();
    if (context && context.addEventListener) {
        context.addEventListener('statechange', this._onContextStateChange, false);
    }

    this.app.on('audio:expanded:ready', this._onExpandedReady, this);
    this.app.on('backgroundMusic:start', this._onExpandedReady, this);
};

// --- Called when the audioAsset attribute is changed
BackgroundMusic.prototype.onAssetChanged = function(newAsset, oldAsset) {
    var resolvedOld = this._resolveAssetReference(oldAsset || this._audioAsset);
    var resolvedNew = this._resolveAssetReference(newAsset || this.audioAsset);

    if (resolvedOld && resolvedOld !== resolvedNew) {
        this.stopMusic();
    }

    this._audioAsset = resolvedNew || null;

    if (this._audioAsset) {
        this._assetReady = false;
        this._assetReadyPromise = null;
        this.playMusic();
    } else {
        this._assetReady = false;
        this._assetReadyPromise = null;
        this.stopMusic();
    }
};

BackgroundMusic.prototype._ensureAssetReady = function () {
    var self = this;
    if (!this._audioAsset && this.audioAsset) {
        this._audioAsset = this._resolveAssetReference(this.audioAsset);
    }
    if (!this._audioAsset) {
        return Promise.reject(new Error('BackgroundMusic: No audio asset assigned.'));
    }
    if (this._assetReady) {
        return Promise.resolve(this._audioAsset);
    }
    if (this._assetReadyPromise) {
        return this._assetReadyPromise;
    }
    this._assetReadyPromise = new Promise(function (resolve, reject) {
        if (self._audioAsset.resource) {
            self._assetReady = true;
            self._assetReadyPromise = null;
            resolve(self._audioAsset);
            return;
        }
        self._audioAsset.once('load', function (asset) {
            self._assetReady = true;
            self._assetReadyPromise = null;
            resolve(asset);
        });
        self._audioAsset.once('error', function (err) {
            self._assetReady = false;
            self._assetReadyPromise = null;
            reject(err || new Error('BackgroundMusic: Failed to load asset.'));
        });
        self.app.assets.load(self._audioAsset);
    });
    return this._assetReadyPromise;
};

BackgroundMusic.prototype._handleExpandedReady = function (payload) {
    var delay = 600;
    if (payload && typeof payload.delay === 'number') {
        delay = payload.delay;
    }
    this.playMusic(delay);
};

BackgroundMusic.prototype.playMusic = function (delay) {
    var self = this;
    this._pendingStart = true;
    this._shouldResumeOnContextRunning = false;
    this._resumeOnContextRunning = false;
    var startDelay = typeof delay === 'number' ? delay : 0;

    this._ensureAssetReady()
        .then(function () {
            return self._ensureAudioContextReady();
        })
        .then(function () {
            self._queuePlayback(startDelay);
        })
        .catch(function (err) {
            console.error('BackgroundMusic: Unable to prepare audio asset for playback.', err);
        });
};

BackgroundMusic.prototype._executePlayback = function () {
    this._pendingStart = false;
    this._clearPendingTimeout();

    if (!this._audioAsset || !this._audioAsset.resource) {
        console.warn('BackgroundMusic: Play requested before audio asset finished loading.');
        return;
    }

    var context = this._getAudioContext();
    if (context && context.state !== 'running') {
        // Context was suspended between scheduling and execution.
        this._pendingStart = true;
        var self = this;
        this._ensureAudioContextReady().then(function () {
            if (self._pendingStart) {
                self._queuePlayback(0);
            }
        }).catch(function (err) {
            console.error('BackgroundMusic: Unable to resume audio context for playback.', err);
        });
        return;
    }

    var slot = this._ensureBackgroundSlot();
    if (!slot) {
        console.warn('BackgroundMusic: Unable to create background slot. Audio asset missing or invalid.');
        return;
    }
    try {
        slot.play();
        this._isPlaying = true;
        this._pausedDueToContext = false;
        this._resumeOnContextRunning = false;
    } catch (err) {
        console.error('BackgroundMusic: Failed to start playback.', err);
        this._isPlaying = false;
    }
};

BackgroundMusic.prototype.stopMusic = function () {
    this._pendingStart = false;
    this._clearPendingTimeout();
    // Check if the slot exists before trying to remove it
    var slot = this.entity.sound && this.entity.sound.slot('background');
    if (slot) {
        slot.stop();
        this.entity.sound.removeSlot('background');
    }
    this._isPlaying = false;
    this._pausedDueToContext = false;
};

BackgroundMusic.prototype.setVolume = function (volume) {
    this.volume = volume;
    var slot = this.entity.sound && this.entity.sound.slot('background');
    if (slot) {
        slot.volume = this.volume;
    }
};

BackgroundMusic.prototype.destroy = function () {
    this.app.off('audio:expanded:ready', this._onExpandedReady, this);
    this.app.off('backgroundMusic:start', this._onExpandedReady, this);
    this.stopMusic();
    this._clearPendingTimeout();
    this._unregisterUnlockListeners();
    document.removeEventListener('visibilitychange', this._onVisibilityChange, false);
    var context = this._getAudioContext();
    if (context && context.removeEventListener) {
        context.removeEventListener('statechange', this._onContextStateChange, false);
    }
};

BackgroundMusic.prototype._queuePlayback = function (delay) {
    var self = this;
    this._clearPendingTimeout();
    this._pendingTimeout = setTimeout(function () {
        if (self._pendingStart) {
            self._executePlayback();
        }
    }, Math.max(0, delay));
};

BackgroundMusic.prototype._clearPendingTimeout = function () {
    if (this._pendingTimeout) {
        clearTimeout(this._pendingTimeout);
        this._pendingTimeout = null;
    }
};

BackgroundMusic.prototype._getAudioContext = function () {
    var soundSystem = this.app.systems && this.app.systems.sound;
    if (soundSystem && soundSystem.manager && soundSystem.manager.context) {
        return soundSystem.manager.context;
    }
    return null;
};

BackgroundMusic.prototype._ensureBackgroundSlot = function (createIfMissing) {
    if (createIfMissing === undefined) {
        createIfMissing = true;
    }
    if (!this.entity.sound) {
        if (!createIfMissing) {
            return null;
        }
        this.entity.addComponent('sound');
        this.entity.sound.positional = false;
    }
    var slot = this.entity.sound.slot('background');
    if (!slot && !createIfMissing) {
        return null;
    }
    if (!this._audioAsset) {
        return null;
    }
    if (!slot) {
        this.entity.sound.addSlot('background', {
            asset: this._audioAsset ? this._audioAsset.id : null,
            loop: true,
            autoPlay: false,
            volume: this.volume
        });
        slot = this.entity.sound.slot('background');
    }
    if (slot) {
        slot.asset = this._audioAsset.id;
        slot.loop = true;
        slot.volume = this.volume;
    }
    return slot;
};

BackgroundMusic.prototype._ensureAudioContextReady = function () {
    var context = this._getAudioContext();
    if (!context) {
        return Promise.reject(new Error('BackgroundMusic: Audio context unavailable.'));
    }
    if (context.state === 'running') {
        return Promise.resolve();
    }

    var self = this;
    if (!this._contextUnlockPromise) {
        this._contextUnlockPromise = new Promise(function (resolve) {
            self._contextUnlockResolve = resolve;
        });
        this._registerUnlockListeners();
    }

    try {
        return context.resume().then(function () {
            self._onContextResumed();
        }).catch(function () {
            return self._contextUnlockPromise;
        });
    } catch (err) {
        return this._contextUnlockPromise;
    }
};

BackgroundMusic.prototype._registerUnlockListeners = function () {
    if (this._unlockListenersBound) {
        return;
    }
    this._unlockListenersBound = true;
    window.addEventListener('pointerdown', this._onUserInteraction, true);
    window.addEventListener('touchend', this._onUserInteraction, true);
    window.addEventListener('keydown', this._onUserInteraction, true);
    document.addEventListener('visibilitychange', this._onVisibilityChange, false);
};

BackgroundMusic.prototype._unregisterUnlockListeners = function () {
    if (!this._unlockListenersBound) {
        return;
    }
    this._unlockListenersBound = false;
    window.removeEventListener('pointerdown', this._onUserInteraction, true);
    window.removeEventListener('touchend', this._onUserInteraction, true);
    window.removeEventListener('keydown', this._onUserInteraction, true);
};

BackgroundMusic.prototype._handleUserInteraction = function () {
    this._tryResumeContext();
};

BackgroundMusic.prototype._handleVisibilityChange = function () {
    if (!document.hidden) {
        this._tryResumeContext();
    } else if (this._isPlaying) {
        this._shouldResumeOnContextRunning = true;
        this._resumeOnContextRunning = false;
        this._pauseSlotForContext();
    }
};

BackgroundMusic.prototype._handleContextStateChange = function () {
    var context = this._getAudioContext();
    if (!context) {
        return;
    }
    if (context.state === 'running') {
        this._onContextResumed();
        this._resumeSlotAfterContext();
    } else if (context.state === 'suspended' || context.state === 'interrupted') {
        this._pauseSlotForContext();
    }
};

BackgroundMusic.prototype._tryResumeContext = function () {
    var context = this._getAudioContext();
    if (!context) {
        return;
    }
    if (context.state === 'running') {
        this._onContextResumed();
        return;
    }

    var self = this;
    context.resume().then(function () {
        self._onContextResumed();
    }).catch(function () {
        // Ignore - will retry on the next user interaction.
    });
};

BackgroundMusic.prototype._onContextResumed = function () {
    this._unregisterUnlockListeners();
    if (this._contextUnlockResolve) {
        this._contextUnlockResolve();
        this._contextUnlockResolve = null;
        this._contextUnlockPromise = null;
    }
};

BackgroundMusic.prototype._pauseSlotForContext = function () {
    if (!this._isPlaying) {
        return;
    }
    var slot = this._ensureBackgroundSlot(false);
    if (!slot) {
        return;
    }
    this._pausedDueToContext = true;
    this._resumeOnContextRunning = true;
    try {
        if (typeof slot.pause === 'function') {
            slot.pause();
        } else if (slot.isPlaying && typeof slot.stop === 'function') {
            slot.stop();
        }
    } catch (err) {
        console.warn('BackgroundMusic: Failed to pause background slot.', err);
    }
};

BackgroundMusic.prototype._resumeSlotAfterContext = function () {
    var slot = this._ensureBackgroundSlot(false);
    if (!slot) {
        return;
    }

    if (this._pendingStart) {
        // We were still waiting to start; let the pending playback logic handle it.
        return;
    }

    if (this._pausedDueToContext) {
        this._pausedDueToContext = false;
        this._resumeOnContextRunning = false;
        try {
            if (typeof slot.resume === 'function') {
                slot.resume();
                this._isPlaying = true;
            } else {
                slot.play();
                this._isPlaying = true;
            }
        } catch (err) {
            console.error('BackgroundMusic: Failed to resume paused slot.', err);
            this.playMusic(0);
        }
        this._shouldResumeOnContextRunning = false;
    } else if (this._shouldResumeOnContextRunning && !slot.isPlaying) {
        this._shouldResumeOnContextRunning = false;
        if (this._resumeOnContextRunning) {
            this._resumeOnContextRunning = false;
            this.playMusic(0);
        }
    }
};

BackgroundMusic.prototype._resolveAssetReference = function (assetRef) {
    if (!assetRef) {
        return null;
    }
    if (assetRef instanceof pc.Asset) {
        return assetRef;
    }
    if (typeof assetRef === 'number' || typeof assetRef === 'string') {
        return this.app.assets && this.app.assets.get ? this.app.assets.get(assetRef) : null;
    }
    if (assetRef.id && this.app.assets && this.app.assets.get) {
        return this.app.assets.get(assetRef.id) || null;
    }
    return null;
};
