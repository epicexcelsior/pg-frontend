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

  var axis = this.entity.findByName("Camera Axis");
  this.cameraScript = axis && axis.script ? axis.script.cameraMovement : null;

  this.visualRoot =
    this.entity.findByName("Armature") ||
    this.entity.findByName("Wolf3D_Avatar") ||
    this.entity;
  this.baseLocalRot = this.visualRoot.getLocalRotation().clone();

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
  }

  console.log("[AnimInit]", {
    playing: !!(this.animEnt && this.animEnt.anim && this.animEnt.anim.playing),
    weight: this.layer ? this.layer.weight : "n/a",
    active: this._state,
  });
};

PlayerMovement.prototype._cameraBasisXZ = function () {
  var yaw =
    this.cameraScript && typeof this.cameraScript.yaw === "number"
      ? this.cameraScript.yaw
      : 0;
  var y = yaw * pc.math.DEG_TO_RAD;
  var f = new pc.Vec3(-Math.sin(y), 0, -Math.cos(y)).normalize();
  var r = new pc.Vec3(Math.cos(y), 0, -Math.sin(y)).normalize();
  return { forward: f, right: r };
};

PlayerMovement.prototype._gatherInput = function () {
  this.inX = 0;
  this.inZ = 0;
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
  var moveDir = new pc.Vec3(0, 0, 0);
  if (this._inputMag > 0) {
    moveDir.add(basis.forward.clone().scale(this.inZ));
    moveDir.add(basis.right.clone().scale(this.inX));
    moveDir.normalize();
  }

  // physics vel
  var rb = this.entity.rigidbody;
  var v = rb.linearVelocity.clone();
  var target = moveDir.scale(this.maxSpeed);
  var a = clamp01(this.acceleration * dt);
  var next = new pc.Vec3().lerp(v, new pc.Vec3(target.x, v.y, target.z), a);

  var speedXZ = Math.hypot(next.x, next.z);
  if (speedXZ < this.stopSpeed && this._inputMag === 0) {
    next.x = 0;
    next.z = 0;
  }
  rb.linearVelocity = next;

  // face move dir (visual only)
  if (next.x * next.x + next.z * next.z > 1e-6) {
    var yawDeg = yawFromDirXZ(next.x, next.z) + this.modelForwardOffsetY;
    var q = new pc.Quat().setFromEulerAngles(0, yawDeg, 0);
    var tgt = this.baseLocalRot.clone().mul(q);
    var cur = this.visualRoot.getLocalRotation().clone();
    var s = clamp01(this.turnSpeed * dt);
    this.visualRoot.setLocalRotation(new pc.Quat().slerp(cur, tgt, s));
  }

  // --- Set Animation Parameter ---
  var speedNormalized = Math.min(1, speedXZ / Math.max(0.0001, this.maxSpeed));
  if (this.animEnt && this.animEnt.anim)
    this.animEnt.anim.setFloat("speed", speedNormalized);
};
