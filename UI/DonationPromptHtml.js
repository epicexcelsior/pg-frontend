///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var DonationPromptHtml = pc.createScript('donationPromptHtml');

// Attributes for HTML and CSS assets
DonationPromptHtml.attributes.add('css', { type: 'asset', assetType: 'css', title: 'Donation UI CSS' });
DonationPromptHtml.attributes.add('html', { type: 'asset', assetType: 'html', title: 'Donation UI HTML' });

DonationPromptHtml.prototype.initialize = function () {
     // 1. Inject the CSS asset into the document
     if (this.css && this.css.resource) {
          var style = document.createElement('style');
          document.head.appendChild(style);
          style.innerHTML = this.css.resource.data || this.css.resource;
     } else {
          console.warn("DonationPromptHtml: Donation UI CSS asset is missing or not loaded.");
     }

     // 2. Load the HTML content from the asset
     var htmlContent = "";
     if (this.html && this.html.resource) {
          htmlContent = this.html.resource.data || this.html.resource;
     } else {
          console.warn("DonationPromptHtml: Donation UI HTML asset is missing or not loaded.");
     }
     this.container = document.createElement('div');
     this.container.innerHTML = htmlContent;
     document.body.appendChild(this.container);

     // 3. Locate the donation UI root element (it must have id="donationUI")
     this.donationUIEl = this.container.querySelector('#donationUI');
     if (!this.donationUIEl) {
          console.error("DonationPromptHtml: No element with id 'donationUI' found in the HTML asset.");
          return;
     }

     // 4. Set the initial state using GSAP (off-screen and hidden)
     gsap.set(this.donationUIEl, {
          y: 100,       // Off-screen; adjust as needed
          opacity: 0,
          pointerEvents: 'none'
     });

     // 5. Register with UIManager (applies theme/animation settings)
     if (this.app.uiManager) {
          this.app.uiManager.registerComponent(this);
     }

     // 6. Attach event listeners to donation buttons:
     // a) Preset donation buttons (with class "donation-button")
     this.presetButtons = this.container.querySelectorAll('.donation-button');
     this.presetButtons.forEach((btn) => {
          // Hover: enlarge slightly
          btn.addEventListener('mouseenter', () => {
               gsap.to(btn, { duration: 0.2, scale: 1.1, ease: "power2.out" });
          });
          btn.addEventListener('mouseleave', () => {
               gsap.to(btn, { duration: 0.2, scale: 1, ease: "power2.out" });
          });
          // Click: bounce animation and initiate donation
          btn.addEventListener('click', () => {
               gsap.to(btn, {
                    duration: 0.1, scale: 0.9, ease: "power2.in", onComplete: () => {
                         gsap.to(btn, { duration: 0.1, scale: 1, ease: "power2.out" });
                    }
               });
               var donationAmount = parseFloat(btn.getAttribute('data-amount'));
               if (isNaN(donationAmount)) {
                    console.error("DonationPromptHtml: Invalid donation amount on button.");
                    return;
               }
               // Instead of localPlayer, we now use the recipient set via setRecipient()
               if (!this.recipientAddress) {
                    console.error("DonationPromptHtml: No recipient address available for donation.");
                    return;
               }
               var donationManagerEntity = this.app.root.findByName("DonationManager");
               if (donationManagerEntity && donationManagerEntity.script && donationManagerEntity.script.donationManager) {
                    donationManagerEntity.script.donationManager.initiateDonation(donationAmount, this.recipientAddress);
               } else {
                    console.error("DonationPromptHtml: DonationManager entity not found.");
               }
          });
     });

     // b) Custom donation: attach listener to the Go button (class "go-button")
     var goButton = this.container.querySelector('.go-button');
     if (goButton) {
          // Hover: enlarge slightly
          goButton.addEventListener('mouseenter', () => {
               gsap.to(goButton, { duration: 0.2, scale: 1.1, ease: "power2.out" });
          });
          goButton.addEventListener('mouseleave', () => {
               gsap.to(goButton, { duration: 0.2, scale: 1, ease: "power2.out" });
          });
          goButton.addEventListener('click', () => {
               gsap.to(goButton, {
                    duration: 0.1, scale: 0.9, ease: "power2.in", onComplete: () => {
                         gsap.to(goButton, { duration: 0.1, scale: 1, ease: "power2.out" });
                    }
               });
               var donationNumberInput = this.container.querySelector('.donation-number');
               var donationAmount = donationNumberInput ? parseFloat(donationNumberInput.value) : NaN;
               if (isNaN(donationAmount)) {
                    console.error("DonationPromptHtml: Invalid custom donation amount entered.");
                    return;
               }
               if (!this.recipientAddress) {
                    console.error("DonationPromptHtml: No recipient address available for donation.");
                    return;
               }
               var donationManagerEntity = this.app.root.findByName("DonationManager");
               if (donationManagerEntity && donationManagerEntity.script && donationManagerEntity.script.donationManager) {
                    donationManagerEntity.script.donationManager.initiateDonation(donationAmount, this.recipientAddress);
               } else {
                    console.error("DonationPromptHtml: DonationManager entity not found.");
               }
          });
     } else {
          console.warn("DonationPromptHtml: No go-button found for custom donations.");
     }

     // 7. Setup slider & custom input synchronization (logarithmic scaling)
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
     } else {
          console.warn("DonationPromptHtml: Slider or donation number input not found.");
     }
};

// Method to set the recipient address (e.g. from BoothClaimZone)
DonationPromptHtml.prototype.setRecipient = function (recipientAddress) {
     this.recipientAddress = recipientAddress;
     console.log("DonationPromptHtml: Recipient set to", recipientAddress);
};

// Apply theme from UIManager
DonationPromptHtml.prototype.setTheme = function (theme) {
     if (this.donationUIEl) {
          this.donationUIEl.style.fontFamily = theme.fontFamily;
          // You can also set colors or other properties from theme here.
     }
};

// Show the donation UI using GSAP and UIManager's animation settings
DonationPromptHtml.prototype.show = function () {
     var uiMgr = this.app.uiManager;
     var animSettings = uiMgr ? uiMgr.getAnimationSettings() : { duration: 0.5, easeIn: "expo.out" };

     // Reset child elements so their animations replay
     var buttons = this.container.querySelectorAll('.donation-button');
     gsap.set(buttons, { opacity: 0, y: 20 });
     var sliderRow = this.container.querySelector('.slider-row');
     if (sliderRow) {
          gsap.set(sliderRow, { opacity: 0, y: 20 });
     }

     // Create timeline for the main panel and child elements
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

     // Unlock mouse pointer when donation UI is visible
     this.app.mouse.disablePointerLock();
};

// Hide the donation UI using GSAP and re-enable pointer lock if desired
DonationPromptHtml.prototype.hide = function () {
     var uiMgr = this.app.uiManager;
     var animSettings = uiMgr ? uiMgr.getAnimationSettings() : { duration: 0.5, easeOut: "expo.in" };
     gsap.to(this.donationUIEl, {
          duration: animSettings.duration,
          y: 100,     // Off-screen position
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
