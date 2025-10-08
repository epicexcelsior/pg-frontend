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

MessageBroker.prototype.sendIfConnected = function (type, payload) {
    if (this.app.room) {
        this.app.room.send(type, payload);
    }
};

MessageBroker.prototype.setupAppEventListeners = function () {
    this.app.on('player:move', (posData) => {
        this.sendIfConnected('updatePosition', posData);
    }, this);
    this.app.on('booth:claimRequest', (data) => {
        const boothId = typeof data === 'string' ? data : (data && data.boothId ? data.boothId : null);
        if (typeof boothId !== 'string' || boothId.length === 0) {
            console.warn('MessageBroker: Ignored booth claim request with invalid boothId.', data);
            return;
        }
        this.sendIfConnected('claimBooth', { boothId: boothId });
    }, this);
    this.app.on('booth:unclaimRequest', () => {
        this.sendIfConnected('unclaimBooth');
    }, this);
    this.app.on('player:setUsername', (username) => {
        const trimmed = typeof username === 'string' ? username.trim() : '';
        if (!trimmed) {
            return;
        }
        this.sendIfConnected('setUsername', { username: trimmed });
    }, this);
    this.app.on('player:chat', (message) => {
        const raw = typeof message === 'string' ? message : (message && typeof message.content === 'string' ? message.content : '');
        const trimmed = typeof raw === 'string' ? raw.trim() : '';
        if (!trimmed) {
            return;
        }
        const limited = trimmed.length > 100 ? trimmed.substring(0, 100) : trimmed;
        this.sendIfConnected('chatMessage', { content: limited });
    }, this);
    this.app.on('player:avatar:recipe', (recipe) => {
        this.sendIfConnected('avatar:recipe', recipe);
    }, this);
    this.app.on('player:animation:play', (payload) => {
        const animationName = typeof payload === 'string' ? payload : (payload && payload.name ? payload.name : null);
        if (!animationName) {
            return;
        }
        this.sendIfConnected('animation:play', { name: animationName });
    }, this);

    this.app.on('network:send', (type, payload) => {
        if (typeof type !== 'string' || !type.length) {
            console.warn('MessageBroker: network:send called without a valid message type.', type);
            return;
        }
        this.sendIfConnected(type, payload);
    }, this);

    const legacyEvents = [
        { event: 'network:send:chatMessage', type: 'chatMessage' },
        { event: 'network:send:avatarRecipe', type: 'avatar:recipe' },
        { event: 'network:send:animation', type: 'animation:play' },
        { event: 'network:send:unclaimBooth', type: 'unclaimBooth' },
        { event: 'network:send:updateAddress', type: 'updateAddress' }
    ];

    legacyEvents.forEach((entry) => {
        this.app.on(entry.event, (payload) => {
            this.app.fire('network:send', entry.type, payload);
        }, this);
    });
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


