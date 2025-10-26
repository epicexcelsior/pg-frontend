var PlayerAnimation = pc.createScript('playerAnimation');

PlayerAnimation.prototype.initialize = function() {
    console.log(`PlayerAnimation.initialize for entity: ${this.entity.name}`);
    this.canWave = true;
    this._clipAliases = {};
    this._lastClip = null;
    this.registerDefaultClips();

    // This event comes from the UI (e.g., WaveButton) and is only intended for the local player.
    this.app.on('animation:play:local', this.onLocalPlay, this);

    // This event comes from the network and is for all players.
    this.app.on('animation:play:network', this.onNetworkPlay, this);

    // A helper to find the anim component, as it might not be ready on initialize.
    this.findAnimTarget();

    if (this.entity && typeof this.entity.on === 'function') {
        this.entity.on('avatar:model:updated', this.onAvatarModelUpdated, this);
    }
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

PlayerAnimation.prototype.registerClipAlias = function (name, config) {
    if (!name) {
        return;
    }
    var key = String(name).toLowerCase();
    this._clipAliases[key] = config || {};
};

PlayerAnimation.prototype.registerDefaultClips = function () {
    this.registerClipAlias('idle', { type: 'speed', value: 0 });
    this.registerClipAlias('walk', { type: 'speed', value: 0.35 });
    this.registerClipAlias('run', { type: 'speed', value: 1 });
    this.registerClipAlias('jump', { triggers: ['jump', 'Jump', 'JUMP'] });
    this.registerClipAlias('wave', { triggers: ['wave', 'Wave', 'WAVE'] });
    this.registerClipAlias('emote_wave', { triggers: ['wave', 'Wave', 'WAVE'] });
    this.registerClipAlias('dance', { triggers: ['dance', 'Dance'] });
    this.registerClipAlias('dance_a', { triggers: ['dance_a', 'Dance_A', 'dance'] });
    this.registerClipAlias('dance_b', { triggers: ['dance_b', 'Dance_B'] });
    this.registerClipAlias('cheer', { triggers: ['cheer', 'Cheer', 'CHEER'] });
};

PlayerAnimation.prototype.playClip = function (name, opts) {
    opts = opts || {};
    var animEntity = this.findAnimTarget();
    if (!animEntity || !animEntity.anim) {
        console.warn(`PlayerAnimation: No anim component found for ${this.entity.name}`);
        return false;
    }
    var anim = animEntity.anim;
    var clipName = typeof name === 'string' ? name : '';
    var key = clipName.toLowerCase();
    if (!key) {
        return false;
    }
    var alias = this._clipAliases[key] || null;
    if (alias && alias.type === 'speed') {
        if (typeof anim.setFloat === 'function') {
            var parameter = alias.parameter || 'speed';
            anim.setFloat(parameter, alias.value);
            this._lastClip = key;
            return true;
        }
        return false;
    }
    var triggers = [];
    if (alias && alias.triggers) {
        if (Array.isArray(alias.triggers)) {
            triggers = alias.triggers.slice();
        } else {
            triggers = [alias.triggers];
        }
    }
    if (!triggers.length) {
        triggers = [key, key.toUpperCase(), key.charAt(0).toUpperCase() + key.slice(1)];
    }
    var success = false;
    for (var i = 0; i < triggers.length && !success; i++) {
        var trigger = triggers[i];
        if (!trigger) continue;
        if (typeof anim.setTrigger === 'function') {
            try {
                anim.setTrigger(trigger);
                success = true;
            } catch (err) {
                // ignore and try fallbacks
            }
        }
        if (!success && typeof anim.play === 'function') {
            try {
                anim.play(trigger);
                success = true;
            } catch (err2) {
                // ignore
            }
        }
    }
    if (!success && alias && typeof alias.play === 'function') {
        try {
            success = alias.play(anim, animEntity, opts);
        } catch (err3) {
            console.warn('PlayerAnimation alias play error', err3);
        }
    }
    if (success) {
        this._lastClip = key;
    } else {
        console.warn(`PlayerAnimation: Failed to play clip '${clipName}' for ${this.entity.name}`);
    }
    return success;
};


// Handles the request to play an animation from the local UI.
PlayerAnimation.prototype.onLocalPlay = function(data) {
    console.log(`PlayerAnimation.onLocalPlay received for entity: ${this.entity.name}`, data);

    // This script is on every player, but only the local player should send the network message.
    if (this.entity.isLocalPlayer) {
        const animationName = typeof data.name === 'string' ? data.name : '';
        if (!animationName) {
            console.warn('PlayerAnimation: Ignoring animation request without a valid name.', data);
            return;
        }

        if (animationName === 'wave' && !this.canWave) {
            console.log("Wave animation is on cooldown.");
            return;
        }

        console.log(`Entity ${this.entity.name} is the local player. Firing network event.`);
        this.playClip(animationName, { source: 'local' });
        this.app.fire('player:animation:play', animationName);

        if (animationName === 'wave') {
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
    // Check if the animation event is for this specific player entity.
    if (this.entity.sessionId === data.playerId) {
        console.log(`Session ID match for ${this.entity.name}. Attempting to play animation.`);
        this.playClip(data.name, { source: 'network', playerId: data.playerId });
    } else {
        console.log(`Session ID mismatch for ${this.entity.name}. Expected: ${this.entity.sessionId}, Got: ${data.playerId}. Ignoring.`);
    }
};

PlayerAnimation.prototype.onAvatarModelUpdated = function (evt) {
    if (!evt) return;
    if (evt.animTarget) {
        this.entity.animTarget = evt.animTarget;
    } else if (evt.model) {
        this.entity.animTarget = evt.model;
    }
    var animTarget = this.findAnimTarget();
    if (animTarget && animTarget.anim) {
        animTarget.anim.playing = true;
    }
};

PlayerAnimation.prototype.destroy = function() {
    this.app.off('animation:play:local', this.onLocalPlay, this);
    this.app.off('animation:play:network', this.onNetworkPlay, this);
    if (this.entity && typeof this.entity.off === 'function') {
        this.entity.off('avatar:model:updated', this.onAvatarModelUpdated, this);
    }
};
