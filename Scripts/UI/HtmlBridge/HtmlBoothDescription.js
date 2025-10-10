// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\UI\HtmlBridge\HtmlBoothDescription.js
var HtmlBoothDescription = pc.createScript('htmlBoothDescription');

HtmlBoothDescription.attributes.add('maxDescriptionLength', {
    type: 'number',
    default: 140,
    title: 'Max Description Length'
});
HtmlBoothDescription.attributes.add('panelWidth', {
    type: 'number',
    default: 320,
    title: 'Panel Width (px)'
});
HtmlBoothDescription.attributes.add('panelBottomOffset', {
    type: 'number',
    default: 96,
    title: 'Panel Bottom Offset (px)'
});
HtmlBoothDescription.attributes.add('panelRightOffset', {
    type: 'number',
    default: 32,
    title: 'Panel Right Offset (px)'
});
HtmlBoothDescription.attributes.add('lockMovement', {
    type: 'boolean',
    default: true,
    title: 'Lock Movement While Editing'
});
HtmlBoothDescription.attributes.add('movementLockReason', {
    type: 'string',
    default: 'boothDescription',
    title: 'Movement Lock Reason Id'
});

const HTML_BOOTH_DEFAULT_THEME = {
    colors: {
        surface: 'rgba(17, 17, 17, 0.92)',
        surface2: 'rgba(26, 28, 40, 0.94)',
        text: '#ffffff',
        textMuted: 'rgba(255,255,255,0.8)',
        accent: '#1df2a4',
        primary: '#4c6ef5',
        success: '#28a745',
        error: '#ff6b6b'
    },
    fonts: {
        family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        size: {
            small: '12px',
            medium: '14px',
            large: '16px'
        },
        weight: {
            regular: 400,
            semibold: 600
        }
    },
    styles: {
        borderRadius: '12px',
        boxShadow: '0 14px 28px rgba(0,0,0,0.28)',
        button: {
            padding: '10px 14px',
            borderRadius: '10px'
        },
        input: {
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.12)',
            backgroundColor: 'rgba(10, 12, 24, 0.82)'
        }
    }
};

HtmlBoothDescription.prototype.initialize = function () {
    this.theme = null;
    this.currentBoothId = null;
    this.pending = false;
    this.lockActive = false;
    this.lockEnabled = !!this.lockMovement;
    this.lockReason = typeof this.movementLockReason === 'string' && this.movementLockReason.length
        ? this.movementLockReason
        : 'boothDescription';

    this.config = {
        maxLength: typeof this.maxDescriptionLength === 'number' && this.maxDescriptionLength > 0
            ? Math.floor(this.maxDescriptionLength)
            : 140,
        panel: {
            width: Math.max(200, Number(this.panelWidth) || 320),
            bottom: Number.isFinite(this.panelBottomOffset) ? this.panelBottomOffset : 96,
            right: Number.isFinite(this.panelRightOffset) ? this.panelRightOffset : 32
        },
        events: {
            focus: 'ui:input:focus',
            blur: 'ui:input:blur'
        }
    };

    this._bindHandlers();
    this.createDom();

    if (this.app.uiManager && typeof this.app.uiManager.registerComponent === 'function') {
        this.app.uiManager.registerComponent(this);
        this.theme = this.app.uiManager.getTheme();
    } else {
        this.setTheme(window.Theme || HTML_BOOTH_DEFAULT_THEME);
    }

    this.applyTheme();
    this.updateCounter();

    this.app.on('ui:showBoothDescriptionEditor', this.showEditor, this);
    this.app.on('ui:hideBoothDescriptionEditor', this.hideEditor, this);
    this.app.on('ui:boothDescription:update', this.onServerUpdate, this);
    this.app.on('ui:boothDescription:ack', this.onSaveAck, this);
    this.app.on('ui:boothDescription:error', this.onSaveError, this);
};

HtmlBoothDescription.prototype._bindHandlers = function () {
    this._onTextareaInput = this.updateCounter.bind(this);
    this._onTextareaKeyDown = this.onKeyDown.bind(this);
    this._onTextareaFocus = this.handleFocus.bind(this);
    this._onTextareaBlur = this.handleBlur.bind(this);
    this._onSaveClick = this.onSubmit.bind(this);
};

HtmlBoothDescription.prototype.createDom = function () {
    this.container = document.createElement('div');
    this.container.className = 'booth-description-editor';
    this.container.style.position = 'fixed';
    this.container.style.bottom = `${this.config.panel.bottom}px`;
    this.container.style.right = `${this.config.panel.right}px`;
    this.container.style.width = `${this.config.panel.width}px`;
    this.container.style.padding = '16px';
    this.container.style.display = 'none';
    this.container.style.zIndex = '1020';

    var titleRow = document.createElement('div');
    titleRow.className = 'booth-description-header';

    this.titleLabel = document.createElement('div');
    this.titleLabel.textContent = 'Your Booth Message';
    titleRow.appendChild(this.titleLabel);

    this.container.appendChild(titleRow);

    this.textarea = document.createElement('textarea');
    this.textarea.setAttribute('maxlength', String(this.config.maxLength));
    this.textarea.placeholder = `Share what your booth is about (max ${this.config.maxLength} characters)...`;
    this.textarea.style.width = '100%';
    this.textarea.style.minHeight = '110px';
    this.textarea.style.boxSizing = 'border-box';
    this.textarea.style.resize = 'none';
    this.container.appendChild(this.textarea);

    var counterRow = document.createElement('div');
    counterRow.className = 'booth-description-meta';
    this.metaRow = counterRow;

    this.counter = document.createElement('div');
    counterRow.appendChild(this.counter);

    this.feedback = document.createElement('div');
    counterRow.appendChild(this.feedback);

    this.container.appendChild(counterRow);

    this.saveButton = document.createElement('button');
    this.saveButton.type = 'button';
    this.saveButton.className = 'booth-description-save';
    this.saveButton.textContent = 'Save Message';
    this.container.appendChild(this.saveButton);

    this.futurePlaceholder = document.createElement('div');
    this.futurePlaceholder.className = 'booth-description-future';

    // NOTE: Future booth customization controls (currently disabled placeholders).
    var futureTitle = document.createElement('div');
    futureTitle.className = 'future-title';
    futureTitle.textContent = 'Customization (Coming Soon)';
    this.futurePlaceholder.appendChild(futureTitle);

    var futureRowColor = document.createElement('div');
    futureRowColor.className = 'future-row';
    var colorLabel = document.createElement('label');
    colorLabel.textContent = 'Color Theme';
    var colorSelect = document.createElement('select');
    colorSelect.disabled = true;
    ['Default', 'Pastel Glow', 'Neon Night'].forEach(function (name) {
        var opt = document.createElement('option');
        opt.textContent = name;
        colorSelect.appendChild(opt);
    });
    futureRowColor.appendChild(colorLabel);
    futureRowColor.appendChild(colorSelect);

    var futureRowFont = document.createElement('div');
    futureRowFont.className = 'future-row';
    var fontLabel = document.createElement('label');
    fontLabel.textContent = 'Font Style';
    var fontSelect = document.createElement('select');
    fontSelect.disabled = true;
    ['Default', 'Serif Classic', 'Display Bold'].forEach(function (name) {
        var opt = document.createElement('option');
        opt.textContent = name;
        fontSelect.appendChild(opt);
    });
    futureRowFont.appendChild(fontLabel);
    futureRowFont.appendChild(fontSelect);

    var futureNote = document.createElement('div');
    futureNote.className = 'future-note';
    futureNote.textContent = 'These options are placeholders for upcoming booth customization (colors, fonts, layout).';

    this.futurePlaceholder.appendChild(futureRowColor);
    this.futurePlaceholder.appendChild(futureRowFont);
    this.futurePlaceholder.appendChild(futureNote);
    this.container.appendChild(this.futurePlaceholder);

    document.body.appendChild(this.container);

    this.textarea.addEventListener('input', this._onTextareaInput);
    this.textarea.addEventListener('keydown', this._onTextareaKeyDown);
    this.textarea.addEventListener('focus', this._onTextareaFocus);
    this.textarea.addEventListener('blur', this._onTextareaBlur);
    this.saveButton.addEventListener('click', this._onSaveClick);
};

HtmlBoothDescription.prototype.setTheme = function (theme) {
    this.theme = theme || HTML_BOOTH_DEFAULT_THEME;
    this.applyTheme();
};

HtmlBoothDescription.prototype.applyTheme = function () {
    var theme = this.theme || HTML_BOOTH_DEFAULT_THEME;
    var colors = theme.colors || HTML_BOOTH_DEFAULT_THEME.colors;
    var fonts = theme.fonts || HTML_BOOTH_DEFAULT_THEME.fonts;
    var styles = theme.styles || HTML_BOOTH_DEFAULT_THEME.styles;

    if (!this.container) {
        return;
    }

    this.container.style.background = colors.surface2 || colors.surface;
    this.container.style.boxShadow = styles.boxShadow || HTML_BOOTH_DEFAULT_THEME.styles.boxShadow;
    this.container.style.borderRadius = styles.borderRadius || HTML_BOOTH_DEFAULT_THEME.styles.borderRadius;
    this.container.style.color = colors.text || '#ffffff';
    this.container.style.fontFamily = fonts.family || HTML_BOOTH_DEFAULT_THEME.fonts.family;

    if (this.titleLabel) {
        this.titleLabel.style.fontSize = fonts.size?.medium || '14px';
        this.titleLabel.style.fontWeight = fonts.weight?.semibold || 600;
        this.titleLabel.style.letterSpacing = '0.05em';
        this.titleLabel.style.textTransform = 'uppercase';
        this.titleLabel.style.marginBottom = '10px';
        this.titleLabel.style.color = colors.textMuted || colors.text;
    }

    if (this.textarea) {
        this.textarea.style.padding = styles.input?.padding || HTML_BOOTH_DEFAULT_THEME.styles.input.padding;
        this.textarea.style.borderRadius = styles.input?.borderRadius || HTML_BOOTH_DEFAULT_THEME.styles.input.borderRadius;
        this.textarea.style.border = styles.input?.border || HTML_BOOTH_DEFAULT_THEME.styles.input.border;
        this.textarea.style.background = styles.input?.backgroundColor || HTML_BOOTH_DEFAULT_THEME.styles.input.backgroundColor;
        this.textarea.style.color = colors.text || '#ffffff';
        this.textarea.style.fontSize = fonts.size?.medium || '14px';
        this.textarea.style.fontFamily = fonts.family || HTML_BOOTH_DEFAULT_THEME.fonts.family;
    }

    if (this.counter) {
        this.counter.style.fontSize = fonts.size?.small || '12px';
        this.counter.style.color = colors.textMuted || '#aeb3d6';
    }

    if (this.metaRow) {
        this.metaRow.style.display = 'flex';
        this.metaRow.style.alignItems = 'center';
        this.metaRow.style.justifyContent = 'space-between';
        this.metaRow.style.gap = '12px';
        this.metaRow.style.marginTop = '8px';
    }

    if (this.feedback) {
        this.feedback.style.fontSize = fonts.size?.small || '12px';
        this.feedback.style.color = colors.textMuted || '#aeb3d6';
    }

    if (this.saveButton) {
        this.saveButton.style.marginTop = '10px';
        this.saveButton.style.width = '100%';
        this.saveButton.style.padding = styles.button?.padding || HTML_BOOTH_DEFAULT_THEME.styles.button.padding;
        this.saveButton.style.borderRadius = styles.button?.borderRadius || HTML_BOOTH_DEFAULT_THEME.styles.button.borderRadius;
        this.saveButton.style.border = 'none';
        this.saveButton.style.fontWeight = fonts.weight?.semibold || 600;
        this.saveButton.style.fontSize = fonts.size?.medium || '14px';
        this.saveButton.style.fontFamily = fonts.family || HTML_BOOTH_DEFAULT_THEME.fonts.family;
        this.saveButton.style.cursor = 'pointer';
        this.saveButton.style.background = colors.primary || '#4c6ef5';
        this.saveButton.style.color = colors.text || '#ffffff';
        this.saveButton.style.transition = 'transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease';
    }

    if (this.saveButton) {
        this.saveButton.onmouseover = () => {
            this.saveButton.style.transform = 'translateY(-1px)';
            this.saveButton.style.boxShadow = '0 10px 22px rgba(0,0,0,0.28)';
        };
        this.saveButton.onmouseout = () => {
            this.saveButton.style.transform = 'none';
            this.saveButton.style.boxShadow = 'none';
        };
    }

    if (this.futurePlaceholder) {
        this.futurePlaceholder.style.marginTop = '14px';
        this.futurePlaceholder.style.padding = '12px';
        this.futurePlaceholder.style.borderRadius = '10px';
        this.futurePlaceholder.style.background = 'rgba(255,255,255,0.06)';
        this.futurePlaceholder.style.color = colors.textMuted || '#d4d7f0';
        this.futurePlaceholder.style.fontSize = fonts.size?.small || '12px';
        this.futurePlaceholder.style.display = 'flex';
        this.futurePlaceholder.style.flexDirection = 'column';
        this.futurePlaceholder.style.gap = '8px';
    }

    if (this.futurePlaceholder) {
        var selects = this.futurePlaceholder.querySelectorAll('select');
        selects.forEach(function (select) {
            select.style.width = '100%';
            select.style.padding = '8px 10px';
            select.style.borderRadius = '8px';
            select.style.border = '1px dashed rgba(255,255,255,0.25)';
            select.style.background = 'rgba(0,0,0,0.15)';
            select.style.color = colors.textMuted || '#d4d7f0';
            select.style.fontFamily = fonts.family || 'inherit';
        });

        var labels = this.futurePlaceholder.querySelectorAll('label');
        labels.forEach(function (label) {
            label.style.fontSize = fonts.size?.small || '12px';
            label.style.fontWeight = fonts.weight?.regular || 400;
        });

        var note = this.futurePlaceholder.querySelector('.future-note');
        if (note) {
            note.style.fontSize = fonts.size?.small || '12px';
            note.style.opacity = '0.75';
            note.style.fontStyle = 'italic';
        }
    }
};

HtmlBoothDescription.prototype.onKeyDown = function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        this.onSubmit();
    }
};

HtmlBoothDescription.prototype.updateCounter = function () {
    if (!this.counter || !this.textarea) {
        return;
    }
    var remaining = this.config.maxLength - this.textarea.value.length;
    remaining = Math.max(-this.config.maxLength, remaining);
    this.counter.textContent = remaining + ' characters remaining';
    if (remaining < 0) {
        this.counter.style.color = (this.theme?.colors?.error) || '#ff6b6b';
    } else {
        this.counter.style.color = (this.theme?.colors?.textMuted) || '#aeb3d6';
    }
    if (this.textarea) {
        if (remaining < 0) {
            this.textarea.classList.add('booth-description-overlimit');
            this.textarea.style.outline = `1px solid ${(this.theme?.colors?.error) || '#ff6b6b'}`;
        } else {
            this.textarea.classList.remove('booth-description-overlimit');
            this.textarea.style.outline = 'none';
        }
    }
};

HtmlBoothDescription.prototype.showEditor = function (payload) {
    if (!payload || !payload.boothId) {
        return;
    }
    this.currentBoothId = payload.boothId;
    this.textarea.value = payload.description || '';
    this.updateCounter();
    this.feedback.textContent = '';
    if (this.feedback && this.theme) {
        this.feedback.style.color = (this.theme.colors && this.theme.colors.textMuted) || '#aeb3d6';
    }
    this.setPending(false);
    this.container.style.display = 'block';
};

HtmlBoothDescription.prototype.hideEditor = function () {
    this.currentBoothId = null;
    this.container.style.display = 'none';
    this.setPending(false);
    if (document.activeElement === this.textarea) {
        this.textarea.blur();
    }
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
        if (this.feedback && this.theme) {
            this.feedback.style.color = (this.theme.colors && this.theme.colors.success) || '#7dd87d';
        }
        this.setPending(false);
    }
};

HtmlBoothDescription.prototype.onSaveError = function (payload) {
    var message = (payload && payload.reason) ? String(payload.reason) : 'Unable to save description.';
    this.feedback.textContent = message;
    if (this.feedback && this.theme) {
        this.feedback.style.color = (this.theme.colors && this.theme.colors.error) || '#ff6b6b';
    }
    this.setPending(false);
};

HtmlBoothDescription.prototype.setPending = function (isPending) {
    this.pending = isPending;
    this.saveButton.disabled = !!isPending;
    this.saveButton.style.opacity = isPending ? '0.6' : '1';
    this.saveButton.textContent = isPending ? 'Saving…' : 'Save Message';
};

HtmlBoothDescription.prototype.onSubmit = function () {
    if (!this.currentBoothId || this.pending) {
        return;
    }
    var value = this.textarea.value || '';
    var trimmed = value.trim();
    if (trimmed.length > this.config.maxLength) {
        trimmed = trimmed.substring(0, this.config.maxLength);
    }
    this.setPending(true);
    this.feedback.textContent = '';
    this.app.fire('network:send', 'booth:updateDescription', { text: trimmed });
};

HtmlBoothDescription.prototype.handleFocus = function () {
    if (!this.lockEnabled || this.lockActive) {
        return;
    }
    this.lockActive = true;
    this.app.fire(this.config.events.focus, { source: this.lockReason });
};

HtmlBoothDescription.prototype.handleBlur = function () {
    if (!this.lockEnabled || !this.lockActive) {
        return;
    }
    this.lockActive = false;
    this.app.fire(this.config.events.blur, { source: this.lockReason });
};

HtmlBoothDescription.prototype.destroy = function () {
    this.app.off('ui:showBoothDescriptionEditor', this.showEditor, this);
    this.app.off('ui:hideBoothDescriptionEditor', this.hideEditor, this);
    this.app.off('ui:boothDescription:update', this.onServerUpdate, this);
    this.app.off('ui:boothDescription:ack', this.onSaveAck, this);
    this.app.off('ui:boothDescription:error', this.onSaveError, this);
    if (this.lockActive) {
        this.handleBlur();
    }
    if (this.textarea) {
        this.textarea.removeEventListener('input', this._onTextareaInput);
        this.textarea.removeEventListener('keydown', this._onTextareaKeyDown);
        this.textarea.removeEventListener('focus', this._onTextareaFocus);
        this.textarea.removeEventListener('blur', this._onTextareaBlur);
    }
    if (this.saveButton) {
        this.saveButton.removeEventListener('click', this._onSaveClick);
    }
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};
