var HtmlAvatarCustomizer = pc.createScript("htmlAvatarCustomizer");

HtmlAvatarCustomizer.attributes.add("cssAsset", {
  type: "asset",
  assetType: "css",
  title: "Customizer CSS"
});
HtmlAvatarCustomizer.attributes.add("htmlAsset", {
  type: "asset",
  assetType: "html",
  title: "Customizer HTML"
});
HtmlAvatarCustomizer.attributes.add("iconAsset", {
  type: "asset",
  assetType: "texture",
  title: "Toggle Icon Asset"
});
HtmlAvatarCustomizer.attributes.add("openOnStart", {
  type: "boolean",
  default: false,
  title: "Open On Start"
});
HtmlAvatarCustomizer.attributes.add("rpmSubdomain", {
  type: "string",
  default: "pls-give.readyplayer.me",
  title: "Ready Player Me Subdomain (e.g. mygame or mygame.readyplayer.me)"
});
HtmlAvatarCustomizer.attributes.add("useInsetLayout", {
  type: "boolean",
  default: false,
  title: "Use 90% Inset Layout"
});
HtmlAvatarCustomizer.attributes.add("additionalQuery", {
  type: "string",
  default: "",
  title: "Additional Creator Query Params"
});
HtmlAvatarCustomizer.attributes.add("overlayTitle", {
  type: "string",
  default: "Ready Player Me",
  title: "Overlay Title"
});

HtmlAvatarCustomizer.prototype.initialize = function () {
  this.container = null;
  this.root = null;
  this.scrim = null;
  this.overlayShell = null;
  this.frameHost = null;
  this.iframe = null;
  this.closeButton = null;
  this.loadingEl = null;
  this.errorEl = null;
  this.toggleButton = null;
  this.rateLimitEl = null;
  this.isOpen = false;
  this.frameReady = false;
  this._pendingOpenRequest = null;
  this._inputsSuspended = false;
  this._bodyOverflow = null;
  this._closeReason = null;
  this.lastAvatarInfo = null;
  this.additionalQuery = (this.additionalQuery || "").trim();
  this.overlayTitle = (this.overlayTitle || "Ready Player Me").trim() || "Ready Player Me";
  this.defaultInset = !!this.useInsetLayout;
  this.activeInset = this.defaultInset;
  this.animationConfig = {
    enabled: true,
    durations: { standard: 0.26, quick: 0.18 },
    easings: { entrance: "power3.out", exit: "power2.in" },
    multiplier: 1
  };

  this.callbacks = {
    next: new Map(),
    prev: new Map(),
    apply: [],
    cancel: [],
    exported: []
  };

  this.bridge = this._createBridge();

  this._handlers = {};
  this._handlers.toggleButton = null;
  this._handlers.hoverButton = null;
  this._handlers.waveButton = null;
  this._handlers.toggleRequest = null;
  this._handlers.openRequest = null;
  this._handlers.closeRequest = null;

  this._messageHandler = this._handleMessage.bind(this);
  this._escHandler = this._handleEscape.bind(this);
  this._boundCloseClick = this.close.bind(this);
  this._boundScrimClick = this.close.bind(this);
  this._legacyWarningShown = false;
  this._pendingSubscriptions = ["v1.avatar.exported"];
  this._subscriptionAcks = new Set();

  this.rpmOrigin = this._normalizeRpmOrigin(this.rpmSubdomain);
  this._rpmOriginConfigured = !!this.rpmOrigin;
  this._missingOriginWarned = false;
  if (!this._rpmOriginConfigured) {
    this.rpmOrigin = "https://YOUR-SUBDOMAIN.readyplayer.me";
  }

  if (this.app.uiManager && this.app.uiManager.registerComponent) {
    this.app.uiManager.registerComponent(this);
  }

  this._loadAssets();
};

HtmlAvatarCustomizer.prototype._normalizeRpmOrigin = function (value) {
  if (!value) return null;
  var trimmed = String(value).trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    trimmed = trimmed.replace(/^http:\/\//i, "https://");
  } else {
    var domain = trimmed;
    if (domain.indexOf(".") === -1) {
      domain = domain + ".readyplayer.me";
    }
    trimmed = "https://" + domain;
  }

  return trimmed.replace(/\/+$/, "");
};

HtmlAvatarCustomizer.prototype._loadAssets = function () {
  var self = this;
  var pending = 0;

  function onReady() {
    pending -= 1;
    if (pending === 0) {
      self._buildDom();
    }
  }

  if (this.cssAsset) {
    pending += 1;
    this._ensureAsset(this.cssAsset, function (css) {
      self._injectCss(css);
      onReady();
    });
  }

  if (this.htmlAsset) {
    pending += 1;
    this._ensureAsset(this.htmlAsset, function (html) {
      self.htmlTemplate = html;
      onReady();
    });
  }

  if (pending === 0) {
    this._buildDom();
  }
};

HtmlAvatarCustomizer.prototype._ensureAsset = function (asset, callback) {
  if (!asset) return;
  if (asset.resource) {
    callback(asset.resource);
  } else {
    asset.once("load", function (a) {
      callback(a.resource);
    });
    asset.once("error", function (err) {
      console.error("HtmlAvatarCustomizer: Failed to load asset.", err);
    });
    if (!asset.loading) {
      this.app.assets.load(asset);
    }
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

  var container = document.createElement("div");
  container.innerHTML = this.htmlTemplate;
  document.body.appendChild(container);
  this.container = container;

  var root = container.querySelector("#avatar-customizer");
  if (!root) {
    console.error("HtmlAvatarCustomizer: Root element #avatar-customizer not found.");
    return;
  }

  this.root = root;
  this.root.classList.add("is-closed");
  this._setupOverlayDom();
  this._createToggleButton();

  var self = this;
  this._handlers.toggleRequest = function () {
    self.toggle();
  };
  this._handlers.openRequest = function () {
    self.open();
  };
  this._handlers.closeRequest = function () {
    self.close();
  };

  this.app.on("htmlAvatarCustomizer:toggle", this._handlers.toggleRequest, this);
  this.app.on("htmlAvatarCustomizer:open", this._handlers.openRequest, this);
  this.app.on("htmlAvatarCustomizer:close", this._handlers.closeRequest, this);

  this.app.fire("avatar:uiReady", this.bridge);

  if (this.openOnStart) {
    this.open();
  } else if (this._pendingOpenRequest) {
    var pendingOptions = this._pendingOpenRequest;
    this._pendingOpenRequest = null;
    this.open(pendingOptions);
  }
};

HtmlAvatarCustomizer.prototype._setupOverlayDom = function () {
  if (!this.root) return;
  if (this.overlayShell) return;

  this.root.setAttribute("aria-hidden", "true");

  var scrim = document.createElement("div");
  scrim.className = "rpm-overlay-scrim";
  scrim.setAttribute("aria-hidden", "true");

  var shell = document.createElement("div");
  shell.className = "rpm-overlay-shell";
  shell.setAttribute("role", "dialog");
  shell.setAttribute("aria-modal", "true");
  shell.setAttribute("aria-label", this.overlayTitle);

  var toolbar = document.createElement("div");
  toolbar.className = "rpm-overlay-toolbar";

  var title = document.createElement("span");
  title.className = "rpm-overlay-title";
  title.textContent = this.overlayTitle;

  var closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "rpm-overlay-close";
  closeBtn.setAttribute("aria-label", "Close avatar creator");
  closeBtn.textContent = "Close";

  toolbar.appendChild(title);
  toolbar.appendChild(closeBtn);

  var content = document.createElement("div");
  content.className = "rpm-overlay-content";

  var loading = document.createElement("div");
  loading.className = "rpm-overlay-loading hidden";
  loading.textContent = "Loading Ready Player Me...";

  var error = document.createElement("div");
  error.className = "rpm-overlay-error hidden";
  error.setAttribute("role", "alert");

  var frameHost = document.createElement("div");
  frameHost.className = "rpm-frame-host";

  content.appendChild(loading);
  content.appendChild(error);
  content.appendChild(frameHost);

  shell.appendChild(toolbar);
  shell.appendChild(content);

  this.scrim = scrim;
  this.overlayShell = shell;
  this.closeButton = closeBtn;
  this.loadingEl = loading;
  this.errorEl = error;
  this.frameHost = frameHost;
  this.titleEl = title;

  this.root.appendChild(scrim);
  this.root.appendChild(shell);
};

HtmlAvatarCustomizer.prototype._createToggleButton = function () {
  var buttonContainer = document.getElementById("ui-button-container");
  if (!buttonContainer) {
    buttonContainer = document.createElement("div");
    buttonContainer.id = "ui-button-container";
    document.body.appendChild(buttonContainer);
  }

  if (this.toggleButton) return;

  var button = document.createElement("button");
  button.className = "ui-action-button avatar-customizer-toggle";
  button.type = "button";
  button.setAttribute("aria-label", "Customize avatar");
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = '<span class="icon" aria-hidden="true">Avatar</span>';

  var self = this;
  this._handlers.toggleButton = function () {
    self.app.fire("ui:playSound", "ui_click_default");
    self.toggle();
  };
  this._handlers.hoverButton = function () {
    self.app.fire("ui:playSound", "ui_hover_default");
  };

  button.addEventListener("click", this._handlers.toggleButton);
  button.addEventListener("mouseenter", this._handlers.hoverButton);

  buttonContainer.appendChild(button);
  this.toggleButton = button;

  this.app.fire("ui:button-container:ready");

  this._handlers.waveButton = function (waveButton) {
    if (!waveButton || !self.toggleButton) return;
    if (buttonContainer.contains(waveButton)) return;
    buttonContainer.insertBefore(waveButton, self.toggleButton);
  };
  this.app.on("ui:wavebutton:create", this._handlers.waveButton, this);
};

HtmlAvatarCustomizer.prototype._createBridge = function () {
  var self = this;

  function warnLegacy() {
    if (self._legacyWarningShown) return;
    self._legacyWarningShown = true;
    console.warn("HtmlAvatarCustomizer: Legacy slot callbacks are ignored in Ready Player Me mode.");
  }

  return {
    onNext: function () {
      warnLegacy();
    },
    onPrev: function () {
      warnLegacy();
    },
    onApply: function (handler) {
      if (typeof handler === "function") {
        self.callbacks.apply.push(handler);
      }
    },
    onCancel: function (handler) {
      if (typeof handler === "function") {
        self.callbacks.cancel.push(handler);
      }
    },
    onAvatarExported: function (handler) {
      self._registerExportListener(handler);
    },
    setSelection: warnLegacy,
    setBusy: warnLegacy,
    setRecipe: warnLegacy,
    showRateLimit: function () {},
    open: function (options) {
      self.open(options || {});
    },
    close: function () {
      self.close();
    },
    toggle: function (options) {
      self.toggle(options || {});
    },
    isOpen: function () {
      return self.isOpen;
    },
    setInsetLayout: function (enabled) {
      self._setInsetLayout(enabled);
    },
    setAvatarContext: function (info) {
      if (!info) {
        self.lastAvatarInfo = null;
        return;
      }
      if (typeof info === "string") {
        self.lastAvatarInfo = { avatarId: info };
        return;
      }
      if (typeof info === "object") {
        var avatarId = info.avatarId || info.id || null;
        var url = info.url || null;
        var userId = info.userId || null;
        self.lastAvatarInfo = avatarId
          ? { avatarId: avatarId, url: url, userId: userId }
          : null;
      }
    }
  };
};

HtmlAvatarCustomizer.prototype._registerExportListener = function (handler) {
  if (typeof handler === "function") {
    this.callbacks.exported.push(handler);
  }
};

HtmlAvatarCustomizer.prototype._setInsetLayout = function (enabled) {
  this.activeInset = !!enabled;
  if (this.isOpen) {
    this._updateOpenState(true);
  }
};

HtmlAvatarCustomizer.prototype.open = function (options) {
  options = options || {};
  if (!this.root) {
    this._pendingOpenRequest = options;
    return;
  }
  if (this.isOpen) return;

  this.isOpen = true;
  this._closeReason = null;
  this.activeInset = typeof options.inset === "boolean" ? options.inset : this.activeInset;

  this._clearError();
  this._setLoading(true);
  this._updateOpenState(true);
  this._mountIframe(options);

  if (!this._rpmOriginConfigured) {
    this._showError("Set HtmlAvatarCustomizer.rpmSubdomain to your Ready Player Me subdomain.");
    this._setLoading(false);
  }

  window.addEventListener("message", this._messageHandler);
  window.addEventListener("keydown", this._escHandler);

  if (this.scrim) {
    this.scrim.addEventListener("click", this._boundScrimClick);
  }
  if (this.closeButton) {
    this.closeButton.addEventListener("click", this._boundCloseClick);
  }

  this._setInputsSuspended(true);
  this._stashBodyOverflow();
  this.app.fire("avatar:rpm:creator:open");
};

HtmlAvatarCustomizer.prototype.close = function (options) {
  options = options || {};
  if (!this.isOpen || !this.root) {
    this._pendingOpenRequest = null;
    return;
  }

  this.isOpen = false;
  this._updateOpenState(false);

  window.removeEventListener("message", this._messageHandler);
  window.removeEventListener("keydown", this._escHandler);

  if (this.scrim) {
    this.scrim.removeEventListener("click", this._boundScrimClick);
  }
  if (this.closeButton) {
    this.closeButton.removeEventListener("click", this._boundCloseClick);
  }

  this._destroyIframe();
  this._setLoading(false);
  this._clearError();
  this._setInputsSuspended(false);
  this._restoreBodyOverflow();
  this.app.fire("avatar:rpm:creator:close", options);

  var reason = options.reason || this._closeReason;
  this._closeReason = null;

  if (reason === "submitted") {
    return;
  }

  for (var i = 0; i < this.callbacks.cancel.length; i++) {
    try {
      this.callbacks.cancel[i]();
    } catch (err) {
      console.error("HtmlAvatarCustomizer: cancel callback failed.", err);
    }
  }
};

HtmlAvatarCustomizer.prototype.toggle = function (options) {
  if (this.isOpen) {
    this.close(options || {});
  } else {
    this.open(options || {});
  }
};

HtmlAvatarCustomizer.prototype._updateOpenState = function (isOpen) {
  if (!this.root) return;
  this.root.classList.toggle("is-open", !!isOpen);
  this.root.classList.toggle("is-closed", !isOpen);
  this.root.classList.toggle("rpm-mode", !!isOpen);
  this.root.classList.toggle("inset90", !!isOpen && this.activeInset);

  if (this.root) {
    this.root.setAttribute("aria-hidden", isOpen ? "false" : "true");
  }
  if (this.scrim) {
    this.scrim.classList.toggle("hidden", !isOpen);
    this.scrim.setAttribute("aria-hidden", isOpen ? "false" : "true");
  }
  if (this.overlayShell) {
    this.overlayShell.classList.toggle("hidden", !isOpen);
  }
  if (this.toggleButton) {
    this.toggleButton.classList.toggle("is-open", !!isOpen);
    this.toggleButton.setAttribute("aria-pressed", isOpen ? "true" : "false");
  }
};

HtmlAvatarCustomizer.prototype._mountIframe = function (options) {
  if (!this.frameHost) return;

  this._destroyIframe();

  this.frameReady = false;
  this._subscriptionAcks.clear();

  var avatarId = null;
  if (options && options.avatarId) {
    avatarId = options.avatarId;
  } else if (this.lastAvatarInfo && this.lastAvatarInfo.avatarId) {
    avatarId = this.lastAvatarInfo.avatarId;
  }

  var iframe = document.createElement("iframe");
  iframe.className = "rpm-creator-frame";
  iframe.allow = "camera; microphone; clipboard-write";
  iframe.setAttribute("allowfullscreen", "true");
  iframe.setAttribute("title", this.overlayTitle + " Creator");
  iframe.src = this._buildCreatorUrl(avatarId, options && options.query);

  this.frameHost.appendChild(iframe);
  this.iframe = iframe;

  iframe.addEventListener("load", this._handleFrameLoad.bind(this), { once: true });
};

HtmlAvatarCustomizer.prototype._destroyIframe = function () {
  if (this.iframe && this.iframe.parentNode) {
    this.iframe.parentNode.removeChild(this.iframe);
  }
  this.iframe = null;
};

HtmlAvatarCustomizer.prototype._buildCreatorUrl = function (avatarId, extraParams) {
  var origin = this.rpmOrigin.replace(/\/+$/, "");
  var endpoint = origin + "/avatar";
  var params = new URLSearchParams();
  params.set("frameApi", "1");
  params.set("clearCache", "true");

  if (avatarId) {
    params.set("avatarId", avatarId);
  }

  this._applyQueryParams(params, this.additionalQuery);
  this._applyQueryParams(params, extraParams);

  return endpoint + "?" + params.toString();
};

HtmlAvatarCustomizer.prototype._applyQueryParams = function (params, source) {
  if (!source) return;

  if (typeof source === "string") {
    var normalized = source.trim();
    if (!normalized) return;
    normalized = normalized.replace(/^[?&]+/, "");
    if (!normalized) return;
    var parts = normalized.split("&");
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      var split = part.split("=");
      var key = decodeURIComponent(split[0]);
      var value = split.length > 1 ? decodeURIComponent(split.slice(1).join("=")) : "";
      if (key) params.set(key, value);
    }
    return;
  }

  if (typeof source === "object") {
    for (var prop in source) {
      if (Object.prototype.hasOwnProperty.call(source, prop)) {
        params.set(prop, source[prop]);
      }
    }
  }
};

HtmlAvatarCustomizer.prototype._handleMessage = function (event) {
  if (!this.isOpen || !this.iframe || event.source !== this.iframe.contentWindow) {
    return;
  }

  var payload = event.data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (err) {
      return;
    }
  }
  if (!payload || typeof payload !== "object") {
    return;
  }

  var originTrusted = false;
  if (this._rpmOriginConfigured) {
    originTrusted = event.origin === this.rpmOrigin;
  } else if (event.origin && /https:\/\/([a-z0-9-]+\.)?readyplayer\.me$/i.test(event.origin)) {
    originTrusted = true;
  } else {
    if (!this._missingOriginWarned) {
      this._missingOriginWarned = true;
      console.warn("HtmlAvatarCustomizer: RPM subdomain not configured; accepting iframe messages in development mode.");
    }
    originTrusted = true;
  }
  if (!originTrusted) {
    return;
  }

  if (payload.source !== "readyplayerme") {
    return;
  }

  var eventName = payload.eventName || payload.type;
  if (!eventName) {
    return;
  }

  if (eventName === "v1.frame.ready") {
    this._handleFrameReady();
    return;
  }

  if (eventName === "v1.avatar.exported") {
    this._handleAvatarExported(payload);
    return;
  }
};

HtmlAvatarCustomizer.prototype._handleFrameReady = function () {
  this.frameReady = true;
  this._setLoading(false);

  for (var i = 0; i < this._pendingSubscriptions.length; i++) {
    this._postToCreator({
      target: "readyplayerme",
      type: "subscribe",
      eventName: this._pendingSubscriptions[i]
    });
  }
};

HtmlAvatarCustomizer.prototype._handleFrameLoad = function () {
  if (!this.isOpen) {
    return;
  }
  this._setLoading(false);
  this._clearError();
};

HtmlAvatarCustomizer.prototype._handleAvatarExported = function (payload) {
  if (!payload || !payload.data) {
    console.warn("HtmlAvatarCustomizer: Received malformed export payload.", payload);
    return;
  }

  var data = payload.data;
  if (!data.url || !data.avatarId) {
    console.warn("HtmlAvatarCustomizer: Export payload missing url or avatarId.", data);
    return;
  }

  var exportedInfo = {
    avatarId: data.avatarId,
    url: data.url,
    userId: data.userId || null,
    timestamp: Date.now()
  };
  this.lastAvatarInfo = exportedInfo;

  for (var i = 0; i < this.callbacks.exported.length; i++) {
    try {
      this.callbacks.exported[i](exportedInfo);
    } catch (err) {
      console.error("HtmlAvatarCustomizer: exported callback failed.", err);
    }
  }

  for (var j = 0; j < this.callbacks.apply.length; j++) {
    try {
      this.callbacks.apply[j](exportedInfo);
    } catch (e) {
      console.error("HtmlAvatarCustomizer: apply callback failed.", e);
    }
  }

  this.app.fire("avatar:rpm:exported", exportedInfo);
  this._closeReason = "submitted";
  this.close({ reason: "submitted" });
};

HtmlAvatarCustomizer.prototype._postToCreator = function (message) {
  if (!this.iframe || !this.iframe.contentWindow) return;
  try {
    var payload = typeof message === "string" ? message : JSON.stringify(message);
    var targetOrigin = this._rpmOriginConfigured ? this.rpmOrigin : "*";
    this.iframe.contentWindow.postMessage(payload, targetOrigin);
  } catch (err) {
    console.error("HtmlAvatarCustomizer: Failed to post message to RPM frame.", err);
  }
};

HtmlAvatarCustomizer.prototype._setLoading = function (isLoading) {
  if (!this.loadingEl) return;
  this.loadingEl.classList.toggle("hidden", !isLoading);
};

HtmlAvatarCustomizer.prototype._showError = function (message) {
  if (!this.errorEl) return;
  this.errorEl.textContent = message || "Avatar creator failed to load.";
  this.errorEl.classList.remove("hidden");
};

HtmlAvatarCustomizer.prototype._clearError = function () {
  if (!this.errorEl) return;
  this.errorEl.textContent = "";
  this.errorEl.classList.add("hidden");
};

HtmlAvatarCustomizer.prototype._setInputsSuspended = function (suspended) {
  if (suspended && !this._inputsSuspended) {
    this._inputsSuspended = true;
    this.app.fire("ui:input:focus", { source: "avatar-customizer" });
  } else if (!suspended && this._inputsSuspended) {
    this._inputsSuspended = false;
    this.app.fire("ui:input:blur", { source: "avatar-customizer" });
  }
};

HtmlAvatarCustomizer.prototype._stashBodyOverflow = function () {
  if (this._bodyOverflow !== null) return;
  this._bodyOverflow = document.body.style.overflow || "";
  document.body.style.overflow = "hidden";
};

HtmlAvatarCustomizer.prototype._restoreBodyOverflow = function () {
  if (this._bodyOverflow === null) return;
  document.body.style.overflow = this._bodyOverflow;
  this._bodyOverflow = null;
};

HtmlAvatarCustomizer.prototype._handleEscape = function (event) {
  if (!this.isOpen) return;
  if (event.key === "Escape" || event.key === "Esc") {
    this.close();
  }
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

  if (this.overlayShell) {
    this.overlayShell.style.setProperty("--avatar-overlay-surface", (theme.colors && theme.colors.surface) || "rgba(12, 16, 24, 0.94)");
    this.overlayShell.style.setProperty("--avatar-overlay-border", "rgba(255, 255, 255, 0.12)");
  }

  if (this.closeButton) {
    this.closeButton.style.setProperty("--toggle-surface", (theme.colors && theme.colors.surface) || "#1f2534");
  }

  if (this.toggleButton && theme.colors && theme.colors.surface) {
    this.toggleButton.style.setProperty("--toggle-surface", theme.colors.surface);
  }
};

HtmlAvatarCustomizer.prototype.setAnimationConfig = function (config) {
  if (!config) return;
  this.animationConfig = Object.assign({}, this.animationConfig, config);
};

HtmlAvatarCustomizer.prototype.destroy = function () {
  window.removeEventListener("message", this._messageHandler);
  window.removeEventListener("keydown", this._escHandler);

  if (this.scrim) {
    this.scrim.removeEventListener("click", this._boundScrimClick);
  }
  if (this.closeButton) {
    this.closeButton.removeEventListener("click", this._boundCloseClick);
  }
  if (this.toggleButton) {
    if (this._handlers.toggleButton) {
      this.toggleButton.removeEventListener("click", this._handlers.toggleButton);
    }
    if (this._handlers.hoverButton) {
      this.toggleButton.removeEventListener("mouseenter", this._handlers.hoverButton);
    }
    if (this.toggleButton.parentNode) {
      this.toggleButton.parentNode.removeChild(this.toggleButton);
    }
    this.toggleButton = null;
  }

  if (this._handlers.waveButton) {
    this.app.off("ui:wavebutton:create", this._handlers.waveButton, this);
  }

  if (this._handlers.toggleRequest) {
    this.app.off("htmlAvatarCustomizer:toggle", this._handlers.toggleRequest, this);
  }
  if (this._handlers.openRequest) {
    this.app.off("htmlAvatarCustomizer:open", this._handlers.openRequest, this);
  }
  if (this._handlers.closeRequest) {
    this.app.off("htmlAvatarCustomizer:close", this._handlers.closeRequest, this);
  }

  this._restoreBodyOverflow();
  this._destroyIframe();
  this._setInputsSuspended(false);

  if (this.container && this.container.parentNode) {
    this.container.parentNode.removeChild(this.container);
  }
  this.container = null;
  this.root = null;
  this.scrim = null;
  this.overlayShell = null;
  this.frameHost = null;
  this.closeButton = null;
  this.loadingEl = null;
  this.errorEl = null;
};
