///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var CameraMovement = pc.createScript('cameraMovement');

CameraMovement.attributes.add('mouseSpeed', {
    type: 'number',
    default: 1.4,
    description: 'Mouse Sensitivity'
});
CameraMovement.attributes.add('distance', {
    type: 'number',
    default: 5,
    description: 'Distance from the pivot (player center)'
});
CameraMovement.attributes.add('pitchMin', {
    type: 'number',
    default: -80,
    description: 'Minimum pitch angle (down)'
});
CameraMovement.attributes.add('pitchMax', {
    type: 'number',
    default: 80,
    description: 'Maximum pitch angle (up)'
});

CameraMovement.prototype.initialize = function () {
    // Set initial yaw to 180 so the camera starts behind the player.
    this.yaw = 0;
    this.pitch = 0;

    var app = this.app;
    app.mouse.on("mousemove", this.onMouseMove, this);
    app.mouse.on("mousedown", this.onMouseDown, this);

    this.on('destroy', function () {
        app.mouse.off("mousemove", this.onMouseMove, this);
        app.mouse.off("mousedown", this.onMouseDown, this);
    }, this);
};

CameraMovement.prototype.update = function (dt) {
    // With the CameraMovement script on the pivot ("Camera Axis"),
    // we use its yaw to rotate the pivot. That pivot's rotation will be used
    // to drive the player's facing direction.
    this.entity.setLocalEulerAngles(this.pitch, 0, 0);

    // If you want to position the actual camera (child entity) based on pitch and distance,
    // that code can live on a separate script on the PlayerCamera. For now, we assume
    // the Camera Axis only controls horizontal rotation.
};

CameraMovement.prototype.onMouseMove = function (e) {
    if (pc.Mouse.isPointerLocked()) {
        // Adjust yaw by mouse X movement.
        this.yaw -= (this.mouseSpeed * e.dx) / 60;
        // Adjust pitch by mouse Y movement.
        this.pitch -= (this.mouseSpeed * e.dy) / 60;

        // Clamp pitch.
        this.pitch = pc.math.clamp(this.pitch, this.pitchMin, this.pitchMax);

        // Normalize yaw.
        if (this.yaw < 0) this.yaw += 360;
        if (this.yaw >= 360) this.yaw -= 360;
    }
};

CameraMovement.prototype.onMouseDown = function (e) {
    //this.app.mouse.enablePointerLock();
};
