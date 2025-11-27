// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Booths\BoothController.js
var BoothController = pc.createScript("boothController");

BoothController.prototype.initialize = function () {
    console.log("BoothController initializing as the orchestrator...");
    this.currentZoneScript = null;
    this.isNetworkConnected = false;
    this.boothEntitiesById = new Map();
    this.boothsByOwner = new Map();
    this.boothDescriptions = new Map();
    this._claimInFlight = false;
    this._claimInFlightBoothId = null;
    this._claimInFlightTimer = null;
    this.claimTimeoutMs = 15000;
    this._claimRetryTimer = null;
    this.claimRetryDelayMs = 450;
    this._lastClaimAttempt = 0;
    this._lastClaimBoothId = null;
    this.manualLogoutCooldownMs = 4000;
    this.manualLogoutUntil = 0;

    this.app.on('colyseus:connected', this.onNetworkConnected, this);
    this.app.on('colyseus:disconnected', this.onNetworkDisconnected, this);
    this.app.on("booth:entered", this.onEnterZone, this);
    this.app.on("booth:left", this.onLeaveZone, this);
    this.app.on("booth:added", this.onBoothAdded, this);
    this.app.on("booth:updated", this.onBoothUpdated, this);
    this.app.on("booth:removed", this.onBoothRemoved, this);
    this.app.on("booth:unclaimed", this.onBoothUnclaimed, this);
    this.app.on("auth:stateChanged", this.onAuthStateChanged, this);
    this.app.on("player:data:changed", this.onLocalPlayerDataChanged, this);
    this.app.on("booth:claim:request", this.handleClaimRequest, this);
    this.app.on("booth:claimSuccess", this.onClaimSuccess, this);
    this.app.on("booth:authRequired", this.onBoothAuthRequired, this);
    this.app.on("booth:claimError", this.onClaimError, this);
    this.app.on("effects:donation", this.onDonationEffect, this);
    this.app.on("booth:description:ok", this.onBoothDescriptionSaved, this);
    this.app.on("booth:description:error", this.onBoothDescriptionError, this);
    this.app.on('auth:manualLogout', this.onManualLogout, this);
};

BoothController.prototype.getPrivyManager = function () {
    const services = this.app.services;
    if (services && services.registry && services.registry.privyManager) {
        return services.registry.privyManager;
    }
    if (services && typeof services.get === 'function') {
        try {
            return services.get('privyManager') || null;
        } catch (error) {
            console.warn('BoothController: Failed to resolve PrivyManager service.', error);
        }
    }
    return null;
};

BoothController.prototype.getLocalPlayerData = function () {
    const localPlayerData = this.app.localPlayer?.script?.playerData || null;
    if (localPlayerData) {
        return localPlayerData;
    }
    const services = this.app.services;
    if (services && services.registry && services.registry.playerData) {
        return services.registry.playerData;
    }
    if (services && typeof services.get === 'function') {
        const serviceInstance = services.get('playerData');
        if (serviceInstance) {
            return serviceInstance;
        }
    }
    return null;
};

BoothController.prototype._clearClaimInFlight = function (reason) {
    if (this._claimInFlightTimer) {
        clearTimeout(this._claimInFlightTimer);
        this._claimInFlightTimer = null;
    }
    this._cancelClaimRetry(reason || 'clear');
    this._claimInFlight = false;
    this._claimInFlightBoothId = null;
    this._lastClaimAttempt = 0;
};

BoothController.prototype._cancelClaimRetry = function (reason) {
    if (this._claimRetryTimer) {
        clearTimeout(this._claimRetryTimer);
        this._claimRetryTimer = null;
        if (reason && typeof console !== 'undefined' && typeof console.debug === 'function') {
            console.debug('BoothController: Claim retry cancelled.', { reason });
        }
    }
};

BoothController.prototype._scheduleClaimRetry = function (boothId, reason, delayMs) {
    if (!boothId) {
        return;
    }
    this.pendingClaimBoothId = boothId;
    this._cancelClaimRetry('reschedule:' + (reason || 'unknown'));
    var retryDelay = typeof delayMs === 'number' && delayMs >= 0 ? delayMs : this.claimRetryDelayMs;
    if (retryDelay < 0) {
        retryDelay = 0;
    }
    this._claimRetryTimer = setTimeout(() => {
        this._claimRetryTimer = null;
        this._lastClaimAttempt = 0;
        this.attemptPendingClaim();
    }, retryDelay);
    if (typeof console !== 'undefined' && typeof console.debug === 'function') {
        console.debug('BoothController: Scheduled claim retry.', {
            boothId,
            reason: reason || 'unspecified',
            delayMs: retryDelay,
        });
    }
};

BoothController.prototype._setClaimInFlight = function (active, boothId, reason) {
    if (!active) {
        this._clearClaimInFlight(reason || 'explicit-clear');
        return;
    }
    if (this._claimInFlightTimer) {
        clearTimeout(this._claimInFlightTimer);
        this._claimInFlightTimer = null;
    }
    this._cancelClaimRetry('new-attempt');
    this._claimInFlight = true;
    this._claimInFlightBoothId = boothId || null;
    var timeout = typeof this.claimTimeoutMs === 'number' && this.claimTimeoutMs > 0 ? this.claimTimeoutMs : 15000;
    this._claimInFlightTimer = setTimeout(() => {
        console.warn('BoothController: Claim attempt timed out.', {
            boothId: this._claimInFlightBoothId,
        });
        const stalledBoothId = this._claimInFlightBoothId;
        this._clearClaimInFlight('timeout');
        if (stalledBoothId) {
            this._scheduleClaimRetry(stalledBoothId, 'timeout', this.claimRetryDelayMs);
        }
    }, timeout);
};

BoothController.prototype.handleClaimRequest = function(boothId) {
    const privyManager = this.getPrivyManager();
    const targetBoothId = typeof boothId === 'string' ? boothId : (boothId && boothId.boothId ? boothId.boothId : null);

    if (!targetBoothId) {
        console.warn('BoothController: handleClaimRequest invoked without a booth identifier.', boothId);
        return;
    }

    if (!privyManager) {
        console.warn('BoothController: PrivyManager service unavailable. Cannot process booth claim.');
        return;
    }

    this._cancelClaimRetry('incoming-request');

    if (this._claimInFlight) {
        if (this._claimInFlightBoothId === targetBoothId) {
            console.log('BoothController: Claim already in flight for booth.', { boothId: targetBoothId });
        } else {
            console.log('BoothController: Claim in flight for different booth, queueing new target.', {
                activeBoothId: this._claimInFlightBoothId,
                requestedBoothId: targetBoothId,
            });
            this.pendingClaimBoothId = targetBoothId;
        }
        return;
    }

    const playerData = this.getLocalPlayerData();
    const claimedBooth = playerData && typeof playerData.getClaimedBoothId === 'function'
        ? playerData.getClaimedBoothId()
        : '';

    if (claimedBooth && claimedBooth === targetBoothId) {
        console.log('BoothController: Claim request ignored; booth already owned by local player.', { boothId: targetBoothId });
        this.pendingClaimBoothId = null;
        this.decideAndShowPrompt();
        return;
    }

    this.pendingClaimBoothId = targetBoothId;

    if (this.manualLogoutUntil && Date.now() < this.manualLogoutUntil) {
        console.log('BoothController: Login suppressed because user recently logged out.');
        this.app.fire('ui:showClaimAuthPrompt', {
            boothId: targetBoothId,
            reason: 'You just logged out. Tap login when you are ready to sign back in before claiming.',
        });
        return;
    }

    const isAuthed = typeof privyManager.isAuthenticated === 'function'
        ? privyManager.isAuthenticated()
        : Boolean(privyManager.isAuthenticated);

    if (isAuthed && typeof privyManager.getWalletAddress === 'function' && privyManager.getWalletAddress()) {
        this._lastClaimAttempt = 0;
        this.attemptPendingClaim();
        return;
    }

    const isLoginInProgress = typeof privyManager.isLoginInProgress === 'function'
        ? privyManager.isLoginInProgress()
        : false;
    
    if (!isLoginInProgress) {
        console.log('BoothController: User not authenticated. Initiating Privy login.');
        this.manualLogoutUntil = 0;
        privyManager.login();
    } else {
        console.log('BoothController: Login already in progress. Will retry after completion.');
    }

    this.app.fire('ui:showClaimAuthPrompt', {
        boothId: targetBoothId,
        reason: 'Please complete authentication to claim this booth.',
    });
};

BoothController.prototype.onManualLogout = function () {
    const cooldown = typeof this.manualLogoutCooldownMs === 'number' && this.manualLogoutCooldownMs >= 0
        ? this.manualLogoutCooldownMs
        : 4000;
    this.manualLogoutUntil = Date.now() + cooldown;
    this.pendingClaimBoothId = null;
    this._cancelClaimRetry('manual-logout');
    this._setClaimInFlight(false, null, 'manual-logout');
    this.app.fire('ui:hideClaimPrompt');
};

BoothController.prototype.onBoothAdded = function (boothData) {
    if (!boothData || !boothData.boothId) {
        return;
    }
    const boothEntity = this.app.root.findByName(boothData.boothId) || null;
    if (boothEntity) {
        this.boothEntitiesById.set(boothData.boothId, boothEntity);
    }
    this.boothDescriptions.set(boothData.boothId, boothData.description || '');
    this.refreshBoothOwnership(boothData, boothEntity);
};

BoothController.prototype.onBoothRemoved = function (boothData) {
    if (!boothData || !boothData.boothId) {
        return;
    }
    this.boothEntitiesById.delete(boothData.boothId);
    this.boothDescriptions.delete(boothData.boothId);
    const boothId = boothData.boothId;
    for (const [wallet, info] of this.boothsByOwner.entries()) {
        if (info.boothId === boothId) {
            this.boothsByOwner.delete(wallet);
        }
    }
};

BoothController.prototype.onBoothUnclaimed = function (payload) {
    const boothId = payload && typeof payload.boothId === 'string' ? payload.boothId : null;
    if (!boothId) {
        return;
    }

    const previousOwner = payload && typeof payload.previousOwner === 'string' ? payload.previousOwner : null;
    if (previousOwner && this.boothsByOwner.has(previousOwner)) {
        this.boothsByOwner.delete(previousOwner);
    }

    const boothEntity = this.app.root.findByName(boothId) || this.boothEntitiesById.get(boothId) || null;
    if (boothEntity) {
        this.boothEntitiesById.set(boothId, boothEntity);
        if (boothEntity.script && boothEntity.script.boothClaimZone) {
            boothEntity.script.boothClaimZone.claimedBy = '';
        }
    }

    this.boothDescriptions.set(boothId, '');

    this.refreshBoothOwnership({
        boothId: boothId,
        claimedBy: '',
        claimedByUsername: '',
        claimedByTwitterHandle: '',
        claimedByTwitterId: '',
        description: '',
    }, boothEntity);

    if (this.pendingClaimBoothId === boothId && !this._claimInFlight) {
        this.pendingClaimBoothId = null;
    }

    if (this.currentZoneScript && this.currentZoneScript.boothId === boothId) {
        this.decideAndShowPrompt();
    }
};

BoothController.prototype.refreshBoothOwnership = function (boothData, boothEntity) {
    const boothId = boothData?.boothId || boothEntity?.name;
    if (!boothId) {
        return;
    }

    const resolvedEntity = boothEntity || this.boothEntitiesById.get(boothId) || this.app.root.findByName(boothId) || null;
    if (resolvedEntity) {
        this.boothEntitiesById.set(boothId, resolvedEntity);
    }

    const claimedBy = boothData?.claimedBy || resolvedEntity?.script?.boothClaimZone?.claimedBy || '';

    for (const [wallet, info] of this.boothsByOwner.entries()) {
        if (info.boothId === boothId) {
            this.boothsByOwner.delete(wallet);
        }
    }

    if (claimedBy) {
        this.boothsByOwner.set(claimedBy, { boothId: boothId, entity: resolvedEntity });
    }
};

BoothController.prototype.getBoothDescription = function (boothId) {
    return this.boothDescriptions.get(boothId) || '';
};

BoothController.prototype.onAuthStateChanged = function (authStateData) {
    if (!authStateData || !authStateData.isAuthenticated || !authStateData.address) {
        this.pendingClaimBoothId = null;
        this._cancelClaimRetry('auth-reset');
        this._setClaimInFlight(false, null, 'auth-reset');
        this._lastClaimBoothId = null;
        this._lastClaimAttempt = 0;
        if (this.currentZoneScript) {
            this.decideAndShowPrompt();
        }
        return;
    }

    if (this.pendingClaimBoothId) {
        console.log("BoothController: Auth complete. Retrying pending booth claim.");
        this._scheduleClaimRetry(this.pendingClaimBoothId, 'auth-complete', this.claimRetryDelayMs);
    }

    if (this.currentZoneScript) {
        this.decideAndShowPrompt();
    }
};

BoothController.prototype.onLocalPlayerDataChanged = function() {
    const playerData = this.getLocalPlayerData();
    if (!playerData || typeof playerData.getWalletAddress !== 'function' || !playerData.getWalletAddress()) {
        this._setClaimInFlight(false, null, 'player-data-missing-wallet');
        this._cancelClaimRetry('player-data-missing-wallet');
    } else if (this.pendingClaimBoothId && !this._claimInFlight) {
        this._scheduleClaimRetry(this.pendingClaimBoothId, 'player-data-sync', 0);
    }
    if (this.currentZoneScript) {
        this.decideAndShowPrompt();
    }
};

BoothController.prototype.onEnterZone = function (boothZoneScript) {
    this.currentZoneScript = boothZoneScript;
    this.decideAndShowPrompt();
};

BoothController.prototype.onLeaveZone = function (boothZoneScript) {
    if (this.currentZoneScript === boothZoneScript) {
        this.currentZoneScript = null;
        this.app.fire("ui:hideClaimPrompt");
        this.app.fire("ui:hideDonationPrompt");
        this.app.fire("ui:hideBoothDescriptionEditor");
    }
};

BoothController.prototype.onBoothUpdated = function (boothData) {
    // This logic correctly updates the 3D text in the scene.
    const boothEntity = this.app.root.findByName(boothData.boothId);
    this.boothDescriptions.set(boothData.boothId, boothData.description || '');
    if (boothEntity) {
        this.boothEntitiesById.set(boothData.boothId, boothEntity);
        boothEntity.script.boothClaimZone.claimedBy = boothData.claimedBy; // Ensure local script is in sync
        const screenEntity = boothEntity.findByName("3D Screen");
        if (screenEntity) {
            const usernameTxt = screenEntity.findByName("UsernameTxt")?.element;
            const descriptionTxt = screenEntity.findByName("DescriptionTxt")?.element || screenEntity.findByName("Description")?.element;
            if (usernameTxt) {
                if (boothData.claimedBy) {
                    const twitterHandle = boothData.claimedByTwitterHandle;
                    const username = boothData.claimedByUsername;
                    const name = twitterHandle ? `@${twitterHandle}` : username;
                    usernameTxt.text = `Give to ${name}`;
                } else {
                    usernameTxt.text = "Claim me";
                }
            }
            if (descriptionTxt) {
                descriptionTxt.text = boothData.description || "";
            }
        }
        this.refreshBoothOwnership(boothData, boothEntity);
        this.app.fire('ui:boothDescription:update', {
            boothId: boothData.boothId,
            description: boothData.description || ''
        });
        if (this.currentZoneScript?.boothId === boothData.boothId) {
            this.decideAndShowPrompt();
        }
    } else {
        this.boothEntitiesById.delete(boothData.boothId);
        this.refreshBoothOwnership(boothData, null);
    }
};

BoothController.prototype.decideAndShowPrompt = function () {
    if (!this.currentZoneScript) return;
    const claimedBy = this.currentZoneScript.claimedBy;
    const localPlayerData = this.getLocalPlayerData();
    if (!localPlayerData) return;

    const localAddress = localPlayerData.getWalletAddress();
    const localClaimedBooth = localPlayerData.getClaimedBoothId();

    if (!claimedBy) {
        this.app.fire("ui:hideDonationPrompt");
        this.app.fire("ui:hideBoothDescriptionEditor");
        this.app.fire(localClaimedBooth ? "ui:hideClaimPrompt" : "ui:showClaimPrompt", this.currentZoneScript);
    } else {
        this.app.fire("ui:hideClaimPrompt");
        if (claimedBy === localAddress) {
            this.app.fire("ui:hideDonationPrompt");
            this.app.fire("ui:showBoothDescriptionEditor", {
                boothId: this.currentZoneScript.boothId,
                description: this.getBoothDescription(this.currentZoneScript.boothId)
            });
        } else {
            this.app.fire("ui:hideBoothDescriptionEditor");
            this.app.fire(localAddress ? "ui:showDonationPrompt" : "ui:hideDonationPrompt", this.currentZoneScript);
        }
    }
};

BoothController.prototype.onBoothDescriptionSaved = function (payload) {
    if (!payload || !payload.boothId) {
        return;
    }
    const description = typeof payload.description === "string" ? payload.description : "";
    this.boothDescriptions.set(payload.boothId, description);
    this.app.fire('ui:boothDescription:ack', {
        boothId: payload.boothId,
        description: description
    });
};

BoothController.prototype.onBoothDescriptionError = function (payload) {
    this.app.fire('ui:boothDescription:error', payload || {});
};


BoothController.prototype.onBoothAuthRequired = function (payload) {
    const privyManager = this.getPrivyManager();
    this._setClaimInFlight(false, null, 'auth-required');
    const boothId = payload && payload.boothId ? payload.boothId : this.currentZoneScript?.boothId || null;
    if (privyManager && typeof privyManager.login === 'function') {
        if (typeof privyManager.isLoginInProgress === 'function' && privyManager.isLoginInProgress()) {
            console.log('BoothController: Auth required; awaiting existing Privy login.');
        } else {
            privyManager.login({ force: true });
        }
    }
    if (boothId) {
        this._scheduleClaimRetry(boothId, 'auth-required', this.claimRetryDelayMs);
    }
    this.app.fire('ui:showClaimAuthPrompt', {
        boothId: boothId,
        reason: (payload && payload.reason) || 'Authentication required to claim this booth.',
    });
};

BoothController.prototype.onClaimSuccess = function (data) {
    const boothEntity = this.app.root.findByName(data.boothId);
    boothEntity?.findByName("BoothClaimEffect")?.particlesystem.play();
    boothEntity?.sound?.play("claimSound");
    if (this.pendingClaimBoothId === data.boothId) {
        this.pendingClaimBoothId = null;
    }
    this._lastClaimBoothId = data.boothId || null;
    this._clearClaimInFlight('claim-success');
    this._cancelClaimRetry('claim-success');
};

BoothController.prototype.onClaimError = function (payload) {
    const boothId = payload && payload.boothId ? payload.boothId : this.pendingClaimBoothId;
    const code = typeof payload?.code === 'string' ? payload.code : 'UNKNOWN';
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('BoothController: Claim error received.', { boothId, code, reason: payload?.reason || null });
    }
    const privyManager = this.getPrivyManager();
    const isAuthRetry = code === 'AUTH_REQUIRED' || code === 'WALLET_REQUIRED';
    const isServerRetry = code === 'SERVER_ERROR';

    if (!isAuthRetry && !isServerRetry && boothId && this.pendingClaimBoothId === boothId) {
        this.pendingClaimBoothId = null;
    }

    if (this._claimInFlight && (!boothId || this._claimInFlightBoothId === boothId)) {
        this._clearClaimInFlight('claim-error:' + code);
    }

    if (isAuthRetry && boothId) {
        if (code === 'AUTH_REQUIRED' && privyManager && typeof privyManager.login === 'function') {
            const loginInProgress = typeof privyManager.isLoginInProgress === 'function'
                ? privyManager.isLoginInProgress()
                : false;
            if (!loginInProgress) {
                privyManager.login({ force: true });
            }
        }
        var retryDelay = code === 'WALLET_REQUIRED' ? this.claimRetryDelayMs + 300 : this.claimRetryDelayMs;
        this._scheduleClaimRetry(boothId, 'retry:' + code.toLowerCase(), retryDelay);
        return;
    }

    if (isServerRetry && boothId) {
        this.pendingClaimBoothId = boothId;
        var serverRetryDelay = typeof payload?.retryAfterMs === 'number' && payload.retryAfterMs >= 0
            ? payload.retryAfterMs
            : Math.max(this.claimRetryDelayMs * 2, 1000);
        this._scheduleClaimRetry(boothId, 'retry:server-error', serverRetryDelay);
        this.app.fire('ui:boothClaim:error', payload || {});
        return;
    }

    if (code === 'TAKEN') {
        const playerData = this.getLocalPlayerData();
        const claimedBooth = playerData && typeof playerData.getClaimedBoothId === 'function'
            ? playerData.getClaimedBoothId()
            : '';
        if (claimedBooth === boothId) {
            this.decideAndShowPrompt();
        }
    }

    this.app.fire('ui:boothClaim:error', payload || {});
};


BoothController.prototype.onDonationEffect = function (data) {
    if (!data || !data.recipient) {
        return;
    }

    const ownerEntry = this.boothsByOwner.get(data.recipient);
    if (ownerEntry && ownerEntry.entity) {
        this.playDonationEffect(ownerEntry.entity);
        return;
    }

    this.app.root.findByTag("booth").forEach((boothEntity) => {
        if (boothEntity.script?.boothClaimZone?.claimedBy === data.recipient) {
            this.playDonationEffect(boothEntity);
        }
    });
};

BoothController.prototype.playDonationEffect = function (boothEntity) {
    boothEntity?.findByName("BoothDonateEffect")?.particlesystem.play();
    boothEntity?.sound?.play("donationSound");
};

BoothController.prototype.onNetworkDisconnected = function () {
    this.isNetworkConnected = false;
    this._cancelClaimRetry('network-disconnected');
    this._clearClaimInFlight('network-disconnected');
};

BoothController.prototype.onNetworkConnected = function () {
    this.isNetworkConnected = true;
    if (this.pendingClaimBoothId) {
        this._scheduleClaimRetry(this.pendingClaimBoothId, 'network-connected', 0);
    }
};

BoothController.prototype.attemptPendingClaim = function () {
    if (!this.pendingClaimBoothId || !this.isNetworkConnected) {
        return;
    }
    const playerData = this.getLocalPlayerData();
    if (!playerData || typeof playerData.getWalletAddress !== 'function') {
        return;
    }
    const wallet = playerData.getWalletAddress();
    if (!wallet) {
        return;
    }
    const boothId = this.pendingClaimBoothId;
    const now = Date.now();
    if (this._lastClaimAttempt && now - this._lastClaimAttempt < 500) {
        return;
    }
    if (this._claimInFlight) {
        return;
    }
    const claimedBooth = typeof playerData.getClaimedBoothId === 'function'
        ? playerData.getClaimedBoothId()
        : '';
    if (claimedBooth === boothId) {
        this.pendingClaimBoothId = null;
        return;
    }
    if (wallet && this.boothsByOwner.get(wallet)?.boothId === boothId) {
        this.pendingClaimBoothId = null;
        return;
    }
    console.log("BoothController: Attempting pending booth claim after auth.", { boothId });
    this._lastClaimAttempt = now;
    this._lastClaimBoothId = boothId;
    this.app.off("booth:unclaimed", this.onBoothUnclaimed, this);
    this.app.off("auth:stateChanged", this.onAuthStateChanged, this);
    this.app.off("player:data:changed", this.onLocalPlayerDataChanged, this);
    this.app.off("booth:claim:request", this.handleClaimRequest, this);
    this.app.off("booth:claimSuccess", this.onClaimSuccess, this);
    this.app.off("booth:authRequired", this.onBoothAuthRequired, this);
    this.app.off("booth:claimError", this.onClaimError, this);
    this.app.off("effects:donation", this.onDonationEffect, this);
    this.app.off("booth:description:ok", this.onBoothDescriptionSaved, this);
    this.app.off("booth:description:error", this.onBoothDescriptionError, this);
    this.app.off('auth:manualLogout', this.onManualLogout, this);
    this.boothEntitiesById.clear();
    this.boothDescriptions.clear();
    this.boothsByOwner.clear();
    this.isNetworkConnected = false;
    this.pendingClaimBoothId = null;
    this._cancelClaimRetry('destroy');
    this._clearClaimInFlight('destroy');
};

BoothController.prototype.swap = function(old) {
    console.log("BoothController: Swapping script instance for hot reload.");
    
    // Transfer state
    this.boothEntitiesById = old.boothEntitiesById;
    this.boothDescriptions = old.boothDescriptions;
    this.boothsByOwner = old.boothsByOwner;
    this.currentZoneScript = old.currentZoneScript;
    this.isNetworkConnected = old.isNetworkConnected;
    this.pendingClaimBoothId = old.pendingClaimBoothId;
    this._lastClaimAttempt = old._lastClaimAttempt;
    this._lastClaimBoothId = old._lastClaimBoothId;
    this._claimInFlight = old._claimInFlight;
    this._claimInFlightBoothId = old._claimInFlightBoothId;
    this._claimInFlightReason = old._claimInFlightReason;
    this._claimRetryTimeout = old._claimRetryTimeout;
    this._claimRetryBoothId = old._claimRetryBoothId;
    this.claimRetryDelayMs = old.claimRetryDelayMs;

    // Re-bind methods
    this.onEnterZone = this.onEnterZone.bind(this);
    this.onLeaveZone = this.onLeaveZone.bind(this);
    this.onBoothAdded = this.onBoothAdded.bind(this);
    this.onBoothUpdated = this.onBoothUpdated.bind(this);
    this.onBoothRemoved = this.onBoothRemoved.bind(this);
    this.onBoothUnclaimed = this.onBoothUnclaimed.bind(this);
    this.onAuthStateChanged = this.onAuthStateChanged.bind(this);
    this.onLocalPlayerDataChanged = this.onLocalPlayerDataChanged.bind(this);
    this.handleClaimRequest = this.handleClaimRequest.bind(this);
    this.onClaimSuccess = this.onClaimSuccess.bind(this);
    this.onBoothAuthRequired = this.onBoothAuthRequired.bind(this);
    this.onClaimError = this.onClaimError.bind(this);
    this.onDonationEffect = this.onDonationEffect.bind(this);
    this.onBoothDescriptionSaved = this.onBoothDescriptionSaved.bind(this);
    this.onBoothDescriptionError = this.onBoothDescriptionError.bind(this);
    this.onNetworkConnected = this.onNetworkConnected.bind(this);
    this.onNetworkDisconnected = this.onNetworkDisconnected.bind(this);

    // Re-attach listeners
    this.app.on('colyseus:connected', this.onNetworkConnected, this);
    this.app.on('colyseus:disconnected', this.onNetworkDisconnected, this);
    this.app.on("booth:entered", this.onEnterZone, this);
    this.app.on("booth:left", this.onLeaveZone, this);
    this.app.on("booth:added", this.onBoothAdded, this);
    this.app.on("booth:updated", this.onBoothUpdated, this);
    this.app.on("booth:removed", this.onBoothRemoved, this);
    this.app.on("booth:unclaimed", this.onBoothUnclaimed, this);
    this.app.on("auth:stateChanged", this.onAuthStateChanged, this);
    this.app.on("player:data:changed", this.onLocalPlayerDataChanged, this);
    this.app.on("booth:claim:request", this.handleClaimRequest, this);
    this.app.on("booth:claimSuccess", this.onClaimSuccess, this);
    this.app.on("booth:authRequired", this.onBoothAuthRequired, this);
    this.app.on("booth:claimError", this.onClaimError, this);
    this.app.on("effects:donation", this.onDonationEffect, this);
    this.app.on("booth:description:ok", this.onBoothDescriptionSaved, this);
    this.app.on("booth:description:error", this.onBoothDescriptionError, this);
};
