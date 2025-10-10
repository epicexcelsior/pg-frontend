var LoadOrchestrator = pc.createScript('loadOrchestrator');

LoadOrchestrator.attributes.add('phaseOrder', {
    type: 'string',
    array: true,
    title: 'Phase Order Override',
    description: 'Optional ordered list of phase names to use instead of config defaults.'
});

LoadOrchestrator.prototype.initialize = function () {
    this.queue = this.app.tagLoadQueue || (this.entity.script && this.entity.script.tagLoadQueue) || null;
    if (!this.queue) {
        console.error('LoadOrchestrator: TagLoadQueue instance not found. Add TagLoadQueue script to the same entity.');
        return;
    }

    this._phasePromises = new Map();
    this._policy = this._resolvePolicy();
    this._deviceTier = this._detectDeviceTier();
    this._phaseSequence = this._resolvePhaseSequence(this.phaseOrder, this._policy);

    this._bindQueueEvents();
    this._applyBaseConcurrency();

    this.app.loadOrchestrator = this;
    this.app.fire('load:orchestrator:ready', {
        tier: this._deviceTier,
        policy: this._policy
    });

    if (this._phaseSequence && this._phaseSequence.length > 0) {
        var initialPhase = this._phaseSequence[0];
        if (initialPhase) {
            this.start(initialPhase).catch(function (err) {
                console.error('LoadOrchestrator: Initial phase "' + initialPhase + '" failed to load.', err);
            });
        }
    }

    this.app.on('load:requestPhase', this.start, this);
    this.on('destroy', this._onDestroy, this);
};

LoadOrchestrator.prototype._onDestroy = function () {
    this.app.off('load:requestPhase', this.start, this);
    if (this.queue) {
        this.queue.off('progress', this._onQueueProgress, this);
        this.queue.off('batch:progress', this._onBatchProgress, this);
    }
    if (this.app.loadOrchestrator === this) {
        this.app.loadOrchestrator = null;
    }
};

LoadOrchestrator.prototype._bindQueueEvents = function () {
    this._onQueueProgress = this._onQueueProgress || this._handleQueueProgress.bind(this);
    this._onBatchProgress = this._onBatchProgress || this._handleBatchProgress.bind(this);
    this.queue.on('progress', this._onQueueProgress, this);
    this.queue.on('batch:progress', this._onBatchProgress, this);
};

LoadOrchestrator.prototype._handleQueueProgress = function (payload) {
    this.app.fire('load:stream:progress', payload);
};

LoadOrchestrator.prototype._handleBatchProgress = function (payload) {
    this.app.fire('load:tag:progress', payload);
};

LoadOrchestrator.prototype._resolvePolicy = function () {
    var config = this.app.config;
    if (config) {
        if (typeof config.getLoadPolicy === 'function') {
            var policy = config.getLoadPolicy();
            if (policy) {
                return policy;
            }
        }
        if (config.loadPolicy) {
            return config.loadPolicy;
        }
    }
    return this._defaultPolicy();
};

LoadOrchestrator.prototype._defaultPolicy = function () {
    return {
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
            postSpawnStream: 1
        }
    };
};

LoadOrchestrator.prototype._resolvePhaseSequence = function (override, policy) {
    if (override && Array.isArray(override) && override.length > 0) {
        return override.slice();
    }
    var phases = policy && policy.phases ? Object.keys(policy.phases) : [];
    return phases;
};

LoadOrchestrator.prototype._detectDeviceTier = function () {
    var config = this.app.config;
    if (config && typeof config.detectDeviceTier === 'function') {
        try {
            return config.detectDeviceTier();
        } catch (err) {
            console.warn('LoadOrchestrator: detectDeviceTier failed, falling back to default.', err);
        }
    }
    return this._fallbackTier();
};

LoadOrchestrator.prototype._fallbackTier = function () {
    var nav = (typeof window !== 'undefined' && window.navigator) ? window.navigator : {};
    var cores = nav.hardwareConcurrency || 4;
    var ua = String(nav.userAgent || '').toLowerCase();
    var isMobile = /android|iphone|ipad|ipod|mobile/i.test(ua);
    if (isMobile) {
        if (cores <= 4) {
            return 'low';
        }
        if (cores <= 6) {
            return 'mid';
        }
        return 'high';
    }
    if (cores <= 4) {
        return 'mid';
    }
    if (cores >= 12) {
        return 'high';
    }
    return 'mid';
};

LoadOrchestrator.prototype._applyBaseConcurrency = function () {
    if (!this.queue) {
        return;
    }
    var caps = (this._policy && this._policy.concurrencyCaps) || {};
    var tier = this._deviceTier || 'default';
    var cap = caps[tier];
    if (typeof cap !== 'number') {
        cap = caps.default || this.queue.defaultConcurrency || 4;
    }
    this.queue.setBaseConcurrency(cap);
};

LoadOrchestrator.prototype.start = function (phaseName, options) {
    if (!this.queue) {
        return Promise.reject(new Error('LoadOrchestrator: queue not ready'));
    }
    if (!phaseName) {
        return Promise.resolve();
    }
    if (this._phasePromises.has(phaseName)) {
        return this._phasePromises.get(phaseName);
    }

    var tags = this._getTagsForPhase(phaseName);
    if (!tags || tags.length === 0) {
        console.warn("LoadOrchestrator: Phase '" + phaseName + "' has no tags configured.");
        return Promise.resolve();
    }

    var priority = this._getPriorityForPhase(phaseName);
    var cap = this._getPhaseConcurrencyCap(phaseName);

    var self = this;
    var promise = new Promise(function (resolve, reject) {
        self.app.fire('load:phase:start', phaseName);
        if (typeof cap === 'number') {
            self.queue.setPhaseConcurrency(cap);
        }

        self._streamTagsSequentially(tags, phaseName, priority).then(function (result) {
            self.queue.clearPhaseConcurrency();
            self.app.fire('load:phase:done', {
                phase: phaseName,
                result: result,
                tier: self._deviceTier
            });
            resolve(result);
        }).catch(function (err) {
            self.queue.clearPhaseConcurrency();
            self.app.fire('load:phase:error', {
                phase: phaseName,
                error: err
            });
            reject(err);
        }).finally(function () {
            self._phasePromises.delete(phaseName);
        });
    });

    this._phasePromises.set(phaseName, promise);
    return promise;
};

LoadOrchestrator.prototype._streamTagsSequentially = function (tags, phaseName, priority) {
    var self = this;
    var results = [];

    var sequence = Promise.resolve();
    tags.forEach(function (tag) {
        sequence = sequence.then(function () {
            return self._loadTagGroup(tag, phaseName, priority).then(function (res) {
                results.push(res);
                return res;
            });
        });
    });

    return sequence.then(function () {
        return {
            phase: phaseName,
            groups: results
        };
    });
};

LoadOrchestrator.prototype._loadTagGroup = function (tagGroup, phaseName, priority) {
    var tags = Array.isArray(tagGroup) ? tagGroup : [tagGroup];
    var filtered = tags.filter(function (tag) {
        return typeof tag === 'string' && tag.trim().length > 0;
    });

    if (filtered.length === 0) {
        return Promise.resolve({
            tags: [],
            skipped: true,
            phase: phaseName
        });
    }

    var self = this;
    var batchDescriptor = {
        tags: filtered,
        phase: phaseName,
        priority: priority
    };

    this.app.fire('load:tag:start', batchDescriptor);

    return this.queue.loadByTags(filtered, {
        priority: priority,
        phase: phaseName,
        onProgress: function (payload) {
            self.app.fire('load:tag:progress', Object.assign({}, payload, batchDescriptor));
        }
    }).then(function (result) {
        var payload = Object.assign({}, result, batchDescriptor);
        self.app.fire('load:tag:done', payload);
        if (filtered.indexOf('audio-expanded') !== -1) {
            self.app.fire('audio:expanded:ready', payload);
        }
        if (filtered.indexOf('avatars-variants') !== -1) {
            self.app.fire('avatars:variants:ready', payload);
        }
        return payload;
    }).catch(function (err) {
        var errorPayload = Object.assign({}, batchDescriptor, { error: err });
        self.app.fire('load:tag:error', errorPayload);
        throw err;
    });
};

LoadOrchestrator.prototype.getDeviceTier = function () {
    return this._deviceTier;
};

LoadOrchestrator.prototype._getTagsForPhase = function (phaseName) {
    if (!this._policy || !this._policy.phases) {
        return null;
    }
    var tags = this._policy.phases[phaseName];
    if (!tags) {
        return null;
    }
    if (Array.isArray(tags)) {
        return tags.slice();
    }
    if (tags && Array.isArray(tags.tags)) {
        return tags.tags.slice();
    }
    return null;
};

LoadOrchestrator.prototype._getPriorityForPhase = function (phaseName) {
    var priorities = this._policy && this._policy.priorities;
    if (priorities && typeof priorities[phaseName] === 'number') {
        return priorities[phaseName];
    }
    if (priorities && typeof priorities.default === 'number') {
        return priorities.default;
    }
    return 0;
};

LoadOrchestrator.prototype._getPhaseConcurrencyCap = function (phaseName) {
    if (!this._policy) {
        return null;
    }
    var phaseCaps = this._policy.phaseCaps;
    if (!phaseCaps) {
        return null;
    }
    var capConfig = phaseCaps[phaseName];
    if (!capConfig) {
        return null;
    }

    if (typeof capConfig === 'number') {
        return capConfig;
    }

    if (typeof capConfig === 'object') {
        var tier = this._deviceTier || 'default';
        if (typeof capConfig[tier] === 'number') {
            return capConfig[tier];
        }
        if (typeof capConfig.default === 'number') {
            return capConfig.default;
        }
    }

    return null;
};
