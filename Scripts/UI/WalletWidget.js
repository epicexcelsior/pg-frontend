// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\UI\WalletWidget.js
var WalletWidget = pc.createScript('walletWidget');

WalletWidget.attributes.add('css', { type: 'asset', assetType: 'css', title: 'Widget CSS' });
WalletWidget.attributes.add('html', { type: 'asset', assetType: 'html', title: 'Widget HTML' });

WalletWidget.prototype.initialize = function () {
    console.log('WalletWidget: Initializing.');

    const style = document.createElement('style');
    style.innerHTML = this.css.resource;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.innerHTML = this.html.resource;
    document.body.appendChild(container);

    this.container = container;
    this.walletWidgetEl = container.querySelector('#wallet-widget');
    this.walletAddressEl = container.querySelector('#wallet-address');
    this.walletBalanceEl = container.querySelector('#wallet-balance');
    this.logoutButtonEl = container.querySelector('#logout-btn');
    this.twitterLinkEl = container.querySelector('#twitter-link');
    this.twitterHandleEl = container.querySelector('#twitter-handle');

    this.walletWidgetEl.style.display = 'none';
    this.walletBalanceEl.textContent = '... SOL';

    this.currentAddress = null;
    this.balanceRetryTimeout = null;
    this.maxBalanceRetries = 8;
    this.feedbackService = null;
    this.heliusRpcUrl = null;
    this.heliusConnection = null;

    this.boundOnAddressClick = this.onAddressClick.bind(this);
    this.boundOnAddressKeyDown = this.onAddressKeyDown.bind(this);
    this.boundOnLogoutClick = this.onLogout.bind(this);
    this.boundOnLinkTwitterClick = this.onLinkTwitter.bind(this);

    if (this.walletAddressEl) {
        this.walletAddressEl.addEventListener('click', this.boundOnAddressClick);
        this.walletAddressEl.addEventListener('keydown', this.boundOnAddressKeyDown);
        this.walletAddressEl.setAttribute('role', 'button');
        this.walletAddressEl.setAttribute('tabindex', '0');
        this.walletAddressEl.setAttribute('title', 'Copy address');
        this.walletAddressEl.setAttribute('data-tooltip', 'Copy address');
        this.walletAddressEl.setAttribute('data-sound', 'ui_click_default');
    }

    if (this.logoutButtonEl) {
        this.logoutButtonEl.addEventListener('click', this.boundOnLogoutClick);
        this.logoutButtonEl.setAttribute('data-sound', 'ui_click_default');
    }

    if (this.twitterLinkEl) {
        this.twitterLinkEl.addEventListener('click', this.boundOnLinkTwitterClick);
        this.twitterLinkEl.setAttribute('data-sound', 'ui_click_default');
    }

    this.app.on('services:initialized', this.setupEventListeners, this);
    if (this.app.services) {
        this.setupEventListeners();
    }

    this.app.on('donation:stateChanged', this.onDonationStateChanged, this);
    this.app.on('wallet:refreshBalance', this.onWalletRefreshRequest, this);
    this.app.on('effects:donation', this.onIncomingDonation, this);

    this.app.fire('wallet:ready', { element: this.walletWidgetEl });
};

WalletWidget.prototype.setupEventListeners = function () {
    if (this.privyManager) {
        return;
    }

    const services = this.app.services;
    if (!services) {
        return;
    }

    this.configLoader = services.get('configLoader') || this.configLoader;
    if (this.configLoader && !this.heliusRpcUrl) {
        this.heliusRpcUrl = this.configLoader.get('heliusRpcUrl');
        console.log('WalletWidget: Loaded heliusRpcUrl from config:', this.heliusRpcUrl);
    }

    this.privyManager = services.get('privyManager');
    this.feedbackService = services.get('feedbackService') || this.feedbackService;

    if (this.privyManager) {
        this.app.on('auth:stateChanged', this.onAuthStateChanged, this);
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

WalletWidget.prototype.onLogout = function () {
    if (this.privyManager) {
        this.privyManager.logout();
    }
};

WalletWidget.prototype.onLinkTwitter = function () {
    if (this.privyManager) {
        this.privyManager.linkTwitter();
    }
};

WalletWidget.prototype.onAuthStateChanged = function (data) {
    if (data.isAuthenticated && data.address) {
        this.currentAddress = data.address;
        this.walletWidgetEl.style.display = 'flex';
        this.walletAddressEl.textContent = this.formatAddress(data.address);
        this.walletAddressEl.title = data.address;
        this.walletBalanceEl.textContent = 'Fetching...';

        this.updateTwitterDisplay(data.twitterHandle);

        this.stopBalancePolling();
        this.startBalancePolling();
    } else {
        this.currentAddress = null;
        this.walletWidgetEl.style.display = 'none';
        this.walletBalanceEl.textContent = '... SOL';
        this.updateTwitterDisplay(null);
        this.stopBalancePolling();
    }
};

WalletWidget.prototype.onDonationStateChanged = function (data) {
    if (!data || data.state !== 'success') {
        return;
    }
    this.scheduleBalanceRefresh(500);
};

WalletWidget.prototype.onWalletRefreshRequest = function (data) {
    if (!this.currentAddress) {
        return;
    }
    if (data && data.address && data.address !== this.currentAddress) {
        return;
    }
    const delay = data && typeof data.delayMs === 'number' ? Math.max(0, data.delayMs) : 0;
    this.scheduleBalanceRefresh(delay);
};

WalletWidget.prototype.onIncomingDonation = function (data) {
    if (!this.currentAddress || !data) {
        return;
    }
    if (data.recipient === this.currentAddress || data.sender === this.currentAddress) {
        this.scheduleBalanceRefresh(500);
    }
};

WalletWidget.prototype.startBalancePolling = function () {
    if (!this.currentAddress) {
        return;
    }

    this.clearBalanceRetryTimeout();
    this.fetchBalance(this.currentAddress);
};

WalletWidget.prototype.stopBalancePolling = function () {
    this.clearBalanceRetryTimeout();
};

WalletWidget.prototype.clearBalanceRetryTimeout = function () {
    if (this.balanceRetryTimeout) {
        clearTimeout(this.balanceRetryTimeout);
        this.balanceRetryTimeout = null;
    }
};

WalletWidget.prototype.scheduleBalanceRefresh = function (delayMs) {
    if (!this.currentAddress) {
        return;
    }
    const delay = typeof delayMs === 'number' && delayMs >= 0 ? delayMs : 0;
    this.clearBalanceRetryTimeout();
    if (delay === 0) {
        this.fetchBalance(this.currentAddress);
        return;
    }
    this.balanceRetryTimeout = window.setTimeout(() => {
        this.balanceRetryTimeout = null;
        if (this.currentAddress) {
            this.fetchBalance(this.currentAddress);
        }
    }, delay);
};

WalletWidget.prototype.fetchBalance = async function (address, attempt = 0) {
    if (!this.currentAddress || address !== this.currentAddress) {
        return;
    }

    this.clearBalanceRetryTimeout();

    let balanceLamports = null;
    let lastError = null;

    const sdkRpc = window.SolanaSDK && window.SolanaSDK.rpc;
    if (sdkRpc && typeof sdkRpc.getBalance === 'function') {
        try {
            console.log('WalletWidget: Attempting SolanaSDK RPC balance fetch for address:', address);
            const request = sdkRpc.getBalance(address, { commitment: 'confirmed' });
            balanceLamports = typeof request.send === 'function' ? await request.send() : await request;
            console.log('WalletWidget: SolanaSDK RPC balance result:', balanceLamports);
        } catch (error) {
            lastError = error;
            console.warn('WalletWidget: SolanaSDK RPC balance fetch failed, attempting fallback.', error);
        }
    }

    if (balanceLamports === null) {
        const solanaWeb3 = window.solanaWeb3 || (window.SolanaSDK && window.SolanaSDK.web3);
        if (solanaWeb3 && solanaWeb3.Connection && solanaWeb3.PublicKey && this.heliusRpcUrl) {
            try {
                console.log('WalletWidget: Attempting fallback RPC balance fetch via heliusRpcUrl:', this.heliusRpcUrl);
                if (!this.heliusConnection) {
                    this.heliusConnection = new solanaWeb3.Connection(this.heliusRpcUrl, 'confirmed');
                }
                const publicKey = new solanaWeb3.PublicKey(address);
                balanceLamports = await this.heliusConnection.getBalance(publicKey, 'confirmed');
                console.log('WalletWidget: Fallback RPC balance result:', balanceLamports);
            } catch (fallbackError) {
                lastError = fallbackError;
                console.error('WalletWidget: Fallback RPC balance fetch failed:', fallbackError);
            }
        } else {
            console.warn('WalletWidget: Fallback RPC not available. solanaWeb3:', !!solanaWeb3, 'heliusRpcUrl:', this.heliusRpcUrl);
        }
    }

    if (balanceLamports === null) {
        if (attempt >= this.maxBalanceRetries) {
            if (lastError) {
                console.error('WalletWidget: Failed to fetch balance after retries.', lastError);
            }
            this.walletBalanceEl.textContent = 'Error';
            return;
        }
        const retryDelay = Math.min(4000, 1000 * (attempt + 1));
        this.balanceRetryTimeout = window.setTimeout(() => {
            this.balanceRetryTimeout = null;
            this.fetchBalance(address, attempt + 1);
        }, retryDelay);
        return;
    }

    if (address !== this.currentAddress) {
        return;
    }

    // Ensure balanceLamports is a valid number
    if (typeof balanceLamports !== 'number' || isNaN(balanceLamports)) {
        console.error('WalletWidget: Invalid balance value received:', balanceLamports);
        this.walletBalanceEl.textContent = 'Error';
        return;
    }

    const balanceSol = balanceLamports / 1_000_000_000;
    this.walletBalanceEl.textContent = `${balanceSol.toFixed(4)} SOL`;
};

WalletWidget.prototype.formatAddress = function (address) {
    if (!address || address.length <= 10) {
        return address || '';
    }
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

WalletWidget.prototype.onAddressClick = function () {
    this.copyCurrentAddress();
};

WalletWidget.prototype.onAddressKeyDown = function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.copyCurrentAddress();
    }
};

WalletWidget.prototype.copyCurrentAddress = async function () {
    if (!this.currentAddress) {
        return;
    }

    const address = this.currentAddress;

    try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(address);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = address;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'absolute';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            if (!successful) {
                throw new Error('Clipboard copy command failed.');
            }
        }
        this.showCopyFeedback(true);
    } catch (error) {
        console.error('WalletWidget: Failed to copy wallet address:', error);
        this.showCopyFeedback(false);
    }
};

WalletWidget.prototype.showCopyFeedback = function (success) {
    if (!this.feedbackService) {
        if (success) {
            console.log('WalletWidget: Wallet address copied to clipboard.');
        }
        return;
    }

    if (success) {
        this.feedbackService.showSuccess('Wallet address copied to clipboard.', 2000);
    } else {
        this.feedbackService.showError('Copy Failed', 'Unable to copy wallet address.', false);
    }
};

WalletWidget.prototype.destroy = function () {
    this.stopBalancePolling();

    this.app.off('services:initialized', this.setupEventListeners, this);
    this.app.off('auth:stateChanged', this.onAuthStateChanged, this);
    this.app.off('donation:stateChanged', this.onDonationStateChanged, this);
    this.app.off('wallet:refreshBalance', this.onWalletRefreshRequest, this);
    this.app.off('effects:donation', this.onIncomingDonation, this);
    this.app.fire('wallet:destroyed');

    if (this.walletAddressEl) {
        this.walletAddressEl.removeEventListener('click', this.boundOnAddressClick);
        this.walletAddressEl.removeEventListener('keydown', this.boundOnAddressKeyDown);
    }

    if (this.logoutButtonEl && this.boundOnLogoutClick) {
        this.logoutButtonEl.removeEventListener('click', this.boundOnLogoutClick);
    }

    if (this.twitterLinkEl && this.boundOnLinkTwitterClick) {
        this.twitterLinkEl.removeEventListener('click', this.boundOnLinkTwitterClick);
    }

    if (this.container?.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};

WalletWidget.prototype.updateTwitterDisplay = function (twitterHandle) {
    if (this.twitterLinkEl && this.twitterHandleEl) {
        if (twitterHandle) {
            this.twitterHandleEl.textContent = `@${twitterHandle}`;
            this.twitterLinkEl.style.display = 'none';
            this.twitterHandleEl.style.display = 'flex';
        } else {
            this.twitterLinkEl.style.display = 'block';
            this.twitterHandleEl.style.display = 'none';
        }
    }
};





