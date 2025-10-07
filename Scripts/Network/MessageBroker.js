// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\MessageBroker.js
var MessageBroker = pc.createScript('messageBroker');

MessageBroker.prototype.initialize = function () {
    this.setupAppEventListeners();
    if (this.app.room) {
        this.setupRoomMessageListeners(this.app.room);
    } else {
        this.app.once('colyseus:connected', this.setupRoomMessageListeners, this);
    }
};

MessageBroker.prototype.setupRoomMessageListeners = function (room) {
    if (!room) return;
    room.onMessage("claimSuccess", (data) => this.app.fire('booth:claimSuccess', data));
    room.onMessage("claimError", (data) => this.app.fire('booth:claimError', data));
    // [!code ++]
    // Renamed to match server-side refactor
    room.onMessage("announceDonation", (data) => {
        const donationEvent = {
            signature: data.signature || null,
            recipient: data.recipient || null,
            recipientUsername: data.recipientUsername || null,
            sender: data.sender || null,
            senderUsername: data.senderUsername || null,
            amount: data.amountSOL || 0,
            senderTwitter: data.senderTwitter || null,
            senderTwitterId: data.senderTwitterId || null,
            recipientTwitter: data.recipientTwitter || null,
            recipientTwitterId: data.recipientTwitterId || null,
            tweetId: data.tweetId || null,
            tweetUrl: data.tweetUrl || null,
            tweetText: data.tweetText || null
        };
        this.app.fire('effects:donation', donationEvent);
        const senderLabel = donationEvent.senderTwitter ? `@${donationEvent.senderTwitter}` : this.formatIdentity(data.senderUsername, data.sender);
        const recipientLabel = donationEvent.recipientTwitter ? `@${donationEvent.recipientTwitter}` : this.formatIdentity(data.recipientUsername, data.recipient);
        const solAmount = this.formatSolAmount(data.amountSOL);
        this.app.fire('chat:newMessage', { type: 'system', content: `${senderLabel} donated ${solAmount} SOL to ${recipientLabel}!` });
        if (data.sender) {
            this.app.fire('wallet:refreshBalance', { address: data.sender, source: 'donation:announce:sender' });
        }
        if (data.recipient) {
            this.app.fire('wallet:refreshBalance', { address: data.recipient, source: 'donation:announce:recipient' });
        }
        if (donationEvent.tweetUrl) {
            this.app.fire('donation:tweetPublished', donationEvent);
        }
    });
    room.onMessage("announceDonationError", (data) => this.app.fire('donation:announcementFailed', data));
    room.onMessage("boothUnclaimed", (data) => this.app.fire('booth:unclaimed', data));
    // [!code --]
    room.onMessage("chatMessage", (data) => {
        const senderName = data?.sender?.username || 'Unknown';
        this.app.fire('chat:newMessage', { type: 'user', sender: senderName, content: data.content });
    });
    room.onMessage("avatar:recipe", (data) => this.app.fire('avatar:recipe', data));
    room.onMessage("animation:play", (data) => this.app.fire('animation:play:network', data));
};

MessageBroker.prototype.setupAppEventListeners = function () {
    // Restore listeners for specific, direct messages
    this.app.on('player:move', (posData) => {
        if (this.app.room) {
            this.app.room.send('updatePosition', posData);
        }
    }, this);
    this.app.on('booth:claimRequest', (boothId) => {
        if (this.app.room) {
            this.app.room.send('claimBooth', { boothId });
        }
    }, this);
    this.app.on('booth:unclaimRequest', () => {
        if (this.app.room) {
            this.app.room.send('unclaimBooth');
        }
    }, this);
    this.app.on('player:setUsername', (username) => {
        if (this.app.room) {
            this.app.room.send('setUsername', { username });
        }
    }, this);
    this.app.on('player:chat', (message) => {
        if (this.app.room) {
            this.app.room.send('chatMessage', { message });
        }
    }, this);
    this.app.on('player:avatar:recipe', (recipe) => {
        if (this.app.room) {
            this.app.room.send('avatar:recipe', recipe);
        }
    }, this);
    this.app.on('player:animation:play', (name) => {
        if (this.app.room) {
            this.app.room.send('animation:play', { name });
        }
    }, this);

    // Add the generic listener that handles the donation flow correctly
    this.app.on('network:send', (type, payload) => {
        if (this.app.room) {
            this.app.room.send(type, payload);
        }
    }, this);
};

MessageBroker.prototype.formatIdentity = function (username, address) {
    if (typeof username === 'string') {
        const trimmed = username.trim();
        if (trimmed.length) {
            return trimmed;
        }
    }
    if (typeof address === 'string' && address.length) {
        if (address.length <= 8) {
            return address;
        }
        return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
    }
    return 'Someone';
};

MessageBroker.prototype.formatSolAmount = function (value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return value;
    }
    const fixed = numeric.toFixed(4);
    const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
    return trimmed.length ? trimmed : '0';
};


