// Scripts/Core/Services.js
var Services = pc.createScript('services');

// initialize code called once per entity
Services.prototype.initialize = function() {
    console.log("Services registry initializing...");
    // Make the registry accessible globally via app for easy access during refactor.
    // Consider refining access patterns later if needed.
    this.app.services = this;

    // Registry to hold references to service scripts
    this.registry = {};

    // Automatically register other scripts attached to this SAME entity.
    // This assumes service scripts (like AuthService, ConnectionManager later)
    // will be added to the 'Services' entity in the editor.
    for (const scriptName in this.entity.script) {
        // Check if it's a script component instance and not this 'services' script itself
        if (scriptName !== 'services' && this.entity.script.hasOwnProperty(scriptName) && this.entity.script[scriptName] instanceof pc.ScriptType) {
            const serviceInstance = this.entity.script[scriptName];
            this.register(scriptName, serviceInstance);
        }
    }

    console.log("Services registry initialized. Registered services on this entity:", Object.keys(this.registry));
    this.app.fire('services:initialized'); // Event indicating the registry is ready
};

// Method to explicitly register a service instance
// (Useful if a service is on a different entity or needs manual registration)
Services.prototype.register = function(name, instance) {
    if (this.registry[name]) {
        console.warn(`Services: Service already registered with name '${name}'. Overwriting.`);
    }
    if (!instance) {
        console.error(`Services: Attempted to register null or undefined instance for '${name}'.`);
        return;
    }
    console.log(`Services: Registering service '${name}'`);
    this.registry[name] = instance;
    this.app.fire(`service:${name}:registered`, instance); // Fire specific event for this service
};

// Method to retrieve a registered service instance
Services.prototype.get = function(name) {
    const service = this.registry[name];
    if (!service) {
        // Log a warning, but don't throw an error immediately during refactoring.
        // Systems might try to access services before they are registered.
        console.warn(`Services: Service with name '${name}' not found in registry.`);
        // Consider throwing an error in production or after refactoring stabilizes:
        // throw new Error(`Service not found: ${name}`);
    }
    return service;
};

// swap method called for script hot-reloading
// inherit your script state here
// Services.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/