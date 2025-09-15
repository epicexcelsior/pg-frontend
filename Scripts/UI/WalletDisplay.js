// Scripts/UI/WalletDisplay.js
var WalletDisplay = pc.createScript("walletDisplay");

// --- Attributes ---
WalletDisplay.attributes.add("servicesEntity", {
  type: "entity",
  title: "Services Entity",
  description: "The entity with the AuthService script.",
});
WalletDisplay.attributes.add("walletAddressTextEntity", {
  type: "entity",
  title: "Wallet Address Text Entity",
  description: "The Text Element entity to display the wallet address.",
});
WalletDisplay.attributes.add("walletBalanceTextEntity", {
  type: "entity",
  title: "Wallet Balance Text Entity",
  description: "The Text Element entity to display the wallet balance.",
});
WalletDisplay.attributes.add("connectButtonEntity", {
  type: "entity",
  title: "Connect/Disconnect Button Entity",
  description:
    "The Button Element entity used for connecting and disconnecting.",
});

WalletDisplay.attributes.add("addFundsButtonEntity", {
  type: "entity",
  title: "Add Funds Button Entity",
  description: "The Button Element entity for Grid onramp (Add Funds).",
  array: false
});
// Optional: Add disconnect button attribute if you have a separate one
// WalletDisplay.attributes.add('disconnectButtonEntity', { type: 'entity', title: 'Disconnect Button Entity' });

// --- Initialize ---
WalletDisplay.prototype.initialize = function() {
    console.log("WalletDisplay initializing...");
    this.walletAddress = null;

    // Use PrivyService now
    this.privyService = this.app.services?.get('privyService');
    if (!this.privyService) {
        console.warn("WalletDisplay: PrivyService not found. Waiting for services to initialize...");
        this.app.once('services:initialized', () => {
            this.privyService = this.app.services.get('privyService');
            this.onAuthStateChanged({ state: this.privyService?.getState(), address: this.privyService?.getWalletAddress() });
        }, this);
    }

    // This HTML element should be part of your main UI HTML file
    this.walletDisplayEl = document.getElementById('wallet-address-display');
    this.connectButtonEl = document.getElementById('wallet-connect-button');
    
    if (!this.walletDisplayEl || !this.connectButtonEl) {
        console.error("WalletDisplay: Required DOM elements ('wallet-address-display', 'wallet-connect-button') not found.");
        return;
    }

    this.connectButtonEl.addEventListener('click', this.onConnectClicked.bind(this));

    this.app.on('auth:stateChanged', this.onAuthStateChanged, this);

    // Initial state check
    if (this.privyService) {
        this.onAuthStateChanged({ state: this.privyService.getState(), address: this.privyService.getWalletAddress() });
    }
    console.log("WalletDisplay initialized.");
};

WalletDisplay.prototype.onConnectClicked = function() {
    if (this.privyService) {
        this.privyService.login();
    } else {
        console.error("WalletDisplay: Cannot connect, PrivyService not available.");
    }
};

WalletDisplay.prototype.onAuthStateChanged = function(stateData) {
    console.log("WalletDisplay: Auth state changed:", stateData);
    const isAuthenticated = stateData.state === 'connected';
    this.walletAddress = isAuthenticated ? stateData.address : null;
    this.updateDisplay();
};

WalletDisplay.prototype.updateDisplay = function() {
    if (!this.walletDisplayEl || !this.connectButtonEl) return;

    if (this.walletAddress) {
        // User is connected, show address, hide connect button
        const formattedAddress = `${this.walletAddress.substring(0, 4)}...${this.walletAddress.substring(this.walletAddress.length - 4)}`;
        this.walletDisplayEl.textContent = formattedAddress;
        this.walletDisplayEl.style.display = 'block';
        this.connectButtonEl.style.display = 'none';
    } else {
        // User is disconnected, hide address, show connect button
        this.walletDisplayEl.style.display = 'none';
        this.connectButtonEl.style.display = 'block';
    }
};

WalletDisplay.prototype.destroy = function() {
    this.app.off('auth:stateChanged', this.onAuthStateChanged, this);
    if (this.connectButtonEl) {
        this.connectButtonEl.removeEventListener('click', this.onConnectClicked.bind(this));
    }
};
