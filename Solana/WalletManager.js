///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
// WalletManager.js
var WalletManager = pc.createScript('walletManager');

WalletManager.prototype.initialize = function () {
    // Find UI elements
    console.log('WalletManager initializing');
    this.walletAddressText = this.app.root.findByName('WalletAddress');
    this.walletBalanceText = this.app.root.findByName('WalletBalance');
    this.connectButton = this.app.root.findByName('WalletConnectButton');

    // Add button click event listener
    if (this.connectButton && this.connectButton.button) {
        this.connectButton.button.on('click', this.connectWallet, this);
    } else {
        console.error('Connect button or button component not found');
    }

    // Initialize wallet state
    this.isConnected = false;

    // Set up wallet event listeners using the wallet adapter's events
    if (window.SolanaSDK) {
        window.SolanaSDK.wallet.on('connect', this.handleWalletConnect.bind(this));
        window.SolanaSDK.wallet.on('disconnect', this.handleWalletDisconnect.bind(this));
    } else {
        console.error('SolanaSDK not found! Make sure bundle.js is loaded.');
    }

    console.log('WalletManager initialized');
};

WalletManager.prototype.handleWalletConnect = function (publicKey) {
    this.isConnected = true;
    this.updateWalletDisplay();
    console.log('Wallet connected:', publicKey.toBase58());

    // Send the address to the server to be attached to player.address
    if (this.app.room) {
        this.app.room.send("updateAddress", { address: publicKey.toBase58() });
    } else {
        console.warn("No room found, can't update address on server!");
    }
};

WalletManager.prototype.handleWalletDisconnect = function () {
    this.isConnected = false;
    this.updateWalletDisplay();
    console.log('Wallet disconnected');
};

WalletManager.prototype.getWalletBalance = async function () {
    if (!window.SolanaSDK.wallet.connected) {
        throw new Error('Wallet not connected');
    }
    try {
        const balance = await window.SolanaSDK.connection.getBalance(window.SolanaSDK.wallet.publicKey);
        return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
        console.error('Failed to fetch balance:', error);
        throw error;
    }
};

WalletManager.prototype.updateWalletDisplay = async function () {
    if (!this.isConnected) {
        this.walletAddressText.element.text = 'Not Connected';
        this.walletBalanceText.element.text = 'Balance: 0 SOL';
        return;
    }

    try {
        // Use the local getWalletBalance method instead of window.SolanaSDK.getWalletBalance()
        const balance = await this.getWalletBalance();
        this.walletBalanceText.element.text = `Balance: ${balance.toFixed(4)} SOL`;
        this.walletAddressText.element.text = `Address: ${window.SolanaSDK.wallet.publicKey.toBase58()}`;
    } catch (error) {
        console.error('Error updating wallet display:', error);
    }
};

WalletManager.prototype.connectWallet = async function () {
    try {
        // Call the wallet adapter's connect method directly.
        await window.SolanaSDK.wallet.connect();
        // The handleWalletConnect event handler will update the display.
    } catch (error) {
        console.error('Error connecting wallet:', error);
        this.walletAddressText.element.text = 'Connection Failed';
    }
};
