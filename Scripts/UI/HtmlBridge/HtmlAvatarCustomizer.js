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

  if (this.app.uiManager && this.app.uiManager.registerComponent) {
    this.app.uiManager.registerComponent(this);
  }

  this._loadAssets();
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
  if (applyBtn)
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

  this.app.fire("avatar:uiReady", this.bridge);
};

HtmlAvatarCustomizer.prototype._createButtonsContainerAndToggle = function () {
  var self = this;

  // Create the shared bottom-right container if missing
  var buttonContainer = document.getElementById("ui-button-container");
  if (!buttonContainer) {
    buttonContainer = document.createElement("div");
    buttonContainer.id = "ui-button-container";
    document.body.appendChild(buttonContainer);
  }

  // Signal other scripts (WaveButton) that container is ready
  this.app.fire("ui:button-container:ready");

  // Listen for the wave button and add it to the container (Wave should appear first)
  this.app.on("ui:wavebutton:create", function (waveButton) {
    if (!waveButton) return;
    // Insert as first child to enforce order: [Wave][Avatar]
    if (buttonContainer.firstChild !== waveButton) {
      buttonContainer.insertBefore(waveButton, buttonContainer.firstChild);
    }
  });

  // Create the avatar toggle button (will sit to the RIGHT of wave)
  var btn = document.createElement("button");
  btn.id = "avatar-toggle-button";
  btn.className = "avatar-toggle-button";
  btn.type = "button";
  btn.setAttribute("aria-label", "Open avatar customization");

  var iconSpan = document.createElement("span");
  iconSpan.className = "icon";

  function setIcon(url) {
    if (url) iconSpan.style.backgroundImage = "url(" + url + ")";
  }
  if (this.iconAsset) {
    this._ensureTextureAsset(this.iconAsset, function (asset) {
      setIcon(asset.getFileUrl());
    });
  }

  var labelSpan = document.createElement("span");
  labelSpan.className = "label";
  labelSpan.textContent = "Avatar";

  btn.appendChild(iconSpan);
  btn.appendChild(labelSpan);

  btn.addEventListener("click", function () {
    if (self.isOpen) self.close();
    else self.open();
  });

  // Append AFTER Wave for correct order
  buttonContainer.appendChild(btn);

  this.toggleButton = btn;
  this.toggleButton.setAttribute("aria-pressed", "false");

  if (this.openOnStart) this.toggleButton.style.display = "none";
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
  if (!this.root || !theme) return;
  if (theme.colors && theme.colors.accent)
    this.root.style.setProperty("--accent-color", theme.colors.accent);
  if (this.toggleButton && theme.colors && theme.colors.surface)
    this.toggleButton.style.setProperty(
      "--toggle-surface",
      theme.colors.surface
    );
};

HtmlAvatarCustomizer.prototype.open = function () {
  if (!this.root) return;
  this.root.classList.add("is-open");
  this.root.classList.remove("is-closed");
  this.isOpen = true;
  if (this.toggleButton) {
    this.toggleButton.classList.add("is-open");
    this.toggleButton.setAttribute("aria-pressed", "true");
    this.toggleButton.style.display = "none";
  }
};

HtmlAvatarCustomizer.prototype.close = function () {
  if (!this.root) return;
  this.root.classList.add("is-closed");
  this.root.classList.remove("is-open");
  this.isOpen = false;
  if (this.toggleButton) {
    this.toggleButton.classList.remove("is-open");
    this.toggleButton.setAttribute("aria-pressed", "false");
    this.toggleButton.style.display = "";
  }
};

HtmlAvatarCustomizer.prototype.destroy = function () {
  clearTimeout(this._rateLimitTimer);
  this.app.off("ui:wavebutton:create"); // clean up listener
  if (this.container && this.container.parentNode)
    this.container.parentNode.removeChild(this.container);
  if (this.toggleButton && this.toggleButton.parentNode)
    this.toggleButton.parentNode.removeChild(this.toggleButton);
  this.toggleButton = null;
};
