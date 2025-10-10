// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\UI\HtmlBridge\HtmlBoothDescription.js
var HtmlBoothDescription = pc.createScript('htmlBoothDescription');

HtmlBoothDescription.prototype.initialize = function () {
    this.maxLength = 140;
    this.currentBoothId = null;
    this.pending = false;

    this.createDom();

    this.app.on('ui:showBoothDescriptionEditor', this.showEditor, this);
    this.app.on('ui:hideBoothDescriptionEditor', this.hideEditor, this);
    this.app.on('ui:boothDescription:update', this.onServerUpdate, this);
    this.app.on('ui:boothDescription:ack', this.onSaveAck, this);
    this.app.on('ui:boothDescription:error', this.onSaveError, this);
};

HtmlBoothDescription.prototype.createDom = function () {
    this.container = document.createElement('div');
    this.container.className = 'booth-description-editor';
    this.container.style.position = 'fixed';
    this.container.style.bottom = '96px';
    this.container.style.right = '32px';
    this.container.style.width = '320px';
    this.container.style.padding = '16px';
    this.container.style.borderRadius = '12px';
    this.container.style.background = 'rgba(15, 16, 32, 0.92)';
    this.container.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
    this.container.style.color = '#f5f6ff';
    this.container.style.fontFamily = 'Inter, sans-serif';
    this.container.style.display = 'none';
    this.container.style.zIndex = '1000';

    var title = document.createElement('div');
    title.textContent = 'Your Booth Message';
    title.style.fontSize = '14px';
    title.style.letterSpacing = '0.04em';
    title.style.textTransform = 'uppercase';
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';
    this.container.appendChild(title);

    this.textarea = document.createElement('textarea');
    this.textarea.setAttribute('maxlength', String(this.maxLength));
    this.textarea.placeholder = 'Share what your booth is about (max 140 characters)...';
    this.textarea.style.width = '100%';
    this.textarea.style.minHeight = '96px';
    this.textarea.style.padding = '12px';
    this.textarea.style.boxSizing = 'border-box';
    this.textarea.style.border = '1px solid rgba(255,255,255,0.16)';
    this.textarea.style.borderRadius = '8px';
    this.textarea.style.background = 'rgba(10, 12, 24, 0.8)';
    this.textarea.style.color = '#f0f2ff';
    this.textarea.style.fontSize = '14px';
    this.textarea.style.resize = 'none';
    this.container.appendChild(this.textarea);

    this.counter = document.createElement('div');
    this.counter.style.marginTop = '6px';
    this.counter.style.fontSize = '12px';
    this.counter.style.opacity = '0.7';
    this.container.appendChild(this.counter);

    this.feedback = document.createElement('div');
    this.feedback.style.marginTop = '6px';
    this.feedback.style.fontSize = '12px';
    this.feedback.style.minHeight = '16px';
    this.container.appendChild(this.feedback);

    this.saveButton = document.createElement('button');
    this.saveButton.textContent = 'Save Message';
    this.saveButton.style.marginTop = '8px';
    this.saveButton.style.width = '100%';
    this.saveButton.style.padding = '10px 12px';
    this.saveButton.style.borderRadius = '8px';
    this.saveButton.style.border = 'none';
    this.saveButton.style.background = '#4c6ef5';
    this.saveButton.style.color = '#fff';
    this.saveButton.style.fontSize = '14px';
    this.saveButton.style.cursor = 'pointer';
    this.saveButton.style.fontWeight = '600';
    this.container.appendChild(this.saveButton);

    document.body.appendChild(this.container);

    this.textarea.addEventListener('input', this.updateCounter.bind(this));
    this.textarea.addEventListener('keydown', this.onKeyDown.bind(this));
    this.saveButton.addEventListener('click', this.onSubmit.bind(this));

    this.updateCounter();
};

HtmlBoothDescription.prototype.onKeyDown = function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        this.onSubmit();
    }
};

HtmlBoothDescription.prototype.updateCounter = function () {
    var remaining = this.maxLength - this.textarea.value.length;
    this.counter.textContent = remaining + ' characters remaining';
    this.counter.style.color = remaining < 0 ? '#ff6b6b' : '#aeb3d6';
};

HtmlBoothDescription.prototype.showEditor = function (payload) {
    if (!payload || !payload.boothId) {
        return;
    }
    this.currentBoothId = payload.boothId;
    this.textarea.value = payload.description || '';
    this.updateCounter();
    this.feedback.textContent = '';
    this.feedback.style.color = '#aeb3d6';
    this.setPending(false);
    this.container.style.display = 'block';
    this.textarea.focus();
};

HtmlBoothDescription.prototype.hideEditor = function () {
    this.currentBoothId = null;
    this.container.style.display = 'none';
    this.setPending(false);
};

HtmlBoothDescription.prototype.onServerUpdate = function (payload) {
    if (payload && payload.boothId && payload.boothId === this.currentBoothId && !this.pending) {
        this.textarea.value = payload.description || '';
        this.updateCounter();
    }
};

HtmlBoothDescription.prototype.onSaveAck = function (payload) {
    if (payload && payload.boothId === this.currentBoothId) {
        this.feedback.textContent = 'Saved!';
        this.feedback.style.color = '#7dd87d';
        this.setPending(false);
    }
};

HtmlBoothDescription.prototype.onSaveError = function (payload) {
    var message = (payload && payload.reason) ? String(payload.reason) : 'Unable to save description.';
    this.feedback.textContent = message;
    this.feedback.style.color = '#ff6b6b';
    this.setPending(false);
};

HtmlBoothDescription.prototype.setPending = function (isPending) {
    this.pending = isPending;
    this.saveButton.disabled = !!isPending;
    this.saveButton.style.opacity = isPending ? '0.6' : '1';
};

HtmlBoothDescription.prototype.onSubmit = function () {
    if (!this.currentBoothId || this.pending) {
        return;
    }
    var value = this.textarea.value || '';
    var trimmed = value.trim();
    if (trimmed.length > this.maxLength) {
        trimmed = trimmed.substring(0, this.maxLength);
    }
    this.setPending(true);
    this.feedback.textContent = '';
    this.app.fire('network:send', 'booth:updateDescription', { text: trimmed });
};

HtmlBoothDescription.prototype.destroy = function () {
    this.app.off('ui:showBoothDescriptionEditor', this.showEditor, this);
    this.app.off('ui:hideBoothDescriptionEditor', this.hideEditor, this);
    this.app.off('ui:boothDescription:update', this.onServerUpdate, this);
    this.app.off('ui:boothDescription:ack', this.onSaveAck, this);
    this.app.off('ui:boothDescription:error', this.onSaveError, this);
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};
