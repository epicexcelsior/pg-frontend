var TagLoadQueue = pc.createScript('tagLoadQueue');

TagLoadQueue.attributes.add('defaultConcurrency', {
    type: 'number',
    min: 1,
    max: 16,
    default: 4,
    title: 'Default Concurrency'
});

TagLoadQueue.attributes.add('minConcurrency', {
    type: 'number',
    min: 1,
    max: 8,
    default: 2,
    title: 'Minimum Concurrency'
});

TagLoadQueue.attributes.add('globalMaxConcurrency', {
    type: 'number',
    min: 1,
    max: 32,
    default: 12,
    title: 'Global Max Concurrency'
});

TagLoadQueue.attributes.add('frameSpikeThresholdMs', {
    type: 'number',
    min: 4,
    max: 64,
    default: 28,
    title: 'Spike Threshold (ms)'
});

TagLoadQueue.attributes.add('spikeSamples', {
    type: 'number',
    min: 1,
    max: 12,
    default: 3,
    title: 'Spike Samples Before Backoff'
});

TagLoadQueue.attributes.add('recoverySamples', {
    type: 'number',
    min: 8,
    max: 600,
    default: 180,
    title: 'Recovery Samples Before Scale Up'
});

TagLoadQueue.attributes.add('adaptiveEnabled', {
    type: 'boolean',
    default: true,
    title: 'Enable Adaptive Concurrency'
});

TagLoadQueue.prototype.initialize = function () {
    this._queue = [];
    this._assetStates = new Map();
    this._batches = new Map();
    this._assetProgress = new Map();
    this._activeLoads = new Map();
    this._batchCounter = 0;

    this._globalCap = Math.max(this.minConcurrency, Math.min(this.globalMaxConcurrency, this.defaultConcurrency));
    this._baseConcurrency = this._globalCap;
    this._phaseConcurrency = null;
    this._currentConcurrency = this._effectiveConcurrencyCap();

    this._spikeCount = 0;
    this._recoveryCount = 0;

    this._destroyed = false;

    this._patchAssetIntegrity();

    if (!this.app.tagLoadQueue) {
        this.app.tagLoadQueue = this;
    } else {
        console.warn('TagLoadQueue: app.tagLoadQueue already set. Overwriting with new instance.');
        this.app.tagLoadQueue = this;
    }

    this.on('destroy', this._onDestroy, this);
};

TagLoadQueue.prototype._onDestroy = function () {
    this._destroyed = true;
    this._queue.length = 0;
    this._batches.clear();
    this._assetStates.clear();
    this._assetProgress.clear();
    this._activeLoads.forEach(function (handlers, assetId) {
        var asset = handlers.asset;
        if (asset) {
            asset.off('load', handlers.onLoad, handlers.scope);
            asset.off('error', handlers.onError, handlers.scope);
        }
    });
    this._activeLoads.clear();
};

TagLoadQueue.prototype._patchAssetIntegrity = function () {
    if (this._assetIntegrityPatched) {
        return;
    }
    this._assetIntegrityPatched = true;

    var app = this.app;
    var registry = app && app.assets;
    if (registry && !registry._guardedLoad) {
        var originalLoad = registry.load;
        registry.load = function (asset) {
            var resolved = asset;
            if (!resolved) {
                console.warn('AssetRegistry.load called without an asset reference.');
                return;
            }

            if (!(resolved instanceof pc.Asset)) {
                var assetId = null;
                if (typeof resolved === 'number' || typeof resolved === 'string') {
                    assetId = resolved;
                } else if (resolved && resolved.id !== undefined) {
                    assetId = resolved.id;
                }

                if (assetId !== null) {
                    var candidate = registry.get(assetId);
                    if (candidate) {
                        resolved = candidate;
                    } else {
                        registry.once('add:' + assetId, function (addedAsset) {
                            originalLoad.call(registry, addedAsset);
                        });
                        console.warn('AssetRegistry.load deferred until asset ' + assetId + ' is registered.');
                        return;
                    }
                } else {
                    console.warn('AssetRegistry.load received unsupported asset reference:', resolved);
                    return;
                }
            }

            return originalLoad.call(this, resolved);
        };
        registry._guardedLoad = true;
    }

    var collisionSystem = app && app.systems && app.systems.collision;
    var impl = collisionSystem && collisionSystem.implementation;
    if (impl && !impl._guardedLoadAsset) {
        var originalLoadAsset = impl.loadAsset;
        var guard = function (component, asset) {
            var resolved = asset;
            if (!resolved && component && component.data) {
                var dataAsset = component.data.asset;
                var assetId = null;

                if (dataAsset instanceof pc.Asset) {
                    resolved = dataAsset;
                } else if (typeof dataAsset === 'number' || typeof dataAsset === 'string') {
                    assetId = dataAsset;
                } else if (dataAsset && dataAsset.id !== undefined) {
                    assetId = dataAsset.id;
                }

                if (!resolved && assetId !== null) {
                    resolved = app.assets.get(assetId);
                    if (!resolved) {
                        app.assets.once('add:' + assetId, function (addedAsset) {
                            component.data.asset = addedAsset;
                            originalLoadAsset.call(impl, component, addedAsset);
                        });
                        console.warn('CollisionMeshSystem: waiting for collision asset ' + assetId + ' to register.');
                        return;
                    }
                    component.data.asset = resolved;
                }
            }

            if (!resolved) {
                var entityName = (component && component.entity && component.entity.name) || '(unnamed entity)';
                console.error('CollisionMeshSystem: Missing collision mesh asset for', entityName);
                return;
            }

            return originalLoadAsset.call(this, component, resolved);
        };

        impl.loadAsset = guard;
        impl._guardedLoadAsset = true;
    }
};

TagLoadQueue.prototype.update = function (dt) {
    if (!this.adaptiveEnabled) {
        return;
    }

    if (this._activeLoads.size === 0) {
        this._spikeCount = Math.max(0, this._spikeCount - 1);
        this._recoveryCount = Math.max(0, this._recoveryCount - 5);
        return;
    }

    var spikeThreshold = (this.frameSpikeThresholdMs || 28) / 1000;
    if (dt > spikeThreshold) {
        this._spikeCount += 1;
        this._recoveryCount = Math.max(0, this._recoveryCount - 1);
        if (this._spikeCount >= this.spikeSamples) {
            this._reduceConcurrency();
            this._spikeCount = 0;
        }
    } else {
        this._recoveryCount += 1;
        this._spikeCount = Math.max(0, this._spikeCount - 1);
        if (this._recoveryCount >= this.recoverySamples) {
            this._increaseConcurrency();
            this._recoveryCount = 0;
        }
    }
};

TagLoadQueue.prototype.setBaseConcurrency = function (value) {
    var clamped = this._clampConcurrency(value);
    this._baseConcurrency = clamped;
    this._currentConcurrency = Math.min(this._currentConcurrency, this._effectiveConcurrencyCap());
    this._drainQueue();
    this.fire('concurrency:changed', this._currentConcurrency);
    this.app.fire('load:concurrency:changed', {
        current: this._currentConcurrency,
        base: this._baseConcurrency,
        cap: this._effectiveConcurrencyCap()
    });
};

TagLoadQueue.prototype.setPhaseConcurrency = function (value) {
    if (typeof value !== 'number' || isNaN(value)) {
        this._phaseConcurrency = null;
    } else {
        this._phaseConcurrency = this._clampConcurrency(value);
    }
    this._currentConcurrency = Math.min(this._currentConcurrency, this._effectiveConcurrencyCap());
    this._drainQueue();
    this.fire('concurrency:changed', this._currentConcurrency);
};

TagLoadQueue.prototype.clearPhaseConcurrency = function () {
    this._phaseConcurrency = null;
    this._currentConcurrency = Math.min(this._currentConcurrency, this._effectiveConcurrencyCap());
    this._drainQueue();
    this.fire('concurrency:changed', this._currentConcurrency);
};

TagLoadQueue.prototype.cancelAll = function () {
    this._queue.length = 0;
    var cancelledError = new Error('TagLoadQueue: cancelled');
    this._batches.forEach(function (batch) {
        batch.cancelled = true;
        if (batch.reject) {
            batch.reject(cancelledError);
        }
    });
    this._batches.clear();
    this._assetStates.forEach(function (state) {
        state.dependents.clear();
    });
    this._assetProgress.clear();
};

TagLoadQueue.prototype.loadByTags = function (tags, options) {
    options = options || {};
    var list = Array.isArray(tags) ? tags.slice() : [tags];
    list = list.filter(function (tag) {
        return typeof tag === 'string' && tag.trim().length > 0;
    });

    if (list.length === 0) {
        return Promise.resolve({ loaded: 0, total: 0 });
    }

    var batchId = ++this._batchCounter;
    var batch = {
        id: batchId,
        tags: list,
        priority: typeof options.priority === 'number' ? options.priority : 0,
        total: 0,
        loaded: 0,
        error: null,
        cancelled: false,
        onProgress: typeof options.onProgress === 'function' ? options.onProgress : null,
        phase: options.phase || null
    };

    this._batches.set(batchId, batch);

    var self = this;
    return new Promise(function (resolve, reject) {
        batch.resolve = resolve;
        batch.reject = reject;
        try {
            self._queueAssetsForBatch(batch);
        } catch (err) {
            batch.error = err;
            batch.reject(err);
            self._batches.delete(batchId);
        }
    });
};

TagLoadQueue.prototype._queueAssetsForBatch = function (batch) {
    var self = this;
    var uniqueAssets = new Map();

    batch.tags.forEach(function (tag) {
        var assets = self.app.assets.findByTag(tag);
        if (!assets || assets.length === 0) {
            return;
        }
        assets.forEach(function (asset) {
            if (!asset) {
                return;
            }
            if (!uniqueAssets.has(asset.id)) {
                uniqueAssets.set(asset.id, asset);
            }
        });
    });

    if (uniqueAssets.size === 0) {
        batch.total = 0;
        batch.loaded = 0;
        this._finishBatch(batch);
        return;
    }

    uniqueAssets.forEach(function (asset, assetId) {
        var state = self._assetStates.get(assetId);
        if (!state) {
            state = {
                asset: asset,
                status: asset.resource ? 'loaded' : 'idle',
                dependents: new Set()
            };
            self._assetStates.set(assetId, state);
        }
        state.dependents.add(batch.id);

        if (!self._assetProgress.has(assetId)) {
            self._assetProgress.set(assetId, asset.resource ? 'loaded' : 'pending');
        }
    });

    batch.total = uniqueAssets.size;
    batch.loaded = 0;

    uniqueAssets.forEach(function (asset) {
        if (asset.resource) {
            batch.loaded += 1;
            self._notifyBatchProgress(batch);
            self._updateGlobalProgress(asset, null);
            return;
        }

        var state = self._assetStates.get(asset.id);
        if (!state) {
            return;
        }

        if (state.status === 'idle') {
            state.status = 'queued';
            self._queue.push({
                assetId: asset.id,
                priority: batch.priority,
                batchId: batch.id
            });
        }
    });

    if (batch.loaded >= batch.total) {
        this._finishBatch(batch);
        return;
    }

    this._queue.sort(function (a, b) {
        if (a.priority === b.priority) {
            return a.assetId - b.assetId;
        }
        return b.priority - a.priority;
    });

    this._drainQueue();
};

TagLoadQueue.prototype._drainQueue = function () {
    if (this._destroyed) {
        return;
    }

    var cap = this._effectiveConcurrencyCap();
    if (this._currentConcurrency > cap) {
        this._currentConcurrency = cap;
    }

    while (this._activeLoads.size < cap && this._queue.length > 0) {
        var item = this._queue.shift();
        var state = this._assetStates.get(item.assetId);
        if (!state || state.status === 'loading' || state.status === 'loaded') {
            continue;
        }
        this._startAssetLoad(state);
    }
};

TagLoadQueue.prototype._startAssetLoad = function (state) {
    if (!state || !state.asset) {
        return;
    }

    state.status = 'loading';
    var asset = state.asset;
    var self = this;

    var handlers = {
        asset: asset,
        scope: self,
        onLoad: function () {
            self._handleAssetReady(asset, null);
        },
        onError: function (err) {
            self._handleAssetReady(asset, err || new Error('TagLoadQueue: asset load error.'));
        }
    };

    this._activeLoads.set(asset.id, handlers);

    asset.once('load', handlers.onLoad, handlers.scope);
    asset.once('error', handlers.onError, handlers.scope);

    if (!asset.resource && !asset.loading) {
        this.app.assets.load(asset);
    } else if (asset.resource) {
        setTimeout(function () {
            self._handleAssetReady(asset, null);
        }, 0);
    }
};

TagLoadQueue.prototype._handleAssetReady = function (asset, error) {
    var handlers = this._activeLoads.get(asset.id);
    if (handlers) {
        asset.off('load', handlers.onLoad, handlers.scope);
        asset.off('error', handlers.onError, handlers.scope);
        this._activeLoads.delete(asset.id);
    }

    var state = this._assetStates.get(asset.id);
    if (!state) {
        return;
    }

    if (error) {
        state.status = 'error';
        state.error = error;
    } else {
        state.status = 'loaded';
        state.error = null;
    }

    var self = this;

    state.dependents.forEach(function (batchId) {
        var batch = self._batches.get(batchId);
        if (!batch || batch.cancelled) {
            return;
        }
        batch.loaded += 1;
        if (error && !batch.error) {
            batch.error = error;
        }
        self._notifyBatchProgress(batch);
        if (batch.loaded >= batch.total) {
            self._finishBatch(batch);
        }
    });

    this._updateGlobalProgress(asset, error);

    if (!error) {
        this._recoveryCount += 3;
    } else {
        this._spikeCount += 1;
    }

    this._drainQueue();
};

TagLoadQueue.prototype._finishBatch = function (batch) {
    if (!batch) {
        return;
    }

    this._batches.delete(batch.id);

    if (batch.cancelled) {
        return;
    }

    if (batch.error) {
        if (batch.reject) {
            batch.reject(batch.error);
        }
    } else if (batch.resolve) {
        batch.resolve({
            loaded: batch.loaded,
            total: batch.total,
            tags: batch.tags.slice(),
            phase: batch.phase
        });
    }
};

TagLoadQueue.prototype._notifyBatchProgress = function (batch) {
    if (!batch) {
        return;
    }
    var payload = {
        id: batch.id,
        loaded: batch.loaded,
        total: batch.total,
        tags: batch.tags.slice(),
        phase: batch.phase
    };

    if (batch.onProgress) {
        try {
            batch.onProgress(payload);
        } catch (err) {
            console.error('TagLoadQueue: batch progress handler failed', err);
        }
    }

    this.fire('batch:progress', payload);
    this.app.fire('load:batch:progress', payload);
};

TagLoadQueue.prototype._updateGlobalProgress = function (asset, error) {
    if (!asset) {
        return;
    }
    if (!this._assetProgress.has(asset.id)) {
        this._assetProgress.set(asset.id, error ? 'error' : 'loaded');
    } else {
        this._assetProgress.set(asset.id, error ? 'error' : 'loaded');
    }

    var total = this._assetProgress.size;
    var loaded = 0;
    var errors = 0;

    this._assetProgress.forEach(function (state) {
        if (state === 'loaded') {
            loaded += 1;
        } else if (state === 'error') {
            errors += 1;
        }
    });

    var payload = {
        loaded: loaded,
        total: total,
        errors: errors,
        asset: asset,
        error: error || null
    };

    this.fire('progress', payload);
    this.app.fire('load:asset:progress', payload);
};

TagLoadQueue.prototype._effectiveConcurrencyCap = function () {
    var cap = this._baseConcurrency;
    if (typeof this._phaseConcurrency === 'number') {
        cap = Math.min(cap, this._phaseConcurrency);
    }
    cap = Math.min(cap, this.globalMaxConcurrency);
    cap = Math.max(cap, this.minConcurrency);
    return cap;
};

TagLoadQueue.prototype._clampConcurrency = function (value) {
    if (typeof value !== 'number' || isNaN(value)) {
        return this._effectiveConcurrencyCap();
    }
    var clamped = Math.max(this.minConcurrency, value);
    clamped = Math.min(clamped, this.globalMaxConcurrency);
    return clamped;
};

TagLoadQueue.prototype._reduceConcurrency = function () {
    var cap = this._effectiveConcurrencyCap();
    if (this._currentConcurrency <= this.minConcurrency) {
        return;
    }
    this._currentConcurrency = Math.max(this.minConcurrency, this._currentConcurrency - 1);
    cap = Math.max(this.minConcurrency, Math.min(cap, this._currentConcurrency));
    this.fire('concurrency:changed', this._currentConcurrency);
    this.app.fire('load:concurrency:changed', {
        current: this._currentConcurrency,
        base: this._baseConcurrency,
        cap: cap
    });
};

TagLoadQueue.prototype._increaseConcurrency = function () {
    var cap = this._effectiveConcurrencyCap();
    if (this._currentConcurrency >= cap) {
        return;
    }
    this._currentConcurrency = Math.min(cap, this._currentConcurrency + 1);
    this.fire('concurrency:changed', this._currentConcurrency);
    this.app.fire('load:concurrency:changed', {
        current: this._currentConcurrency,
        base: this._baseConcurrency,
        cap: cap
    });
    this._drainQueue();
};
