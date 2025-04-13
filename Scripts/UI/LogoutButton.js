// Scripts/UI/LogoutButton.js
var LogoutButton = pc.createScript('logoutButton');

// Optional: Add attribute if the script isn't directly on the button entity
// LogoutButton.attributes.add('buttonEntity', { type: 'entity', title: 'Logout Button Entity' });

// initialize code called once per entity
LogoutButton.prototype.initialize = function() {
    // Assuming the script is attached directly to the entity with the Button component
    const button = this.entity.button;

    if (button) {
        // Setup callback for when the button is pressed
        button.on('click', this.onLogoutClick, this);
        console.log("LogoutButton initialized for entity:", this.entity.name);
    } else {
        console.error("LogoutButton: No Button component found on entity:", this.entity.name);
    }

    // Optional: Listen to auth state changes to disable the button if not authenticated
    this.app.on('auth:stateChanged', this.updateButtonState, this);
    // Initial state update
    this.updateButtonState();
};

LogoutButton.prototype.onLogoutClick = function(event) {
    console.log("LogoutButton: Clicked. Firing 'auth:logout:request' event.");
    // Fire an event to request logout. AuthService should handle the actual logout process.
    this.app.fire('auth:logout:request');
};

LogoutButton.prototype.updateButtonState = function() {
    const button = this.entity.button;
    if (!button) return;

    let isAuthenticated = false;
    // Check auth state via AuthService if available
    const authService = this.app.services?.get('authService');
    if (authService) {
        isAuthenticated = authService.isAuthenticated();
    } else {
        // Fallback or initial state: Assume not authenticated if service isn't ready
        // This might briefly show the button as disabled until AuthService initializes
        isAuthenticated = false;
        console.warn("LogoutButton: AuthService not available for state check.");
    }

    // Enable the button only if the user is authenticated
    this.entity.enabled = isAuthenticated;
    // console.log("LogoutButton: Updated enabled state based on auth:", isAuthenticated);
};

// swap method called for script hot-reloading
// inherit your script state here
// LogoutButton.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/