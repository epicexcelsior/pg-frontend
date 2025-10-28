// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\MessageBroker.js
var MessageBroker = pc.createScript('messageBroker');

MessageBroker.prototype.initialize = function () {
    this.currentRoom = null;
    this.lastMovePayload = null;
    this.lastMoveSentAt = 0;
    this.lastUsernameSent = null;
    this.pendingUsername = null;
    this.coinBalance = 0;
    this.coinLifetime = 0;
    this.lastCoinFetchAt = 0;
    this.coinFetchIntervalMs = 45000;
    this._playgroundMessageTypes = {};
    this.moveMinInterval = 100; // ms between sends when player is moving
    this.moveMaxInterval = 400; // ms heartbeat even if stationary
    this.movePosThresholdSq = 0.04 * 0.04; // ~4 cm positional threshold
    this.moveRotThreshold = 2; // degrees
    this.moveSpeedThreshold = 0.02;
    this.setupAppEventListeners();
    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
    if (this.app.room) {
        this.onConnected(this.app.room);
    }
};

MessageBroker.prototype.onConnected = function (room) {
    if (!room || this.currentRoom === room) {
        return;
    }
    this.currentRoom = room;
    this.setupRoomMessageListeners(room);
    this.scheduleCoinFetch(true);
    if (this.pendingUsername) {
        const pending = this.pendingUsername;
        this.pendingUsername = null;
        this.lastUsernameSent = pending;
        this.sendIfConnected('setUsername', { username: pending });
    }
};

MessageBroker.prototype.onDisconnected = function () {
    this.currentRoom = null;
    if (this.lastUsernameSent) {
        this.pendingUsername = this.lastUsernameSent;
        this.lastUsernameSent = null;
    }
    this.clearCoinSchedule();
};

MessageBroker.prototype.setupRoomMessageListeners = function (room) {
    if (!room) return;
    room.onMessage("__playground_message_types", this._handlePlaygroundMessageTypes.bind(this));
    room.onMessage("claimSuccess", (data) => this.app.fire('booth:claimSuccess', data));
    room.onMessage("claimError", (data) => this.app.fire('booth:claimError', data));
    room.onMessage("authRequired", (data) => this.app.fire('booth:authRequired', data));
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
    room.onMessage("boothUnclaimed", (data) => {
        this.app.fire('booth:unclaimed', data);
        const boothId = data && typeof data.boothId === 'string' ? data.boothId : null;
        if (boothId) {
            this.app.fire('booth:updated', {
                boothId: boothId,
                claimedBy: '',
                claimedByUsername: '',
                claimedByTwitterHandle: '',
                claimedByTwitterId: '',
                description: '',
                previousOwner: data && typeof data.previousOwner === 'string' ? data.previousOwner : '',
                previousOwnerUsername: data && typeof data.previousOwnerUsername === 'string' ? data.previousOwnerUsername : '',
            });
        }
    });
    // [!code --]
    room.onMessage("chatMessage", (data) => {
        const senderName = data?.sender?.username || 'Unknown';
        this.app.fire('chat:newMessage', { type: 'user', sender: senderName, content: data.content });
    });
    room.onMessage("avatar:recipe", (data) => this.app.fire('avatar:recipe', data));
    room.onMessage("animation:play", (data) => {
        // data: { playerId, id, triggerId }
        // Route animation directly to the correct player entity
        const playerSync = this.app.playerSync;
        if (!playerSync) return;

        const targetEntity = playerSync.getPlayerEntityById(data.playerId);
        if (!targetEntity || !targetEntity.script || !targetEntity.script.playerAnimation) return;

        targetEntity.script.playerAnimation.applyNetworkEmote(data);
    });
    room.onMessage("booth:updateDescription:ok", (data) => this.app.fire('booth:description:ok', data));
    room.onMessage("booth:updateDescription:error", (data) => this.app.fire('booth:description:error', data));
    room.onMessage("leaderboard:data", (data) => this.app.fire('leaderboard:data', data));
};

MessageBroker.prototype._handlePlaygroundMessageTypes = function (data) {
    this._playgroundMessageTypes = data || {};
    if (this.app) {
        this.app.fire('network:playground:messageTypes', this._playgroundMessageTypes);
    }
};

MessageBroker.prototype._collectAuthPayload = function () {
    const result = {};
    const services = this.app && this.app.services ? this.app.services : null;
    if (!services) {
        return result;
    }

    let authTokenService = null;
    if (services.registry && services.registry.authToken) {
        authTokenService = services.registry.authToken;
    } else if (typeof services.get === 'function') {
        try {
            authTokenService = services.get('authToken');
        } catch (error) {
            authTokenService = null;
        }
    }

    if (authTokenService && typeof authTokenService.getToken === 'function') {
        const token = authTokenService.getToken();
        if (typeof token === 'string' && token.length > 20) {
            result.token = token;
        }
    }

    let privyManager = null;
    if (services.registry && services.registry.privyManager) {
        privyManager = services.registry.privyManager;
    } else if (typeof services.get === 'function') {
        try {
            privyManager = services.get('privyManager');
        } catch (error) {
            privyManager = null;
        }
    }

    if (privyManager && typeof privyManager.getLatestPrivyToken === 'function') {
        const privyToken = privyManager.getLatestPrivyToken();
        if (typeof privyToken === 'string' && privyToken.length > 20) {
            result.privyToken = privyToken;
        }
    }

    return result;
};

MessageBroker.prototype.sendIfConnected = function (type, payload) {
    if (this.app.room) {
        this.app.room.send(type, payload);
    }
};

MessageBroker.prototype.setupAppEventListeners = function () {
    this.app.on('player:move', this.handlePlayerMove, this);
    this.app.on('booth:claimRequest', (data) => {
        const boothId = typeof data === 'string' ? data : (data && data.boothId ? data.boothId : null);
        if (typeof boothId !== 'string' || boothId.length === 0) {
            console.warn('MessageBroker: Ignored booth claim request with invalid boothId.', data);
            return;
        }
        const authPayload = this._collectAuthPayload();
        const payload = Object.assign({ boothId: boothId }, authPayload);
        this.sendIfConnected('claimBooth', payload);
    }, this);
    this.app.on('booth:unclaimRequest', () => {
        this.sendIfConnected('unclaimBooth');
    }, this);
    this.app.on('player:setUsername', (username) => {
        const cleaned = this.cleanUsername(username);
        if (!cleaned) {
            return;
        }
        if (!this.currentRoom) {
            this.pendingUsername = cleaned;
            return;
        }
        if (this.lastUsernameSent === cleaned) {
            return;
        }
        this.lastUsernameSent = cleaned;
        this.sendIfConnected('setUsername', { username: cleaned });
    }, this);
    this.app.on('coins:refresh', this.fetchCoinWallet, this);
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
    this.app.on('leaderboard:request', (payload) => {
        const limit = payload && typeof payload.limit === 'number' ? payload.limit : 10;
        this.sendIfConnected('leaderboard:get', { limit: limit });
    }, this);

    this.app.on('network:send', (type, payload) => {
        if (typeof type !== 'string' || !type.length) {
            console.warn('MessageBroker: network:send called without a valid message type.', type);
            return;
        }
        const sanitized = this.sanitizeOutbound(type, payload);
        if (sanitized === null) {
            return;
        }
        this.sendIfConnected(type, sanitized);
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

MessageBroker.prototype.destroy = function () {
    this.app.off('colyseus:connected', this.onConnected, this);
    this.app.off('colyseus:disconnected', this.onDisconnected, this);
    this.app.off('player:move', this.handlePlayerMove, this);
    this.app.off('coins:refresh', this.fetchCoinWallet, this);
    this.clearCoinSchedule();
    this.currentRoom = null;
};

MessageBroker.prototype.handlePlayerMove = function (posData) {
    if (!posData || typeof posData !== 'object') {
        return;
    }

    const numeric = this.sanitizeMovementPayload(posData);
    if (!numeric) {
        return;
    }

    const now = Date.now();
    const lastPayload = this.lastMovePayload;
    const elapsed = now - this.lastMoveSentAt;

    const shouldSend =
        !lastPayload ||
        elapsed >= this.moveMaxInterval ||
        (elapsed >= this.moveMinInterval && this.hasMovementDelta(lastPayload, numeric));

    if (!shouldSend) {
        return;
    }

    this.lastMovePayload = numeric;
    this.lastMoveSentAt = now;
    this.sendIfConnected('updatePosition', numeric);
};

MessageBroker.prototype.sanitizeMovementPayload = function (payload) {
    const x = Number(payload.x);
    const y = Number(payload.y);
    const z = Number(payload.z);
    const rotation = Number(payload.rotation);
    const speed = Number(payload.speed);

    if (![x, y, z, rotation].every(Number.isFinite)) {
        console.warn('MessageBroker: rejected movement payload with non-finite values.', payload);
        return null;
    }

    const sanitized = {
        x: this.roundTo(x, 2),
        y: this.roundTo(y, 2),
        z: this.roundTo(z, 2),
        rotation: this.roundTo(rotation, 1),
        speed: Number.isFinite(speed) ? pc.math.clamp(speed, 0, 1) : 0
    };

    return sanitized;
};

MessageBroker.prototype.hasMovementDelta = function (prev, next) {
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const dz = next.z - prev.z;
    const distanceSq = dx * dx + dy * dy + dz * dz;
    if (distanceSq >= this.movePosThresholdSq) {
        return true;
    }
    if (Math.abs(next.rotation - prev.rotation) >= this.moveRotThreshold) {
        return true;
    }
    if (Math.abs((next.speed || 0) - (prev.speed || 0)) >= this.moveSpeedThreshold) {
        return true;
    }
    return false;
};

MessageBroker.prototype.roundTo = function (value, decimals) {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
};

MessageBroker.prototype.sanitizeOutbound = function (type, payload) {
    switch (type) {
        case 'updatePosition':
            return this.sanitizeMovementPayload(payload);
        case 'chatMessage': {
            const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
            if (!content.length) {
                return null;
            }
            return { content: content.slice(0, 100) };
        }
        default:
            return payload;
    }
};

MessageBroker.prototype.cleanUsername = function (raw) {
    if (typeof raw !== 'string') {
        return '';
    }
    const withoutTags = raw.replace(/(<([^>]+)>)/gi, '');
    const collapsedWhitespace = withoutTags.replace(/\s+/g, ' ').trim();
    if (!collapsedWhitespace.length) {
        return '';
    }
    return collapsedWhitespace.substring(0, 16);
};

MessageBroker.prototype.scheduleCoinFetch = function (immediate) {
    this.clearCoinSchedule();
    if (!this.app.room) {
        return;
    }
    const onVis = () => {
        if (document.hidden) {
            this.clearCoinSchedule();
        } else if (!this._coinTimer && this.app.room) {
            this.scheduleCoinFetch(false);
        }
    };
    document.addEventListener('visibilitychange', onVis, { passive: true });
    this._onVisCoins = onVis;
    if (immediate) {
        this.fetchCoinWallet();
    }
    this._coinTimer = setInterval(() => {
        this.fetchCoinWallet();
    }, this.coinFetchIntervalMs);
};

MessageBroker.prototype.clearCoinSchedule = function () {
    if (this._coinTimer) {
        clearInterval(this._coinTimer);
        this._coinTimer = null;
    }
    if (this._onVisCoins) {
        document.removeEventListener('visibilitychange', this._onVisCoins);
        this._onVisCoins = null;
    }
};

MessageBroker.prototype.fetchCoinWallet = function () {
    if (!this.app || !this.app.services || !this.app.services.get) {
        return;
    }
    const services = this.app.services;
    if (!services || typeof services.get !== 'function') {
        return;
    }
    const authService = services.get('privyManager');
    if (!authService || typeof authService.isAuthenticated !== 'function' || !authService.isAuthenticated()) {
        return;
    }
    const tokenService = services.get('authToken');
    if (!tokenService || typeof tokenService.getToken !== 'function') {
        return;
    }
    const token = tokenService && typeof tokenService.getToken === 'function' ? tokenService.getToken() : null;
    if (!token) {
        return;
    }
    const now = Date.now();
    if (now - this.lastCoinFetchAt < 5000) {
        return;
    }
    this.lastCoinFetchAt = now;
    const url = this.resolveApiUrl('/coins/wallet');
    fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
    })
        .then((response) => {
            if (response.status === 401 && tokenService && typeof tokenService.clearToken === 'function') {
                tokenService.clearToken();
            }
            if (!response.ok) {
                throw new Error(`Coin fetch failed with status ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            if (!data || typeof data.balance !== 'number') {
                return;
            }
            this.coinBalance = data.balance;
            this.coinLifetime = typeof data.lifetimeEarned === 'number' ? data.lifetimeEarned : this.coinLifetime;
            this.app.fire('coins:update', {
                balance: this.coinBalance,
                lifetimeEarned: this.coinLifetime,
            });
        })
        .catch((error) => {
            console.warn('MessageBroker: Failed to fetch coin wallet.', error);
        });
};

MessageBroker.prototype.resolveApiUrl = function (path) {
    const config = this.app.services && this.app.services.get ? this.app.services.get('configLoader') : null;
    const base = config && typeof config.get === 'function' ? config.get('apiBaseUrl') : null;
    if (base && typeof base === 'string' && base.length) {
        return base.replace(/\/+$/, '') + path;
    }
    return path;
};

