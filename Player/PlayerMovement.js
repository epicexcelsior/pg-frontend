///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var PlayerMovement = pc.createScript('playerMovement');

PlayerMovement.attributes.add('speed', { type: 'number', default: 0.09 });

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

    // Grab the camera script from "PlayerCamera" (which is inside Camera Axis)
    var camera = this.entity.findByName("Camera Axis");
    this.cameraScript = camera.script.cameraMovement;
    //console.log("Camera script: ", this.cameraScript);

    // Setup network throttling
    this.lastReportedPos = this.entity.getPosition().clone();
    this.updateInterval = 0.1;
    this.timeSinceLastUpdate = 0;
};

PlayerMovement.worldDirection = new pc.Vec3();
PlayerMovement.tempDirection = new pc.Vec3();

PlayerMovement.prototype.update = function (dt) {
    // Disable movement if the chat input is active.
    if (window.isChatActive) return;
    if (this.entity.name !== "LocalPlayer") return;

    var app = this.app;

    // Read movement input.
    var inputX = 0, inputZ = 0;
    if (app.keyboard.isPressed(pc.KEY_A)) inputX -= 1;
    if (app.keyboard.isPressed(pc.KEY_D)) inputX += 1;
    if (app.keyboard.isPressed(pc.KEY_W)) inputZ += 1;
    if (app.keyboard.isPressed(pc.KEY_S)) inputZ -= 1;

    // Get current yaw from the camera script.
    var yaw = this.cameraScript.yaw;
    yaw = normalizeAngle(yaw);
    var yawRad = yaw * pc.math.DEG_TO_RAD;

    // Calculate forward and right vectors from the camera's yaw.
    // Assuming yaw=0 means facing along -Z (common in PlayCanvas).
    var forward = new pc.Vec3(-Math.sin(yawRad), 0, -Math.cos(yawRad));
    // Right vector is perpendicular to forward and up.
    var right = new pc.Vec3(Math.cos(yawRad), 0, -Math.sin(yawRad));

    // Use the camera's yaw for the player's rotation.
    // var newRot = new pc.Quat().setFromEulerAngles(0, yaw, 0);
    // this.entity.setRotation(newRot);

    // Build the movement vector.
    var move = new pc.Vec3();
    move.add(forward.scale(inputZ));
    move.add(right.scale(inputX));
    if (move.length() > 0) {
        move.normalize();
    }

    // Compute the new position.
    var newPos = this.entity.getPosition().clone();
    newPos.add(move.scale(this.speed * dt));

    // Use the camera's yaw for the player's rotation.
    var newRot = new pc.Quat().setFromEulerAngles(0, yaw, 0);
    this.entity.setRotation(newRot);
    //console.log(newRot);

    // Only use rigidbody teleport for position if needed
    this.entity.rigidbody.teleport(newPos);

    // Set animation direction
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

    // Throttle network updates...
    this.timeSinceLastUpdate += dt;
    var currentPos = this.entity.getPosition();
    var dist = currentPos.distance(this.lastReportedPos);
    if (dist > 0.001 || this.timeSinceLastUpdate >= this.updateInterval) {
        var rotation = yaw;
        this.app.fire("player:move", {
            x: currentPos.x,
            y: currentPos.y,
            z: currentPos.z,
            rotation: normalizeAngle(rotation)
        });
        //console.log("Player moved: ", currentPos, rotation, yaw);
        this.lastReportedPos.copy(currentPos);
        this.timeSinceLastUpdate = 0;
    }

    // Add this debug code temporarily to your update function
    //console.log(`yaw: ${this.cameraScript.yaw}, rotation: ${newRot}`);
};
