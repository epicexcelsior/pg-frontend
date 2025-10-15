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

    this.animationConfig = {
        enabled: true,
        durations: { standard: 0.24, quick: 0.16 },
        easings: { entrance: 'power3.out', exit: 'power2.in' },
        multiplier: 1
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

HtmlBoothDescription.prototype._ensureStyles = function () {
    if (HtmlBoothDescription._stylesInjected) {
        return;
    }
    var style = document.createElement('style');
    style.id = 'booth-description-styles';
    style.textContent = `
    .booth-description-editor {
        position: fixed;
        bottom: var(--booth-bottom-offset, 96px);
        right: var(--booth-right-offset, 32px);
        width: var(--booth-panel-width, 320px);
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 20px;
        border-radius: 20px;
        background: var(--booth-surface, rgba(17, 22, 34, 0.94));
        border: 1px solid var(--booth-border, rgba(255, 255, 255, 0.08));
        box-shadow: var(--booth-shadow, 0 24px 52px rgba(0, 0, 0, 0.45));
        color: var(--booth-text, #ffffff);
        font-family: var(--font-family, 'Segoe UI', sans-serif);
        backdrop-filter: blur(18px);
        z-index: 5020;
        opacity: 0;
        pointer-events: none;
        transform-origin: bottom right;
        transform: translate3d(0, 28px, 0) scale(0.95);
        transition: opacity var(--animation-duration-standard, 0.26s) ease, transform var(--animation-duration-standard, 0.26s) ease;
    }
    .booth-description-editor.is-visible {
        opacity: 1;
        pointer-events: auto;
        transform: none;
    }
    .booth-description-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .booth-description-title {
        font-size: 15px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-weight: 600;
        color: var(--booth-text-muted, rgba(255, 255, 255, 0.76));
    }
    .booth-description-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 12px;
        color: var(--booth-text-muted, rgba(255, 255, 255, 0.7));
    }
    .booth-description-counter {
        font-variant-numeric: tabular-nums;
    }
    .booth-description-feedback {
        font-size: 12px;
        color: var(--booth-text-muted, rgba(255, 255, 255, 0.7));
        transition: color 0.2s ease;
    }
    .booth-description-textarea {
        width: 100%;
        min-height: 120px;
        border-radius: 16px;
        border: 1px solid var(--booth-input-border, rgba(255, 255, 255, 0.12));
        background: var(--booth-input-surface, rgba(12, 16, 28, 0.82));
        color: var(--booth-text, #ffffff);
        padding: 14px;
        font-size: 14px;
        line-height: 1.45;
        resize: none;
        box-shadow: 0 18px 38px rgba(0, 0, 0, 0.18);
        transition: border var(--animation-duration-quick, 0.18s) ease, box-shadow var(--animation-duration-quick, 0.18s) ease;
    }
    .booth-description-textarea:focus {
        outline: none;
        border-color: var(--accent-color, #1df2a4);
        box-shadow: 0 0 0 2px rgba(29, 242, 164, 0.32);
    }
    .booth-description-textarea.booth-description-overlimit {
        border-color: var(--booth-error-color, #ff6b6b);
        box-shadow: 0 0 0 2px rgba(255, 107, 107, 0.28);
    }
    .booth-description-save {
        width: 100%;
        padding: 14px 18px;
        border-radius: 14px;
        border: none;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        background: linear-gradient(135deg, var(--accent-color, #1df2a4), var(--accent2-color, #1de8f2));
        color: var(--text-dark-color, #10151f);
        box-shadow: 0 16px 32px rgba(29, 242, 164, 0.28);
        transition: transform var(--animation-duration-quick, 0.18s) ease, box-shadow var(--animation-duration-quick, 0.18s) ease;
    }
    .booth-description-save:hover {
        transform: translateY(-1px);
        box-shadow: 0 18px 42px rgba(29, 242, 164, 0.32);
    }
    .booth-description-save:disabled {
        opacity: 0.55;
        cursor: default;
        box-shadow: none;
        transform: none;
    }
    .booth-description-future {
        border-radius: 14px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--booth-text-muted, rgba(255, 255, 255, 0.72));
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-size: 12px;
    }
    .booth-description-future .future-title {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
    }
    .booth-description-future .future-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .booth-description-future label {
        font-size: 12px;
        font-weight: 500;
        opacity: 0.8;
    }
    .booth-description-future select {
        border-radius: 10px;
        border: 1px dashed rgba(255, 255, 255, 0.22);
        background: rgba(0, 0, 0, 0.15);
        color: var(--booth-text-muted, rgba(255, 255, 255, 0.8));
        padding: 8px 10px;
        font-size: 12px;
    }
    .booth-description-future .future-note {
        font-size: 12px;
        opacity: 0.7;
        font-style: italic;
    }
    @media (max-width: 720px) {
        .booth-description-editor {
            right: max(16px, env(safe-area-inset-right));
            left: max(16px, env(safe-area-inset-left));
            width: auto;
        }
    }
    `;
    document.head.appendChild(style);
    HtmlBoothDescription._stylesInjected = true;
};

HtmlBoothDescription.prototype.createDom = function () {
    this._ensureStyles();

    this.container = document.createElement('div');
    this.container.className = 'booth-description-editor';
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');
    this.container.setAttribute('aria-hidden', 'true');
    this.container.style.setProperty('--booth-panel-width', this.config.panel.width + 'px');
    this.container.style.setProperty('--booth-bottom-offset', this.config.panel.bottom + 'px');
    this.container.style.setProperty('--booth-right-offset', this.config.panel.right + 'px');

    var titleRow = document.createElement('div');
    titleRow.className = 'booth-description-header';

    this.titleLabel = document.createElement('div');
    this.titleLabel.className = 'booth-description-title';
    this.titleLabel.textContent = 'Your Booth Message';
    titleRow.appendChild(this.titleLabel);

    this.container.appendChild(titleRow);

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'booth-description-textarea';
    this.textarea.setAttribute('maxlength', String(this.config.maxLength));
    this.textarea.placeholder = `Share what your booth is about (max ${this.config.maxLength} characters)...`;
    this.container.appendChild(this.textarea);

    var counterRow = document.createElement('div');
    counterRow.className = 'booth-description-meta';
    this.metaRow = counterRow;

    this.counter = document.createElement('div');
    this.counter.className = 'booth-description-counter';
    counterRow.appendChild(this.counter);

    this.feedback = document.createElement('div');
    this.feedback.className = 'booth-description-feedback';
    counterRow.appendChild(this.feedback);

    this.container.appendChild(counterRow);

    this.saveButton = document.createElement('button');
    this.saveButton.type = 'button';
    this.saveButton.className = 'booth-description-save';
    this.saveButton.textContent = 'Save Message';
    this.container.appendChild(this.saveButton);

    this.futurePlaceholder = document.createElement('div');
    this.futurePlaceholder.className = 'booth-description-future';

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
    colorSelect.setAttribute('aria-disabled', 'true');
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
    fontSelect.setAttribute('aria-disabled', 'true');
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

HtmlBoothDescription.prototype.setAnimationConfig = function (config) {
    if (!config) {
        return;
    }
    this.animationConfig = Object.assign({}, this.animationConfig, config);
};

HtmlBoothDescription.prototype.applyTheme = function () {
    var theme = this.theme || HTML_BOOTH_DEFAULT_THEME;
    var colors = theme.colors || HTML_BOOTH_DEFAULT_THEME.colors;
    var fonts = theme.fonts || HTML_BOOTH_DEFAULT_THEME.fonts;
    var styles = theme.styles || HTML_BOOTH_DEFAULT_THEME.styles;

    if (!this.container) {
        return;
    }

    this.container.style.setProperty('--booth-surface', colors.surface2 || colors.surface || 'rgba(17, 22, 34, 0.94)');
    this.container.style.setProperty('--booth-border', 'rgba(255, 255, 255, 0.08)');
    this.container.style.setProperty('--booth-shadow', styles.boxShadow || '0 24px 52px rgba(0, 0, 0, 0.45)');
    this.container.style.setProperty('--booth-text', colors.text || '#ffffff');
    this.container.style.setProperty('--booth-text-muted', colors.textMuted || 'rgba(255, 255, 255, 0.72)');
    this.container.style.setProperty('--booth-input-border', styles.input?.border || '1px solid rgba(255, 255, 255, 0.12)');
    this.container.style.setProperty('--booth-input-surface', styles.input?.backgroundColor || 'rgba(12, 16, 28, 0.82)');
    this.container.style.setProperty('--booth-error-color', colors.error || '#ff6b6b');
    this.container.style.setProperty('--accent-color', colors.accent || '#1df2a4');
    this.container.style.setProperty('--accent2-color', colors.accent2 || colors.primary || '#1de8f2');
    this.container.style.fontFamily = fonts.family || HTML_BOOTH_DEFAULT_THEME.fonts.family;

    if (this.feedback) {
        this.feedback.style.color = colors.textMuted || 'rgba(255, 255, 255, 0.72)';
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
        } else {
            this.textarea.classList.remove('booth-description-overlimit');
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
    this.container.classList.add('is-visible');
    this.container.setAttribute('aria-hidden', 'false');
    this._animatePanel(true);
};

HtmlBoothDescription.prototype.hideEditor = function () {
    this.currentBoothId = null;
    this.setPending(false);
    var self = this;
    var duration = this._animatePanel(false);
    var finalize = function () {
        if (!self.container) {
            return;
        }
        self.container.classList.remove('is-visible');
        self.container.setAttribute('aria-hidden', 'true');
    };
    if (duration > 0 && window.gsap && this._shouldAnimate()) {
        gsap.delayedCall(duration, finalize);
    } else {
        finalize();
    }
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
    if (this.saveButton) {
        this.saveButton.disabled = !!isPending;
        this.saveButton.textContent = isPending ? 'Saving…' : 'Save Message';
    }
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

HtmlBoothDescription.prototype._shouldAnimate = function () {
    return this.animationConfig && this.animationConfig.enabled !== false;
};

HtmlBoothDescription.prototype._animatePanel = function (isOpening) {
    if (!window.gsap || !this._shouldAnimate() || !this.container) {
        if (!isOpening) {
            this.container.style.opacity = '';
            this.container.style.transform = '';
        }
        return 0;
    }
    var base = (this.animationConfig.durations && this.animationConfig.durations.standard) || 0.24;
    var duration = Math.max(0.14, base * (this.animationConfig.multiplier || 1));
    var easeIn = (this.animationConfig.easings && this.animationConfig.easings.entrance) || 'power3.out';
    var easeOut = (this.animationConfig.easings && this.animationConfig.easings.exit) || 'power2.in';

    gsap.killTweensOf(this.container);
    if (isOpening) {
        gsap.fromTo(this.container,
            { opacity: 0, y: 30, scale: 0.94 },
            {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: duration,
                ease: easeIn,
                onComplete: function (target) {
                    target.style.opacity = '';
                    target.style.transform = '';
                },
                onCompleteParams: [this.container]
            }
        );
        return duration;
    }

    var closingDuration = Math.max(0.12, duration * 0.82);
    gsap.to(this.container, {
        opacity: 0,
        y: 24,
        scale: 0.92,
        duration: closingDuration,
        ease: easeOut,
        onComplete: function (target) {
            target.style.opacity = '';
            target.style.transform = '';
        },
        onCompleteParams: [this.container]
    });
    return closingDuration;
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
