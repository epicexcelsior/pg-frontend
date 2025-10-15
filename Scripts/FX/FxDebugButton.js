// Renders a temporary DOM button that fires an FX event for quick manual testing.
var FxDebugButton = pc.createScript('fxDebugButton');

FxDebugButton.attributes.add('label', {
    type: 'string',
    default: 'Trigger FX',
    title: 'Button Label'
});

FxDebugButton.attributes.add('effectId', {
    type: 'string',
    default: 'donation',
    title: 'Effect ID'
});

FxDebugButton.attributes.add('useDonationEvent', {
    type: 'boolean',
    default: false,
    title: 'Fire Donation Event',
    description: 'When enabled, fires effects:donation instead of fx:play.'
});

FxDebugButton.attributes.add('donationAmount', {
    type: 'number',
    default: 1.5,
    title: 'Donation Amount (SOL)'
});

FxDebugButton.prototype.initialize = function () {
    this.buttonElement = null;
    this._createButton();

    this.on('destroy', function () {
        this._removeButton();
    }, this);
};

FxDebugButton.prototype._createButton = function () {
    var existing = document.getElementById('fx-debug-button');
    if (existing) {
        this.buttonElement = existing;
        this._bindClick();
        return;
    }

    var style = document.createElement('style');
    style.id = 'fx-debug-button-style';
    style.innerHTML = [
        '#fx-debug-button {',
        '  position: fixed;',
        '  right: 16px;',
        '  bottom: 16px;',
        '  padding: 10px 18px;',
        '  background: rgba(35, 147, 255, 0.88);',
        '  color: white;',
        '  border: none;',
        '  border-radius: 20px;',
        '  font-size: 14px;',
        '  font-family: "Inter", "Helvetica Neue", Arial, sans-serif;',
        '  cursor: pointer;',
        '  z-index: 11000;',
        '  box-shadow: 0 10px 20px rgba(0,0,0,0.25);',
        '}',
        '#fx-debug-button:hover {',
        '  background: rgba(35, 147, 255, 1);',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    this.buttonElement = document.createElement('button');
    this.buttonElement.id = 'fx-debug-button';
    this.buttonElement.type = 'button';
    this.buttonElement.textContent = this.label || 'Trigger FX';
    document.body.appendChild(this.buttonElement);

    this._bindClick();
};

FxDebugButton.prototype._bindClick = function () {
    if (!this.buttonElement) {
        return;
    }
    var self = this;
    this.buttonElement.onclick = function () {
        self._onButtonClicked();
    };
};

FxDebugButton.prototype._onButtonClicked = function () {
    if (this.useDonationEvent) {
        this.app.fire('effects:donation', {
            senderUsername: 'Debug',
            sender: 'DebugWallet111111111111111111111111111111',
            recipientUsername: 'You',
            recipient: 'PlayerWallet2222222222222222222222222',
            amountSOL: this.donationAmount,
            message: 'Demo donation trigger'
        });
        this.app.fire('ui:donation:debug');
        return;
    }

    var overrides = null;
    if (this.entity && this.entity.getPosition) {
        overrides = { position: this.entity.getPosition().clone() };
    }

    this.app.fire('fx:play', this.effectId || 'donation', overrides);
};

FxDebugButton.prototype._removeButton = function () {
    if (this.buttonElement && this.buttonElement.parentElement) {
        this.buttonElement.parentElement.removeChild(this.buttonElement);
    }
    var style = document.getElementById('fx-debug-button-style');
    if (style && style.parentElement) {
        style.parentElement.removeChild(style);
    }
    this.buttonElement = null;
};
