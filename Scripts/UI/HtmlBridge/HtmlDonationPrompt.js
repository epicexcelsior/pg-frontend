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
               var donationManagerEntity = this.app.root.findByName("DonationManager");
               if (donationManagerEntity && donationManagerEntity.script && donationManagerEntity.script.donationManager) {
                    donationManagerEntity.script.donationManager.initiateDonation(donationAmount, this.recipientAddress);
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
               var donationManagerEntity = this.app.root.findByName("DonationManager");
               if (donationManagerEntity && donationManagerEntity.script && donationManagerEntity.script.donationManager) {
                    donationManagerEntity.script.donationManager.initiateDonation(donationAmount, this.recipientAddress);
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
               this.donationNumber.value = val;
               this.donationSlider.value = linearToLog(val);
          });
     }
};

DonationPromptHtml.prototype.setDonationButtonBackgrounds = function () {
     if (this.presetButtons.length > 0 && this.solanaLogoTexture && this.solanaLogoTexture.resource) {
          const logoUrl = this.solanaLogoTexture.getFileUrl();
          this.presetButtons.forEach(btn => {
               btn.style.backgroundImage = `url('${logoUrl}')`;
               btn.style.backgroundSize = '50px 50px';
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
};