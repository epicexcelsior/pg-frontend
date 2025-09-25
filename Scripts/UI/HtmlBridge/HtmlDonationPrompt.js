var DonationPromptHtml = pc.createScript('donationPromptHtml');

DonationPromptHtml.attributes.add('css', { type: 'asset', assetType: 'css', title: 'Donation UI CSS' });
DonationPromptHtml.attributes.add('html', { type: 'asset', assetType: 'html', title: 'Donation UI HTML' });
DonationPromptHtml.attributes.add('solanaLogoTexture', { type: 'asset', assetType: 'texture', title: 'Solana Logo Texture' });

DonationPromptHtml.prototype.initialize = function () {
    if (this.css && this.css.resource) {
        var style = document.createElement('style');
        document.head.appendChild(style);
        style.innerHTML = this.css.resource;
    }

    this.container = document.createElement('div');
    this.container.innerHTML = this.html.resource;
    document.body.appendChild(this.container);

    this.donationUIEl = this.container.querySelector('#donationUI');
    if (!this.donationUIEl) {
        console.error("DonationPromptHtml: No element with id 'donationUI' found.");
        return;
    }
    
    // --- GSAP Check and Initialization ---
    if (typeof gsap === 'undefined') {
        console.error("DonationPromptHtml: GSAP library not found. Animations will be disabled. Make sure your bundle.js is loaded correctly.");
        this.donationUIEl.style.opacity = '0';
        this.donationUIEl.style.transform = 'translateY(100px)';
        this.donationUIEl.style.pointerEvents = 'none';
    } else {
        gsap.set(this.donationUIEl, { y: 100, opacity: 0, pointerEvents: 'none' });
    }

    // --- Element Querying ---
    this.solanaPayCheckbox = this.container.querySelector('#solanaPayCheckbox');
    this.solanaPayQRView = this.container.querySelector('#solanaPayQR');
    this.qrCodeCanvas = this.container.querySelector('#qrCodeCanvas');
    this.solanaPayLink = this.container.querySelector('#solanaPayLink');
    this.qrDoneBtn = this.container.querySelector('#qrDoneBtn');
    this.qrCancelBtn = this.container.querySelector('#qrCancelBtn');
    this.qrOverlay = this.container.querySelector('#qr-overlay');
    this.presetButtons = this.container.querySelectorAll('.donation-button');
    var goButton = this.container.querySelector('.go-button');
    this.donationSlider = this.container.querySelector('#donationSlider');
    this.donationNumber = this.container.querySelector('#donationNumber');

    // --- Event Listeners ---
    this.setupEventListeners(goButton);

    // Listen for global app events
    this.app.on('ui:showDonationPrompt', this.onShowPrompt, this);
    this.app.on('ui:hideDonationPrompt', this.onHidePrompt, this);
    this.app.on('donation:showQR', this.showQRView, this);
    this.app.on('donation:stateChanged', this.onDonationStateChanged, this);
};

DonationPromptHtml.prototype.setupEventListeners = function(goButton) {
    if (this.qrDoneBtn) this.qrDoneBtn.addEventListener('click', () => this.app.fire('solanapay:poll', { reference: this.currentPollReference, recipient: this.recipientAddress, amount: this.currentPollAmount }));
    if (this.qrCancelBtn) this.qrCancelBtn.addEventListener('click', () => this.hideQRView());

    const handleDonationClick = (amount, triggerElement) => {
        if (isNaN(amount) || !this.recipientAddress) return;
        const isSolanaPay = this.solanaPayCheckbox ? this.solanaPayCheckbox.checked : false;
        this.app.fire('ui:donate:request', { amount, recipient: this.recipientAddress, isSolanaPay, triggerElement });
    };

    this.presetButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const amount = parseFloat(btn.getAttribute('data-amount'));
            handleDonationClick(amount, btn);
        });
        if (typeof gsap !== 'undefined') {
            btn.addEventListener('mouseenter', () => gsap.to(btn, { duration: 0.2, scale: 1.1, ease: "power2.out" }));
            btn.addEventListener('mouseleave', () => gsap.to(btn, { duration: 0.2, scale: 1, ease: "power2.out" }));
        }
    });

    if (goButton) {
        goButton.addEventListener('click', () => {
            const amount = this.donationNumber ? parseFloat(this.donationNumber.value) : NaN;
            handleDonationClick(amount, goButton);
        });
         if (typeof gsap !== 'undefined') {
            goButton.addEventListener('mouseenter', () => gsap.to(goButton, { duration: 0.2, scale: 1.1, ease: "power2.out" }));
            goButton.addEventListener('mouseleave', () => gsap.to(goButton, { duration: 0.2, scale: 1, ease: "power2.out" }));
        }
    }

    if (this.donationSlider && this.donationNumber) {
        const linearToLog = (value) => Math.log10(value);
        const logToLinear = (value) => Math.pow(10, value);
        this.donationSlider.addEventListener('input', () => this.donationNumber.value = logToLinear(this.donationSlider.value).toFixed(2));
        this.donationNumber.addEventListener('input', () => {
            let val = parseFloat(this.donationNumber.value) || 0.01;
            val = Math.max(0.01, Math.min(69, val));
            this.donationNumber.value = val.toFixed(2);
            this.donationSlider.value = linearToLog(val);
        });
    }
};


DonationPromptHtml.prototype.show = function () {
    if (typeof gsap !== 'undefined') {
        gsap.to(this.donationUIEl, { duration: 0.5, y: 0, opacity: 1, pointerEvents: 'auto', ease: "expo.out" });
    } else {
        this.donationUIEl.style.opacity = '1';
        this.donationUIEl.style.transform = 'translateY(0px)';
        this.donationUIEl.style.pointerEvents = 'auto';
    }
};

DonationPromptHtml.prototype.hide = function () {
    if (typeof gsap !== 'undefined') {
        gsap.to(this.donationUIEl, { duration: 0.5, y: 100, opacity: 0, pointerEvents: 'none', ease: "expo.in" });
    } else {
        this.donationUIEl.style.opacity = '0';
        this.donationUIEl.style.transform = 'translateY(100px)';
        this.donationUIEl.style.pointerEvents = 'none';
    }
    this.hideQRView();
};

DonationPromptHtml.prototype.onShowPrompt = function (boothScript) {
    if (!boothScript || !boothScript.claimedBy) {
        this.hide();
        return;
    }
    this.recipientAddress = boothScript.claimedBy;
    this.show();
};

DonationPromptHtml.prototype.onHidePrompt = function () {
    if (this.donationUIEl.style.opacity > 0) {
        this.hide();
    }
};

DonationPromptHtml.prototype.onDonationStateChanged = function(data) {
    if (data.state === 'success' || data.state.startsWith('failed')) {
        if (this.solanaPayQRView && !this.solanaPayQRView.classList.contains('hidden')) {
            this.hideQRView();
        }
    }
};

DonationPromptHtml.prototype.showQRView = function(data) {
    if (!this.solanaPayQRView || !this.qrCodeCanvas || !this.solanaPayLink || !this.qrOverlay) return;

    this.currentPollReference = data.reference;
    this.currentPollAmount = data.amount;

    if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
        window.QRCode.toCanvas(this.qrCodeCanvas, data.solanaPayUrl, { width: 200 }, (error) => {
            if (error) console.error("QR Code generation failed:", error);
        });
    }

    this.solanaPayLink.href = data.solanaPayUrl;
    if(this.qrDoneBtn) {
        this.qrDoneBtn.disabled = false;
        this.qrDoneBtn.textContent = "I've Sent the Donation";
    }

    this.donationUIEl.classList.add('hidden');
    this.solanaPayQRView.classList.remove('hidden');
    this.qrOverlay.classList.remove('hidden');
};

DonationPromptHtml.prototype.hideQRView = function() {
    if (!this.solanaPayQRView || !this.qrOverlay) return;
    this.solanaPayQRView.classList.add('hidden');
    this.donationUIEl.classList.remove('hidden');
    this.qrOverlay.classList.add('hidden');
    
    this.app.fire('solanapay:poll:stop');
    this.currentPollReference = null;
};

DonationPromptHtml.prototype.destroy = function () {
    this.app.off('ui:showDonationPrompt', this.onShowPrompt, this);
    this.app.off('ui:hideDonationPrompt', this.onHidePrompt, this);
    this.app.off('donation:showQR', this.showQRView, this);
    this.app.off('donation:stateChanged', this.onDonationStateChanged, this);

    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};