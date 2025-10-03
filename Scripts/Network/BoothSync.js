var BoothSync = pc.createScript('boothSync');

// initialize code called once per entity
BoothSync.prototype.initialize = function() {
    console.log("BoothSync: Initializing...");
    this.room = null;
    // No need to store booth entities here, just fire events

    // Listen for connection events
    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
};

BoothSync.prototype.onConnected = function(room) {
    console.log("BoothSync: Received colyseus:connected event.");
    if (!room) {
        console.error("BoothSync: Cannot initialize listeners. Room object is missing.");
        return;
    }
    this.room = room;

    // --- Setup Booth State Listeners ---
    console.log("BoothSync: Setting up booth state listeners...");

    // Listen for new booths being added
    this.room.state.booths.onAdd((booth, boothId) => {
        console.log(`BoothSync: Booth added: ${boothId}, Claimed by: ${booth.claimedBy || 'None'}`);
        this.handleBoothUpdate(booth, boothId, true); // Fire initial add event

        // Listen for changes on this specific booth
        booth.onChange(() => {
            console.log(`BoothSync: Booth changed: ${boothId}, Claimed by: ${booth.claimedBy || 'None'}`);
            this.handleBoothUpdate(booth, boothId, false); // Fire update event
        });
    });

    // Listen for booths being removed
    this.room.state.booths.onRemove((booth, boothId) => {
        // Note: The 'booth' object passed here might be the state *before* removal.
        // We primarily care about the boothId for removal events.
        console.log(`BoothSync: Booth removed: ${boothId}`);
        this.handleBoothRemove(boothId);
    });

    // --- Initial Population ---
    // Process booths already in the room when we join
    console.log("BoothSync: Processing existing booths...");
    this.room.state.booths.forEach((booth, boothId) => {
        console.log(`BoothSync: Processing existing booth: ${boothId}`);
        this.handleBoothUpdate(booth, boothId, true); // Fire initial add event

        // Attach onChange listener for existing booths too
         booth.onChange(() => {
            console.log(`BoothSync: Existing Booth changed: ${boothId}, Claimed by: ${booth.claimedBy || 'None'}`);
            this.handleBoothUpdate(booth, boothId, false); // Fire update event
        });
    });

    console.log("BoothSync: Booth listeners initialized.");
};

BoothSync.prototype.onDisconnected = function(data) {
    console.log("BoothSync: Received colyseus:disconnected event.", data);
    this.room = null;
    // No specific cleanup needed here unless we were tracking booth entities
};

BoothSync.prototype.handleBoothUpdate = function(boothState, boothId, isInitialAdd) {
    // Extract relevant data from the booth state
    const boothData = {
        boothId: boothId,
        claimedBy: boothState.claimedBy,
        claimedByUsername: boothState.claimedByUsername, // Include username
        claimedByTwitterHandle: boothState.claimedByTwitterHandle,
    };

    // Fire specific event for initial add, generic update otherwise
    const eventName = isInitialAdd ? 'booth:added' : 'booth:updated';
    this.app.fire(eventName, boothData);

    // Optional: Log the event being fired
    // console.log(`BoothSync: Fired event '${eventName}' for booth ${boothId}`);
};

BoothSync.prototype.handleBoothRemove = function(boothId) {
    // Fire event for other systems
    this.app.fire('booth:removed', { boothId: boothId });
    // Optional: Log the event being fired
    // console.log(`BoothSync: Fired event 'booth:removed' for booth ${boothId}`);
};

// swap method called for script hot-reloading
// BoothSync.prototype.swap = function(old) { };