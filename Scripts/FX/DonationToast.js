// Displays a lightweight donation toast UI element anchored to the DOM.
var DonationToast = pc.createScript('donationToast');

DonationToast.prototype.initialize = function () {
    this.app.on('effects:donation', this.onDonation, this);

    this.toastElement = null;
    this.hideTimeout = null;
    this._ensureToastElement();

    this.on('destroy', function () {
        this.app.off('effects:donation', this.onDonation, this);
        if (this.toastElement && this.toastElement.parentElement) {
            this.toastElement.parentElement.removeChild(this.toastElement);
        }
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
    }, this);
};

DonationToast.prototype.onDonation = function (e) {
    if (!this.toastElement) {
        return;
    }

    var sender = this.formatIdentity(e.senderUsername, e.sender);
    var recipient = this.formatIdentity(e.recipientUsername, e.recipient);
    var amount = parseFloat(e.amount || e.amountSOL || 0).toFixed(2);

    this.toastElement.innerHTML =
        sender +
        ' <span class="fx-toast-arrow">-></span> ' +
        recipient +
        ' <strong>+' + amount + ' SOL</strong>';

    this.show();
};

DonationToast.prototype._ensureToastElement = function () {
    if (document.getElementById('fx-donation-toast')) {
        this.toastElement = document.getElementById('fx-donation-toast');
        return;
    }

    var style = document.createElement('style');
    style.id = 'fx-donation-toast-style';
    style.innerHTML = [
        '#fx-donation-toast {',
        '  position: fixed;',
        '  bottom: 20px;',
        '  left: 50%;',
        '  transform: translate(-50%, 150%);',
        '  background-color: rgba(0, 0, 0, 0.78);',
        '  color: #fff;',
        '  padding: 8px 16px;',
        '  border-radius: 24px;',
        '  font-family: "Inter", "Helvetica Neue", Arial, sans-serif;',
        '  font-size: 14px;',
        '  letter-spacing: 0.01em;',
        '  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.28);',
        '  z-index: 10000;',
        '  pointer-events: none;',
        '  transition: transform 0.36s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease-out;',
        '  opacity: 0;',
        '  white-space: nowrap;',
        '}',
        '#fx-donation-toast.visible {',
        '  transform: translate(-50%, 0);',
        '  opacity: 1;',
        '}',
        '#fx-donation-toast .fx-toast-arrow {',
        '  opacity: 0.7;',
        '  margin: 0 6px;',
        '}',
        '#fx-donation-toast strong {',
        '  margin-left: 8px;',
        '  color: #FFE070;',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    this.toastElement = document.createElement('div');
    this.toastElement.id = 'fx-donation-toast';
    document.body.appendChild(this.toastElement);
};

DonationToast.prototype.show = function () {
    if (!this.toastElement) {
        return;
    }

    if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
    }

    this.toastElement.classList.add('visible');

    var self = this;
    this.hideTimeout = setTimeout(function () {
        if (self.toastElement) {
            self.toastElement.classList.remove('visible');
        }
        self.hideTimeout = null;
    }, 2500);
};

DonationToast.prototype.formatIdentity = function (username, address) {
    if (username && username.trim) {
        var trimmed = username.trim();
        if (trimmed.length) {
            return trimmed;
        }
    }
    if (address) {
        return address.substring(0, 4) + '...' + address.substring(address.length - 4);
    }
    return 'Someone';
};
