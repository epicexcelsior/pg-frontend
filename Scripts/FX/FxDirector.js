// Provides a central entry point for spawning VFX, routing SFX playback and coordinating camera shake.
var FxDirector = pc.createScript('fxDirector');

FxDirector.attributes.add('spawnRoot', {
    type: 'entity',
    title: 'Spawn Root',
    description: 'Parent entity for spawned visual effects. Defaults to this entity.'
});

FxDirector.attributes.add('cameraShakeEntity', {
    type: 'entity',
    title: 'Camera Shaker',
    description: 'Entity that owns a cameraShaker script instance.'
});

FxDirector.attributes.add('prefabKeys', {
    type: 'string',
    array: true,
    default: [],
    title: 'Prefab Keys',
    description: 'Keys used to reference prefabs in effect definitions.'
});

FxDirector.attributes.add('prefabs', {
    type: 'entity',
    array: true,
    default: [],
    title: 'Prefabs',
    description: 'Entities or template instances that will be cloned when referenced.'
});

FxDirector.attributes.add('soundKeys', {
    type: 'string',
    array: true,
    default: [],
    title: 'Sound Keys'
});

FxDirector.attributes.add('soundAssets', {
    type: 'asset',
    array: true,
    assetType: 'audio',
    default: [],
    title: 'Sound Assets'
});

FxDirector.attributes.add('soundEntity', {
    type: 'entity',
    title: 'Sound Host Entity',
    description: 'Entity with a Sound component. Slots are created automatically as needed.'
});

FxDirector.attributes.add('effectsCatalog', {
    type: 'json',
    array: true,
    title: 'Effects Catalog',
    description: 'Optional editor-defined effect presets.',
    schema: [
        { name: 'id', type: 'string', title: 'Effect ID' },
        { name: 'trauma', type: 'number', title: 'Shake Trauma', default: 0 },
        { name: 'impulse', type: 'number', title: 'Shake Impulse', default: 0 },
        { name: 'prefabs', type: 'string', title: 'Prefab Keys', array: true },
        { name: 'sounds', type: 'string', title: 'Sound Keys', array: true },
        { name: 'rumbleMagnitude', type: 'number', title: 'Rumble Magnitude', default: 0 },
        { name: 'rumbleDurationMs', type: 'number', title: 'Rumble Duration (ms)', default: 0 }
    ]
});

FxDirector.prototype.initialize = function () {
    this.spawnRoot = this.spawnRoot || this.entity;
    this._prefabMap = this._buildMap(this.prefabKeys, this.prefabs, 'fxDirector.prefabs');
    this._soundMap = this._buildMap(this.soundKeys, this.soundAssets, 'fxDirector.soundAssets');
    this._effects = {};
    this._timers = [];
    this._tmpVec = new pc.Vec3();
    this._tmpQuat = new pc.Quat();

    this._shaker = null;
    this._resolveCameraShaker();
    this._ingestCatalog(this.effectsCatalog);
    this._ensureDefaultEffects();

    this.app.on('fx:play', this.playEffect, this);
    this.app.on('fx:register', this.registerEffect, this);

    this.on('destroy', function () {
        this.app.off('fx:play', this.playEffect, this);
        this.app.off('fx:register', this.registerEffect, this);
        for (var i = 0; i < this._timers.length; i++) {
            clearTimeout(this._timers[i]);
        }
        this._timers.length = 0;
    }, this);
};

FxDirector.prototype._ensureDefaultEffects = function () {
    if (!this._effects.donation) {
        this._effects.donation = {
            id: 'donation',
            shake: { trauma: 0.25 },
            vfx: [],
            sfx: [],
            rumble: { magnitude: 0.35, durationMs: 160 }
        };
    }
};

FxDirector.prototype._buildMap = function (keys, values, label) {
    var out = {};
    if (!keys || !values) {
        return out;
    }
    var len = Math.min(keys.length, values.length);
    for (var i = 0; i < len; i++) {
        var key = keys[i];
        if (!key) {
            continue;
        }
        if (!values[i]) {
            console.warn('[FxDirector] Missing value for key "' + key + '" in ' + label);
            continue;
        }
        out[key] = values[i];
    }
    if (keys.length !== values.length) {
        console.warn('[FxDirector] Prefab/Sound key list length mismatch for ' + label);
    }
    return out;
};

FxDirector.prototype._ingestCatalog = function (catalog) {
    if (!catalog || !catalog.length) {
        return;
    }
    for (var i = 0; i < catalog.length; i++) {
        var entry = catalog[i];
        if (!entry || !entry.id) {
            console.warn('[FxDirector] Invalid catalog entry at index ' + i);
            continue;
        }
        this._effects[entry.id] = this._normalizeEffectEntry(entry);
    }
};

FxDirector.prototype._normalizeEffectEntry = function (entry) {
    var def = { id: entry.id };

    var shake = {};
    if (entry.trauma) {
        shake.trauma = entry.trauma;
    }
    if (entry.impulse) {
        shake.impulse = entry.impulse;
    }
    if (Object.keys(shake).length) {
        def.shake = shake;
    }

    if (entry.prefabs && entry.prefabs.length) {
        def.vfx = [];
        for (var i = 0; i < entry.prefabs.length; i++) {
            def.vfx.push({ prefab: entry.prefabs[i] });
        }
    }

    if (entry.sounds && entry.sounds.length) {
        def.sfx = [];
        for (var j = 0; j < entry.sounds.length; j++) {
            def.sfx.push({ key: entry.sounds[j] });
        }
    }

    if (entry.rumbleMagnitude) {
        def.rumble = {
            magnitude: entry.rumbleMagnitude,
            durationMs: entry.rumbleDurationMs || entry.rumbleDuration || 180
        };
    }

    return def;
};

FxDirector.prototype.registerEffect = function (definition) {
    if (!definition || !definition.id) {
        console.warn('[FxDirector] Attempted to register effect without id.');
        return;
    }
    this._effects[definition.id] = definition;
};

FxDirector.prototype.playEffect = function (idOrDefinition, overrides) {
    var definition = (typeof idOrDefinition === 'string')
        ? this._effects[idOrDefinition]
        : idOrDefinition;

    if (!definition) {
        console.warn('[FxDirector] No effect definition found for request:', idOrDefinition);
        return;
    }

    var runtime = overrides || {};
    var shakeCfg = this._mergeConfigs(definition.shake, runtime.shake);
    var vfxList = this._mergeArrays(definition.vfx, runtime.vfx);
    var sfxList = this._mergeArrays(definition.sfx, runtime.sfx);
    var rumbleCfg = this._mergeConfigs(definition.rumble, runtime.rumble);

    if (shakeCfg) {
        this._applyShake(shakeCfg);
    }
    if (vfxList && vfxList.length) {
        this._spawnVfx(vfxList, runtime);
    }
    if (sfxList && sfxList.length) {
        this._playSfx(sfxList, runtime);
    }
    if (rumbleCfg) {
        this._applyRumble(rumbleCfg);
    }
};

FxDirector.prototype._mergeConfigs = function (base, override) {
    if (!base && !override) {
        return null;
    }
    var result = {};
    var prop;
    if (base) {
        for (prop in base) {
            if (Object.prototype.hasOwnProperty.call(base, prop)) {
                result[prop] = base[prop];
            }
        }
    }
    if (override) {
        for (prop in override) {
            if (Object.prototype.hasOwnProperty.call(override, prop)) {
                result[prop] = override[prop];
            }
        }
    }
    return result;
};

FxDirector.prototype._mergeArrays = function (baseArr, overrideArr) {
    if (!baseArr && !overrideArr) {
        return null;
    }
    var out = [];
    if (baseArr && baseArr.length) {
        for (var i = 0; i < baseArr.length; i++) {
            out.push(baseArr[i]);
        }
    }
    if (overrideArr && overrideArr.length) {
        for (var j = 0; j < overrideArr.length; j++) {
            out.push(overrideArr[j]);
        }
    }
    return out;
};

FxDirector.prototype._resolveCameraShaker = function () {
    this._shaker = null;
    var target = this.cameraShakeEntity || this.entity;
    if (!target || !target.script) {
        return;
    }
    if (target.script.cameraShaker) {
        this._shaker = target.script.cameraShaker;
    } else if (target.findComponent) {
        var scriptComp = target.script;
        if (scriptComp && scriptComp.instances && scriptComp.instances.cameraShaker) {
            this._shaker = scriptComp.instances.cameraShaker;
        }
    }
};

FxDirector.prototype._applyShake = function (cfg) {
    if (!this._shaker || !this._shaker.entity.enabled) {
        this._resolveCameraShaker();
    }

    var trauma = cfg.trauma || 0;
    var impulse = cfg.impulse || 0;

    if (cfg.clear) {
        this._shaker.clearShake();
    }

    if (this._shaker) {
        if (impulse) {
            this._shaker.addImpulse(impulse);
        }
        if (trauma) {
            this._shaker.addTrauma(trauma);
        }
    }

    if (impulse) {
        this.app.fire('fx:shake:impulse', impulse);
    }
    if (trauma) {
        this.app.fire('fx:shake:addTrauma', trauma);
    }
};

FxDirector.prototype._spawnVfx = function (list, runtime) {
    var baseParent = this.spawnRoot || this.entity;
    for (var i = 0; i < list.length; i++) {
        var entry = list[i];
        if (!entry) {
            continue;
        }

        var prefab = entry.entity || this._prefabMap[entry.prefab];
        if (!prefab) {
            console.warn('[FxDirector] Missing prefab for VFX entry', entry);
            continue;
        }

        var count = entry.count || 1;
        for (var c = 0; c < count; c++) {
            var clone = prefab.clone();
            var parent = entry.parentEntity || baseParent;

            if (entry.worldSpace) {
                this.app.root.addChild(clone);
            } else {
                parent.addChild(clone);
            }

            clone.enabled = true;

            var pos = this._resolvePosition(entry, runtime);
            if (pos) {
                if (entry.worldSpace) {
                    clone.setPosition(pos);
                } else {
                    clone.setLocalPosition(pos);
                }
            }

            if (entry.rotation) {
                var rot = entry.rotation;
                var rx = rot.x || 0;
                var ry = rot.y || 0;
                var rz = rot.z || 0;
                if (entry.worldSpace) {
                    this._tmpQuat.setFromEulerAngles(rx, ry, rz);
                    clone.setRotation(this._tmpQuat);
                } else {
                    clone.setLocalEulerAngles(rx, ry, rz);
                }
            }

            var ps = clone.particlesystem || clone.particleSystem;
            if (ps && typeof ps.play === 'function') {
                ps.reset();
                ps.play();
            }

            var lifetime = entry.lifetime || entry.duration || 0;
            if (lifetime > 0) {
                this._queueDestroy(clone, lifetime);
            }
        }
    }
};

FxDirector.prototype._resolvePosition = function (entry, runtime) {
    var position = null;
    if (entry.position) {
        position = this._tmpVec.set(entry.position.x || 0, entry.position.y || 0, entry.position.z || 0);
    } else if (runtime && runtime.position) {
        position = runtime.position.clone ? this._tmpVec.copy(runtime.position) : this._tmpVec.set(
            runtime.position.x || 0,
            runtime.position.y || 0,
            runtime.position.z || 0
        );
    }

    if (!position) {
        if (entry.offset) {
            return this._tmpVec.set(entry.offset.x || 0, entry.offset.y || 0, entry.offset.z || 0);
        }
        return null;
    }

    if (entry.offset) {
        position.x += entry.offset.x || 0;
        position.y += entry.offset.y || 0;
        position.z += entry.offset.z || 0;
    }

    return position;
};

FxDirector.prototype._queueDestroy = function (entity, lifetimeSeconds) {
    var timer = setTimeout(function () {
        if (entity && !entity._destroyed) {
            entity.destroy();
        }
    }, Math.max(0, lifetimeSeconds) * 1000);
    this._timers.push(timer);
};

FxDirector.prototype._playSfx = function (list) {
    if (!this.soundEntity || !this.soundEntity.sound) {
        console.warn('[FxDirector] Sound entity with a Sound component is required to play audio.');
        return;
    }
    var sound = this.soundEntity.sound;
    for (var i = 0; i < list.length; i++) {
        var entry = list[i];
        if (!entry) {
            continue;
        }
        var key = entry.key || entry.slot;
        if (!key) {
            console.warn('[FxDirector] SFX entry missing key/slot field', entry);
            continue;
        }
        var asset = entry.asset || this._soundMap[key];
        if (!asset) {
            console.warn('[FxDirector] No audio asset found for key "' + key + '"');
            continue;
        }

        if (!sound.slots[key]) {
            sound.addSlot(key, {
                asset: asset.id,
                volume: entry.volume !== undefined ? entry.volume : 1,
                pitch: entry.pitch !== undefined ? entry.pitch : 1,
                loop: !!entry.loop,
                autoPlay: false,
                overlap: true
            });
        } else if (sound.slots[key].asset !== asset.id) {
            sound.slots[key].asset = asset.id;
        }

        var slot = sound.slots[key];
        slot.volume = entry.volume !== undefined ? entry.volume : slot.volume;
        if (entry.pitch !== undefined) {
            slot.pitch = entry.pitch;
        }
        if (entry.loop !== undefined) {
            slot.loop = entry.loop;
        }

        var playFn = function (s) {
            if (!s) return;
            if (entry.stopBeforePlay) {
                s.stop();
            }
            s.play();
        }.bind(this, slot);

        if (entry.delayMs && entry.delayMs > 0) {
            var timer = setTimeout(playFn, entry.delayMs);
            this._timers.push(timer);
        } else {
            playFn();
        }
    }
};

FxDirector.prototype._applyRumble = function (cfg) {
    if (!this.app.gamepads || typeof this.app.gamepads.rumble !== 'function') {
        return;
    }
    var index = cfg.index !== undefined ? cfg.index : 0;
    var magnitude = cfg.magnitude !== undefined ? cfg.magnitude : 0.35;
    var duration = cfg.durationMs || cfg.duration || 180;
    this.app.gamepads.rumble(index, pc.math.clamp(magnitude, 0, 1), Math.max(0, duration));
};
