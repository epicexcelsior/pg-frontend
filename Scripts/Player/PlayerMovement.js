var PlayerMovement = pc.createScript("playerMovement");

// --- movement tuning ---
PlayerMovement.attributes.add("maxSpeed", { type: "number", default: 5.0 });
PlayerMovement.attributes.add("acceleration", {
  type: "number",
  default: 22.0,
});
PlayerMovement.attributes.add("turnSpeed", { type: "number", default: 12.0 });
PlayerMovement.attributes.add("stopSpeed", { type: "number", default: 0.05 });

PlayerMovement.attributes.add("modelForwardOffsetY", {
  type: "number",
  default: 0,
});

// hysteresis
PlayerMovement.attributes.add("moveOn", { type: "number", default: 0.18 });
PlayerMovement.attributes.add("moveOff", { type: "number", default: 0.12 });

// NEW: input gating + forward hold
PlayerMovement.attributes.add("inputOn", {
  type: "number",
  default: 0.1,
  title: "Input Threshold On",
});
PlayerMovement.attributes.add("inputOff", {
  type: "number",
  default: 0.06,
  title: "Input Threshold Off",
});
PlayerMovement.attributes.add("forwardMinHold", {
  type: "number",
  default: 0.3,
  title: "Forward Hold (s)",
});

// mobile ids
PlayerMovement.attributes.add("joystickId", {
  type: "string",
  default: "joystick0",
});
PlayerMovement.attributes.add("interactButtonId", {
  type: "string",
  default: "interactButton",
});

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}
function yawFromDirXZ(vx, vz) {
  return Math.atan2(-vx, -vz) * pc.math.RAD_TO_DEG;
}

PlayerMovement.prototype.initialize = function () {
  this.isMobile = pc.platform.touch;
  this.chatFocused = false; // Track if chat input is focused
  this.activeInputLocks = new Set();

  var axis = this.entity.findByName("Camera Axis");
  this.cameraScript = axis && axis.script ? axis.script.cameraMovement : null;

  this.visualRoot =
    this.entity.findByName("Armature") ||
    this.entity.findByName("Wolf3D_Avatar") ||
    this.entity;
  this.baseLocalRot = this.visualRoot.getLocalRotation().clone();
  this.lastMoveDir = new pc.Vec3();
  this._tmpTargetVelocity = new pc.Vec3();
  this._tempMoveDir = new pc.Vec3();
  this._tempBasisForward = new pc.Vec3();
  this._tempBasisRight = new pc.Vec3();
  var initialEuler = this.visualRoot.getEulerAngles
    ? this.visualRoot.getEulerAngles()
    : null;
  this._currentYaw = initialEuler ? initialEuler.y : 0;

  if (this.entity.rigidbody) this.entity.rigidbody.angularFactor = pc.Vec3.ZERO;

  // anim
  this.animEnt = (function dfs(e) {
    if (e.anim) return e;
    for (var i = 0; i < e.children.length; i++) {
      var r = dfs(e.children[i]);
      if (r) return r;
    }
    return null;
  })(this.entity);
  this.layer =
    this.animEnt && this.animEnt.anim ? this.animEnt.anim.baseLayer : null;

  if (this.animEnt && this.animEnt.anim) {
    this.animEnt.anim.playing = true; // ensure component plays
    this.animEnt.anim.speed = 1;
  }
  if (this.layer) {
    this.layer.weight = 1;
    if (!this.layer.activeState || this.layer.activeState === "START") {
      if (this.layer.transition) this.layer.transition("Idle", 0);
      else if (this.layer.play) this.layer.play("Idle");
    }
  }

  // state & timers
  this._state =
    this.layer && this.layer.activeState ? this.layer.activeState : "Idle";
  this._speedN = 0;
  this._inputMag = 0;
  this._lockUntil = 0; // while locked, we won't return to Idle

  // input
  this.inX = 0;
  this.inZ = 0;

  // hide mobile UI on desktop
  if (!this.isMobile) {
    (function hideDFS(e) {
      var n = (e.name || "").toLowerCase();
      if (
        n.indexOf("joystick") !== -1 ||
        n.indexOf("joypad") !== -1 ||
        n.indexOf("touch") !== -1
      )
        e.enabled = false;
      for (var i = 0; i < e.children.length; i++) hideDFS(e.children[i]);
    })(this.app.root);
  } else {
    // Ensure mobile UI is visible on mobile
    (function showDFS(e) {
      var n = (e.name || "").toLowerCase();
      if (
        n.indexOf("joystick") !== -1 ||
        n.indexOf("joypad") !== -1 ||
        n.indexOf("touch") !== -1
      )
        e.enabled = true;
      for (var i = 0; i < e.children.length; i++) showDFS(e.children[i]);
    })(this.app.root);
  }

  console.log("[AnimInit]", {
    playing: !!(this.animEnt && this.animEnt.anim && this.animEnt.anim.playing),
    weight: this.layer ? this.layer.weight : "n/a",
    active: this._state,
  });

  // Listen for chat focus/blur events to disable movement
  this.app.on('ui:chat:focus', this.onChatFocus, this);
  this.app.on('ui:chat:blur', this.onChatBlur, this);
  this.app.on('ui:input:focus', this.onUiInputFocus, this);
  this.app.on('ui:input:blur', this.onUiInputBlur, this);
};

PlayerMovement.prototype._cameraBasisXZ = function () {
  var yaw =
    this.cameraScript && typeof this.cameraScript.yaw === "number"
      ? this.cameraScript.yaw
      : 0;
  var y = yaw * pc.math.DEG_TO_RAD;
  this._tempBasisForward.set(-Math.sin(y), 0, -Math.cos(y)).normalize();
  this._tempBasisRight.set(Math.cos(y), 0, -Math.sin(y)).normalize();
  return { forward: this._tempBasisForward, right: this._tempBasisRight };
};

PlayerMovement.prototype._gatherInput = function () {
  this.inX = 0;
  this.inZ = 0;
  
  // Don't gather input if UI has locked controls
  if (this.chatFocused || this._isInputLocked()) return;
  
  if (this.isMobile) {
    var s =
      window.touchJoypad && window.touchJoypad.sticks
        ? window.touchJoypad.sticks[this.joystickId]
        : null;
    if (s) {
      this.inX = pc.math.clamp(s.x, -1, 1);
      this.inZ = pc.math.clamp(s.y, -1, 1);
    }
  } else {
    var kb = this.app.keyboard;
    if (kb.isPressed(pc.KEY_A) || kb.isPressed(pc.KEY_LEFT)) this.inX -= 1;
    if (kb.isPressed(pc.KEY_D) || kb.isPressed(pc.KEY_RIGHT)) this.inX += 1;
    if (kb.isPressed(pc.KEY_W) || kb.isPressed(pc.KEY_UP)) this.inZ += 1;
    if (kb.isPressed(pc.KEY_S) || kb.isPressed(pc.KEY_DOWN)) this.inZ -= 1;
  }
};

PlayerMovement.prototype.update = function (dt) {
  if (!this.entity.rigidbody) return;

  // keep component & layer alive
  if (this.animEnt && this.animEnt.anim && !this.animEnt.anim.playing)
    this.animEnt.anim.playing = true;
  if (this.layer && this.layer.weight < 1) this.layer.weight = 1;

  // input
  this._gatherInput();
  this._inputMag = Math.hypot(this.inX, this.inZ);

  var basis = this._cameraBasisXZ();
  this._tempMoveDir.set(0, 0, 0);
  if (this._inputMag > 0) {
    this._tempMoveDir.add(basis.forward.clone().scale(this.inZ));
    this._tempMoveDir.add(basis.right.clone().scale(this.inX));
    this._tempMoveDir.normalize();
  }

  // physics vel
  var rb = this.entity.rigidbody;
  var currentVelocity = rb.linearVelocity.clone();
  var targetVelocity = this._tmpTargetVelocity;
  targetVelocity.set(
    this._tempMoveDir.x * this.maxSpeed,
    currentVelocity.y,
    this._tempMoveDir.z * this.maxSpeed
  );

  var blend = clamp01(this.acceleration * dt);
  var next = new pc.Vec3().lerp(currentVelocity, targetVelocity, blend);

  var speedXZ = Math.hypot(next.x, next.z);
  if (speedXZ < this.stopSpeed && this._inputMag === 0) {
    next.x = 0;
    next.z = 0;
    speedXZ = 0;
  }
  rb.linearVelocity = next;

  if (speedXZ > 1e-4) {
    this.lastMoveDir.set(next.x, 0, next.z);
    this.lastMoveDir.normalize();
  } else {
    this.lastMoveDir.set(0, 0, 0);
  }

  if (next.x * next.x + next.z * next.z > 1e-6) {
    var yawDeg = yawFromDirXZ(next.x, next.z) + this.modelForwardOffsetY;
    var q = new pc.Quat().setFromEulerAngles(0, yawDeg, 0);
    var tgt = this.baseLocalRot.clone().mul(q);
    var cur = this.visualRoot.getLocalRotation().clone();
    var s = clamp01(this.turnSpeed * dt);
    this.visualRoot.setLocalRotation(cur.slerp(tgt, s));
    this._currentYaw = yawDeg;
  }

  var speedNormalized = Math.min(
    1,
    speedXZ / Math.max(0.0001, this.maxSpeed)
  );
  if (this.animEnt && this.animEnt.anim) {
    this.animEnt.anim.setFloat("speed", speedNormalized);
  }

  var pos = this.entity.getPosition();

  this.app.fire("player:move", {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    rotation: this._currentYaw,
    speed: speedNormalized,
  });
};

PlayerMovement.prototype.onChatFocus = function() {
  this.chatFocused = true;
  this._applyInputLock('chat');
  console.log("PlayerMovement: Chat focused - movement disabled");
};

PlayerMovement.prototype.onChatBlur = function() {
  this.chatFocused = false;
  this._releaseInputLock('chat');
  console.log("PlayerMovement: Chat blurred - movement enabled");
};

PlayerMovement.prototype.onUiInputFocus = function(payload) {
  var reason = payload && payload.source ? String(payload.source) : 'ui-input';
  this._applyInputLock(reason);
};

PlayerMovement.prototype.onUiInputBlur = function(payload) {
  var reason = payload && payload.source ? String(payload.source) : 'ui-input';
  this._releaseInputLock(reason);
};

PlayerMovement.prototype._applyInputLock = function(reason) {
  this.activeInputLocks.add(reason || 'global');
};

PlayerMovement.prototype._releaseInputLock = function(reason) {
  if (reason) {
    this.activeInputLocks.delete(reason);
  } else {
    this.activeInputLocks.clear();
  }
};

PlayerMovement.prototype._isInputLocked = function() {
  return this.activeInputLocks.size > 0;
};

PlayerMovement.prototype.destroy = function() {
  // Clean up event listeners
  this.app.off('ui:chat:focus', this.onChatFocus, this);
  this.app.off('ui:chat:blur', this.onChatBlur, this);
  this.app.off('ui:input:focus', this.onUiInputFocus, this);
  this.app.off('ui:input:blur', this.onUiInputBlur, this);
};
