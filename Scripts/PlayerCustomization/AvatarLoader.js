/* global pc */
(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  var assetCache = new Map();
  var slotHistory = new Map();
  var rpmAssetCache = new Map();
  var rpmAssetId = 0;

  var HEAD_BONE_NAMES = [
    'Head',
    'head',
    'mixamorig:Head',
    'Wolf3D_Head',
    'HeadTop_End',
    'HeadTop'
  ];

  var NECK_BONE_NAMES = [
    'Neck',
    'neck',
    'mixamorig:Neck',
    'Wolf3D_Neck',
    'Neck1',
    'NeckTop'
  ];

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

  function sanitizeAvatarId(id) {
    if (typeof id !== 'string') return null;
    var trimmed = id.trim();
    if (!trimmed) return null;
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
    return trimmed;
  }

  function resolveDeviceTier() {
    var isMobile = false;
    if (pc.platform && typeof pc.platform.mobile === 'boolean') {
      isMobile = pc.platform.mobile;
    } else if (pc.platform && typeof pc.platform.touch === 'boolean') {
      isMobile = pc.platform.touch;
    } else {
      var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
      isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    }
    return isMobile ? 'mobile' : 'desktop';
  }

  var LOD_CONFIG = {
    desktop: [
      { tier: 'near', max: 8, preset: { lod: 0, textureAtlas: 1024, textureSizeLimit: 1024, textureFormat: 'webp' } },
      { tier: 'mid', max: 20, preset: { lod: 1, textureAtlas: 512, textureSizeLimit: 512, textureFormat: 'webp' } },
      { tier: 'far', max: Infinity, preset: { lod: 2, textureAtlas: 256, textureSizeLimit: 256, textureFormat: 'webp' } }
    ],
    mobile: [
      { tier: 'near', max: 6, preset: { lod: 1, textureAtlas: 512, textureSizeLimit: 512, textureFormat: 'webp' } },
      { tier: 'mid', max: 15, preset: { lod: 2, textureAtlas: 256, textureSizeLimit: 256, textureFormat: 'webp' } },
      { tier: 'far', max: Infinity, preset: { lod: 2, textureAtlas: 256, textureSizeLimit: 256, textureFormat: 'webp' } }
    ]
  };

  var LOD_HYSTERESIS = {
    desktop: 2,
    mobile: 1.5
  };

  function choosePreset(deviceTier, tierName) {
    var platform = deviceTier || resolveDeviceTier();
    var config = LOD_CONFIG[platform] || LOD_CONFIG.desktop;
    if (tierName) {
      for (var i = 0; i < config.length; i++) {
        if (config[i].tier === tierName) {
          return config[i].preset;
        }
      }
    }
    return config[0].preset;
  }

  function buildAvatarUrl(avatarId, preset, baseUrl) {
    var id = sanitizeAvatarId(avatarId);
    if (!id) {
      throw new Error('AvatarLoader: avatarId is required.');
    }
    var base = typeof baseUrl === 'string' && baseUrl.indexOf(id) !== -1
      ? baseUrl
      : 'https://models.readyplayer.me/' + id + '.glb';
    var url;
    try {
      url = new URL(base);
    } catch (err) {
      url = new URL(base, window.location.origin);
    }
    url.searchParams.set('useDracoMeshCompression', 'true');
    if (preset && typeof preset === 'object') {
      if (preset.textureFormat) url.searchParams.set('textureFormat', preset.textureFormat);
      if (preset.textureAtlas) url.searchParams.set('textureAtlas', preset.textureAtlas);
      if (preset.textureSizeLimit) url.searchParams.set('textureSizeLimit', preset.textureSizeLimit);
      if (preset.lod !== undefined && preset.lod !== null) url.searchParams.set('lod', preset.lod);
    }
    return url.toString();
  }

  function findFirstByNames(root, names) {
    if (!root || !names || !names.length) return null;
    for (var i = 0; i < names.length; i++) {
      var bone = root.findByName(names[i]);
      if (bone) return bone;
    }
    // fallback: case-insensitive search
    var queue = [root];
    while (queue.length) {
      var node = queue.shift();
      if (node && node.name) {
        var lower = node.name.toLowerCase();
        for (var j = 0; j < names.length; j++) {
          if (lower === names[j].toLowerCase()) {
            return node;
          }
        }
      }
      for (var c = 0; node && c < node.children.length; c++) {
        queue.push(node.children[c]);
      }
    }
    return null;
  }

  function collectChildMeshes(entity) {
    var meshes = [];
    if (!entity) return meshes;
    var renders = entity.findComponents('render');
    for (var i = 0; i < renders.length; i++) {
      var comp = renders[i];
      if (!comp.meshInstances) continue;
      for (var m = 0; m < comp.meshInstances.length; m++) {
        meshes.push(comp.meshInstances[m]);
      }
    }
    return meshes;
  }

  function loadRpmAsset(app, url, avatarId) {
    return new Promise(function (resolve, reject) {
      var cacheEntry = rpmAssetCache.get(url);
      if (cacheEntry && cacheEntry.asset && cacheEntry.asset.resource) {
        cacheEntry.refCount += 1;
        cacheEntry.lastUsed = Date.now();
        resolve(cacheEntry);
        return;
      }

      var assetName = 'rpm-avatar-' + (avatarId || '') + '-' + (++rpmAssetId);
      var asset = new pc.Asset(assetName, 'container', { url: url });
      asset.preload = false;

      function cleanup() {
        asset.off('load', onLoad);
        asset.off('error', onError);
      }

      function onLoad(loaded) {
        cleanup();
        var entry = rpmAssetCache.get(url);
        if (!entry) {
          entry = { asset: loaded, refCount: 0, url: url, lastUsed: Date.now() };
          rpmAssetCache.set(url, entry);
        }
        entry.asset = loaded;
        entry.refCount += 1;
        entry.lastUsed = Date.now();
        resolve(entry);
      }

      function onError(err) {
        cleanup();
        if (asset.registry) {
          asset.registry.remove(asset);
        }
        reject(err || new Error('Failed to load RPM avatar.'));
      }

      asset.once('load', onLoad);
      asset.once('error', onError);
      app.assets.add(asset);
      app.assets.load(asset);
    });
  }

  function releaseRpmAsset(url, entry) {
    if (!entry) return;
    entry.refCount = Math.max(0, (entry.refCount || 1) - 1);
    entry.lastUsed = Date.now();
    if (entry.refCount === 0) {
      // Keep asset cached for reuse; do not unload immediately.
      return;
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
    this.feedbackService = (app && app.services && typeof app.services.get === 'function') ? app.services.get('feedbackService') : null;
    this.avatarRoot = null;
    this.currentAvatar = null;
    this._rpmLoadToken = 0;
    this._pendingDescriptor = null;
    this.deviceTier = resolveDeviceTier();
    this.baseDescriptor = null;
    this.renderOptions = { castShadows: true, receiveShadows: true };
    this.lodState = {
      currentTier: null,
      pendingTier: null,
      lastDistance: Infinity,
      lastCheck: 0,
      lastLoadedKey: null
    };
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
    if (this.currentAvatar) {
      this._destroyCurrentAvatar();
    }
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

  AvatarLoader.prototype.applyAvatar = async function (descriptor, options) {
    options = options || {};
    if (!descriptor || !descriptor.avatarId) {
      console.warn('AvatarLoader: applyAvatar called without a valid descriptor.', descriptor);
      return Promise.reject(new Error('avatarId missing'));
    }

    var avatarId = sanitizeAvatarId(descriptor.avatarId);
    if (!avatarId) {
      return Promise.reject(new Error('AvatarLoader: Invalid avatarId.'));
    }

    var initialTier = typeof options.initialTier === 'string' ? options.initialTier : 'near';
    var preset = choosePreset(this.deviceTier, initialTier);
    if (options.preset && typeof options.preset === 'object') {
      preset = Object.assign({}, preset, options.preset);
    }

    var toastHandle = options.quiet ? null : this._showApplyingToast();
    var token = ++this._rpmLoadToken;
    var renderOptions = {
      castShadows: options.castShadows !== false,
      receiveShadows: options.receiveShadows !== false
    };

    var baseDescriptor = {
      avatarId: avatarId,
      url: descriptor.url || descriptor.baseUrl || null,
      userId: descriptor.userId || null,
      version: typeof descriptor.version === 'number' ? descriptor.version : 1
    };

    try {
      var variant = await this._loadVariantForPreset(baseDescriptor, preset, renderOptions);
      if (this._rpmLoadToken !== token) {
        this._cleanupVariant(variant);
        return;
      }

      this.baseDescriptor = baseDescriptor;
      this.renderOptions = renderOptions;
      this._swapCurrentAvatar(variant);

      this.lodState.currentTier = initialTier;
      this.lodState.pendingTier = null;
      this.lodState.lastLoadedKey = variant.presetKey || null;
      this.lodState.lastDistance = 0;
      this.lodState.lastCheck = Date.now();

      if (!options.quiet) {
        this._notifyApplied(toastHandle);
      }
      return { avatarId: avatarId, url: variant.url };
    } catch (err) {
      this._handleApplyError(err, toastHandle);
      throw err;
    }
  };

  AvatarLoader.prototype._applyRenderSettings = function (entity, options) {
    var castShadows = options.castShadows !== false;
    var receiveShadows = options.receiveShadows !== false;
    var meshes = collectChildMeshes(entity);
    for (var i = 0; i < meshes.length; i++) {
      meshes[i].castShadow = castShadows;
      meshes[i].receiveShadow = receiveShadows;
    }
  };

  AvatarLoader.prototype._prepareAnchors = function (modelEntity) {
    if (!this.player) return;
    if (!this.anchors || !this.anchors.rootBone) {
      var ensureFn = scope.PlayerCustomization && scope.PlayerCustomization.ensureAvatarAnchors;
      if (typeof ensureFn === 'function') {
        this.anchors = ensureFn(this.player, {});
      }
    }
    var updateFn = scope.PlayerCustomization && scope.PlayerCustomization.updateAvatarAnchors;
    if (typeof updateFn === 'function') {
      updateFn(this.anchors, modelEntity, {
        headNames: HEAD_BONE_NAMES,
        neckNames: NECK_BONE_NAMES
      });
    }
  };

  AvatarLoader.prototype._updatePlayerVisuals = function (modelEntity, avatarId) {
    if (!this.player) return;

    var animTarget = (function findAnim(e) {
      if (!e) return null;
      if (e.anim) return e;
      for (var i = 0; i < e.children.length; i++) {
        var found = findAnim(e.children[i]);
        if (found) return found;
      }
      return null;
    })(modelEntity);

    this.player.animTarget = animTarget || modelEntity;
    this.player.currentAvatarId = avatarId;

    if (this.player.script) {
      if (this.player.script.playerMovement && typeof this.player.script.playerMovement.onAvatarModelUpdated === 'function') {
        this.player.script.playerMovement.onAvatarModelUpdated({
          model: modelEntity,
          animTarget: this.player.animTarget,
          avatarId: avatarId
        });
      }
      if (this.player.script.playerAnimation && typeof this.player.script.playerAnimation.onAvatarModelUpdated === 'function') {
        this.player.script.playerAnimation.onAvatarModelUpdated({
          model: modelEntity,
          animTarget: this.player.animTarget,
          avatarId: avatarId
        });
      }
    }

    if (typeof this.player === 'object') {
      if (this.player.remoteVisualRoot !== undefined) {
        this.player.remoteVisualRoot = modelEntity;
      }
      if (this.player.remoteBaseLocalRot !== undefined && modelEntity.getLocalRotation) {
        this.player.remoteBaseLocalRot = modelEntity.getLocalRotation().clone();
      }
    }

    if (typeof this.player.fire === 'function') {
      this.player.fire('avatar:model:updated', {
        model: modelEntity,
        animTarget: this.player.animTarget,
        avatarId: avatarId
      });
    }
  };

  AvatarLoader.prototype._presetKey = function (preset) {
    if (!preset || typeof preset !== 'object') {
      return 'default';
    }
    var parts = [];
    if (preset.lod !== undefined) parts.push('lod:' + preset.lod);
    if (preset.textureAtlas) parts.push('atlas:' + preset.textureAtlas);
    if (preset.textureSizeLimit) parts.push('size:' + preset.textureSizeLimit);
    if (preset.textureFormat) parts.push('fmt:' + preset.textureFormat);
    return parts.join('|') || 'default';
  };

  AvatarLoader.prototype._cleanupVariant = function (variant) {
    if (!variant) return;
    if (variant.entity && !variant.entity.destroyed) {
      try {
        variant.entity.destroy();
      } catch (err) {
        console.warn('AvatarLoader: failed to destroy variant entity', err);
      }
    }
    if (variant.entry) {
      try {
        releaseRpmAsset(variant.url, variant.entry);
      } catch (err) {
        console.warn('AvatarLoader: failed to release variant asset', err);
      }
    }
  };

  AvatarLoader.prototype._loadVariantForPreset = async function (descriptor, preset, renderOptions) {
    var url = buildAvatarUrl(descriptor.avatarId, preset, descriptor.url);
    var entry = await loadRpmAsset(this.app, url, descriptor.avatarId);
    var container = entry.asset && entry.asset.resource;
    if (!container || typeof container.instantiateRenderEntity !== 'function') {
      releaseRpmAsset(url, entry);
      throw new Error('AvatarLoader: RPM asset missing render entity.');
    }

    var entity = container.instantiateRenderEntity({
      castShadows: renderOptions.castShadows,
      receiveShadows: renderOptions.receiveShadows
    });
    entity.enabled = false;
    entity.name = 'RPMAvatar';
    entity.tags.add('rpm-avatar');

    var root = this._ensureAvatarRoot();
    if (entity.parent) {
      entity.parent.removeChild(entity);
    }
    root.addChild(entity);
    entity.setLocalPosition(0, 0, 0);
    entity.setLocalEulerAngles(0, 0, 0);
    entity.setLocalScale(1, 1, 1);

    this._applyRenderSettings(entity, renderOptions);
    this._prepareAnchors(entity, renderOptions);
    this._updatePlayerVisuals(entity, descriptor.avatarId);

    return {
      entity: entity,
      entry: entry,
      url: url,
      avatarId: descriptor.avatarId,
      presetKey: this._presetKey(preset)
    };
  };

  AvatarLoader.prototype._determineLodTier = function (distance) {
    var platform = this.deviceTier === 'mobile' ? 'mobile' : 'desktop';
    var config = LOD_CONFIG[platform] || LOD_CONFIG.desktop;
    var hysteresis = LOD_HYSTERESIS[platform] || 2;
    var lastTier = this.lodState.currentTier || config[0].tier;
    var tierIndex = {};
    for (var i = 0; i < config.length; i++) {
      tierIndex[config[i].tier] = i;
    }

    var target = config[config.length - 1].tier;
    for (var j = 0; j < config.length; j++) {
      var entry = config[j];
      var compareDistance = distance;
      var lastIndex = tierIndex[lastTier];
      if (lastIndex < j) {
        compareDistance = distance - hysteresis;
      } else if (lastIndex > j) {
        compareDistance = distance + hysteresis;
      }
      if (compareDistance <= entry.max) {
        target = entry.tier;
        break;
      }
    }
    return target;
  };

  AvatarLoader.prototype.updateLodIfNeeded = function (distance, options) {
    if (!this.baseDescriptor || !this.currentAvatar) {
      return;
    }
    options = options || {};
    var now = Date.now();
    var minInterval = options.force ? 0 : 320;
    if (now - this.lodState.lastCheck < minInterval) {
      return;
    }
    this.lodState.lastCheck = now;
    if (Number.isFinite(distance)) {
      this.lodState.lastDistance = distance;
    } else {
      distance = this.lodState.lastDistance;
    }

    var targetTier = this._determineLodTier(distance);
    if (targetTier === this.lodState.currentTier || targetTier === this.lodState.pendingTier) {
      return;
    }

    var preset = choosePreset(this.deviceTier, targetTier);
    var presetKey = this._presetKey(preset);
    if (presetKey === this.lodState.lastLoadedKey) {
      this.lodState.currentTier = targetTier;
      this.lodState.pendingTier = null;
      return;
    }

    var self = this;
    this.lodState.pendingTier = targetTier;
    this._loadVariantForPreset(this.baseDescriptor, preset, this.renderOptions).then(function (variant) {
      self._swapCurrentAvatar(variant);
      self.lodState.currentTier = targetTier;
      self.lodState.lastLoadedKey = variant.presetKey;
    }).catch(function (err) {
      console.warn('AvatarLoader: Failed to update LOD variant', err);
    }).finally(function () {
      if (self.lodState.pendingTier === targetTier) {
        self.lodState.pendingTier = null;
      }
    });
  };

  AvatarLoader.prototype._swapCurrentAvatar = function (next) {
    var previous = this.currentAvatar;
    this.currentAvatar = next || null;
    if (this.currentAvatar) {
      this.currentAvatar.presetKey = this.currentAvatar.presetKey || (next ? next.presetKey || null : null);
    }
    var self = this;
    this.app.once('prerender', function () {
      if (previous && previous.entity && !previous.entity.destroyed) {
        previous.entity.destroy();
        releaseRpmAsset(previous.url, previous.entry);
      }
      if (next && next.entity && !next.entity.destroyed) {
        next.entity.enabled = true;
      }
    });
  };

  AvatarLoader.prototype._destroyCurrentAvatar = function () {
    if (!this.currentAvatar) return;
    var current = this.currentAvatar;
    this.currentAvatar = null;
    if (current.entity && !current.entity.destroyed) {
      current.entity.destroy();
    }
    releaseRpmAsset(current.url, current.entry);
    this.baseDescriptor = null;
    this.lodState.currentTier = null;
    this.lodState.lastLoadedKey = null;
    this.lodState.pendingTier = null;
    this.lodState.lastDistance = Infinity;
  };

  AvatarLoader.prototype._ensureAvatarRoot = function () {
    if (this.avatarRoot && !this.avatarRoot.destroyed) {
      return this.avatarRoot;
    }
    var root = this.player && this.player.findByName && this.player.findByName('AvatarModelRoot');
    if (!root && this.player) {
      root = new pc.Entity('AvatarModelRoot');
      root.setLocalPosition(0, 0, 0);
      root.setLocalEulerAngles(0, 0, 0);
      root.setLocalScale(1, 1, 1);
      this.player.addChild(root);
    }
    if (this.player) {
      var legacyArmature = this.player.findByName && this.player.findByName('Armature');
      if (legacyArmature && legacyArmature !== root) {
        legacyArmature.enabled = false;
      }
      var legacyWolf = this.player.findByName && this.player.findByName('Wolf3D_Avatar');
      if (legacyWolf) {
        legacyWolf.enabled = false;
      }
    }
    this.avatarRoot = root || this.player;
    return this.avatarRoot;
  };

  AvatarLoader.prototype._showApplyingToast = function () {
    if (!this.feedbackService || typeof this.feedbackService.showInfo !== 'function') {
      return null;
    }
    try {
      this.feedbackService.showInfo('Applying avatar...', 3000);
      return true;
    } catch (err) {
      console.warn('AvatarLoader: Failed to show applying toast.', err);
      return null;
    }
  };

  AvatarLoader.prototype._notifyApplied = function (toastShown) {
    if (!this.feedbackService) return;
    if (typeof this.feedbackService.showSuccess === 'function') {
      this.feedbackService.showSuccess('Avatar updated', 2500);
    } else if (!toastShown && typeof this.feedbackService.showInfo === 'function') {
      this.feedbackService.showInfo('Avatar updated', 2500);
    }
  };

  AvatarLoader.prototype._handleApplyError = function (error, toastShown) {
    if (!this.feedbackService) return;
    var message = (error && error.message) ? error.message : 'Avatar update failed';
    if (typeof this.feedbackService.showError === 'function') {
      this.feedbackService.showError('Avatar Error', message, false);
    } else if (!toastShown && typeof this.feedbackService.showInfo === 'function') {
      this.feedbackService.showInfo(message, 4000);
    }
  };

  scope.PlayerCustomization = scope.PlayerCustomization || {};
  scope.PlayerCustomization.AvatarLoader = AvatarLoader;
  scope.AvatarLoader = scope.AvatarLoader || AvatarLoader;
})();
