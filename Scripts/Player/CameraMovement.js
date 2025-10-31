var CameraMovement = pc.createScript('cameraMovement');

// Follow / orbit
CameraMovement.attributes.add('distance',     { type: 'number', default: 5.0 });
CameraMovement.attributes.add('height',       { type: 'number', default: 1.7 });
CameraMovement.attributes.add('followSpeed',  { type: 'number', default: 12.0 });
CameraMovement.attributes.add('orbitSpeed',   { type: 'number', default: 0.22 });

// Auto-align strengths
CameraMovement.attributes.add('autoYawFromInput',    { type: 'number', default: 2.5 });
CameraMovement.attributes.add('autoYawFromVelocity', { type: 'number', default: 1.2 });
CameraMovement.attributes.add('autoYawMaxPerSec',    { type: 'number', default: 60 });

// Strafe orbit (gently turn when holding left/right)
CameraMovement.attributes.add('strafeYawPerSec',      { type: 'number', default: 48.0 }); // deg/s
CameraMovement.attributes.add('strafeDeadzone',       { type: 'number', default: 0.12 });
CameraMovement.attributes.add('strafeForwardDeadzone',{ type: 'number', default: 0.22 });
CameraMovement.attributes.add('strafeDiagScale',      { type: 'number', default: 0.6 });

// Micro mouse influence
CameraMovement.attributes.add('microMouseFactor',{ type: 'number', default: 0.002 });
CameraMovement.attributes.add('microBiasClampDeg',{ type: 'number', default: 0.12 });
CameraMovement.attributes.add('microDecay',      { type: 'number', default: 8.0 });

// Limits
CameraMovement.attributes.add('pitchMin', { type: 'number', default: -40 });
CameraMovement.attributes.add('pitchMax', { type: 'number', default: 75 });

// Optional explicit target name
CameraMovement.attributes.add('targetName', { type: 'string', default: '' });

// Mobile camera joystick
CameraMovement.attributes.add('cameraJoystickId', { 
    type: 'string', 
    default: 'cameraJoystick0',
    title: 'Camera Joystick ID',
    description: 'Identifier for the camera control joystick on mobile'
});

CameraMovement.prototype.initialize = function(){
    this.yaw = 0;
    this.pitch = 15;

    this._target = null;
    this._mouseBias = 0;
    this.isMobile = pc.platform.touch;
    this.canvas = this.app.graphicsDevice.canvas;
    this.chatFocused = false; // Track if chat input is focused
    this.uiInputLockedReasons = new Set();

    // Pre-allocate temps for GC optimization (reused every frame, no per-frame allocs)
    this._tmpPos = new pc.Vec3();
    this._curPos = new pc.Vec3();
    this._desiredPos = new pc.Vec3();
    this._rotQ = new pc.Quat();

    // Mouse handlers (desktop only)
    this.rmb = false;
    if (!this.isMobile){
        this.app.mouse.on('mousemove', this.onMouseMove, this);
        this.app.mouse.on('mousedown', this.onMouseDown, this);
        this.app.mouse.on('mouseup',   this.onMouseUp, this);
        this._ctx = e => e.preventDefault();
        this.canvas.addEventListener('contextmenu', this._ctx);
    }

    this.on('destroy', function(){
        if (!this.isMobile){
            this.app.mouse.off('mousemove', this.onMouseMove, this);
            this.app.mouse.off('mousedown', this.onMouseDown, this);
            this.app.mouse.off('mouseup',   this.onMouseUp, this);
            this.canvas.removeEventListener('contextmenu', this._ctx);
        }
        // Clean up chat focus listeners
        this.app.off('ui:chat:focus', this.onChatFocus, this);
        this.app.off('ui:chat:blur', this.onChatBlur, this);
        this.app.off('ui:input:focus', this.onUiInputFocus, this);
        this.app.off('ui:input:blur', this.onUiInputBlur, this);
    }, this);

    // Listen for chat focus/blur events to disable camera control
    this.app.on('ui:chat:focus', this.onChatFocus, this);
    this.app.on('ui:chat:blur', this.onChatBlur, this);
    this.app.on('ui:input:focus', this.onUiInputFocus, this);
    this.app.on('ui:input:blur', this.onUiInputBlur, this);

    // Child camera stays at (0,0,distance) — adjust attr in Editor if too far/near
    const cam = this.entity.findByName('PlayerCamera');
    if (cam) cam.setLocalPosition(0, 0, this.distance);
};

CameraMovement.prototype._resolveTarget = function(){
    if (this._target && this._target.isDescendantOf(this.app.root)) return;
    if (this.targetName){
        this._target = this.app.root.findByName(this.targetName);
        if (this._target) return;
    }
    this._target = this.entity.parent || this.app.root.findByName('PlayerPrefab') || this.app.root.findByName('LocalPlayer') || null;
};

CameraMovement.prototype.postUpdate = function(dt){
    this._resolveTarget();
    if (!this._target) return;

    // (A) Smooth follow
    this._desiredPos.copy(this._target.getPosition());
    this._desiredPos.y += this.height;
    this._curPos.copy(this.entity.getPosition());
    const a = pc.math.clamp(this.followSpeed * dt, 0, 1);
    this._tmpPos.lerp(this._curPos, this._desiredPos, a);
    this.entity.setPosition(this._tmpPos);

    // (B) Keep camera generally behind player
    const pm = this._target.script && this._target.script.playerMovement ? this._target.script.playerMovement : null;
    if (pm && pm.lastMoveDir && pm.lastMoveDir.lengthSq() > 0.04) {
        const d = pm.lastMoveDir;
        this._stepYawTowards(Math.atan2(-d.x, -d.z) * pc.math.RAD_TO_DEG, this.autoYawFromInput, dt);
    } else if (this._target.rigidbody) {
        const v = this._target.rigidbody.linearVelocity;
        if ((v.x*v.x + v.z*v.z) > 0.04) {
            this._stepYawTowards(Math.atan2(-v.x, -v.z) * pc.math.RAD_TO_DEG, this.autoYawFromVelocity, dt);
        }
    }

    // (C) Strafe orbit — continuous gentle yaw from horizontal input (no RMB)
    if (pm && !this.rmb) {
        const ix = Number.isFinite(pm.inX) ? pm.inX : 0;
        const iz = Number.isFinite(pm.inZ) ? pm.inZ : 0;
        const absX = Math.abs(ix);
        if (absX > this.strafeDeadzone) {
            // reduce when also moving forward/back to avoid over-rotation
            const strafingOnly = Math.abs(iz) < this.strafeForwardDeadzone;
            const rate = this.strafeYawPerSec * (strafingOnly ? 1.0 : this.strafeDiagScale);
            // Left (ix<0) turns camera left → yaw decreases; Right (ix>0) yaw increases
            this.yaw -= (ix > 0 ? +rate : -rate) * dt * Math.min(1, (absX - this.strafeDeadzone) / (1 - this.strafeDeadzone));
        }
    }

    // (D) Mobile joystick input for camera control - DISABLED
    // Camera is now fully automatic, matching Coastal World style
    // Players can only move with the movement joystick
    // if (this.isMobile && !this.chatFocused && !this._isUiInputLocked()) {
    //     const cameraStick = window.touchJoypad && window.touchJoypad.sticks 
    //         ? window.touchJoypad.sticks[this.cameraJoystickId] 
    //         : null;
    //     
    //     if (cameraStick) {
    //         // Use joystick input for camera rotation
    //         const sensitivity = 2.0; // Adjust sensitivity as needed
    //         const sx = Number.isFinite(cameraStick.x) ? cameraStick.x : 0;
    //         const sy = Number.isFinite(cameraStick.y) ? cameraStick.y : 0;
    //         this.yaw -= sx * sensitivity * dt * 60; // Convert to per-second
    //         this.pitch -= sy * sensitivity * dt * 60;
    //     }
    // }

    // (E) Micro mouse bias (desktop only)
    if (!this.isMobile && Math.abs(this._mouseBias) > 0.0001){
        const clamped = pc.math.clamp(this._mouseBias, -this.microBiasClampDeg, this.microBiasClampDeg);
        this.yaw += clamped;
        this._mouseBias *= Math.exp(-this.microDecay * dt);
    }

    // Apply rotation (FIX: correct Quat ctor)
    if (!Number.isFinite(this.pitch)) this.pitch = 15;
    if (!Number.isFinite(this.yaw)) this.yaw = 0;
    this.pitch = pc.math.clamp(this.pitch, this.pitchMin, this.pitchMax);
    this._rotQ.setFromEulerAngles(this.pitch, this.yaw, 0);
    this.entity.setRotation(this._rotQ);
};

CameraMovement.prototype._stepYawTowards = function(targetDeg, strengthPerSec, dt){
    if (!Number.isFinite(targetDeg)) {
        return;
    }
    if (!Number.isFinite(this.yaw)) {
        this.yaw = 0;
    }
    let delta = ((targetDeg - this.yaw + 540) % 360) - 180;
    const maxStep = this.autoYawMaxPerSec * dt;
    delta = pc.math.clamp(delta, -maxStep, maxStep);
    this.yaw += delta * Math.min(1, Math.max(0, strengthPerSec * dt));
};

CameraMovement.prototype.onMouseDown = function(e){
    if (e.button === pc.MOUSEBUTTON_RIGHT && !this._isUiInputLocked()) {
        this.rmb = true;
    }
};
CameraMovement.prototype.onMouseUp   = function(e){ if (e.button === pc.MOUSEBUTTON_RIGHT) this.rmb = false; };
CameraMovement.prototype.onMouseMove = function(e){
    if (this._isUiInputLocked()) {
        return;
    }
    if (this.rmb){
        this.yaw   -= e.dx * this.orbitSpeed;
        this.pitch -= e.dy * this.orbitSpeed;
    } else {
        this._mouseBias += (-e.dx * this.microMouseFactor);
    }
};

CameraMovement.prototype.onChatFocus = function() {
    this.chatFocused = true;
    this._applyUiLock('chat');
    console.log("CameraMovement: Chat focused - camera control disabled");
};

CameraMovement.prototype.onChatBlur = function() {
    this.chatFocused = false;
    this._releaseUiLock('chat');
    console.log("CameraMovement: Chat blurred - camera control enabled");
};

CameraMovement.prototype.onUiInputFocus = function(payload) {
    const reason = payload && payload.source ? String(payload.source) : 'ui-input';
    this._applyUiLock(reason);
};

CameraMovement.prototype.onUiInputBlur = function(payload) {
    const reason = payload && payload.source ? String(payload.source) : 'ui-input';
    this._releaseUiLock(reason);
};

CameraMovement.prototype._applyUiLock = function(reason) {
    this.uiInputLockedReasons.add(reason || 'global');
};

CameraMovement.prototype._releaseUiLock = function(reason) {
    if (reason) {
        this.uiInputLockedReasons.delete(reason);
    } else {
        this.uiInputLockedReasons.clear();
    }
};

CameraMovement.prototype._isUiInputLocked = function() {
    return this.uiInputLockedReasons.size > 0;
};
