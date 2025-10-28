var PlayerAnimation = pc.createScript("playerAnimation");

// Stable network IDs → local anim trigger names
const EMOTE_MAP = {
  JUMP:    { trigger: 'jump' },
  WAVE:    { trigger: 'wave' },
  DANCE_A: { trigger: 'danceA' },
  DANCE_B: { trigger: 'danceB' },
  CHEER:   { trigger: 'cheer' }
};

PlayerAnimation.attributes.add("stateGraphAsset", {
  type: "asset",
  assetType: "animstategraph",
  title: "State Graph",
});

PlayerAnimation.attributes.add("idleClip", {
  type: "asset",
  assetType: "animation",
  title: "Idle Clip",
});

PlayerAnimation.attributes.add("forwardClip", {
  type: "asset",
  assetType: "animation",
  title: "Forward / Locomotion Clip",
});

PlayerAnimation.attributes.add("waveClip", {
  type: "asset",
  assetType: "animation",
  title: "Wave / Emote Clip",
});

PlayerAnimation.attributes.add("jumpClip", {
  type: "asset",
  assetType: "animation",
  title: "Jump Clip",
});

PlayerAnimation.attributes.add("danceAClip", {
  type: "asset",
  assetType: "animation",
  title: "Dance A Clip",
});

PlayerAnimation.attributes.add("danceBClip", {
  type: "asset",
  assetType: "animation",
  title: "Dance B Clip",
});

PlayerAnimation.attributes.add("cheerClip", {
  type: "asset",
  assetType: "animation",
  title: "Cheer Clip",
});

PlayerAnimation.prototype.initialize = function () {
  this.avatarEntity = null;
  this.avatarAnim = null;
  this.pendingTriggers = [];
  this.isReadyForAnimation = false;
  this.movement =
    (this.entity.script && this.entity.script.playerMovement) || null;

  // Trigger versioning to prevent double-trigger (client prediction + server echo)
  this._nextTriggerId = 0;
  this._appliedTriggerIds = new Set();

  this.app.on("avatar:loaded", this.onAvatarLoaded, this);

  var loader = this.entity.script && this.entity.script.avatarLoader;
  if (loader && loader.currentAvatarEntity && !this.avatarAnim) {
    this.onAvatarLoaded({
      player: this.entity,
      avatar: loader.currentAvatarEntity,
    });
  }
};

PlayerAnimation.prototype._findRootBone = function (avatarEntity) {
  if (!avatarEntity || !avatarEntity.findByName) {
    return avatarEntity;
  }

  var armature = avatarEntity.findByName("Armature");
  if (armature) return armature;

  var hips = avatarEntity.findByName("Hips");
  if (hips) return hips;

  return avatarEntity;
};

PlayerAnimation.prototype.onAvatarLoaded = function (evt) {
  if (!evt || evt.player !== this.entity || !evt.avatar) {
    return;
  }

  if (!this.stateGraphAsset || !this.stateGraphAsset.resource) {
    console.error(
      "PlayerAnimation: stateGraphAsset is missing or not loaded. Drag the Player State Graph asset onto the playerAnimation script in the prefab."
    );
    return;
  }

  var avatar = evt.avatar;
  this.avatarEntity = avatar;
  this.avatarAnim = null;
  this.isReadyForAnimation = false;

  if (avatar.anim) {
    avatar.removeComponent("anim");
  }

  var rootBoneEntity = this._findRootBone ? this._findRootBone(avatar) : avatar;

  avatar.addComponent("anim", {
    activate: true,
    playing: true,
    speed: 1,
    rootBone: rootBoneEntity,
  });

  this.avatarAnim = avatar.anim;

  this.avatarAnim.loadStateGraph(this.stateGraphAsset.resource);
  this._assignClips();

  var baseLayer =
    (this.avatarAnim.findAnimationLayer &&
      this.avatarAnim.findAnimationLayer("Base")) ||
    null;
  if (!baseLayer && this.avatarAnim.baseLayer) {
    if (
      !this.avatarAnim.baseLayer.name ||
      this.avatarAnim.baseLayer.name === "Base"
    ) {
      baseLayer = this.avatarAnim.baseLayer;
    }
  }
  if (baseLayer) {
    if (typeof baseLayer.play === "function") {
      baseLayer.play("Idle");
    }
  } else {
    console.error(
      'PlayerAnimation: Anim layer "Base" not found. Check the anim state graph layer name.'
    );
  }

  this.avatarAnim.setFloat("speed", 0);

  for (var i = 0; i < this.pendingTriggers.length; i++) {
    this.avatarAnim.setTrigger(this.pendingTriggers[i]);
  }
  this.pendingTriggers.length = 0;

  this.isReadyForAnimation = !!baseLayer;
};

PlayerAnimation.prototype._assignClips = function () {
  this._assignClip("Idle", this.idleClip);
  this._assignClip("Forward", this.forwardClip);
  this._assignClip("Wave", this.waveClip);

  // new
  this._assignClip("Jump", this.jumpClip);
  this._assignClip("DanceA", this.danceAClip);
  this._assignClip("DanceB", this.danceBClip);
  this._assignClip("Cheer", this.cheerClip);
};

PlayerAnimation.prototype._assignClip = function (stateName, clipAsset) {
  if (!this.avatarAnim) {
    return;
  }
  if (!clipAsset || !clipAsset.resource) {
    console.warn(
      'PlayerAnimation: Clip asset for state "' +
        stateName +
        '" is not assigned.'
    );
    return;
  }

  var baseLayer =
    (this.avatarAnim.findAnimationLayer &&
      this.avatarAnim.findAnimationLayer("Base")) ||
    null;
  if (!baseLayer && this.avatarAnim.baseLayer) {
    if (
      !this.avatarAnim.baseLayer.name ||
      this.avatarAnim.baseLayer.name === "Base"
    ) {
      baseLayer = this.avatarAnim.baseLayer;
    }
  }
  if (!baseLayer) {
    console.error(
      'PlayerAnimation: Anim layer "Base" not found. Check the anim state graph layer name.'
    );
    return;
  }

  this.avatarAnim.assignAnimation(stateName, clipAsset.resource, "Base");
};

PlayerAnimation.prototype.update = function (dt) {
  if (!this.isReadyForAnimation || !this.avatarAnim || !this.movement) {
    return;
  }

  // Only update speed from local movement for the local player
  // Remote players get their speed from PlayerSync
  var isLocalPlayer = this.app.localPlayer === this.entity;
  if (!isLocalPlayer) {
    return;
  }

  var speedValue = this.movement.currentSpeed || 0;
  this.avatarAnim.setFloat("speed", speedValue);
};

PlayerAnimation.prototype.requestEmote = function (emoteId) {
  var def = EMOTE_MAP[emoteId];
  if (!def) return;

  // Generate unique trigger ID to prevent double-trigger (client prediction + server echo)
  var triggerId = ++this._nextTriggerId;
  this._appliedTriggerIds.add(triggerId);

  // Play immediately on this avatar (client-side prediction)
  this._playLocalTrigger(def.trigger);

  // Send to server for server-side validation and broadcast to all clients
  this.app.fire('network:send', 'animation:play', {
    id: emoteId,
    triggerId: triggerId
  });
};

PlayerAnimation.prototype._playLocalTrigger = function (triggerName) {
  if (!triggerName) return;

  if (this.isReadyForAnimation && this.avatarAnim) {
    this.avatarAnim.setTrigger(triggerName);
  } else {
    // avatar not fully ready yet, queue it
    this.pendingTriggers.push(triggerName);
  }
};

PlayerAnimation.prototype.applyNetworkEmote = function (data) {
  if (!data || !data.id) return;

  // Prevent double-trigger by checking if this triggerId was already applied locally
  if (data.triggerId && this._appliedTriggerIds.has(data.triggerId)) {
    return;
  }

  // Safety check: ensure this animation is meant for this entity
  if (this.entity.sessionId && data.playerId && this.entity.sessionId !== data.playerId) {
    return;
  }

  if (data.triggerId) {
    this._appliedTriggerIds.add(data.triggerId);
  }

  var def = EMOTE_MAP[data.id];
  if (!def) return;

  this._playLocalTrigger(def.trigger);
};



PlayerAnimation.prototype.destroy = function () {
  this.app.off("avatar:loaded", this.onAvatarLoaded, this);
};
