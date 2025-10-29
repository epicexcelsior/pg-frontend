var HtmlTutorialSteps = pc.createScript('htmlTutorialSteps');

HtmlTutorialSteps.attributes.add('claimCssAsset', { type: 'asset', assetType: 'css', title: 'Claim Step CSS' });
HtmlTutorialSteps.attributes.add('claimHtmlAsset', { type: 'asset', assetType: 'html', title: 'Claim Step HTML' });
HtmlTutorialSteps.attributes.add('donationCssAsset', { type: 'asset', assetType: 'css', title: 'Donation Step CSS' });
HtmlTutorialSteps.attributes.add('donationHtmlAsset', { type: 'asset', assetType: 'html', title: 'Donation Step HTML' });
HtmlTutorialSteps.attributes.add('customizeCssAsset', { type: 'asset', assetType: 'css', title: 'Customize Step CSS' });
HtmlTutorialSteps.attributes.add('customizeHtmlAsset', { type: 'asset', assetType: 'html', title: 'Customize Step HTML' });
HtmlTutorialSteps.attributes.add('rewardCssAsset', { type: 'asset', assetType: 'css', title: 'Reward CSS' });
HtmlTutorialSteps.attributes.add('rewardHtmlAsset', { type: 'asset', assetType: 'html', title: 'Reward HTML' });

HtmlTutorialSteps.prototype.initialize = function() {
    this.initialized = false;
    this.visibleSteps = new Set();
    this.steps = {};
    this.rewardNotification = null;
    this.container = null;

    this._loadAssets();
    this._setupEventListeners();
    
    // Expose for debugging
    if (!window.tutorialSteps) {
        window.tutorialSteps = {};
    }
    window.tutorialSteps.htmlTutorialStepsInstance = this;
};

HtmlTutorialSteps.prototype._loadAssets = function() {
    var self = this;
    var assetsToLoad = 4; // claim, donation, customize, reward
    var assetsLoaded = 0;

    var checkComplete = function() {
        assetsLoaded++;
        if (assetsLoaded === assetsToLoad) {
            self.initialized = true;
        }
    };

    // Load claim step
    this._loadStepAsset('claim', this.claimCssAsset, this.claimHtmlAsset, checkComplete);

    // Load donation step
    this._loadStepAsset('donation', this.donationCssAsset, this.donationHtmlAsset, checkComplete);

    // Load customize step
    this._loadStepAsset('customize', this.customizeCssAsset, this.customizeHtmlAsset, checkComplete);

    // Load reward notification
    this._loadRewardAsset(checkComplete);
};

HtmlTutorialSteps.prototype._loadStepAsset = function(stepName, cssAsset, htmlAsset, callback) {
    var self = this;
    var cssLoaded = false;
    var htmlLoaded = false;

    var onCssLoaded = function(resource) {
        var style = document.createElement('style');
        style.id = 'tutorial-step-' + stepName + '-css';
        style.textContent = resource;
        document.head.appendChild(style);
        cssLoaded = true;
        if (htmlLoaded) finishStep();
    };

    var onHtmlLoaded = function(resource) {
        var container = document.createElement('div');
        container.innerHTML = resource.trim();
        var stepElement = container.firstElementChild;
        
        // Ensure step starts hidden with critical inline styles
        stepElement.style.display = 'none';
        stepElement.style.visibility = 'hidden';
        stepElement.classList.add('hidden');
        
        document.body.appendChild(stepElement);
        self.steps[stepName] = {
            element: stepElement,
            visible: false,
            idleTimer: null
        };
        self._setupStepListeners(stepName, stepElement);
        htmlLoaded = true;
        if (cssLoaded) finishStep();
    };

    var finishStep = function() {
        callback();
    };

    if (cssAsset) {
        if (cssAsset.resource) {
            onCssLoaded(cssAsset.resource);
        } else {
            cssAsset.ready(function(a) { onCssLoaded(a.resource); });
        }
    } else {
        cssLoaded = true;
    }

    if (htmlAsset) {
        if (htmlAsset.resource) {
            onHtmlLoaded(htmlAsset.resource);
        } else {
            htmlAsset.ready(function(a) { onHtmlLoaded(a.resource); });
        }
    } else {
        htmlLoaded = true;
    }
};

HtmlTutorialSteps.prototype._loadRewardAsset = function(callback) {
    var self = this;
    var cssLoaded = false;
    var htmlLoaded = false;

    var onCssLoaded = function(resource) {
        var style = document.createElement('style');
        style.textContent = resource;
        document.head.appendChild(style);
        cssLoaded = true;
        if (htmlLoaded) finishReward();
    };

    var onHtmlLoaded = function(resource) {
        var container = document.createElement('div');
        container.innerHTML = resource.trim();
        var rewardElement = container.firstElementChild;
        
        // Ensure reward starts hidden
        rewardElement.style.display = 'none';
        rewardElement.classList.remove('show');
        rewardElement.classList.add('hide');
        
        document.body.appendChild(rewardElement);
        self.rewardNotification = rewardElement;
        htmlLoaded = true;
        if (cssLoaded) finishReward();
    };

    var finishReward = function() {
        callback();
    };

    if (this.rewardCssAsset) {
        if (this.rewardCssAsset.resource) {
            onCssLoaded(this.rewardCssAsset.resource);
        } else {
            this.rewardCssAsset.ready(function(a) { onCssLoaded(a.resource); });
        }
    } else {
        cssLoaded = true;
    }

    if (this.rewardHtmlAsset) {
        if (this.rewardHtmlAsset.resource) {
            onHtmlLoaded(this.rewardHtmlAsset.resource);
        } else {
            this.rewardHtmlAsset.ready(function(a) { onHtmlLoaded(a.resource); });
        }
    } else {
        htmlLoaded = true;
    }
};

HtmlTutorialSteps.prototype._setupStepListeners = function(stepName, element) {
    var closeButton = element.querySelector('.tutorial-step-close');
    if (closeButton) {
        closeButton.addEventListener('click', this._makeCloseHandler(stepName, element).bind(this));
    }

    document.addEventListener('keydown', this._makeKeyHandler(stepName, element).bind(this));
};

HtmlTutorialSteps.prototype._makeCloseHandler = function(stepName, element) {
    var self = this;
    return function() {
        self.hideStep(stepName);
        self.app.fire('ui:playSound', 'ui_click_default');
    };
};

HtmlTutorialSteps.prototype._makeKeyHandler = function(stepName, element) {
    var self = this;
    return function(event) {
        if (event.key === 'Escape' && self.steps[stepName] && self.steps[stepName].visible) {
            self.hideStep(stepName);
        }
    };
};

HtmlTutorialSteps.prototype._setupEventListeners = function() {
    var self = this;
    
    this.app.on('tutorial:show:welcome', function() {
        self.showWelcome();
    });
    
    this.app.on('tutorial:show:makeDonation', function() {
        self.showMakeDonation();
    });
    
    this.app.on('tutorial:show:customizeBooth', function() {
        self.showCustomizeBooth();
    });
    
    this.app.on('tutorial:hide:all', function() {
        self.hideAll();
    });
    
    this.app.on('ui:showRewardNotification', function(data) {
        self.showRewardNotification(data);
    });
    
    this.app.on('donation:stateChanged', function(data) {
        self.onDonationStateChanged(data);
    });
    
    this.app.on('booth:description:ok', function(data) {
        self.onBoothCustomized(data);
    });
    
    // Expose manual test trigger
    window.tutorialTestShow = function(stepName) {
        console.log('Manual trigger: showing step', stepName);
        if (stepName === 'welcome') self.showWelcome();
        else if (stepName === 'donation') self.showMakeDonation();
        else if (stepName === 'customize') self.showCustomizeBooth();
        else self.app.fire('tutorial:show:' + stepName);
    };
    
    window.tutorialDebugStatus = function() {
        console.log('=== Tutorial Debug Status ===');
        console.log('Initialized:', self.initialized);
        console.log('Visible steps:', Array.from(self.visibleSteps));
        Object.keys(self.steps).forEach(function(stepName) {
            var step = self.steps[stepName];
            var element = step.element;
            if (element) {
                console.log(stepName + ':', {
                    visible: step.visible,
                    display: element.style.display,
                    width: element.offsetWidth,
                    computedWidth: window.getComputedStyle(element).width,
                    hidden: element.classList.contains('hidden'),
                    visible_class: element.classList.contains('tutorial-step-visible'),
                    idle: element.classList.contains('idle')
                });
            }
        });
    };
};

HtmlTutorialSteps.prototype.showWelcome = function() {
    if (!this.initialized || !this.steps.claim) {
        return;
    }
    this.hideAll();
    var self = this;
    requestAnimationFrame(function() {
        self.showStep('claim');
    });
};

HtmlTutorialSteps.prototype.showMakeDonation = function() {
    if (!this.initialized || !this.steps.donation) return;
    this.hideAll();
    var self = this;
    requestAnimationFrame(function() {
        self.showStep('donation');
    });
};

HtmlTutorialSteps.prototype.showCustomizeBooth = function() {
    if (!this.initialized || !this.steps.customize) return;
    this.hideAll();
    var self = this;
    requestAnimationFrame(function() {
        self.showStep('customize');
    });
};

HtmlTutorialSteps.prototype.showStep = function(stepName) {
    if (!this.steps[stepName]) return;

    var step = this.steps[stepName];
    var element = step.element;

    step.visible = true;
    this.visibleSteps.add(stepName);

    // Show element first with critical inline styles to ensure width is correct
    element.style.display = 'block';
    element.style.visibility = 'visible';
    element.style.width = '320px';
    element.style.maxWidth = 'calc(100vw - 40px)';
    element.style.position = 'fixed';
    element.style.zIndex = '5000';
    element.style.bottom = '120px';
    
    // Position left/right based on step type
    if (stepName === 'claim') {
        element.style.left = '20px';
        element.style.right = 'auto';
    } else {
        element.style.left = 'auto';
        element.style.right = '20px';
    }
    
    element.classList.remove('hidden');
    element.classList.remove('idle');
    
    requestAnimationFrame(function() {
        element.classList.add('tutorial-step-visible');
    });

    // Add idle animation after animation completes
    var self = this;
    step.idleTimer = setTimeout(function() {
        if (element && step.visible) {
            element.classList.add('idle');
        }
    }, 400);
};

HtmlTutorialSteps.prototype.hideStep = function(stepName) {
    if (!this.steps[stepName]) return;

    var step = this.steps[stepName];
    var element = step.element;

    step.visible = false;
    this.visibleSteps.delete(stepName);

    // Clear idle timer
    if (step.idleTimer) {
        clearTimeout(step.idleTimer);
        step.idleTimer = null;
    }

    element.classList.remove('idle');
    element.classList.add('hidden');
    element.style.display = 'none';
    
    setTimeout(function() {
        element.classList.remove('tutorial-step-visible');
    }, 300);
};

HtmlTutorialSteps.prototype.hideAll = function() {
    var self = this;
    var stepsToHide = Array.from(this.visibleSteps);
    stepsToHide.forEach(function(stepName) {
        self.hideStep(stepName);
    });
};

HtmlTutorialSteps.prototype.onDonationStateChanged = function(data) {
    // Auto-dismiss donation step on successful donation
    if (data && data.state === 'success' && this.steps.donation && this.steps.donation.visible) {
        var self = this;
        setTimeout(function() {
            self.hideStep('donation');
        }, 500);
    }
};

HtmlTutorialSteps.prototype.onBoothCustomized = function() {
    // Auto-dismiss customize step on successful save
    if (this.steps.customize && this.steps.customize.visible) {
        var self = this;
        setTimeout(function() {
            self.hideStep('customize');
        }, 500);
    }
};

HtmlTutorialSteps.prototype.showRewardNotification = function(data) {
    if (!this.initialized || !this.rewardNotification) {
        return;
    }

    var amount = (data && typeof data.coins === 'number') ? data.coins : 0;
    var amountElement = this.rewardNotification.querySelector('.reward-coin-amount');
    if (amountElement) {
        amountElement.textContent = amount.toString();
    }

    this.rewardNotification.classList.remove('hide');
    this.rewardNotification.classList.add('show');

    var self = this;
    setTimeout(function() {
        self.rewardNotification.classList.remove('show');
        self.rewardNotification.classList.add('hide');
    }, 4000);
};

HtmlTutorialSteps.prototype.destroy = function() {
    this.app.off('tutorial:show:welcome', this.showWelcome, this);
    this.app.off('tutorial:show:makeDonation', this.showMakeDonation, this);
    this.app.off('tutorial:show:customizeBooth', this.showCustomizeBooth, this);
    this.app.off('tutorial:hide:all', this.hideAll, this);
    this.app.off('ui:showRewardNotification', this.showRewardNotification, this);
    this.app.off('donation:stateChanged', this.onDonationStateChanged, this);
    this.app.off('booth:description:ok', this.onBoothCustomized, this);

    // Cleanup DOM elements
    Object.keys(this.steps).forEach(function(key) {
        var step = this.steps[key];
        if (step.element && step.element.parentNode) {
            step.element.parentNode.removeChild(step.element);
        }
    }, this);

    if (this.rewardNotification && this.rewardNotification.parentNode) {
        this.rewardNotification.parentNode.removeChild(this.rewardNotification);
    }
};
