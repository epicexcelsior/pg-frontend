(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  var FALLBACK_SLOTS = ["head", "body", "legs", "feet"];
  var FALLBACK_DEFAULTS = {
    version: 1,
    gender: "unisex",
    head: "Casual_Head",
    body: "Casual_Body",
    legs: "Casual_Legs",
    feet: "Casual_Feet"
  };
  var FALLBACK_NET = { rateLimitMs: 1000 };
  var FALLBACK_CACHE = { perSlotKeep: 6, prefetchCount: 2 };

  function ns() {
    scope.PlayerCustomization = scope.PlayerCustomization || {};
    return scope.PlayerCustomization;
  }

  function clampIndex(idx, total) {
    if (!total) return 0;
    return (idx % total + total) % total;
  }

  function cloneRecipe(recipe) {
    recipe = recipe || {};
    return {
      version: recipe.version || 1,
      gender: recipe.gender || 'unisex',
      head: recipe.head || null,
      body: recipe.body || null,
      legs: recipe.legs || null,
      feet: recipe.feet || null
    };
  }

  function AvatarController(app, playerEntity, catalog, uiBridge, options) {
    options = options || {};
    var namespace = ns();
    var ensureAnchors = namespace.ensureAvatarAnchors;
    var LoaderCtor = namespace.AvatarLoader;

    if (typeof ensureAnchors !== 'function') {
      throw new Error('AvatarController: ensureAvatarAnchors not available.');
    }
    if (typeof LoaderCtor !== 'function') {
      throw new Error('AvatarController: AvatarLoader not available.');
    }

    this.app = app;
    this.player = playerEntity;
    this.catalog = catalog || { slots: {} };
    this.ui = uiBridge || null;
    this.options = options;
    this.slots = (namespace.AVATAR_SLOTS || FALLBACK_SLOTS).slice();
    this.defaults = namespace.DEFAULTS || FALLBACK_DEFAULTS;
    this.net = namespace.NET || FALLBACK_NET;
    this.cache = namespace.CACHE || FALLBACK_CACHE;
    this.anchors = ensureAnchors(playerEntity, options.anchorOptions || {});
    this.loader = new LoaderCtor(app, playerEntity, this.anchors, catalog, options.loaderOptions || {});
    this.indexes = {};
    this.savedRecipe = null;
    this.lastApplyTs = 0;
    this.slotLocks = {};

    this._wireUi();
  }

  AvatarController.prototype.init = async function (initialRecipe) {
    var recipe = cloneRecipe(initialRecipe || this.catalog.defaults || this.defaults);
    await this.loader.applyRecipe(recipe).catch(function (err) {
      console.error('AvatarController: failed to apply initial recipe', recipe, err);
      throw err;
    });
    this.savedRecipe = cloneRecipe(recipe);
    this._syncIndexesFromRecipe(recipe);
    this._refreshUiSelections();
    this._prefetchAll();
    return recipe;
};

  AvatarController.prototype.list = function (slot) {
      return this.loader.list(slot) || [];
  };

  AvatarController.prototype.getRecipe = function () {
    var current = this.loader.getRecipeSnapshot();
    return {
      version: 1,
      gender: (this.savedRecipe && this.savedRecipe.gender) || 'unisex',
      head: current.head,
      body: current.body,
      legs: current.legs,
      feet: current.feet
    };
  };

  AvatarController.prototype.setRecipe = async function (recipe, opts) {
    opts = opts || {};
    if (!recipe) return;
    var cloned = cloneRecipe(recipe);
    var self = this;
    await Promise.all(this.slots.map(function (slot) {
      return self._withSlotBusy(slot, function () {
        var list = self.list(slot);
        if (!list.length) return Promise.resolve();
        var target = cloned[slot] || list[0];
        cloned[slot] = target;
        return self.loader.equip(slot, target).catch(function (err) {
          console.error('AvatarController: equip failed', slot, target, err);
          throw err;
        });
      });
    }));
    this._syncIndexesFromRecipe(cloned);
    if (!opts.silent) this._refreshUiSelections();
    if (opts.markApplied) {
      this.savedRecipe = cloneRecipe(cloned);
    }
    this._prefetchAll();
    return cloned;
  };

  AvatarController.prototype._cycle = async function (slot, direction) {
      var list = this.list(slot);
      if (!list.length) return null;
      var current = typeof this.indexes[slot] === 'number' ? this.indexes[slot] : 0;
      var nextIndex = clampIndex(current + direction, list.length);
    var name = list[nextIndex];
    var self = this;
    await this._withSlotBusy(slot, function () {
      return self.loader.equip(slot, name).catch(function (err) {
        console.error('AvatarController: equip failed while cycling', slot, name, err);
      });
    });
    this.indexes[slot] = nextIndex;
    this._refreshUiSelection(slot);
    this._prefetchNeighbors(slot, nextIndex);
    return name;
  };

  AvatarController.prototype.apply = function () {
    var now = Date.now();
    if (now - this.lastApplyTs < this.net.rateLimitMs) {
      if (this.ui && this.ui.showRateLimit) {
        this.ui.showRateLimit(this.net.rateLimitMs - (now - this.lastApplyTs));
      }
      return false;
    }
    this.lastApplyTs = now;
    var recipe = this.getRecipe();
    this.savedRecipe = cloneRecipe(recipe);
    if (this.options.onApply) {
      this.options.onApply(recipe);
    }
    this.app.fire('avatar:apply', recipe);
    return true;
  };

  AvatarController.prototype.cancel = async function () {
    if (!this.savedRecipe) return;
    await this.setRecipe(this.savedRecipe, { markApplied: false }).catch(function (err) {
      console.error('AvatarController: cancel restore failed', err);
    });
    if (this.options.onCancel) this.options.onCancel(this.savedRecipe);
    this.app.fire('avatar:cancel', this.savedRecipe);
};

AvatarController.prototype.destroy = function () {
    this.loader.destroy();
    this.ui = null;
  };

  AvatarController.prototype._prefetchAll = function () {
    var self = this;
    this.slots.forEach(function (slot) {
      var list = self.list(slot);
      if (!list.length) return;
      var index = typeof self.indexes[slot] === 'number' ? self.indexes[slot] : 0;
      self._prefetchNeighbors(slot, index);
    });
  };

  AvatarController.prototype._prefetchNeighbors = function (slot, centerIndex) {
      var list = this.list(slot);
      if (!list.length || typeof this.loader.prefetch !== 'function') return;

      var total = list.length;
      if (total <= 1) return;

      var prefetchCount = (this.cache && typeof this.cache.prefetchCount === 'number') ? this.cache.prefetchCount : 2;
      if (prefetchCount <= 0) return;

      var uniqueNames = new Set();
      var centerName = list[centerIndex];
      if (centerName) {
          uniqueNames.add(centerName);
      }

      var tasks = [];

      for (var i = 1; i <= prefetchCount; i++) {
          var prevIndex = clampIndex(centerIndex - i, total);
          var nextIndex = clampIndex(centerIndex + i, total);
          var prevName = list[prevIndex];
          var nextName = list[nextIndex];

          if (prevName && !uniqueNames.has(prevName)) {
              uniqueNames.add(prevName);
              tasks.push(this.loader.prefetch(slot, prevName));
          }
          if (nextName && !uniqueNames.has(nextName)) {
              uniqueNames.add(nextName);
              tasks.push(this.loader.prefetch(slot, nextName));
          }
      }

      if (tasks.length > 0) {
          Promise.all(tasks).catch(function (err) {
              console.warn('AvatarController: prefetch batch failed', err);
          });
      }
  };

  AvatarController.prototype._wireUi = function () {
    var self = this;
    if (!this.ui) return;
    this.slots.forEach(function (slot) {
      if (self.ui.onNext) {
        self.ui.onNext(slot, function () { self._cycle(slot, +1); });
      }
      if (self.ui.onPrev) {
        self.ui.onPrev(slot, function () { self._cycle(slot, -1); });
      }
    });
    if (this.ui.onApply) {
      this.ui.onApply(function () { self.apply(); });
    }
    if (this.ui.onCancel) {
        this.ui.onCancel(function () { self.cancel(); });
    }
};

  AvatarController.prototype._syncIndexesFromRecipe = function (recipe) {
    var self = this;
    this.slots.forEach(function (slot) {
      var list = self.list(slot);
      if (!list.length) {
        self.indexes[slot] = -1;
        return;
      }
      var name = recipe[slot];
      var idx = name ? list.indexOf(name) : -1;
      self.indexes[slot] = idx >= 0 ? idx : 0;
    });
  };

  AvatarController.prototype._refreshUiSelections = function () {
    var self = this;
    this.slots.forEach(function (slot) { self._refreshUiSelection(slot); });
    if (this.ui && this.ui.setRecipe) {
      this.ui.setRecipe(this.getRecipe());
    }
  };

  AvatarController.prototype._refreshUiSelection = function (slot) {
    if (!this.ui || !this.ui.setSelection) return;
    var list = this.list(slot);
    var idx = typeof this.indexes[slot] === 'number' ? this.indexes[slot] : 0;
    this.ui.setSelection(slot, {
      index: idx,
      total: list.length,
      name: list[idx] || null
    });
  };

  AvatarController.prototype._withSlotBusy = async function (slot, fn) {
    if (!fn) return;
    if (this.slotLocks[slot]) {
      await this.slotLocks[slot];
    }
    var promise = Promise.resolve().then(fn);
    this.slotLocks[slot] = promise;
    if (this.ui && this.ui.setBusy) this.ui.setBusy(slot, true);
    try {
      await promise;
    } finally {
      if (this.ui && this.ui.setBusy) this.ui.setBusy(slot, false);
      if (this.slotLocks[slot] === promise) {
        delete this.slotLocks[slot];
      }
    }
  };

  scope.PlayerCustomization = scope.PlayerCustomization || {};
  scope.PlayerCustomization.AvatarController = AvatarController;
  scope.AvatarController = scope.AvatarController || AvatarController;
})();
