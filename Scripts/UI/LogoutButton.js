// Scripts/UI/LogoutButton.js
var LogoutButton = pc.createScript('logoutButton');

// Optional: Add attribute if the script isn't directly on the button entity
// LogoutButton.attributes.add('buttonEntity', { type: 'entity', title: 'Logout Button Entity' });

// initialize code called once per entity
LogoutButton.prototype.initialize = function() {
    this.privyService = this.app.services?.get('privyService');
    if (!this.privyService) {
        console.warn("LogoutButton: PrivyService not found.");
        this.app.once('services:initialized', () => {
            this.privyService = this.app.services.get('privyService');
        });
    }

    this.logoutButton = document.getElementById('logoutButton');
    if (this.logoutButton) {
        this.logoutButton.addEventListener('click', this.onLogoutClicked.bind(this));
        // Initial state check
        this.onAuthStateChanged({ state: this.privyService?.getState() || 'disconnected' });
    } else {
        console.warn("LogoutButton: DOM element with id 'logoutButton' not found.");
    }
    
    this.app.on('auth:stateChanged', this.onAuthStateChanged, this);
};

LogoutButton.prototype.onLogoutClicked = function() {
    console.log("Logout button clicked.");
    if (this.privyService) {
        this.privyService.logout();
    } else {
        console.error("LogoutButton: Cannot log out, PrivyService not available.");
    }
};

LogoutButton.prototype.onAuthStateChanged = function(stateData) {
    if (!this.logoutButton) return;
    const isAuthenticated = stateData.state === 'connected';

    if (isAuthenticated) {
        this.logoutButton.style.display = 'block';
    } else {
        this.logoutButton.style.display = 'none';
    }
};

LogoutButton.prototype.destroy = function() {
    if (this.logoutButton) {
        this.logoutButton.removeEventListener('click', this.onLogoutClicked.bind(this));
    }
    this.app.off('auth:stateChanged', this.onAuthStateChanged, this);
};

// swap method called for script hot-reloading
// inherit your script state here
// LogoutButton.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/