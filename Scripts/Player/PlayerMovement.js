///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var PlayerMovement = pc.createScript('playerMovement');

PlayerMovement.prototype.initialize = function() {
    this.playerMovementEnabled = true;

    this.app.on('ui:chat:focus', this.disableMovement, this);
    this.app.on('ui:chat:blur', this.enableMovement, this);
};

PlayerMovement.prototype.disableMovement = function() {
    this.playerMovementEnabled = false;
};

PlayerMovement.prototype.enableMovement = function() {
    this.playerMovementEnabled = true;
PlayerMovement.prototype.update = function(dt) {
    if (!this.playerMovementEnabled) return;

    // Existing movement code here
};
};
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
};

PlayerMovement.worldDirection = new pc.Vec3();
PlayerMovement.tempDirection = new pc.Vec3();

PlayerMovement.prototype.update = function (dt) {
    if (window.isChatActive) return;
    if (this.entity.name !== "LocalPlayer") return;

    var app = this.app;

    var inputX = 0, inputZ = 0;
    if (this.isMobile) {
        if (window.touchJoypad && window.touchJoypad.sticks && window.touchJoypad.sticks[this.joystickId]) {
            const joystick = window.touchJoypad.sticks[this.joystickId];
            inputX = joystick.x;
            inputZ = joystick.y;
        }
    } else {
        if (app.keyboard.isPressed(pc.KEY_A)) inputX -= 1;
        if (app.keyboard.isPressed(pc.KEY_D)) inputX += 1;
        if (app.keyboard.isPressed(pc.KEY_W)) inputZ += 1;
        if (app.keyboard.isPressed(pc.KEY_S)) inputZ -= 1;
    }

    var yaw = this.cameraScript.yaw;
    yaw = normalizeAngle(yaw);
    var yawRad = yaw * pc.math.DEG_TO_RAD;

    var forward = new pc.Vec3(-Math.sin(yawRad), 0, -Math.cos(yawRad));
    var right = new pc.Vec3(Math.cos(yawRad), 0, -Math.sin(yawRad));

    var move = new pc.Vec3();
    move.add(forward.scale(inputZ));
    move.add(right.scale(inputX));
    if (move.length() > 0) {
        move.normalize();
    }

    var newPos = this.entity.getPosition().clone();
    newPos.add(move.scale(this.speed * dt));

    var newRot = new pc.Quat().setFromEulerAngles(0, yaw, 0);
    this.entity.setRotation(newRot);

    this.entity.rigidbody.teleport(newPos);

    if (inputX !== 0 || inputZ !== 0) {
        if (this.entity.anim) {
            this.entity.anim.setFloat('xDirection', inputX);
            this.entity.anim.setFloat('zDirection', inputZ);
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
            xDirection: inputX,
            zDirection: inputZ
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