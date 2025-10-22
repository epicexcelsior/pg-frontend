// Displays a professional donation toast UI element with VFX-grade styling and animations.
var DonationToast = pc.createScript('donationToast');

DonationToast.prototype.initialize = function () {
    this.app.on('effects:donation', this.onDonation, this);

    this.toastElement = null;
    this.hideTimeout = null;
    this.toastQueue = [];
    this.isShowingToast = false;
    this._ensureToastElement();

    this.on('destroy', function () {
        this.app.off('effects:donation', this.onDonation, this);
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        if (this.toastElement && this.toastElement.parentElement) {
            this.toastElement.parentElement.removeChild(this.toastElement);
        }
        this.toastQueue = [];
    }, this);
};

DonationToast.prototype.onDonation = function (e) {
    if (!this.toastElement) {
        return;
    }

    var sender = this.formatIdentity(e.senderUsername, e.sender);
    var recipient = this.formatIdentity(e.recipientUsername, e.recipient);
    var amount = parseFloat(e.amount || e.amountSOL || 0).toFixed(2);

    var html = 
        '<div class="fx-toast-content">' +
        '  <div class="fx-toast-from">' +
        '    <span class="fx-toast-label">From</span>' +
        '    <span class="fx-toast-name">' + this.escapeHtml(sender) + '</span>' +
        '  </div>' +
        '  <div class="fx-toast-arrow">→</div>' +
        '  <div class="fx-toast-to">' +
        '    <span class="fx-toast-label">To</span>' +
        '    <span class="fx-toast-name">' + this.escapeHtml(recipient) + '</span>' +
        '  </div>' +
        '  <div class="fx-toast-amount">+' + amount + ' SOL</div>' +
        '</div>';

    this.toastElement.innerHTML = html;
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
        '  bottom: 24px;',
        '  left: 50%;',
        '  transform: translate(-50%, 200%) scale(0.8);',
        '  background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.08) 100%);',
        '  backdrop-filter: blur(20px);',
        '  -webkit-backdrop-filter: blur(20px);',
        '  color: #fff;',
        '  padding: 16px 20px;',
        '  border-radius: 16px;',
        '  border: 1px solid rgba(255, 255, 255, 0.25);',
        '  font-family: "Inter", "Helvetica Neue", Arial, sans-serif;',
        '  font-size: 13px;',
        '  font-weight: 500;',
        '  letter-spacing: 0.02em;',
        '  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2);',
        '  z-index: 10000;',
        '  pointer-events: none;',
        '  opacity: 0;',
        '  will-change: transform, opacity;',
        '}',
        '',
        '#fx-donation-toast.visible {',
        '  animation: fx-toast-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;',
        '}',
        '',
        '#fx-donation-toast.hiding {',
        '  animation: fx-toast-out 0.4s cubic-bezier(0.4, 0, 1, 1) forwards;',
        '}',
        '',
        '@keyframes fx-toast-in {',
        '  0% {',
        '    transform: translate(-50%, 200%) scale(0.8);',
        '    opacity: 0;',
        '  }',
        '  60% {',
        '    transform: translate(-50%, -8%) scale(1.02);',
        '    opacity: 1;',
        '  }',
        '  100% {',
        '    transform: translate(-50%, 0) scale(1);',
        '    opacity: 1;',
        '  }',
        '}',
        '',
        '@keyframes fx-toast-out {',
        '  0% {',
        '    transform: translate(-50%, 0) scale(1);',
        '    opacity: 1;',
        '  }',
        '  100% {',
        '    transform: translate(-50%, 120%) scale(0.9);',
        '    opacity: 0;',
        '  }',
        '}',
        '',
        '.fx-toast-content {',
        '  display: flex;',
        '  align-items: center;',
        '  gap: 12px;',
        '  min-width: 320px;',
        '}',
        '',
        '.fx-toast-from,',
        '.fx-toast-to {',
        '  display: flex;',
        '  flex-direction: column;',
        '  gap: 2px;',
        '  min-width: 0;',
        '}',
        '',
        '.fx-toast-label {',
        '  font-size: 10px;',
        '  letter-spacing: 0.1em;',
        '  text-transform: uppercase;',
        '  color: rgba(255, 255, 255, 0.6);',
        '  font-weight: 600;',
        '}',
        '',
        '.fx-toast-name {',
        '  font-size: 13px;',
        '  font-weight: 600;',
        '  color: #ffffff;',
        '  word-break: break-all;',
        '  line-height: 1.2;',
        '}',
        '',
        '.fx-toast-arrow {',
        '  color: rgba(255, 224, 112, 0.8);',
        '  font-size: 16px;',
        '  font-weight: 700;',
        '  flex-shrink: 0;',
        '  animation: fx-arrow-pulse 1.2s ease-in-out infinite;',
        '}',
        '',
        '@keyframes fx-arrow-pulse {',
        '  0%, 100% {',
        '    opacity: 0.6;',
        '    transform: translateX(0);',
        '  }',
        '  50% {',
        '    opacity: 1;',
        '    transform: translateX(2px);',
        '  }',
        '}',
        '',
        '.fx-toast-amount {',
        '  flex-shrink: 0;',
        '  font-size: 14px;',
        '  font-weight: 700;',
        '  color: #FFE070;',
        '  background: linear-gradient(135deg, rgba(255, 224, 112, 0.2) 0%, rgba(255, 200, 0, 0.1) 100%);',
        '  padding: 6px 12px;',
        '  border-radius: 8px;',
        '  border: 1px solid rgba(255, 224, 112, 0.3);',
        '  animation: fx-amount-glow 2s ease-in-out infinite;',
        '  text-shadow: 0 0 12px rgba(255, 224, 112, 0.4);',
        '}',
        '',
        '@keyframes fx-amount-glow {',
        '  0%, 100% {',
        '    box-shadow: 0 0 8px rgba(255, 224, 112, 0.2);',
        '  }',
        '  50% {',
        '    box-shadow: 0 0 16px rgba(255, 224, 112, 0.4);',
        '  }',
        '}',
        '',
        '@media (max-width: 600px) {',
        '  #fx-donation-toast {',
        '    padding: 12px 16px;',
        '  }',
        '  .fx-toast-content {',
        '    gap: 8px;',
        '    min-width: 280px;',
        '  }',
        '  .fx-toast-name {',
        '    font-size: 12px;',
        '  }',
        '  .fx-toast-amount {',
        '    font-size: 13px;',
        '  }',
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

    this.toastElement.classList.remove('hiding');
    this.toastElement.classList.add('visible');
    this.isShowingToast = true;

    var self = this;
    this.hideTimeout = setTimeout(function () {
        if (self.toastElement && self.isShowingToast) {
            self.toastElement.classList.remove('visible');
            self.toastElement.classList.add('hiding');
            self.isShowingToast = false;
        }
        self.hideTimeout = null;
    }, 3200);
};

DonationToast.prototype.formatIdentity = function (username, address) {
    if (username && typeof username === 'string') {
        var trimmed = username.trim();
        if (trimmed.length) {
            return trimmed;
        }
    }
    if (address && typeof address === 'string') {
        if (address.length > 12) {
            return address.substring(0, 6) + '...' + address.substring(address.length - 6);
        }
        return address;
    }
    return 'Anonymous';
};

DonationToast.prototype.escapeHtml = function (text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};
