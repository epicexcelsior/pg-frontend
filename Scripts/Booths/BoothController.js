// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Booths\BoothController.js
var BoothController = pc.createScript("boothController");

BoothController.prototype.initialize = function () {
    console.log("BoothController initializing as the orchestrator...");
    this.currentZoneScript = null;
    this.pendingClaimBoothId = null;
    this.isNetworkConnected = false;
    this.boothEntitiesById = new Map();
    this.boothsByOwner = new Map();
    this.boothDescriptions = new Map();

    this.app.on('colyseus:connected', this.onNetworkConnected, this);
    this.app.on("booth:entered", this.onEnterZone, this);
    this.app.on("booth:left", this.onLeaveZone, this);
    this.app.on("booth:added", this.onBoothAdded, this);
    this.app.on("booth:updated", this.onBoothUpdated, this);
    this.app.on("booth:removed", this.onBoothRemoved, this);
    this.app.on("auth:stateChanged", this.onAuthStateChanged, this);
    this.app.on("player:data:changed", this.onLocalPlayerDataChanged, this);
    this.app.on("booth:claim:request", this.handleClaimRequest, this);
    this.app.on("booth:claimSuccess", this.onClaimSuccess, this);
    this.app.on("effects:donation", this.onDonationEffect, this);
    this.app.on("booth:description:ok", this.onBoothDescriptionSaved, this);
    this.app.on("booth:description:error", this.onBoothDescriptionError, this);
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

    if (privyManager.isAuthenticated() && privyManager.getWalletAddress()) {
        this.app.fire('booth:claimRequest', targetBoothId);
        this.pendingClaimBoothId = null;
    } else {
        this.pendingClaimBoothId = targetBoothId;
        privyManager.login();
    }
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

// FIX: This function no longer fires the claim. It just sets up the expectation.
BoothController.prototype.onAuthStateChanged = function (authStateData) {
    if (this.pendingClaimBoothId && authStateData.isAuthenticated && authStateData.address) {
        console.log("BoothController: Auth complete. Waiting for PlayerData to confirm address sync.");
        // We now wait for onLocalPlayerDataChanged to fire the pending claim.
    }
    if (this.currentZoneScript) {
        this.decideAndShowPrompt();
    }
};

// FIX: This is the new final step in the claim flow.
BoothController.prototype.onLocalPlayerDataChanged = function() {
    const playerData = this.getLocalPlayerData();
    if (this.pendingClaimBoothId && this.isNetworkConnected && playerData && typeof playerData.getWalletAddress === 'function' && playerData.getWalletAddress()) {
        this.app.fire('booth:claimRequest', this.pendingClaimBoothId);
        this.pendingClaimBoothId = null;
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
            const upperTxt = screenEntity.findByName("UpperTxt")?.element;
            const usernameTxt = screenEntity.findByName("UsernameTxt")?.element;
            const descriptionTxt = screenEntity.findByName("DescriptionTxt")?.element || screenEntity.findByName("Description")?.element;
            if (upperTxt && usernameTxt) {
                upperTxt.text = boothData.claimedBy ? "Give to" : "CLAIM";
                if (boothData.claimedBy) {
                    const twitterHandle = boothData.claimedByTwitterHandle;
                    const username = boothData.claimedByUsername;
                    if (twitterHandle) {
                        usernameTxt.text = `@${twitterHandle}`;
                    } else {
                        usernameTxt.text = username || "";
                    }
                } else {
                    usernameTxt.text = "ME!";
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
    if (this.currentZoneScript && this.currentZoneScript.boothId === payload.boothId) {
        this.app.fire('ui:boothDescription:ack', {
            boothId: payload.boothId,
            description: description
        });
    }
};

BoothController.prototype.onBoothDescriptionError = function (payload) {
    this.app.fire('ui:boothDescription:error', payload || {});
};

BoothController.prototype.onClaimSuccess = function (data) {
    const boothEntity = this.app.root.findByName(data.boothId);
    boothEntity?.findByName("BoothClaimEffect")?.particlesystem.play();
    boothEntity?.sound?.play("claimSound");
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

BoothController.prototype.onNetworkConnected = function () {
    this.isNetworkConnected = true;
    const playerData = this.getLocalPlayerData();
    if (this.pendingClaimBoothId && playerData && typeof playerData.getWalletAddress === 'function' && playerData.getWalletAddress()) {
        this.app.fire('booth:claimRequest', this.pendingClaimBoothId);
        this.pendingClaimBoothId = null;
    }
};

BoothController.prototype.destroy = function () {
    this.app.off('colyseus:connected', this.onNetworkConnected, this);
    this.app.off("booth:entered", this.onEnterZone, this);
    this.app.off("booth:left", this.onLeaveZone, this);
    this.app.off("booth:added", this.onBoothAdded, this);
    this.app.off("booth:updated", this.onBoothUpdated, this);
    this.app.off("booth:removed", this.onBoothRemoved, this);
    this.app.off("auth:stateChanged", this.onAuthStateChanged, this);
    this.app.off("player:data:changed", this.onLocalPlayerDataChanged, this);
    this.app.off("booth:claim:request", this.handleClaimRequest, this);
    this.app.off("booth:claimSuccess", this.onClaimSuccess, this);
    this.app.off("effects:donation", this.onDonationEffect, this);
    this.app.off("booth:description:ok", this.onBoothDescriptionSaved, this);
    this.app.off("booth:description:error", this.onBoothDescriptionError, this);
    this.boothEntitiesById.clear();
    this.boothDescriptions.clear();
    this.boothsByOwner.clear();
};
