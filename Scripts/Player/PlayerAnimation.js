var PlayerAnimation = pc.createScript('playerAnimation');

PlayerAnimation.prototype.initialize = function() {
    console.log(`PlayerAnimation.initialize for entity: ${this.entity.name}`);
    this.canWave = true;

    // This event comes from the UI (e.g., WaveButton) and is only intended for the local player.
    this.app.on('animation:play:local', this.onLocalPlay, this);

    // This event comes from the network and is for all players.
    this.app.on('animation:play:network', this.onNetworkPlay, this);

    // A helper to find the anim component, as it might not be ready on initialize.
    this.findAnimTarget();
};

PlayerAnimation.prototype.findAnimTarget = function() {
    if (this.entity.animTarget) {
        return this.entity.animTarget;
    }
    // The animTarget property is set by PlayerSync.js. If it's not there, let's try to find it ourselves.
    const animTarget = (function dfs(e) {
        if (e.anim) return e;
        for (var i = 0; i < e.children.length; i++) {
            var r = dfs(e.children[i]);
            if (r) return r;
        }
        return null;
    })(this.entity);

    if (animTarget) {
        console.log(`PlayerAnimation: Found animTarget for ${this.entity.name}`);
        this.entity.animTarget = animTarget;
    }
    return animTarget;
};


// Handles the request to play an animation from the local UI.
PlayerAnimation.prototype.onLocalPlay = function(data) {
    console.log(`PlayerAnimation.onLocalPlay received for entity: ${this.entity.name}`, data);

    // This script is on every player, but only the local player should send the network message.
    if (this.entity.isLocalPlayer) {
        if (data.name === 'wave' && !this.canWave) {
            console.log("Wave animation is on cooldown.");
            return;
        }

        console.log(`Entity ${this.entity.name} is the local player. Firing network event.`);
        // Send the animation event over the network.
        this.app.fire('network:send:animation', { name: data.name });

        if (data.name === 'wave') {
            this.canWave = false;
            setTimeout(() => {
                this.canWave = true;
            }, 2500); // 2.5 second cooldown
        }
    } else {
        console.log(`Entity ${this.entity.name} is NOT the local player. Ignoring local play event.`);
    }
};

// Handles playing an animation that has been broadcast from the server.
PlayerAnimation.prototype.onNetworkPlay = function(data) {
    console.log(`PlayerAnimation.onNetworkPlay received for entity: ${this.entity.name}`, data);

    // The anim component might not be available immediately, especially on remote players.
    var animEntity = this.findAnimTarget();
    if (!animEntity) {
        console.warn(`PlayerAnimation: animTarget not found for entity ${this.entity.name}. Cannot play animation.`);
        return;
    }

    // Check if the animation event is for this specific player entity.
    if (this.entity.sessionId === data.playerId) {
        console.log(`Session ID match for ${this.entity.name}. Attempting to play animation.`);
        if (animEntity.anim) {
            console.log(`SUCCESS: Playing animation '${data.name}' on entity ${this.entity.name}`);
            animEntity.anim.setTrigger(data.name);
        } else {
            console.warn(`PlayerAnimation: anim component not found on animTarget for entity ${this.entity.name}.`);
        }
    } else {
        console.log(`Session ID mismatch for ${this.entity.name}. Expected: ${this.entity.sessionId}, Got: ${data.playerId}. Ignoring.`);
    }
};

PlayerAnimation.prototype.destroy = function() {
    this.app.off('animation:play:local', this.onLocalPlay, this);
    this.app.off('animation:play:network', this.onNetworkPlay, this);
};