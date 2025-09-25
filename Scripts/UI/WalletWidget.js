// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\UI\WalletWidget.js
var WalletWidget = pc.createScript('walletWidget');

WalletWidget.attributes.add('css', { type: 'asset', assetType: 'css', title: 'Widget CSS' });
WalletWidget.attributes.add('html', { type: 'asset', assetType: 'html', title: 'Widget HTML' });

WalletWidget.prototype.initialize = function() {
    console.log("WalletWidget: Initializing.");
    const style = document.createElement('style');
    style.innerHTML = this.css.resource;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.innerHTML = this.html.resource;
    document.body.appendChild(container);

    this.walletWidgetEl = container.querySelector('#wallet-widget');
    this.walletAddressEl = container.querySelector('#wallet-address');
    this.walletBalanceEl = container.querySelector('#wallet-balance');
    this.logoutButtonEl = container.querySelector('#logout-btn');
    this.container = container; // Store container for destroy

    this.logoutButtonEl.addEventListener('click', this.onLogout.bind(this));

    this.app.on('services:initialized', this.setupEventListeners, this);
    if (this.app.services) this.setupEventListeners();
};

WalletWidget.prototype.setupEventListeners = function() {
    if (this.privyManager) return;
    this.privyManager = this.app.services.get('privyManager');
    if (this.privyManager) {
        this.app.on('auth:stateChanged', this.onAuthStateChanged, this);
        // Initial check on load
        const user = this.privyManager.getUser();
        if (user) {
            this.onAuthStateChanged({
                isAuthenticated: this.privyManager.isAuthenticated(),
                address: this.privyManager.getWalletAddress(),
                user: user
            });
        }
    }
};

WalletWidget.prototype.onLogout = function() {
    if (this.privyManager) this.privyManager.logout();
};

WalletWidget.prototype.onAuthStateChanged = function(data) {
    if (data.isAuthenticated && data.address) {
        this.walletWidgetEl.style.display = 'flex'; // Use flex for better alignment
        this.walletAddressEl.textContent = `${data.address.substring(0, 6)}...${data.address.substring(data.address.length - 4)}`;
        this.fetchBalance(data.address);
    } else {
        this.walletWidgetEl.style.display = 'none';
        this.walletBalanceEl.textContent = '... SOL'; // Reset text
    }
};

WalletWidget.prototype.fetchBalance = async function(address) {
    try {
        // [!code ++]
        // More robust check for the SDK and RPC client
        if (!window.SolanaSDK || !window.SolanaSDK.rpc || typeof window.SolanaSDK.rpc.getBalance !== 'function') {
            console.warn("WalletWidget: SolanaSDK or RPC client not ready yet. Will retry.");
            setTimeout(() => this.fetchBalance(address), 1000); // Retry after 1 second
            return;
        }
        // [!code --]

        const rpc = window.SolanaSDK.rpc;
        
        // Use the .send() method required by the Gill library.
        const balanceLamports = await rpc.getBalance(address, { commitment: 'confirmed' }).send();
        const balanceSol = balanceLamports / 1_000_000_000;
        this.walletBalanceEl.textContent = `${balanceSol.toFixed(4)} SOL`;
    } catch (error) {
        console.error("WalletWidget: Failed to fetch balance:", error);
        this.walletBalanceEl.textContent = 'Error';
    }
};

WalletWidget.prototype.destroy = function() {
    this.app.off('services:initialized', this.setupEventListeners, this);
    this.app.off('auth:stateChanged', this.onAuthStateChanged, this);
    if (this.container?.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};