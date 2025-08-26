///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas\build\playcanvas.d.ts"
// ///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var DonationPromptHtml = pc.createScript('donationPromptHtml');

// Attributes for HTML and CSS assets
DonationPromptHtml.attributes.add('css', { type: 'asset', assetType: 'css', title: 'Donation UI CSS' });
DonationPromptHtml.attributes.add('html', { type: 'asset', assetType: 'html', title: 'Donation UI HTML' });
DonationPromptHtml.attributes.add('solanaLogoTexture', { type: 'asset', assetType: 'texture', title: 'Solana Logo Texture' });

DonationPromptHtml.prototype.initialize = function () {
     if (this.css && this.css.resource) {
          var style = document.createElement('style');
          document.head.appendChild(style);
          style.innerHTML = this.css.resource.data || this.css.resource;
     }

     var htmlContent = "";
     if (this.html && this.html.resource) {
          htmlContent = this.html.resource.data || this.html.resource;
     }
     this.container = document.createElement('div');
     this.container.innerHTML = htmlContent;
     document.body.appendChild(this.container);

     this.donationUIEl = this.container.querySelector('#donationUI');
     if (!this.donationUIEl) {
          console.error("DonationPromptHtml: No element with id 'donationUI' found in the HTML asset.");
          return;
     }

     // --- Start Solana Pay Additions ---
     this.solanaPayCheckbox = this.container.querySelector('#solanaPayCheckbox');
     this.solanaPayQRView = this.container.querySelector('#solanaPayQR');
     this.qrCodeCanvas = this.container.querySelector('#qrCodeCanvas');
     this.solanaPayLink = this.container.querySelector('#solanaPayLink');
     this.qrDoneBtn = this.container.querySelector('#qrDoneBtn');
     this.qrCancelBtn = this.container.querySelector('#qrCancelBtn');
     this.qrOverlay = this.container.querySelector('#qr-overlay'); // Get overlay
     this.currentPollData = null; // To store data for polling

     if (!this.solanaPayCheckbox || !this.solanaPayQRView || !this.qrCodeCanvas || !this.solanaPayLink || !this.qrDoneBtn || !this.qrCancelBtn || !this.qrOverlay) {
          console.error("DonationPromptHtml: One or more Solana Pay UI elements are missing from the HTML.");
          // return; // Don't block initialization if these are missing
     } else {
          // Add listeners for the new QR view buttons
          this.qrDoneBtn.addEventListener('click', () => {
               if (this.currentPollData) {
                    this.app.fire('solanapay:poll', this.currentPollData);
                    // Optionally disable the button to prevent multiple clicks
                    this.qrDoneBtn.disabled = true;
                    this.qrDoneBtn.textContent = "Polling...";
               }
          });

          this.qrCancelBtn.addEventListener('click', () => {
               this.hideQRView();
          });
     }
     // --- End Solana Pay Additions ---

     gsap.set(this.donationUIEl, {
          y: 100,
          opacity: 0,
          pointerEvents: 'none'
     });

     if (this.app.uiManager) {
          this.app.uiManager.registerComponent(this);
     }

     this.presetButtons = this.container.querySelectorAll('.donation-button');

     if (this.solanaLogoTexture && this.presetButtons.length > 0) {
          if (this.solanaLogoTexture.resource) {
               this.setDonationButtonBackgrounds();
          } else {
               this.solanaLogoTexture.ready(asset => this.setDonationButtonBackgrounds());
          }
     }

     this.presetButtons.forEach((btn) => {
          btn.addEventListener('mouseenter', () => gsap.to(btn, { duration: 0.2, scale: 1.1, ease: "power2.out" }));
          btn.addEventListener('mouseleave', () => gsap.to(btn, { duration: 0.2, scale: 1, ease: "power2.out" }));
          btn.addEventListener('click', () => {
               gsap.to(btn, { duration: 0.1, scale: 0.9, ease: "power2.in", onComplete: () => gsap.to(btn, { duration: 0.1, scale: 1, ease: "power2.out" }) });
               var donationAmount = parseFloat(btn.getAttribute('data-amount'));
               if (isNaN(donationAmount)) return;
               if (!this.recipientAddress) return;
               
               const isSolanaPay = this.solanaPayCheckbox ? this.solanaPayCheckbox.checked : false;
               console.log("[DEBUG] Preset Button Click -> Checkbox state:", this.solanaPayCheckbox?.checked, "isSolanaPay:", isSolanaPay);

               const donationService = this.app.services?.get('donationService');
               if (donationService) {
                    console.log(`HtmlDonationPrompt: Calling initiateDonation from preset (Solana Pay: ${isSolanaPay})...`);
                    donationService.initiateDonation(donationAmount, this.recipientAddress, isSolanaPay);
               } else {
                    console.error("HtmlDonationPrompt: Could not find donationService in app.services registry.");
               }
          });
     });

     var goButton = this.container.querySelector('.go-button');
     if (goButton) {
          goButton.addEventListener('mouseenter', () => gsap.to(goButton, { duration: 0.2, scale: 1.1, ease: "power2.out" }));
          goButton.addEventListener('mouseleave', () => gsap.to(goButton, { duration: 0.2, scale: 1, ease: "power2.out" }));
          goButton.addEventListener('click', () => {
               gsap.to(goButton, { duration: 0.1, scale: 0.9, ease: "power2.in", onComplete: () => gsap.to(goButton, { duration: 0.1, scale: 1, ease: "power2.out" }) });
               var donationNumberInput = this.container.querySelector('.donation-number');
               var donationAmount = donationNumberInput ? parseFloat(donationNumberInput.value) : NaN;
               if (isNaN(donationAmount)) return;
               if (!this.recipientAddress) return;
               
               const isSolanaPay = this.solanaPayCheckbox ? this.solanaPayCheckbox.checked : false;
               console.log("[DEBUG] Go Button Click -> Checkbox state:", this.solanaPayCheckbox?.checked, "isSolanaPay:", isSolanaPay);

               const donationService = this.app.services?.get('donationService');
               if (donationService) {
                    console.log(`HtmlDonationPrompt: Calling initiateDonation (Solana Pay: ${isSolanaPay})...`);
                    donationService.initiateDonation(donationAmount, this.recipientAddress, isSolanaPay);
               } else {
                    console.error("HtmlDonationPrompt: Could not find donationService in app.services registry.");
               }
          });
     }

     this.donationSlider = this.container.querySelector('#donationSlider');
     this.donationNumber = this.container.querySelector('#donationNumber');
     if (this.donationSlider && this.donationNumber) {
          const linearToLog = (value) => Math.log10(value);
          const logToLinear = (value) => Math.pow(10, value);
          let initialValue = parseFloat(this.donationNumber.value);
          if (!initialValue || initialValue < 0.01) {
               initialValue = 0.01;
               this.donationNumber.value = initialValue;
          }
          this.donationSlider.value = linearToLog(initialValue);
          this.donationSlider.addEventListener('input', () => {
               this.donationNumber.value = logToLinear(this.donationSlider.value).toFixed(2);
          });
          this.donationNumber.addEventListener('input', () => {
               let val = parseFloat(this.donationNumber.value) || 0.01;
               if (val < 0.01) val = 0.01;
               if (val > 69) val = 69;
               this.donationNumber.value = val.toFixed(2);
               this.donationSlider.value = linearToLog(val);
          });
     }

     // Listen for UI events from BoothController (or UIManager)
     this.app.on('ui:showDonationPrompt', this.onShowPrompt, this);
     this.app.on('ui:hideDonationPrompt', this.onHidePrompt, this);
     this.app.on('donation:showQR', this.showQRView, this); // Listen for QR event
     this.app.on('donation:stateChanged', this.onDonationStateChanged, this); // Listen for state changes
};

DonationPromptHtml.prototype.setDonationButtonBackgrounds = function () {
     if (this.presetButtons.length > 0 && this.solanaLogoTexture && this.solanaLogoTexture.resource) {
          const logoUrl = this.solanaLogoTexture.getFileUrl();
          this.presetButtons.forEach(btn => {
               btn.style.backgroundImage = `url('${logoUrl}')`;
               btn.style.backgroundSize = '69px 69px';
          });
     }
};

DonationPromptHtml.prototype.setRecipient = function (recipientAddress) {
     this.recipientAddress = recipientAddress;
     console.log("DonationPromptHtml: Recipient set to", recipientAddress);
};

DonationPromptHtml.prototype.setTheme = function (theme) {
     if (this.donationUIEl) {
          this.donationUIEl.style.fontFamily = theme.fontFamily;
     }
};

DonationPromptHtml.prototype.show = function () {
     if (this.solanaLogoTexture && this.solanaLogoTexture.resource && !this.presetButtons[0]?.style.backgroundImage) {
          this.setDonationButtonBackgrounds();
     }
     var uiMgr = this.app.uiManager;
     var animSettings = uiMgr ? uiMgr.getAnimationSettings() : { duration: 0.5, easeIn: "expo.out" };

     var buttons = this.container.querySelectorAll('.donation-button');
     gsap.set(buttons, { opacity: 0, y: 20 });
     var sliderRow = this.container.querySelector('.slider-row');
     if (sliderRow) {
          gsap.set(sliderRow, { opacity: 0, y: 20 });
     }

     var tl = gsap.timeline();
     tl.to(this.donationUIEl, {
          duration: animSettings.duration,
          y: 0,
          opacity: 1,
          pointerEvents: 'auto',
          ease: animSettings.easeIn
     });
     if (buttons.length > 0) {
          tl.to(buttons, {
               duration: 0.3,
               opacity: 1,
               y: 0,
               ease: "power2.out",
               stagger: 0.1
          }, "-=0.2");
     }
     if (sliderRow) {
          tl.to(sliderRow, {
               duration: 0.3,
               opacity: 1,
               y: 0,
               ease: "power2.out"
          }, "-=0.1");
     }

     this.app.mouse.disablePointerLock();
};

DonationPromptHtml.prototype.hide = function () {
     var uiMgr = this.app.uiManager;
     var animSettings = uiMgr ? uiMgr.getAnimationSettings() : { duration: 0.5, easeOut: "expo.in" };
     gsap.to(this.donationUIEl, {
          duration: animSettings.duration,
          y: 100,
          opacity: 0,
          pointerEvents: 'none',
          ease: animSettings.easeOut
     });
     try {
          this.app.mouse.enablePointerLock();
     } catch (err) {
          console.warn("DonationPromptHtml: Unable to re-enable pointer lock automatically:", err);
     }
     this.hideQRView(); // Also ensure QR view is hidden
};

// === EVENT HANDLERS for UI events ===
DonationPromptHtml.prototype.onShowPrompt = function (boothScript) {
     if (!boothScript || !boothScript.claimedBy) {
          console.error("DonationPromptHtml: Received ui:showDonationPrompt without valid booth script or claimedBy address.");
          this.hide(); // Ensure it's hidden if data is invalid
          return;
     }
     // Set the recipient based on the booth script context provided by BoothController
     this.setRecipient(boothScript.claimedBy);
     console.log("DonationPromptHtml: Received ui:showDonationPrompt for booth ->", boothScript.boothId, "Recipient:", this.recipientAddress);
     this.show(); // Use existing show method
};

DonationPromptHtml.prototype.onHidePrompt = function () {
     // Only hide if it's currently visible (check opacity or a dedicated flag if needed)
     if (this.donationUIEl.style.opacity > 0) {
          console.log("DonationPromptHtml: Received ui:hideDonationPrompt.");
          this.hide(); // Use existing hide method
          this.hideQRView(); // Also ensure QR view is hidden
          // Optionally clear recipient when hidden
          // this.recipientAddress = null;
     }
};

DonationPromptHtml.prototype.onDonationStateChanged = function(data) {
    // Hide the QR prompt automatically on success or failure
    if (data.state === 'success' || data.state.startsWith('failed')) {
        if (!this.solanaPayQRView.classList.contains('hidden')) {
            this.hideQRView();
        }
    }
};

DonationPromptHtml.prototype.showQRView = function(data) {
     if (!this.solanaPayQRView || !this.qrCodeCanvas || !this.solanaPayLink || !this.qrOverlay) return;

     this.currentPollData = data; // Store data needed for polling

     // Generate QR code on the canvas
     if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
         window.QRCode.toCanvas(this.qrCodeCanvas, data.solanaPayUrl, { width: 200 }, (error) => {
             if (error) console.error("QR Code generation failed:", error);
         });
     }

     this.solanaPayLink.href = data.solanaPayUrl;
     
     // Reset button state
     this.qrDoneBtn.disabled = false;
     this.qrDoneBtn.textContent = "I've Sent the Donation";

     this.donationUIEl.classList.add('hidden');
     this.solanaPayQRView.classList.remove('hidden');
     this.qrOverlay.classList.remove('hidden'); // Show overlay
};

DonationPromptHtml.prototype.hideQRView = function() {
     if (!this.solanaPayQRView || !this.qrOverlay) return;
     this.solanaPayQRView.classList.add('hidden');
     this.donationUIEl.classList.remove('hidden'); // Show the main UI again
     this.qrOverlay.classList.add('hidden'); // Hide overlay
     
     // Stop polling if it's active
     this.app.fire('solanapay:poll:stop');
     this.currentPollData = null;
};

// Clean up listeners
DonationPromptHtml.prototype.destroy = function () {
     this.app.off('ui:showDonationPrompt', this.onShowPrompt, this);
     this.app.off('ui:hideDonationPrompt', this.onHidePrompt, this);
     this.app.off('donation:showQR', this.showQRView, this);
     this.app.off('donation:stateChanged', this.onDonationStateChanged, this);

     // Remove event listeners from buttons etc. if necessary (though often handled by element removal)
     // Remove HTML element if needed
     if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
     }
};