///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var ClaimPrompt = pc.createScript('claimPrompt');

// Add the ClaimIcon asset as an attribute (ensure the asset type is 'texture')
ClaimPrompt.attributes.add('claimIcon', { type: 'asset', assetType: 'texture', title: 'Claim Icon' });

// Called once per entity, during initialization
ClaimPrompt.prototype.initialize = function () {
    // Create a container DIV for the claim prompt
    this.div = document.createElement('div');
    this.div.id = 'claim-prompt';
    this.div.classList.add('claim-prompt'); // CSS controls its position and opacity

    // Build the inner HTML:
    // We include a background, an icon, and some prompt text.
    this.div.innerHTML = `
        <div class="claim-background">
            <img class="claim-icon" src="${this.claimIcon ? this.claimIcon.getFileUrl() : ''}" alt="Claim Icon">
            <span class="claim-text">Press E to claim booth!</span>
        </div>
    `;

    // Append the claim prompt to the document body
    document.body.appendChild(this.div);

    // Initially, ensure the prompt is hidden (it will have 0 opacity)
    if (this.div) {
        this.hide();
    }
};

// Call this function to show the prompt (e.g., when a player enters a booth zone)
ClaimPrompt.prototype.show = function () {
    this.div.classList.add('visible');
};

// Call this function to hide the prompt (e.g., when the player leaves the booth zone or claims)
ClaimPrompt.prototype.hide = function () {
    this.div.classList.remove('visible');
};
