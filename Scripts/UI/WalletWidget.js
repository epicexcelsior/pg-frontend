// Scripts/UI/WalletWidget.js
var WalletWidget = pc.createScript('walletWidget');

// === ATTRIBUTES ===
WalletWidget.attributes.add('css', { type: 'asset', assetType: 'css', title: 'CSS Asset' });
WalletWidget.attributes.add('html', { type: 'asset', assetType: 'html', title: 'HTML Asset' });

// === INITIALIZE ===
WalletWidget.prototype.initialize = function () {
    console.log("WalletWidget initializing...");
    
    // 1. Inject HTML and CSS
    if (this.css && this.css.resource) {
        const style = document.createElement('style');
        document.head.appendChild(style);
        style.innerHTML = this.css.resource;
    }
    
    this.container = document.createElement('div');
    this.container.innerHTML = this.html.resource;
    document.body.appendChild(this.container);

    // 2. Get DOM Elements
    this.walletWidget = this.container.querySelector('#wallet-widget');
    this.connectedState = this.container.querySelector('#wallet-connected');
    this.disconnectedState = this.container.querySelector('#wallet-disconnected');
    this.walletBalance = this.container.querySelector('#wallet-balance');
    this.walletAddress = this.container.querySelector('#wallet-address');
    this.logoutBtn = this.container.querySelector('#logout-btn');
    this.connectBtn = this.container.querySelector('#connect-btn');

    if (!this.walletWidget || !this.connectedState || !this.disconnectedState) {
        console.error("WalletWidget: Required DOM elements not found!");
        return;
    }

    // 3. Get PrivyService
    this.privyService = this.app.services?.get('privyService');
    if (!this.privyService) {
        this.app.once('services:initialized', () => {
            this.privyService = this.app.services.get('privyService');
            this.updateDisplay();
        });
    }

    // 4. Setup Event Listeners
    if (this.logoutBtn) {
        this.logoutBtn.addEventListener('click', this.onLogoutClick.bind(this));
    }
    // Remove pre-auth connect button behavior; widget shown only when authenticated

    // 5. Listen for auth state changes
    this.app.on('auth:stateChanged', this.onAuthStateChanged, this);

    // 6. Initial display update
    this.currentBalance = 0;
    this.currentAddress = null;
    this.updateDisplay();

    console.log("WalletWidget initialized.");
};

// === EVENT HANDLERS ===
WalletWidget.prototype.onAuthStateChanged = function(stateData) {
    console.log("WalletWidget: Auth state changed:", stateData);
    this.currentAddress = stateData.address || null;
    this.updateDisplay();
    
    // Fetch balance if connected
    if (stateData.state === 'connected' && this.currentAddress) {
        this.fetchBalance();
    }
};

WalletWidget.prototype.onLogoutClick = function() {
    console.log("WalletWidget: Logout clicked");
    if (this.privyService) {
        this.privyService.logout();
    } else {
        console.error("WalletWidget: PrivyService not available for logout");
    }
};

WalletWidget.prototype.onConnectClick = function() {
    console.log("WalletWidget: Connect clicked");
    if (this.privyService) {
        this.privyService.login();
    } else {
        console.error("WalletWidget: PrivyService not available for login");
    }
};

// === DISPLAY METHODS ===
WalletWidget.prototype.updateDisplay = function() {
    if (!this.connectedState || !this.disconnectedState) return;

    const isConnected = this.privyService && this.privyService.isAuthenticated();
    
    if (isConnected && this.currentAddress) {
        if (this.walletWidget) {
            this.walletWidget.style.display = 'block';
        }
        // Show connected state
        this.disconnectedState.style.display = 'none';
        this.connectedState.style.display = 'flex';
        this.connectedState.classList.add('fade-in');
        
        // Update address display
        if (this.walletAddress) {
            const formattedAddress = this.formatAddress(this.currentAddress);
            this.walletAddress.textContent = formattedAddress;
        }
        
        // Update balance display
        if (this.walletBalance) {
            this.walletBalance.textContent = `${this.currentBalance.toFixed(3)} SOL`;
        }
    } else {
        // Show disconnected state
        // Hide the widget entirely when not authenticated
        if (this.walletWidget) {
            this.walletWidget.style.display = 'none';
        }
        
        // Reset values
        this.currentBalance = 0;
        this.currentAddress = null;
    }
};

WalletWidget.prototype.formatAddress = function(address) {
    if (!address || address.length < 8) return address;
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
};

WalletWidget.prototype.fetchBalance = function() {
    if (!this.currentAddress) return;
    
    // Use the same RPC endpoint as configured in the game
    const config = this.app.config?.get();
    if (!config) {
        console.warn("WalletWidget: No config available for RPC endpoint");
        return;
    }

    // For now, we'll use a simple fetch to get balance
    // In a real implementation, you might want to use the same Solana SDK as the rest of the game
    try {
        this.fetchSolanaBalance(this.currentAddress)
            .then(balance => {
                this.currentBalance = balance;
                this.updateDisplay();
            })
            .catch(error => {
                console.warn("WalletWidget: Failed to fetch balance:", error);
                this.currentBalance = 0;
                this.updateDisplay();
            });
    } catch (error) {
        console.warn("WalletWidget: Error fetching balance:", error);
    }
};

WalletWidget.prototype.fetchSolanaBalance = function(address) {
    return new Promise((resolve, reject) => {
        // Use Helius mainnet endpoint for balance checking
        // In production, you might want to use the same RPC as configured in your game
        const rpcUrl = 'https://api.mainnet-beta.solana.com';
        
        const requestBody = {
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [address]
        };

        fetch(rpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                reject(new Error(data.error.message));
                return;
            }
            
            // Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
            const lamports = data.result?.value || 0;
            const sol = lamports / 1000000000;
            resolve(sol);
        })
        .catch(error => {
            reject(error);
        });
    });
};

// === CLEANUP ===
WalletWidget.prototype.destroy = function() {
    this.app.off('auth:stateChanged', this.onAuthStateChanged, this);
    
    if (this.logoutBtn) {
        this.logoutBtn.removeEventListener('click', this.onLogoutClick.bind(this));
    }
    if (this.connectBtn) {
        this.connectBtn.removeEventListener('click', this.onConnectClick.bind(this));
    }
    
    if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
    }
};
