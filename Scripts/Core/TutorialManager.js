var TutorialManager = pc.createScript('tutorialManager');

TutorialManager.attributes.add('welcomeDelayMs', { 
    type: 'number', 
    default: 1000, 
    title: 'Welcome Prompt Delay (ms)' 
});

TutorialManager.attributes.add('donationDelayMs', { 
    type: 'number', 
    default: 800, 
    title: 'Donation Prompt Delay (ms)' 
});

TutorialManager.attributes.add('customizeDelayMs', { 
    type: 'number', 
    default: 600, 
    title: 'Customize Prompt Delay (ms)' 
});

TutorialManager.STAGES = {
    WELCOME: 'welcome',
    CLAIM_BOOTH: 'claim_booth',
    MAKE_DONATION: 'make_donation',
    CUSTOMIZE_BOOTH: 'customize_booth',
    COMPLETE: 'complete'
};

TutorialManager.prototype.initialize = function() {
    this.currentStage = this.loadProgress();
    this.privyManager = null;
    this.playerData = null;
    this.rewardClaimed = false;
    this.lastSyncTime = 0;
    this.syncDebounceMs = 2000;
    this.showPromptTimer = null;
    this.app.services.register('tutorialManager', this);

    // Normalize delay values
    this.welcomeDelayMs = typeof this.welcomeDelayMs === 'number' ? Math.max(0, this.welcomeDelayMs) : 1000;
    this.donationDelayMs = typeof this.donationDelayMs === 'number' ? Math.max(0, this.donationDelayMs) : 800;
    this.customizeDelayMs = typeof this.customizeDelayMs === 'number' ? Math.max(0, this.customizeDelayMs) : 600;

    // Get services
    this._resolveServices();

    // Bind event handlers
    this._boundBoothClaimed = this.onBoothClaimed.bind(this);
    this._boundDonationState = this.onDonationState.bind(this);
    this._boundBoothCustomized = this.onBoothCustomized.bind(this);
    this._boundAuthChanged = this.onAuthChanged.bind(this);

    // Register event listeners
    this.app.on('booth:claimSuccess', this._boundBoothClaimed);
    this.app.on('donation:stateChanged', this._boundDonationState);
    this.app.on('booth:description:ok', this._boundBoothCustomized);
    this.app.on('auth:stateChanged', this._boundAuthChanged);
    
    // Expose manager for debugging
    window.tutorialManager = this;
    window.tutorialStatus = function() {
        console.log('=== Tutorial Manager Status ===');
        console.log('Current Stage:', window.tutorialManager.currentStage);
        console.log('Timer Running:', window.tutorialManager.showPromptTimer !== null);
        console.log('Reward Claimed:', window.tutorialManager.rewardClaimed);
        console.log('LocalStorage tutorial_stage:', localStorage.getItem('tutorial_stage'));
    };
    
    window.tutorialReset = function() {
        console.log('Resetting tutorial...');
        localStorage.removeItem('tutorial_stage');
        localStorage.removeItem('tutorial_stage_time');
        window.tutorialManager.currentStage = TutorialManager.STAGES.WELCOME;
        console.log('Tutorial reset to WELCOME. Reload page and re-authenticate.');
    };
    
    window.tutorialTrace = function() {
        console.log('%c=== FULL TUTORIAL TRACE ===', 'color: blue; font-weight: bold;');
        console.log('%cTutorialManager:', 'color: green; font-weight: bold;');
        console.log('  Initialized:', !!window.tutorialManager);
        console.log('  Current Stage:', window.tutorialManager?.currentStage);
        console.log('  LocalStorage Stage:', localStorage.getItem('tutorial_stage'));
        console.log('  Welcome Delay:', window.tutorialManager?.welcomeDelayMs, 'ms');
        console.log('  Timer Active:', window.tutorialManager?.showPromptTimer !== null);
        console.log('%cHtmlTutorialSteps:', 'color: orange; font-weight: bold;');
        if (window.tutorialSteps && window.tutorialSteps.htmlTutorialStepsInstance) {
            var hts = window.tutorialSteps.htmlTutorialStepsInstance;
            console.log('  Initialized:', hts.initialized);
            console.log('  Visible Steps:', Array.from(hts.visibleSteps || []));
            console.log('  Steps Loaded:', Object.keys(hts.steps || {}));
        } else {
            console.log('  HtmlTutorialSteps not found in window');
        }
    };
};

TutorialManager.prototype._resolveServices = function() {
    if (this.app.services && typeof this.app.services.get === 'function') {
        this.privyManager = this.app.services.get('privyManager') || null;
        this.playerData = this.app.services.get('playerData') || null;
    }
};

TutorialManager.prototype.loadProgress = function() {
    try {
        const stored = localStorage.getItem('tutorial_stage');
        if (stored && TutorialManager.STAGES[stored.toUpperCase()]) {
            return stored;
        }
    } catch (err) {
        console.warn('TutorialManager: Failed to load progress from localStorage', err);
    }
    return TutorialManager.STAGES.WELCOME;
};

TutorialManager.prototype.saveProgress = function() {
    try {
        localStorage.setItem('tutorial_stage', this.currentStage);
        localStorage.setItem('tutorial_stage_time', Date.now().toString());
    } catch (err) {
        console.warn('TutorialManager: Failed to save progress to localStorage', err);
    }
};

TutorialManager.prototype.onAuthChanged = function(event) {
    if (!event) return;

    const isConnected = event.state === 'connected';

    // Update service references when auth state changes
    this._resolveServices();

    if (isConnected && !this.playerData) {
        this.playerData = this.app.services?.get?.('playerData');
    }

    if (isConnected) {
        // Show appropriate prompt based on current stage
        if (this.currentStage === TutorialManager.STAGES.WELCOME) {
            this._scheduleShowPrompt('tutorial:show:welcome', this.welcomeDelayMs);
        } else if (this.currentStage === TutorialManager.STAGES.CLAIM_BOOTH) {
            this._scheduleShowPrompt('tutorial:show:welcome', this.welcomeDelayMs);
        } else if (this.currentStage === TutorialManager.STAGES.MAKE_DONATION) {
            this._scheduleShowPrompt('tutorial:show:makeDonation', this.donationDelayMs);
        } else if (this.currentStage === TutorialManager.STAGES.CUSTOMIZE_BOOTH) {
            this._scheduleShowPrompt('tutorial:show:customizeBooth', this.customizeDelayMs);
        }
    } else {
        // On logout, do NOT reset - keep progress so it resumes
        this._clearShowPromptTimer();
    }
};

TutorialManager.prototype.onBoothClaimed = function(data) {
    if (this.currentStage === TutorialManager.STAGES.WELCOME || 
        this.currentStage === TutorialManager.STAGES.CLAIM_BOOTH) {
        this.advanceStage(TutorialManager.STAGES.MAKE_DONATION);
        this._scheduleShowPrompt('tutorial:show:makeDonation', this.donationDelayMs);
    }
};

TutorialManager.prototype.onDonationState = function(data) {
    if (!data || data.state !== 'success') {
        return;
    }

    if (this.currentStage === TutorialManager.STAGES.MAKE_DONATION) {
        this.advanceStage(TutorialManager.STAGES.CUSTOMIZE_BOOTH);
        this._scheduleShowPrompt('tutorial:show:customizeBooth', this.customizeDelayMs);
    }
};

TutorialManager.prototype.onBoothCustomized = function(data) {
    if (this.currentStage === TutorialManager.STAGES.CUSTOMIZE_BOOTH) {
        this.completeTutorial();
    }
};

TutorialManager.prototype.advanceStage = function(nextStage) {
    if (this.currentStage === TutorialManager.STAGES.COMPLETE) {
        return;
    }

    if (!TutorialManager.STAGES[nextStage.toUpperCase()]) {
        console.warn('TutorialManager: Invalid stage', nextStage);
        return;
    }

    this.currentStage = nextStage;
    this.saveProgress();

    // Sync with server (debounced)
    this.syncProgressToServer();

    this.app.fire('tutorial:stage:changed', { stage: nextStage });
};

TutorialManager.prototype.completeTutorial = function() {
    if (this.currentStage === TutorialManager.STAGES.COMPLETE) {
        return;
    }

    this.currentStage = TutorialManager.STAGES.COMPLETE;
    this.saveProgress();
    this.syncProgressToServer();

    this.app.fire('tutorial:finished');

    // Request reward from server
    var self = this;
    setTimeout(function() {
        self.requestTutorialReward();
    }, 500);
};

TutorialManager.prototype.syncProgressToServer = function() {
    var now = Date.now();
    if (now - this.lastSyncTime < this.syncDebounceMs) {
        return;
    }

    this.lastSyncTime = now;

    if (!this.privyManager) {
        this._resolveServices();
    }

    var address = this.privyManager && typeof this.privyManager.getWalletAddress === 'function'
        ? this.privyManager.getWalletAddress()
        : null;

    if (!address) {
        return;
    }

    this.app.fire('network:send', 'tutorial:progress', {
        stage: this.currentStage,
        walletAddress: address
    });
};

TutorialManager.prototype.requestTutorialReward = function() {
    if (this.rewardClaimed) {
        return;
    }

    if (!this.privyManager) {
        this._resolveServices();
    }

    var address = this.privyManager && typeof this.privyManager.getWalletAddress === 'function'
        ? this.privyManager.getWalletAddress()
        : null;

    if (!address) {
        return;
    }

    this.rewardClaimed = true;
    this.app.fire('network:send', 'tutorial:claimReward', {
        walletAddress: address
    });
};

TutorialManager.prototype.getCurrentStage = function() {
    return this.currentStage;
};

TutorialManager.prototype.isComplete = function() {
    return this.currentStage === TutorialManager.STAGES.COMPLETE;
};

TutorialManager.prototype._scheduleShowPrompt = function(eventName, delayMs) {
    this._clearShowPromptTimer();
    var self = this;
    this.showPromptTimer = setTimeout(function() {
        self.showPromptTimer = null;
        self.app.fire(eventName);
    }, delayMs);
};

TutorialManager.prototype._clearShowPromptTimer = function() {
    if (this.showPromptTimer) {
        clearTimeout(this.showPromptTimer);
        this.showPromptTimer = null;
    }
};

TutorialManager.prototype.destroy = function() {
    this._clearShowPromptTimer();
    this.app.off('booth:claimSuccess', this._boundBoothClaimed);
    this.app.off('donation:stateChanged', this._boundDonationState);
    this.app.off('booth:description:ok', this._boundBoothCustomized);
    this.app.off('auth:stateChanged', this._boundAuthChanged);
};
