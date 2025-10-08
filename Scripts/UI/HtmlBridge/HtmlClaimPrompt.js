// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\UI\HtmlBridge\HtmlClaimPrompt.js
var HtmlClaimPrompt = pc.createScript('htmlClaimPrompt');

HtmlClaimPrompt.attributes.add('css', { type: 'asset', assetType: 'css', title: 'CSS Asset' });
HtmlClaimPrompt.attributes.add('html', { type: 'asset', assetType: 'html', title: 'HTML Asset' });

HtmlClaimPrompt.prototype.initialize = function () {
    const style = document.createElement('style');
    style.innerHTML = this.css.resource;
    document.head.appendChild(style);

    this.container = document.createElement('div');
    this.container.innerHTML = this.html.resource;
    document.body.appendChild(this.container);

    this.claimPromptEl = this.container.querySelector('#claimPrompt');
    this.claimButton = this.container.querySelector('#claimButton');
    
    // Initial off-screen position for slide-up animation
    if (this.claimPromptEl) {
        this.claimPromptEl.style.transform = 'translate(-50%, 16px)';
        this.claimPromptEl.style.opacity = '0';
        this.claimPromptEl.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    }
    
    this.claimButton.addEventListener('click', this.onClaimClick.bind(this));
    this.app.keyboard.on(pc.EVENT_KEYDOWN, this.onKeyDown.bind(this));
    
    this.app.on('ui:showClaimPrompt', this.show, this);
    this.app.on('ui:hideClaimPrompt', this.hide, this);

    this.currentBoothId = null;
    this.claimPromptEl.style.display = 'none';
};

HtmlClaimPrompt.prototype.show = function (boothZoneScript) {
    this.currentBoothId = boothZoneScript.boothId;
    this.claimPromptEl.style.display = 'block';
    // Slide up from bottom
    requestAnimationFrame(() => {
        this.claimPromptEl.style.opacity = '1';
        this.claimPromptEl.style.transform = 'translate(-50%, 0)';
    });
};

HtmlClaimPrompt.prototype.hide = function () {
    this.currentBoothId = null;
    if (this.claimPromptEl) {
        this.claimPromptEl.style.opacity = '0';
        this.claimPromptEl.style.transform = 'translate(-50%, 16px)';
        window.setTimeout(() => {
            if (this.claimPromptEl) {
                this.claimPromptEl.style.display = 'none';
            }
        }, 200);
    }
};

// This function is now very simple: it just announces the user's intent.
HtmlClaimPrompt.prototype.onClaimClick = function () {
    if (this.currentBoothId) {
        console.log("HtmlClaimPrompt: User wants to claim. Firing 'booth:claim:request'.");
        this.app.fire('booth:claim:request', this.currentBoothId);
    }
};

HtmlClaimPrompt.prototype.onKeyDown = function (event) {
    if (event.key === pc.KEY_E && this.claimPromptEl.style.display === 'block') {
        this.app.fire('ui:playSound', 'ui_click_default');
        this.onClaimClick();
        event.event.preventDefault();
    }
};

HtmlClaimPrompt.prototype.destroy = function() {
    this.app.off('ui:showClaimPrompt', this.show, this);
    this.app.off('ui:hideClaimPrompt', this.hide, this);
    this.app.keyboard.off(pc.EVENT_KEYDOWN, this.onKeyDown, this);
    if (this.container?.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};