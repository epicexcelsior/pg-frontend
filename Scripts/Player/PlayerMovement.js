///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts"
var PlayerMovement = pc.createScript('playerMovement');

PlayerMovement.attributes.add('speed', { type: 'number', default: 0.09 });
PlayerMovement.attributes.add('joystickId', { type: 'string', default: 'joystick0' }); // Joystick ID for movement
PlayerMovement.attributes.add('interactButtonId', { type: 'string', default: 'interactButton' }); // Button ID for interact (E key)

function normalizeAngle(angle) {
    let newAngle = angle % 360;
    if (newAngle < 0) newAngle += 360;
    return newAngle;
}

PlayerMovement.prototype.initialize = function () {
    if (this.entity.name !== "LocalPlayer") {
        this.enabled = false;
        return;
    }

    var camera = this.entity.findByName("Camera Axis");
    this.cameraScript = camera.script.cameraMovement;

    this.lastReportedPos = this.entity.getPosition().clone();
    this.updateInterval = 0.2;
    this.timeSinceLastUpdate = 0;

    this.isMobile = pc.platform.touch;
    this.movementJoystickEntity = pc.app.root.findByName('MovementJoystick');
    this.touchJoypadScreenEntity = pc.app.root.findByName('TouchJoypadScreen');

    if (this.isMobile && this.touchJoypadScreenEntity) {
        this.touchJoypadScreenEntity.enabled = true;
    } else if (!this.isMobile && this.touchJoypadScreenEntity) {
        this.touchJoypadScreenEntity.enabled = false;
    }

    if (this.isMobile && this.movementJoystickEntity) {
        this.movementJoystickEntity.enabled = true;
    } else if (!this.isMobile && this.movementJoystickEntity) {
        this.movementJoystickEntity.enabled = false;
    }

    // --- ADDED: Initialize movement state and listeners ---
    this.playerMovementEnabled = true;
    this.app.on('ui:chat:focus', this.disableMovement, this);
    this.app.on('ui:chat:blur', this.enableMovement, this);
    this.app.on('tutorial:active', this.onTutorialActive, this);
    // --- END ADDED ---
};

PlayerMovement.prototype.disableMovement = function() {
    this.playerMovementEnabled = false;
};

PlayerMovement.prototype.enableMovement = function() {
    this.playerMovementEnabled = true;
};

PlayerMovement.prototype.onTutorialActive = function(isActive) {
    if (isActive) {
        this.disableMovement();
    } else {
        this.enableMovement();
    }
};

PlayerMovement.worldDirection = new pc.Vec3();
PlayerMovement.tempDirection = new pc.Vec3();

// Add tracking for current input values
PlayerMovement.prototype.currentInputX = 0;
PlayerMovement.prototype.currentInputZ = 0;

PlayerMovement.prototype.update = function (dt) {
    if (window.isChatActive || !this.playerMovementEnabled) return;

    if (this.entity.name !== "LocalPlayer") return;

    var app = this.app;

    this.currentInputX = 0;
    this.currentInputZ = 0;
    
    if (this.isMobile) {
        if (window.touchJoypad && window.touchJoypad.sticks && window.touchJoypad.sticks[this.joystickId]) {
            const joystick = window.touchJoypad.sticks[this.joystickId];
            this.currentInputX = joystick.x;
            this.currentInputZ = joystick.y;
        }
    } else {
        if (app.keyboard.isPressed(pc.KEY_A)) this.currentInputX -= 1;
        if (app.keyboard.isPressed(pc.KEY_D)) this.currentInputX += 1;
        if (app.keyboard.isPressed(pc.KEY_W)) this.currentInputZ += 1;
        if (app.keyboard.isPressed(pc.KEY_S)) this.currentInputZ -= 1;
    }

    // Get camera yaw and normalize it
    var yaw = this.cameraScript.yaw;
    yaw = normalizeAngle(yaw);
    var yawRad = yaw * pc.math.DEG_TO_RAD;

    // Calculate movement directions based on camera orientation
    var forward = new pc.Vec3(-Math.sin(yawRad), 0, -Math.cos(yawRad));
    var right = new pc.Vec3(Math.cos(yawRad), 0, -Math.sin(yawRad));

    // Combine movement input
    var move = new pc.Vec3();
    move.add(forward.scale(this.currentInputZ));
    move.add(right.scale(this.currentInputX));
    
    // Normalize movement vector if there's any input
    if (move.length() > 0) {
        move.normalize();
        
        // Only update rotation when actually moving
        var targetRot = new pc.Quat().setFromEulerAngles(0, yaw, 0);
        var currentRot = this.entity.getRotation();
        currentRot.slerp(currentRot, targetRot, 0.15); // Smooth rotation
        this.entity.setRotation(currentRot);
    }

    // Update position
    var newPos = this.entity.getPosition().clone();
    newPos.add(move.scale(this.speed * dt));

    this.entity.rigidbody.teleport(newPos);

    if (this.currentInputX !== 0 || this.currentInputZ !== 0) {
        if (this.entity.anim) {
            this.entity.anim.setFloat('xDirection', this.currentInputX);
            this.entity.anim.setFloat('zDirection', this.currentInputZ);
        }
    } else {
        if (this.entity.anim) {
            this.entity.anim.setFloat('xDirection', 0);
            this.entity.anim.setFloat('zDirection', 0);
        }
    }

    this.timeSinceLastUpdate += dt;
    var currentPos = this.entity.getPosition();
    var dist = currentPos.distance(this.lastReportedPos);

    if (dist > 0.01 || this.timeSinceLastUpdate >= this.updateInterval) {
        var rotation = yaw;
        this.app.fire("player:move", {
            x: currentPos.x,
            y: currentPos.y,
            z: currentPos.z,
            rotation: normalizeAngle(rotation),
            xDirection: this.currentInputX,
            zDirection: this.currentInputZ
        });
        this.lastReportedPos.copy(currentPos);
        this.timeSinceLastUpdate = 0;
    }

    if (this.isMobile) {
        if (window.touchJoypad && window.touchJoypad.buttons && window.touchJoypad.buttons.wasPressed(this.interactButtonId)) {
            this.simulateEKeyPress();
        }
    } else {
        if (app.keyboard.wasPressed(pc.KEY_E)) {
            this.simulateEKeyPress();
        }
    }
};

PlayerMovement.prototype.simulateEKeyPress = function () {
    this.app.fire('interact:keypress');
};