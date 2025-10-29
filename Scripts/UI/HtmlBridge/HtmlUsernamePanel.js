var HtmlUsernamePanel = pc.createScript('htmlUsernamePanel');

HtmlUsernamePanel.attributes.add('css', { type: 'asset', assetType: 'css', title: 'Username Panel CSS' });
HtmlUsernamePanel.attributes.add('html', { type: 'asset', assetType: 'html', title: 'Username Panel HTML' });

HtmlUsernamePanel.prototype.initialize = function () {
    this._visible = false;
    this._pendingUsername = null;
    this._lastSubmitAt = 0;

    this._injectAssets();
    this._bindDom();
    this._registerEvents();

    if (this.app.uiManager && this.app.uiManager.registerComponent) {
        this.app.uiManager.registerComponent(this);
    }

    this.updateDisplay();
};

HtmlUsernamePanel.prototype._injectAssets = function () {
    var cssSource = this.css && this.css.resource ? (this.css.resource.data || this.css.resource) : null;
    if (cssSource) {
        this._styleEl = document.createElement('style');
        this._styleEl.innerHTML = cssSource;
        document.head.appendChild(this._styleEl);
    }

    var htmlSource = this.html && this.html.resource ? (this.html.resource.data || this.html.resource) : null;
    if (!htmlSource) {
        console.error('HtmlUsernamePanel: HTML asset missing or empty.');
        return;
    }

    this._container = document.createElement('div');
    this._container.innerHTML = htmlSource;
    document.body.appendChild(this._container);
};

HtmlUsernamePanel.prototype._bindDom = function () {
    this.rootEl = this._container ? this._container.querySelector('#username-panel-root') : null;
    this.modalEl = this._container ? this._container.querySelector('#username-modal') : null;
    this.closeButton = this._container ? this._container.querySelector('#username-close-btn') : null;
    this.cancelButton = this._container ? this._container.querySelector('#username-cancel-btn') : null;
    this.formEl = this._container ? this._container.querySelector('#username-form') : null;
    this.inputEl = this._container ? this._container.querySelector('#username-field') : null;
    this.feedbackEl = this._container ? this._container.querySelector('#username-feedback') : null;
    this.currentLabelEl = this._container ? this._container.querySelector('#username-current-label') : null;
    this.saveButton = this._container ? this._container.querySelector('#username-save-btn') : null;

    this._boundOpen = this.openPanel.bind(this);
    this._boundClose = this.closePanel.bind(this);
    this._boundCancel = this.handleCancel.bind(this);
    this._boundSubmit = this.handleSubmit.bind(this);
    this._boundBackdropClick = this.handleBackdropClick.bind(this);
    this._boundKeyDown = this.handleGlobalKeyDown.bind(this);
    this._boundInputFocus = this.handleInputFocus.bind(this);
    this._boundInputBlur = this.handleInputBlur.bind(this);

    if (this.closeButton) {
        this.closeButton.addEventListener('click', this._boundClose);
    }
    if (this.cancelButton) {
        this.cancelButton.addEventListener('click', this._boundCancel);
    }
    if (this.formEl) {
        this.formEl.addEventListener('submit', this._boundSubmit);
    }
    if (this.modalEl) {
        this.modalEl.addEventListener('click', this._boundBackdropClick);
    }
    if (this.inputEl) {
        this.inputEl.addEventListener('focus', this._boundInputFocus);
        this.inputEl.addEventListener('blur', this._boundInputBlur);
    }
    document.addEventListener('keydown', this._boundKeyDown, true);
};

HtmlUsernamePanel.prototype._registerEvents = function () {
    this.app.on('player:data:changed', this.onPlayerDataChanged, this);
    this.app.on('colyseus:connected', this.updateDisplay, this);
    this.app.on('player:spawned', this.updateDisplay, this);
    this.app.on('ui:usernamePanel:open', this.openPanel, this);
    this.app.on('ui:usernamePanel:close', this.closePanel, this);
};

HtmlUsernamePanel.prototype.handleInputFocus = function () {
    this.app.fire('ui:input:focus', { source: 'usernamePanel' });
};

HtmlUsernamePanel.prototype.handleInputBlur = function () {
    this.app.fire('ui:input:blur', { source: 'usernamePanel' });
};

HtmlUsernamePanel.prototype.destroy = function () {
    this.app.off('player:data:changed', this.onPlayerDataChanged, this);
    this.app.off('colyseus:connected', this.updateDisplay, this);
    this.app.off('player:spawned', this.updateDisplay, this);
    this.app.off('ui:usernamePanel:open', this.openPanel, this);
    this.app.off('ui:usernamePanel:close', this.closePanel, this);

    if (this.closeButton && this._boundClose) {
        this.closeButton.removeEventListener('click', this._boundClose);
    }
    if (this.cancelButton && this._boundCancel) {
        this.cancelButton.removeEventListener('click', this._boundCancel);
    }
    if (this.formEl && this._boundSubmit) {
        this.formEl.removeEventListener('submit', this._boundSubmit);
    }
    if (this.modalEl && this._boundBackdropClick) {
        this.modalEl.removeEventListener('click', this._boundBackdropClick);
    }
    if (this.inputEl && this._boundInputFocus) {
        this.inputEl.removeEventListener('focus', this._boundInputFocus);
    }
    if (this.inputEl && this._boundInputBlur) {
        this.inputEl.removeEventListener('blur', this._boundInputBlur);
    }
    document.removeEventListener('keydown', this._boundKeyDown, true);

    if (this._container && this._container.parentNode) {
        this._container.parentNode.removeChild(this._container);
    }
    if (this._styleEl && this._styleEl.parentNode) {
        this._styleEl.parentNode.removeChild(this._styleEl);
    }
};

HtmlUsernamePanel.prototype.handleBackdropClick = function (event) {
    if (event.target === this.modalEl) {
        this.closePanel();
    }
};

HtmlUsernamePanel.prototype.handleCancel = function () {
    this.closePanel();
};

HtmlUsernamePanel.prototype.handleGlobalKeyDown = function (event) {
    if (!this._visible) {
        return;
    }
    if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        this.closePanel();
    }
};

HtmlUsernamePanel.prototype.openPanel = function () {
    if (!this.modalEl || this._visible) {
        return;
    }
    this._visible = true;
    this.rootEl.style.display = 'block';
    this.modalEl.classList.add('visible');
    this.modalEl.setAttribute('aria-hidden', 'false');
    this._pendingUsername = null;
    this.showFeedback('', null);

    var current = this.getCurrentUsername();
    if (this.inputEl) {
        this.inputEl.value = current;
        var length = (current || '').length;
        try {
            this.inputEl.setSelectionRange(length, length);
        } catch (err) {
            // Unsupported on some mobile browsers
        }
        setTimeout(() => {
            this.inputEl.focus();
        }, 30);
    }

    if (this.app.mouse && this.app.mouse.disablePointerLock) {
        try {
            this.app.mouse.disablePointerLock();
        } catch (err) {
            console.warn('HtmlUsernamePanel: Failed to disable pointer lock.', err);
        }
    }
};

HtmlUsernamePanel.prototype.closePanel = function () {
    if (!this.modalEl || !this._visible) {
        return;
    }
    this._visible = false;
    this._pendingUsername = null;
    this.modalEl.classList.remove('visible');
    this.modalEl.setAttribute('aria-hidden', 'true');
    this.showFeedback('', null);

    if (this.app.mouse && this.app.mouse.enablePointerLock) {
        try {
            this.app.mouse.enablePointerLock();
        } catch (err) {
            console.warn('HtmlUsernamePanel: Failed to re-enable pointer lock.', err);
        }
    }
};

HtmlUsernamePanel.prototype.handleSubmit = function (event) {
    event.preventDefault();
    if (!this.inputEl || !this.saveButton) {
        return;
    }

    var now = Date.now();
    if (now - this._lastSubmitAt < 400) {
        return;
    }
    this._lastSubmitAt = now;

    var raw = this.inputEl.value;
    var sanitized = this.sanitizeUsername(raw);
    if (!sanitized) {
        this.showFeedback('Please enter a valid username.', 'error');
        return;
    }

    var current = this.getCurrentUsername();
    if (current && current === sanitized) {
        this.showFeedback('You already have this username.', 'info');
        return;
    }

    this.inputEl.value = sanitized;
    this.saveButton.disabled = true;
    this._pendingUsername = sanitized;
    this.showFeedback('Saving username...', 'info');

    this.app.fire('player:username:localUpdate', sanitized);
    this.app.fire('player:setUsername', sanitized);

    setTimeout(() => {
        if (this.saveButton) {
            this.saveButton.disabled = false;
        }
    }, 600);
};

HtmlUsernamePanel.prototype.onPlayerDataChanged = function (playerData) {
    var username = this.extractUsername(playerData);
    this.updateDisplay();
    if (!this._pendingUsername) {
        return;
    }
    if (username && username === this._pendingUsername) {
        this.showFeedback('Username updated!', 'success');
        this._pendingUsername = null;
        setTimeout(() => {
            this.closePanel();
        }, 180);
    }
};

HtmlUsernamePanel.prototype.extractUsername = function (playerData) {
    if (!playerData) {
        return '';
    }
    if (typeof playerData.getUsername === 'function') {
        return playerData.getUsername() || '';
    }
    if (typeof playerData.username === 'string') {
        return playerData.username;
    }
    return '';
};

HtmlUsernamePanel.prototype.getCurrentUsername = function () {
    var player = this.app.localPlayer && this.app.localPlayer.script ? this.app.localPlayer.script.playerData : null;
    if (player && typeof player.getUsername === 'function') {
        var name = player.getUsername();
        if (name) {
            return name;
        }
    }
    if (this.app.services && typeof this.app.services.get === 'function') {
        try {
            var serviceInstance = this.app.services.get('playerData');
            if (serviceInstance && typeof serviceInstance.getUsername === 'function') {
                var svcName = serviceInstance.getUsername();
                if (svcName) {
                    return svcName;
                }
            }
        } catch (err) {
            console.warn('HtmlUsernamePanel: Unable to resolve playerData service.', err);
        }
    }
    try {
        var stored = localStorage.getItem('userName') || '';
        return this.sanitizeUsername(stored);
    } catch (err) {
        return '';
    }
};

HtmlUsernamePanel.prototype.updateDisplay = function () {
    if (!this.currentLabelEl) {
        return;
    }
    var username = this.getCurrentUsername();
    if (username) {
        this.currentLabelEl.textContent = 'Current: ' + username;
        this.currentLabelEl.classList.remove('is-empty');
    } else {
        this.currentLabelEl.textContent = 'Set your username';
        this.currentLabelEl.classList.add('is-empty');
    }
};

HtmlUsernamePanel.prototype.showFeedback = function (message, variant) {
    if (!this.feedbackEl) {
        return;
    }
    this.feedbackEl.textContent = message || '';
    if (variant) {
        this.feedbackEl.setAttribute('data-variant', variant);
    } else {
        this.feedbackEl.removeAttribute('data-variant');
    }
};

HtmlUsernamePanel.prototype.sanitizeUsername = function (raw) {
    if (typeof raw !== 'string') {
        return '';
    }
    var withoutTags = raw.replace(/(<([^>]+)>)/gi, '');
    var collapsed = withoutTags.replace(/\s+/g, ' ').trim();
    if (!collapsed.length) {
        return '';
    }
    return collapsed.substring(0, 16);
};
