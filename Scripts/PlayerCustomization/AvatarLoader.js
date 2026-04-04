/* global pc */
(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  var assetCache = new Map();
  var slotHistory = new Map();

  function touchSlot(slot, name) {
    var arr = slotHistory.get(slot);
    if (!arr) {
      arr = [];
      slotHistory.set(slot, arr);
    }
    var idx = arr.indexOf(name);
    if (idx !== -1) {
      arr.splice(idx, 1);
    }
    arr.push(name);
  }

  function pruneSlot(slot, limit) {
    var arr = slotHistory.get(slot);
    if (!arr || arr.length <= limit) return;
    var i = 0;
    while (arr.length > limit && i < arr.length) {
      var candidate = arr[i];
      var entry = assetCache.get(candidate);
      if (entry && entry.refCount > 0) {
        i++;
        continue;
      }
      arr.splice(i, 1);
      if (entry && entry.asset && entry.asset.resource) {
        entry.asset.unload();
      }
      assetCache.delete(candidate);
    }
  }

  function findTemplateAsset(app, name) {
    if (!name) return null;
    var trimmed = name.trim();
    if (!trimmed) return null;

    var asset = app.assets.find(trimmed, 'template');
    if (asset) return asset;

    asset = app.assets.find(trimmed);
    if (asset && asset.type === 'template') return asset;
    if (asset && asset.resource && typeof asset.resource.instantiate === 'function') {
      return asset;
    }

    if (typeof app.assets.list === 'function') {
      var lower = trimmed.toLowerCase();
      var list = app.assets.list();
      for (var i = 0; i < list.length; i++) {
        var candidate = list[i];
        if (!candidate || candidate.type !== 'template' || typeof candidate.name !== 'string') continue;
        if (candidate.name.toLowerCase() === lower) {
          return candidate;
        }
      }
    }

    return null;
  }

  function loadAsset(app, asset) {
    return new Promise(function (resolve, reject) {
      if (!asset) {
        reject(new Error('Template asset not found.'));
        return;
      }
      if (asset.resource) {
        resolve(asset);
        return;
      }
      function cleanup() {
        asset.off('load', onLoad);
        asset.off('error', onError);
      }
      function onLoad(loaded) {
        cleanup();
        resolve(loaded);
      }
      function onError(err) {
        cleanup();
        reject(err || new Error('Failed to load avatar template.'));
      }
      asset.once('load', onLoad);
      asset.once('error', onError);
      app.assets.load(asset);
    });
  }

  function stripEmbeddedSkeleton(entity) {
    if (!entity) return;
    var animComponents = entity.findComponents('anim');
    for (var i = 0; i < animComponents.length; i++) {
      var compEntity = animComponents[i].entity;
      if (compEntity && compEntity.removeComponent) {
        compEntity.removeComponent('anim');
      }
    }
  }

  function retargetToArmature(entity, armature) {
    if (!entity || !armature) return;
    var renders = entity.findComponents('render');
    for (var i = 0; i < renders.length; i++) {
      renders[i].rootBone = armature;
    }
  }

  function AvatarLoader(app, playerEntity, anchors, catalog, options) {
    this.app = app;
    this.player = playerEntity;
    this.anchors = anchors;
    this.catalog = catalog || null;
    this.options = options || {};
    this.currentNames = { head: null, body: null, legs: null, feet: null };
    this._slotEntries = { head: null, body: null, legs: null, feet: null };
    this._slotEntities = { head: null, body: null, legs: null, feet: null };
    this._slotOps = { head: 0, body: 0, legs: 0, feet: 0 };
  }

  AvatarLoader.prototype.list = function (slot) {
      return (this.catalog && this.catalog.slots && this.catalog.slots[slot]) || [];
  };

  AvatarLoader.prototype.prefetch = async function (slot, name) {
    if (!name) return;
    var entry = assetCache.get(name);
    if (entry && entry.asset && entry.asset.resource) {
      return;
    }
    var asset = findTemplateAsset(this.app, name);
    if (!asset) {
      console.warn('AvatarLoader: prefetch skipped, template not found', slot, name);
      return;
    }
    try {
      var loaded = await loadAsset(this.app, asset);
      entry = assetCache.get(name);
      if (entry) {
        entry.asset = loaded;
        entry.lastUsed = Date.now();
      } else {
        assetCache.set(name, { asset: loaded, refCount: 0, lastUsed: Date.now() });
      }
      touchSlot(slot, name);
    } catch (err) {
      console.warn('AvatarLoader: prefetch failed', slot, name, err);
    }
  };

  AvatarLoader.prototype.equip = async function (slot, name) {
    if (!slot) throw new Error('AvatarLoader.equip: slot is required.');
    if (!name) throw new Error('AvatarLoader.equip: template name is required.');
    if (!this.anchors || !this.anchors[slot]) {
      throw new Error("AvatarLoader.equip: anchor for slot '" + slot + "' is missing.");
    }

    if (this.currentNames[slot] === name) {
      return name;
    }

    var opId = ++this._slotOps[slot];
    var entry;
    try {
      entry = await this._acquireAsset(slot, name);
    } catch (err) {
      if (this._slotOps[slot] === opId) this._slotOps[slot]--;
      console.error('AvatarLoader: failed to acquire asset', slot, name, err);
      throw err;
    }

    if (this._slotOps[slot] !== opId) {
      this._releaseEntry(slot, entry);
      return null;
    }

    var instance = entry.asset.resource.instantiate();
    instance.enabled = true;
    instance.name = slot + '_' + name;
    stripEmbeddedSkeleton(instance);
    retargetToArmature(instance, this.anchors.rootBone || this.anchors.armature || this.anchors);

    this._replaceSlot(slot, instance, entry, name);
    touchSlot(slot, name);
    pruneSlot(slot, this._cacheLimit());
    return name;
  };

  AvatarLoader.prototype.applyRecipe = async function (recipe) {
    if (!recipe) return;
    var tasks = [];
    for (var slot in this.currentNames) {
      if (!Object.prototype.hasOwnProperty.call(this.currentNames, slot)) continue;
      if (recipe[slot]) {
        tasks.push(this.equip(slot, recipe[slot]));
      }
    }
    await Promise.all(tasks);
  };

  AvatarLoader.prototype.getRecipeSnapshot = function () {
    return {
      head: this.currentNames.head,
      body: this.currentNames.body,
      legs: this.currentNames.legs,
      feet: this.currentNames.feet
    };
  };

  AvatarLoader.prototype.destroy = function () {
    var self = this;
    ['head', 'body', 'legs', 'feet'].forEach(function (slot) {
      self._clearSlot(slot);
    });
    this.player = null;
  };

  AvatarLoader.prototype._cacheLimit = function () {
    var constants = (scope && scope.PlayerCustomization) || {};
    var cacheConfig = constants.CACHE || { perSlotKeep: 6 };
    return Math.max(1, cacheConfig.perSlotKeep || 6);
  };

  AvatarLoader.prototype._acquireAsset = async function (slot, name) {
    var entry = assetCache.get(name);
    if (!entry || !entry.asset || !entry.asset.resource) {
      var asset = findTemplateAsset(this.app, name);
      if (!asset) {
        throw new Error('Template not found: ' + name);
      }
      var loaded = await loadAsset(this.app, asset);
      var currentEntry = assetCache.get(name);
      if (currentEntry) {
        currentEntry.asset = loaded;
        entry = currentEntry;
      } else {
        entry = { asset: loaded, refCount: 0, lastUsed: Date.now() };
        assetCache.set(name, entry);
      }
    }
    entry.refCount += 1;
    entry.lastUsed = Date.now();
    return entry;
  };

  AvatarLoader.prototype._releaseEntry = function (slot, entry) {
    if (!entry) return;
    entry.refCount = Math.max(0, (entry.refCount || 1) - 1);
    entry.lastUsed = Date.now();
    pruneSlot(slot, this._cacheLimit());
  };

  AvatarLoader.prototype._replaceSlot = function (slot, instance, entry, requestedName) {
    var anchor = this.anchors[slot];
    if (!anchor) {
      console.warn("AvatarLoader: Missing anchor for slot '" + slot + "'.");
      instance.destroy();
      this._releaseEntry(slot, entry);
      return;
    }

    var oldEntity = this._slotEntities[slot];
    var oldEntry = this._slotEntries[slot];

    if (instance.parent) {
      instance.parent.removeChild(instance);
    }
    anchor.addChild(instance);

    this._slotEntities[slot] = instance;
    this._slotEntries[slot] = entry;
    this.currentNames[slot] = requestedName || (entry.asset && entry.asset.name) || null;

    if (oldEntity && !oldEntity.destroyed) {
      // Defer destruction to prevent a flicker where the avatar is invisible.
      setTimeout(function () {
        if (oldEntity && !oldEntity.destroyed) {
          oldEntity.destroy();
        }
      }, 0);
    }
    if (oldEntry && oldEntry !== entry) {
      this._releaseEntry(slot, oldEntry);
    }
  };

  AvatarLoader.prototype._clearSlot = function (slot) {
    var entity = this._slotEntities[slot];
    if (entity && !entity.destroyed) {
      entity.destroy();
    }
    var entry = this._slotEntries[slot];
    if (entry) {
      this._releaseEntry(slot, entry);
    }
    this._slotEntities[slot] = null;
    this._slotEntries[slot] = null;
    this.currentNames[slot] = null;
  };

  scope.PlayerCustomization = scope.PlayerCustomization || {};
  scope.PlayerCustomization.AvatarLoader = AvatarLoader;
  scope.AvatarLoader = scope.AvatarLoader || AvatarLoader;
})();
