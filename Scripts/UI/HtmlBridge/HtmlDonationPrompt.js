var DonationPromptHtml = pc.createScript('donationPromptHtml');

DonationPromptHtml.attributes.add('css', { type: 'asset', assetType: 'css', title: 'Donation UI CSS' });
DonationPromptHtml.attributes.add('html', { type: 'asset', assetType: 'html', title: 'Donation UI HTML' });
DonationPromptHtml.attributes.add('solanaLogoTexture', { type: 'asset', assetType: 'texture', title: 'Solana Logo Texture' });

DonationPromptHtml.prototype.initialize = function () {
    var cssSource = this.css && this.css.resource ? (this.css.resource.data || this.css.resource) : null;
    if (cssSource) {
        var style = document.createElement('style');
        style.innerHTML = cssSource;
        document.head.appendChild(style);
    }

    var htmlSource = this.html && this.html.resource ? (this.html.resource.data || this.html.resource) : null;
    if (!htmlSource) {
        console.error('DonationPromptHtml: HTML asset missing or empty.');
        return;
    }

    this.container = document.createElement('div');
    this.container.innerHTML = htmlSource;
    document.body.appendChild(this.container);

    this.donationUIEl = this.container.querySelector('#donationUI');
    if (!this.donationUIEl) {
        console.error("DonationPromptHtml: No element with id 'donationUI' found.");
        return;
    }

    if (typeof gsap === 'undefined') {
        console.error('DonationPromptHtml: GSAP not found. Falling back to basic styles.');
        this.donationUIEl.style.opacity = '0';
        this.donationUIEl.style.transform = 'translateY(100px)';
        this.donationUIEl.style.pointerEvents = 'none';
    } else {
        gsap.set(this.donationUIEl, { y: 100, opacity: 0, pointerEvents: 'none' });
    }

    this.solanaPayCheckbox = this.container.querySelector('#solanaPayCheckbox');
    this.solanaPayQRView = this.container.querySelector('#solanaPayQR');
    this.qrCodeCanvas = this.container.querySelector('#qrCodeCanvas');
    this.solanaPayLink = this.container.querySelector('#solanaPayLink');
    this.qrDoneBtn = this.container.querySelector('#qrDoneBtn');
    this.qrCancelBtn = this.container.querySelector('#qrCancelBtn');
    this.qrOverlay = this.container.querySelector('#qr-overlay');
    this.presetButtons = this.container.querySelectorAll('.donation-button');
    this.donationSlider = this.container.querySelector('#donationSlider');
    this.donationNumber = this.container.querySelector('#donationNumber');
    var goButton = this.container.querySelector('.go-button');

    this.setupEventListeners(goButton);

    if (this.app.uiManager && this.app.uiManager.registerComponent) {
        this.app.uiManager.registerComponent(this);
    }

    if (this.solanaLogoTexture && this.solanaLogoTexture.resource) {
        this.setDonationButtonBackgrounds();
    } else if (this.solanaLogoTexture) {
        this.solanaLogoTexture.ready(this.setDonationButtonBackgrounds.bind(this));
    }

    this.currentPollReference = null;
    this.currentPollAmount = null;

    this.app.on('ui:showDonationPrompt', this.onShowPrompt, this);
    this.app.on('ui:hideDonationPrompt', this.onHidePrompt, this);
    this.app.on('donation:showQR', this.showQRView, this);
    this.app.on('donation:stateChanged', this.onDonationStateChanged, this);
};

DonationPromptHtml.prototype.setupEventListeners = function (goButton) {
    if (this.qrDoneBtn) {
        this.qrDoneBtn.addEventListener('click', () => {
            if (this.currentPollReference && this.recipientAddress && this.currentPollAmount) {
                this.qrDoneBtn.disabled = true;
                this.qrDoneBtn.textContent = 'Polling...';
                this.app.fire('solanapay:poll', {
                    reference: this.currentPollReference,
                    recipient: this.recipientAddress,
                    amount: this.currentPollAmount
                });
            }
        });
    }

    if (this.qrCancelBtn) {
        this.qrCancelBtn.addEventListener('click', () => this.hideQRView());
    }

    var formatAmount = function (value) {
        if (!isFinite(value)) {
            return '0.001';
        }
        var num = Number(value);
        if (num < 0.001) return '0.001';
        return num.toFixed(3);
    };

    var clampAmount = function (value) {
        var num = parseFloat(value) || 0.001;
        if (num < 0.001) num = 0.001;
        if (num > 69.42) num = 69.42;
        return num;
    };

    var linearToLog = (value) => Math.log10(value);
    var logToLinear = (value) => Math.pow(10, value);

    var syncControls = (rawAmount, isManual) => {
        if (!this.donationSlider || !this.donationNumber) return;
        var amount = clampAmount(rawAmount);
        this.donationNumber.value = formatAmount(amount);
        this.donationSlider.value = linearToLog(amount);
    };

    var handleDonationRequest = (amount, triggerElement) => {
        if (isNaN(amount) || amount <= 0 || !this.recipientAddress) {
            return;
        }
        var isSolanaPay = this.solanaPayCheckbox ? this.solanaPayCheckbox.checked : false;
        this.app.fire('ui:donate:request', {
            amount: clampAmount(amount),
            recipient: this.recipientAddress,
            isSolanaPay: isSolanaPay,
            triggerElement: triggerElement
        });
    };

    this.presetButtons.forEach((btn) => {
        var amountAttr = parseFloat(btn.getAttribute('data-amount'));
        // Text is handled by CSS ::before pseudo-element instead
        if (typeof gsap !== 'undefined') {
            btn.addEventListener('mouseenter', () => gsap.to(btn, { duration: 0.2, scale: 1.1, ease: 'power2.out' }));
            btn.addEventListener('mouseleave', () => gsap.to(btn, { duration: 0.2, scale: 1, ease: 'power2.out' }));
        }
        btn.addEventListener('click', () => {
            var amount = parseFloat(btn.getAttribute('data-amount'));
            if (!isNaN(amount)) {
                syncControls(amount);
                handleDonationRequest(amount, btn);
                this.app.fire('ui:playSound', 'ui_click_default');
            }
        });
    });

    if (goButton) {
        if (typeof gsap !== 'undefined') {
            goButton.addEventListener('mouseenter', () => gsap.to(goButton, { duration: 0.2, scale: 1.1, ease: 'power2.out' }));
            goButton.addEventListener('mouseleave', () => gsap.to(goButton, { duration: 0.2, scale: 1, ease: 'power2.out' }));
        }
        goButton.addEventListener('click', () => {
            var amount = this.donationNumber ? parseFloat(this.donationNumber.value) : NaN;
            if (!isNaN(amount)) {
                syncControls(amount, true);
                handleDonationRequest(amount, goButton);
                this.app.fire('ui:playSound', 'donation_give_success');
            }
        });
    }

    if (this.donationSlider && this.donationNumber) {
        var initialValue = clampAmount(this.donationNumber.value);
        this.donationSlider.value = linearToLog(initialValue);
        this.donationNumber.value = formatAmount(initialValue);

        this.donationSlider.addEventListener('input', () => {
            var sliderAmount = logToLinear(parseFloat(this.donationSlider.value));
            this.donationNumber.value = formatAmount(sliderAmount);
            this.app.fire('ui:playSound', 'donation_slider_tick');
        });
        this.donationNumber.addEventListener('input', (e) => {
            var value = e.target.value;
            if (value === '' || value.endsWith('.')) {
                return;
            }
            var num = parseFloat(value);
            if (!isNaN(num)) {
                this.donationSlider.value = linearToLog(clampAmount(num));
            }
        });

        this.donationNumber.addEventListener('blur', () => {
            var num = clampAmount(this.donationNumber.value);
            this.donationNumber.value = formatAmount(num);
            this.donationSlider.value = linearToLog(num);
        });
    }
};

DonationPromptHtml.prototype.setDonationButtonBackgrounds = function () {
    if (!this.presetButtons || !this.presetButtons.length || !this.solanaLogoTexture || !this.solanaLogoTexture.resource) {
        return;
    }
    var logoUrl = this.solanaLogoTexture.getFileUrl();
    this.presetButtons.forEach((btn) => {
        btn.style.backgroundImage = "url('" + logoUrl + "')";
        btn.style.backgroundSize = '69px 69px';
    });
};

DonationPromptHtml.prototype.setTheme = function (theme) {
    if (this.donationUIEl && theme && theme.fontFamily) {
        this.donationUIEl.style.fontFamily = theme.fontFamily;
    }
};

DonationPromptHtml.prototype.show = function () {
    if (typeof gsap !== 'undefined') {
        var timeline = gsap.timeline();
        timeline.to(this.donationUIEl, {
            duration: 0.5,
            y: 0,
            opacity: 1,
            pointerEvents: 'auto',
            ease: 'expo.out'
        });
        var buttons = this.container.querySelectorAll('.donation-button');
        if (buttons.length) {
            gsap.set(buttons, { opacity: 0, y: 20 });
            timeline.to(buttons, {
                duration: 0.3,
                opacity: 1,
                y: 0,
                ease: 'power2.out',
                stagger: 0.08
            }, '-=0.2');
        }
        var sliderRow = this.container.querySelector('.slider-row');
        if (sliderRow) {
            gsap.set(sliderRow, { opacity: 0, y: 20 });
            timeline.to(sliderRow, {
                duration: 0.3,
                opacity: 1,
                y: 0,
                ease: 'power2.out'
            }, '-=0.15');
        }
    } else {
        this.donationUIEl.style.opacity = '1';
        this.donationUIEl.style.transform = 'translateY(0)';
        this.donationUIEl.style.pointerEvents = 'auto';
    }

    if (this.app.mouse && this.app.mouse.disablePointerLock) {
        this.app.mouse.disablePointerLock();
    }
};

DonationPromptHtml.prototype.hide = function () {
    if (typeof gsap !== 'undefined') {
        gsap.to(this.donationUIEl, {
            duration: 0.5,
            y: 100,
            opacity: 0,
            pointerEvents: 'none',
            ease: 'expo.in'
        });
    } else {
        this.donationUIEl.style.opacity = '0';
        this.donationUIEl.style.transform = 'translateY(100px)';
        this.donationUIEl.style.pointerEvents = 'none';
    }

    if (this.app.mouse && this.app.mouse.enablePointerLock) {
        try {
            this.app.mouse.enablePointerLock();
        } catch (err) {
            console.warn('DonationPromptHtml: Unable to re-enable pointer lock automatically.', err);
        }
    }

    this.hideQRView();
};

DonationPromptHtml.prototype.onShowPrompt = function (boothScript) {
    if (!boothScript || !boothScript.claimedBy) {
        console.warn('DonationPromptHtml: show requested without a valid booth.');
        this.hide();
        return;
    }
    this.recipientAddress = boothScript.claimedBy;
    this.show();
};

DonationPromptHtml.prototype.onHidePrompt = function () {
    if (this.donationUIEl && this.donationUIEl.style.opacity !== '0') {
        this.hide();
    }
};

DonationPromptHtml.prototype.onDonationStateChanged = function (data) {
    if (!data || !data.state) {
        return;
    }
    if (data.state === 'success' || (typeof data.state === 'string' && data.state.indexOf('failed') === 0)) {
        this.hideQRView();
    }
};

DonationPromptHtml.prototype.showQRView = function (data) {
    if (!data || !this.solanaPayQRView || !this.qrCodeCanvas || !this.solanaPayLink || !this.qrOverlay) {
        return;
    }

    this.currentPollReference = data.reference;
    this.currentPollAmount = data.amount;

    if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
        window.QRCode.toCanvas(this.qrCodeCanvas, data.solanaPayUrl, { width: 200 }, function (error) {
            if (error) {
                console.error('DonationPromptHtml: QR generation failed.', error);
            }
        });
    }

    this.solanaPayLink.href = data.solanaPayUrl;

    if (this.qrDoneBtn) {
        this.qrDoneBtn.disabled = false;
        this.qrDoneBtn.textContent = "I've Sent the Donation";
    }

    this.donationUIEl.classList.add('hidden');
    this.solanaPayQRView.classList.remove('hidden');
    this.qrOverlay.classList.remove('hidden');
};

DonationPromptHtml.prototype.hideQRView = function () {
    if (!this.solanaPayQRView || !this.qrOverlay) {
        return;
    }

    this.solanaPayQRView.classList.add('hidden');
    this.donationUIEl.classList.remove('hidden');
    this.qrOverlay.classList.add('hidden');

    this.currentPollReference = null;
    this.currentPollAmount = null;

    this.app.fire('solanapay:poll:stop');
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
