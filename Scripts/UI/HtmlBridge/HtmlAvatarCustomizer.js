var HtmlAvatarCustomizer = pc.createScript("htmlAvatarCustomizer");

HtmlAvatarCustomizer.attributes.add("cssAsset", {
  type: "asset",
  assetType: "css",
  title: "Customizer CSS",
});
HtmlAvatarCustomizer.attributes.add("htmlAsset", {
  type: "asset",
  assetType: "html",
  title: "Customizer HTML",
});
HtmlAvatarCustomizer.attributes.add("iconAsset", {
  type: "asset",
  assetType: "texture",
  title: "Toggle Icon Asset",
});
HtmlAvatarCustomizer.attributes.add("openOnStart", {
  type: "boolean",
  default: false,
  title: "Open On Start",
});

HtmlAvatarCustomizer.prototype.initialize = function () {
  this.slotNames = ["head", "body", "legs", "feet"];
  this.callbacks = { next: new Map(), prev: new Map(), apply: [], cancel: [] };
  this.slotElements = new Map();
  this.container = null;
  this.rateLimitEl = null;
  this.bridge = this._createBridge();
  this._rateLimitTimer = null;
  this.isOpen = false;
  this.toggleButton = null;
  this._requestedVariantStream = false;
  this.animationConfig = {
    enabled: true,
    durations: { standard: 0.26, quick: 0.18 },
    easings: { entrance: 'power3.out', exit: 'power2.in' },
    multiplier: 1
  };

  if (this.app.uiManager && this.app.uiManager.registerComponent) {
    this.app.uiManager.registerComponent(this);
  }

  this._loadAssets();
  this._preloadSounds();
};

HtmlAvatarCustomizer.prototype._loadAssets = function () {
  var self = this,
    pending = 0;
  function onReady() {
    if (--pending === 0) self._buildDom();
  }

  if (this.cssAsset) {
    pending++;
    this._ensureAsset(this.cssAsset, function (css) {
      self._injectCss(css);
      onReady();
    });
  }
  if (this.htmlAsset) {
    pending++;
    this._ensureAsset(this.htmlAsset, function (html) {
      self.htmlTemplate = html;
      onReady();
    });
  }
  if (pending === 0) this._buildDom();
};

HtmlAvatarCustomizer.prototype._ensureAsset = function (asset, callback) {
  if (!asset) return;
  if (asset.resource) callback(asset.resource);
  else {
    asset.once("load", function (a) {
      callback(a.resource);
    });
    asset.once("error", function (err) {
      console.error("HtmlAvatarCustomizer: Failed to load asset.", err);
    });
    this.app.assets.load(asset);
  }
};

HtmlAvatarCustomizer.prototype._ensureTextureAsset = function (
  asset,
  callback
) {
  if (!asset) return;
  if (asset.resource) callback(asset);
  else {
    asset.once("load", callback);
    asset.once("error", function (err) {
      console.error("HtmlAvatarCustomizer: Failed to load asset.", err);
    });
    if (!asset.loading) this.app.assets.load(asset);
  }
};

HtmlAvatarCustomizer.prototype._injectCss = function (cssText) {
  if (!cssText) return;
  var style = document.createElement("style");
  style.type = "text/css";
  style.textContent = cssText;
  document.head.appendChild(style);
};

HtmlAvatarCustomizer.prototype._buildDom = function () {
  if (!this.htmlTemplate || this.container) return;

  // Insert HTML
  this.container = document.createElement("div");
  this.container.innerHTML = this.htmlTemplate;
  document.body.appendChild(this.container);

  var root = this.container.querySelector("#avatar-customizer");
  if (!root) {
    console.error(
      "HtmlAvatarCustomizer: Root element #avatar-customizer not found."
    );
    return;
  }
  this.root = root;
  this.root.classList.add("is-closed");
  this.rateLimitEl = root.querySelector("[data-rate-limit]");

  // Wire slot controls
  var self = this;
  this.slotNames.forEach(function (slot) {
    var slotEl = root.querySelector('[data-slot="' + slot + '"]');
    if (!slotEl) return;
    self.slotElements.set(slot, {
      container: slotEl,
      indexEl: slotEl.querySelector("[data-slot-index]"),
      progressEl: slotEl.querySelector("[data-slot-progress]"),
      progressFill: slotEl.querySelector("[data-slot-progress] .progress-fill"),
      busyEl: slotEl.querySelector("[data-slot-busy]"),
    });
    var prevBtn = slotEl.querySelector("[data-slot-prev]");
    var nextBtn = slotEl.querySelector("[data-slot-next]");
    if (prevBtn)
      prevBtn.addEventListener("click", function () {
        self._emitSlot("prev", slot);
        self.app.fire("ui:playSound", "ui_click_default");
      });
    if (nextBtn)
      nextBtn.addEventListener("click", function () {
        self._emitSlot("next", slot);
        self.app.fire("ui:playSound", "ui_click_default");
      });
  });

  var applyBtn = root.querySelector("[data-apply]");
  if (applyBtn) {
    applyBtn.setAttribute('data-suppress-default-sound', 'true');
    applyBtn.addEventListener("click", function () {
      self.callbacks.apply.forEach(function (fn) {
        try {
          fn();
        } catch (e) {
          console.error("Avatar apply callback error", e);
        }
      });
      self.close();
      self.app.fire("ui:playSound", "avatar_apply_click");
    });
  }

  var cancelBtn = root.querySelector("[data-cancel]");
  if (cancelBtn)
    cancelBtn.addEventListener("click", function () {
      self.callbacks.cancel.forEach(function (fn) {
        try {
          fn();
        } catch (e) {
          console.error("Avatar cancel callback error", e);
        }
      });
      self.close();
    });

  // Create/announce the bottom-right button container
  this._createButtonsContainerAndToggle();

  if (this.openOnStart) this.open();
  else this.close();

  this._handlers = this._handlers || {};
  this._handlers.toggleRequest = function () {
    if (self.isOpen) self.close();
    else self.open();
  };
  this._handlers.openRequest = function () { self.open(); };
  this._handlers.closeRequest = function () { self.close(); };

  this.app.on("htmlAvatarCustomizer:toggle", this._handlers.toggleRequest, this);
  this.app.on("htmlAvatarCustomizer:open", this._handlers.openRequest, this);
  this.app.on("htmlAvatarCustomizer:close", this._handlers.closeRequest, this);

  this.app.fire("avatar:uiReady", this.bridge);
};

HtmlAvatarCustomizer.prototype._createButtonsContainerAndToggle = function () {
  var self = this;

  // Create the shared ui-button-container if missing (positioned left-center)
  var buttonContainer = document.getElementById("ui-button-container");
  if (!buttonContainer) {
    buttonContainer = document.createElement("div");
    buttonContainer.id = "ui-button-container";
    document.body.appendChild(buttonContainer);
  }

  // Create the avatar customizer toggle button
  if (!this.toggleButton) {
    this.toggleButton = document.createElement('button');
    this.toggleButton.className = 'ui-action-button avatar-customizer-toggle';
    this.toggleButton.type = 'button';
    this.toggleButton.setAttribute('aria-label', 'Customize avatar');
    this.toggleButton.setAttribute('aria-pressed', 'false');
    this.toggleButton.innerHTML = '<span class="icon" aria-hidden="true">🎨</span>';

    this._handlers = this._handlers || {};
    this._handlers.toggleButton = function () {
      self.app.fire('ui:playSound', 'ui_click_default');
      if (self.isOpen) self.close();
      else self.open();
    };
    this._handlers.hoverButton = function () {
      self.app.fire('ui:playSound', 'ui_hover_default');
    };

    this.toggleButton.addEventListener('click', this._handlers.toggleButton);
    this.toggleButton.addEventListener('mouseenter', this._handlers.hoverButton);

    buttonContainer.appendChild(this.toggleButton);
  }

  // Signal other scripts (WaveButton) that container is ready
  this.app.fire("ui:button-container:ready");

  // Listen for the wave button and insert it before avatar button
  this.app.on("ui:wavebutton:create", function (waveButton) {
    if (!waveButton || !self.toggleButton) return;
    if (buttonContainer.contains(waveButton)) return;
    buttonContainer.insertBefore(waveButton, self.toggleButton);
  });

  var themeToApply = this.theme;
  if (!themeToApply && this.app.uiManager && typeof this.app.uiManager.getTheme === "function") {
    themeToApply = this.app.uiManager.getTheme();
  }
  if (themeToApply) {
    this.setTheme(themeToApply);
  }
};

HtmlAvatarCustomizer.prototype._createBridge = function () {
  var self = this;
  return {
    onNext: function (slot, h) {
      self._registerSlotCallback("next", slot, h);
    },
    onPrev: function (slot, h) {
      self._registerSlotCallback("prev", slot, h);
    },
    onApply: function (h) {
      if (h) self.callbacks.apply.push(h);
    },
    onCancel: function (h) {
      if (h) self.callbacks.cancel.push(h);
    },
    setSelection: function (slot, info) {
      self._setSelection(slot, info);
    },
    setBusy: function (slot, s) {
      self._setBusy(slot, s);
    },
    setRecipe: function (r) {
      self._setRecipeSummary(r);
    },
    showRateLimit: function (ms) {
      self._showRateLimit(ms);
    },
    open: function () {
      self.open();
    },
    close: function () {
      self.close();
    },
    toggle: function () {
      if (self.isOpen) self.close();
      else self.open();
    },
    isOpen: function () {
      return self.isOpen;
    },
  };
};

HtmlAvatarCustomizer.prototype._registerSlotCallback = function (
  type,
  slot,
  handler
) {
  if (!handler) return;
  var map = this.callbacks[type];
  if (!map) return;
  if (!map.has(slot)) map.set(slot, []);
  map.get(slot).push(handler);
};

HtmlAvatarCustomizer.prototype._emitSlot = function (type, slot) {
  var list = (this.callbacks[type] && this.callbacks[type].get(slot)) || [];
  list.forEach(function (fn) {
    try {
      fn();
    } catch (e) {
      console.error("HtmlAvatarCustomizer callback error", e);
    }
  });
};

HtmlAvatarCustomizer.prototype._setSelection = function (slot, info) {
  var refs = this.slotElements.get(slot);
  if (!refs) return;
  var total = info && typeof info.total === "number" ? info.total : 0;
  var index = info && typeof info.index === "number" ? info.index : 0;
  var displayIndex = total ? index + 1 : 0;
  refs.lastIndex = displayIndex;
  refs.totalOptions = total;
  if (refs.indexEl)
    refs.indexEl.textContent = total ? displayIndex + " / " + total : "0 / 0";
  if (refs.progressFill)
    refs.progressFill.style.width =
      (total ? (displayIndex / total) * 100 : 0) + "%";
};

HtmlAvatarCustomizer.prototype._setBusy = function (slot, state) {
  var refs = this.slotElements.get(slot);
  if (!refs) return;
  if (refs.container) refs.container.classList.toggle("is-busy", !!state);
  if (refs.busyEl) refs.busyEl.classList.toggle("hidden", !state);
};

HtmlAvatarCustomizer.prototype._setRecipeSummary = function (recipe) {
  if (!this.root) return;
  var summary = this.root.querySelector("[data-recipe-summary]");
  if (!summary) return;
  summary.textContent = recipe ? "Tap the arrows to preview each style." : "";
};

HtmlAvatarCustomizer.prototype._showRateLimit = function (remainingMs) {
  if (!this.rateLimitEl) return;
  clearTimeout(this._rateLimitTimer);
  var seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  this.rateLimitEl.textContent =
    seconds > 0 ? "Please wait " + seconds + "s before applying again." : "";
  this.rateLimitEl.classList.remove("hidden");
  var self = this;
  this._rateLimitTimer = setTimeout(function () {
    if (self.rateLimitEl) self.rateLimitEl.classList.add("hidden");
  }, Math.max(1500, remainingMs));
};

HtmlAvatarCustomizer.prototype.setTheme = function (theme) {
  this.theme = theme;
  if (!theme) return;
  if (this.root) {
    var colors = theme.colors || {};
    var layout = theme.layout && theme.layout.avatarPanel ? theme.layout.avatarPanel : null;

    this.root.style.setProperty("--accent-color", colors.accent || "#1df2a4");
    this.root.style.setProperty("--accent2-color", colors.accent2 || colors.primary || "#1de8f2");
    this.root.style.setProperty("--avatar-surface", colors.surface2 || colors.surface || "rgba(17, 22, 34, 0.94)");
    this.root.style.setProperty("--avatar-border", "rgba(255, 255, 255, 0.08)");
    this.root.style.setProperty("--avatar-slot-surface", "rgba(255, 255, 255, 0.05)");
    this.root.style.setProperty("--avatar-shadow", (theme.styles && theme.styles.boxShadow) || "0 28px 60px rgba(0, 0, 0, 0.45)");
    this.root.style.setProperty("--text-muted-color", colors.textMuted || "rgba(255, 255, 255, 0.7)");
    if (layout && layout.width) {
      this.root.style.setProperty("--avatar-panel-width", layout.width + "px");
    }
  }
  if (this.toggleButton && theme.colors && theme.colors.surface)
    this.toggleButton.style.setProperty(
      "--toggle-surface",
      theme.colors.surface
    );
};

HtmlAvatarCustomizer.prototype.setAnimationConfig = function (config) {
  if (!config) {
    return;
  }
  this.animationConfig = Object.assign({}, this.animationConfig, config);
};

HtmlAvatarCustomizer.prototype.open = function () {
  if (!this.root || this.isOpen) return;
  this.isOpen = true;
  this.root.style.display = 'block';
  this.root.style.display = 'block';
  this.root.classList.remove("is-closed");
  this.root.classList.add("is-open");
  this.root.style.pointerEvents = "auto";
  this._animatePanel(true);
  this._requestVariantStreaming();
  if (this.toggleButton) {
    this.toggleButton.classList.add("is-open");
    this.toggleButton.setAttribute("aria-pressed", "true");
  }
};

HtmlAvatarCustomizer.prototype.close = function () {
  if (!this.root || !this.isOpen) return;
  var self = this;
  this.isOpen = false;
  this.root.style.pointerEvents = "none";
  if (this.toggleButton) {
    this.toggleButton.classList.remove("is-open");
    this.toggleButton.setAttribute("aria-pressed", "false");
  }

  var duration = this._animatePanel(false);
  var finalize = function () {
    if (!self.root) return;
    self.root.classList.add("is-closed");
    self.root.classList.remove("is-open");
  };

  if (duration > 0 && window.gsap && this._shouldAnimate()) {
    gsap.delayedCall(duration, finalize);
  } else {
    finalize();
  }
};

HtmlAvatarCustomizer.prototype._preloadSounds = function () {
  if (this.app.soundManager && this.app.soundManager.preloadSound) {
    this.app.soundManager.preloadSound('ui_click_default');
    this.app.soundManager.preloadSound('avatar_apply_click');
    this.app.soundManager.preloadSound('ui_hover_default');
  }
};

HtmlAvatarCustomizer.prototype._requestVariantStreaming = function () {
  if (this._requestedVariantStream) {
    return;
  }
  this._requestedVariantStream = true;
  const queue = this.app && this.app.tagLoadQueue;
  if (!queue || typeof queue.loadByTags !== 'function') {
    return;
  }
  queue.loadByTags(['avatars-variants'], {
    priority: 3,
    phase: 'postSpawnStream'
  }).catch(function (err) {
    console.warn('HtmlAvatarCustomizer: Failed to stream avatar variants.', err);
  });
};

HtmlAvatarCustomizer.prototype._shouldAnimate = function () {
  return this.animationConfig && this.animationConfig.enabled !== false;
};

HtmlAvatarCustomizer.prototype._animatePanel = function (isOpening) {
  if (!window.gsap || !this._shouldAnimate() || !this.root) {
    return 0;
  }
  var baseDuration = (this.animationConfig.durations && this.animationConfig.durations.standard) || 0.26;
  var duration = Math.max(0.16, baseDuration * (this.animationConfig.multiplier || 1));
  var easeIn = (this.animationConfig.easings && this.animationConfig.easings.entrance) || 'power3.out';
  var easeOut = (this.animationConfig.easings && this.animationConfig.easings.exit) || 'power2.in';

  gsap.killTweensOf(this.root);
  if (isOpening) {
    gsap.fromTo(this.root,
      { opacity: 0, y: 28, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: duration, ease: easeIn }
    );
    return duration;
  }

  var closingDuration = Math.max(0.14, duration * 0.85);
  gsap.to(this.root, {
    opacity: 0,
    y: 24,
    scale: 0.94,
    duration: closingDuration,
    ease: easeOut
  });
  return closingDuration;
};

HtmlAvatarCustomizer.prototype.destroy = function () {
  clearTimeout(this._rateLimitTimer);
  this.app.off("ui:wavebutton:create");
  if (this._handlers) {
    if (this._handlers.toggleRequest) {
      this.app.off("htmlAvatarCustomizer:toggle", this._handlers.toggleRequest, this);
    }
    if (this._handlers.openRequest) {
      this.app.off("htmlAvatarCustomizer:open", this._handlers.openRequest, this);
    }
    if (this._handlers.closeRequest) {
      this.app.off("htmlAvatarCustomizer:close", this._handlers.closeRequest, this);
    }
  }
  if (this.toggleButton) {
    if (this._handlers.toggleButton) {
      this.toggleButton.removeEventListener('click', this._handlers.toggleButton);
    }
    if (this._handlers.hoverButton) {
      this.toggleButton.removeEventListener('mouseenter', this._handlers.hoverButton);
    }
    if (this.toggleButton.parentNode) {
      this.toggleButton.parentNode.removeChild(this.toggleButton);
    }
    this.toggleButton = null;
  }
  if (this.container && this.container.parentNode)
    this.container.parentNode.removeChild(this.container);
};
