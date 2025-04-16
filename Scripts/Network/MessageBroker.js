var MessageBroker = pc.createScript('messageBroker');

// initialize code called once per entity
MessageBroker.prototype.initialize = function() {
    console.log("MessageBroker: Initializing...");
    this.room = null;

    // Listen for connection events
    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);

    // Setup listeners for outgoing message requests from the app
    this.setupAppEventListeners();
};

MessageBroker.prototype.onConnected = function(room) {
    console.log("MessageBroker: Received colyseus:connected event.");
    if (!room) {
        console.error("MessageBroker: Cannot initialize listeners. Room object is missing.");
        return;
    }
    this.room = room;
    this.setupRoomMessageListeners(); // Start listening for incoming messages
};

MessageBroker.prototype.onDisconnected = function(data) {
    console.log("MessageBroker: Received colyseus:disconnected event.", data);
    this.room = null;
    // No need to remove listeners specifically if using app.on/app.off correctly elsewhere
};

// Listen for specific messages FROM the Colyseus Room
MessageBroker.prototype.setupRoomMessageListeners = function() {
    if (!this.room) return;

    console.log("MessageBroker: Setting up room message listeners...");

    // --- Booth Messages ---
    this.room.onMessage("claimSuccess", (data) => {
        console.log(`[MessageBroker] Received claimSuccess:`, data);
        // Fire specific event for UI/other systems
        this.app.fire('booth:claimSuccess', data);
        // Note: PlayerData/BoothController might listen to this
    });

    this.room.onMessage("claimError", (data) => {
        console.warn(`[MessageBroker] Received claimError: Booth '${data.boothId}', Reason: ${data.reason}`);
        // Fire specific event for UI/other systems
        this.app.fire('booth:claimError', data);
    });

    // --- Donation Messages ---
    this.room.onMessage("donationConfirmed", (data) => {
        console.log(`[MessageBroker] Received donationConfirmed:`, data);
        // Fire events for effects and chat (or a single more generic event)
        this.app.fire('effects:donation', { recipient: data.recipient, amount: data.amountSOL });
        this.app.fire('chat:newMessage', { type: 'system', content: `${data.sender.substring(0, 4)}... donated ${data.amountSOL} SOL to ${data.recipient.substring(0, 4)}...!` });
        // Could also fire a more specific event: this.app.fire('donation:confirmed', data);
    });

    // --- Chat Messages ---
    this.room.onMessage("chatMessage", (data) => {
        // Expected data: { senderName: string, content: string } or similar
        console.log(`[MessageBroker] Received chatMessage:`, data);
        // Fire event for ChatController/HtmlChat to display
        // Ensure data and data.sender exist before accessing username
        const senderName = data?.sender?.username || 'Unknown';
        this.app.fire('chat:newMessage', { type: 'user', sender: senderName, content: data.content });
    });

    // Add listeners for any other custom messages here...
    // e.g., this.room.onMessage("serverNotification", (data) => { ... });
};

// Listen for events FROM the application requesting to send messages
MessageBroker.prototype.setupAppEventListeners = function() {
    console.log("MessageBroker: Setting up app event listeners for outgoing messages...");

    // --- Player Updates ---
    this.app.on("player:move", this.sendPlayerMove, this);
    this.app.on('user:setname', this.sendUsernameUpdate, this);
    this.app.on('auth:addressAvailable', this.sendAddressUpdate, this); // Or listen for a more specific 'player:updateAddress' event

    // --- Booth Actions ---
    this.app.on('booth:claimRequest', this.sendClaimBoothRequest, this);

    // --- Chat ---
    this.app.on('network:send:chatMessage', this.sendChatMessage, this); // Match ChatController event

    // Add listeners for any other outgoing message requests...
    // e.g., this.app.on('interaction:request', this.sendInteraction, this);
};

// --- Methods to Send Messages ---

MessageBroker.prototype.sendPlayerMove = function(data) {
    if (this.room) {
        // console.log("MessageBroker: Sending updatePosition:", data); // Optional: Verbose logging
        this.room.send("updatePosition", data);
    } else {
        console.warn("MessageBroker: Cannot send player:move, not connected.");
    }
};

MessageBroker.prototype.sendUsernameUpdate = function(confirmedUsername) {
     // TODO: Should ideally get username from AuthService or PlayerData, not rely on event payload directly if possible
    if (this.room && confirmedUsername) {
         // Check against current server state if possible/needed (might be complex here)
         // For simplicity, just send the update request. Server should handle duplicates.
        console.log(`MessageBroker: Sending setUsername: ${confirmedUsername}`);
        this.room.send("setUsername", { username: confirmedUsername });
        // Note: We don't update window.userName here. AuthService/PlayerData should be source of truth.
    } else {
        console.warn("MessageBroker: Cannot send setUsername. Not connected or username empty.");
    }
};

MessageBroker.prototype.sendAddressUpdate = function(data) {
    // Expecting data = { address: "0x..." } from 'auth:addressAvailable'
    if (this.room && data && data.address) {
        console.log("MessageBroker: Sending updateAddress:", data.address);
        this.room.send("updateAddress", { walletAddress: data.address });
    } else {
         console.warn("MessageBroker: Cannot send updateAddress. Not connected or address missing.");
    }
};

MessageBroker.prototype.sendClaimBoothRequest = function(boothId) {
    if (this.room && boothId) {
        console.log(`MessageBroker: Sending claimBooth request for '${boothId}'`);
        this.room.send('claimBooth', { boothId: boothId });
    } else {
        console.warn("MessageBroker: Cannot send claimBooth request. Not connected or boothId missing.");
    }
};

MessageBroker.prototype.sendChatMessage = function(messageData) {
    // messageData is expected to be { content: "string" } from ChatController
    const actualContent = messageData?.content; // Extract the actual string
    if (this.room && actualContent) {
        console.log("MessageBroker: Sending chatMessage:", actualContent);
        // Send only the actual string content under the 'content' key
        this.room.send("chatMessage", { content: actualContent });
    } else {
         console.warn("MessageBroker: Cannot send chatMessage. Not connected or message empty/invalid.", messageData);
    }
};

// Add other send methods as needed...
// MessageBroker.prototype.sendSomeOtherMessage = function(payload) { ... };


// swap method called for script hot-reloading
// MessageBroker.prototype.swap = function(old) { };