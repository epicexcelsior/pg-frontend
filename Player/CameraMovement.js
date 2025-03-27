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
    // Initial camera angles.
    this.yaw = 0;
    this.pitch = 0;
    this.rightMouseDown = false;

    var app = this.app;
    // Listen to mouse movement events.
    app.mouse.on("mousemove", this.onMouseMove, this);
    // Listen for right-click mouse down/up events.
    app.mouse.on("mousedown", this.onMouseDown, this);
    app.mouse.on("mouseup", this.onMouseUp, this);

    // Disable the context menu on right-click.
    this.canvas = app.graphicsDevice.canvas;
    // Save a reference to the handler so we can remove it later.
    this.disableContextMenu = function (e) {
        e.preventDefault();
    };
    this.canvas.addEventListener("contextmenu", this.disableContextMenu);

    this.on('destroy', function () {
        app.mouse.off("mousemove", this.onMouseMove, this);
        app.mouse.off("mousedown", this.onMouseDown, this);
        app.mouse.off("mouseup", this.onMouseUp, this);
        this.canvas.removeEventListener("contextmenu", this.disableContextMenu);
    }, this);
};

CameraMovement.prototype.update = function (dt) {
    // Here, the CameraMovement script rotates the pivot (player's camera axis).
    // The pitch is applied to the entity (the pivot) for vertical rotation.
    this.entity.setLocalEulerAngles(this.pitch, 0, 0);
};

CameraMovement.prototype.onMouseMove = function (e) {
    if (pc.Mouse.isPointerLocked() && this.rightMouseDown) {
        // Rotate the camera based on mouse movement while pointer is locked.
        this.yaw -= (this.mouseSpeed * e.dx) / 60;
        this.pitch -= (this.mouseSpeed * e.dy) / 60;

        // Clamp the pitch to avoid flipping.
        this.pitch = pc.math.clamp(this.pitch, this.pitchMin, this.pitchMax);

        // Normalize yaw so it stays within 0-360 degrees.
        if (this.yaw < 0) this.yaw += 360;
        if (this.yaw >= 360) this.yaw -= 360;
    }
};

CameraMovement.prototype.onMouseDown = function (e) {
    // Check if the right mouse button (button code 2) is pressed.
    if (e.button === pc.MOUSEBUTTON_RIGHT) {
        this.rightMouseDown = true;
        // Enable pointer lock so that the mouse can freely drive the camera.
        this.app.mouse.enablePointerLock();
    }
};

CameraMovement.prototype.onMouseUp = function (e) {
    // When the right mouse button is released, disable pointer lock.
    if (e.button === pc.MOUSEBUTTON_RIGHT) {
        this.rightMouseDown = false;
        this.app.mouse.disablePointerLock();
    }
};
