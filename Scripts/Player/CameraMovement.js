///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var CameraMovement = pc.createScript('cameraMovement');

CameraMovement.attributes.add('mouseSpeed', {
    type: 'number',
    default: 1.4,
    description: 'Mouse Sensitivity'
});
CameraMovement.attributes.add('mobileOrbitSensitivity', { // New attribute for mobile
    type: 'number',
    default: 0.7, // Default mobile sensitivity - adjust this value!
    description: 'Orbit Sensitivity (Mobile)'
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
CameraMovement.attributes.add('cameraJoystickId', { type: 'string', default: 'joystick1' }); // Joystick ID for camera

CameraMovement.attributes.add('minDistance', {
    type: 'number',
    default: 2,
    description: 'Minimum zoom distance'
});

CameraMovement.attributes.add('maxDistance', {
    type: 'number',
    default: 10,
    description: 'Maximum zoom distance'
});

CameraMovement.attributes.add('zoomSpeed', {
    type: 'number',
    default: 0.25,
    description: 'Mouse wheel zoom sensitivity'
});

CameraMovement.prototype.initialize = function () {
    this.yaw = 0;
    this.pitch = 0;
    this.rightMouseDown = false;

    var app = this.app;

    this.canvas = app.graphicsDevice.canvas;
    this.disableContextMenu = function (e) { e.preventDefault(); };

    this.isMobile = pc.platform.touch;
    this.cameraJoystickEntity = pc.app.root.findByName('CameraJoystick');
    this.touchJoypadScreenEntity = pc.app.root.findByName('TouchJoypadScreen');

    if (this.isMobile && this.touchJoypadScreenEntity) {
        this.touchJoypadScreenEntity.enabled = true;
    } else if (!this.isMobile && this.touchJoypadScreenEntity) {
        this.touchJoypadScreenEntity.enabled = false;
    }

    if (this.isMobile) {
        app.mouse.off("mousemove", this.onMouseMove, this);
        app.mouse.off("mousedown", this.onMouseDown, this);
        app.mouse.off("mouseup", this.onMouseUp, this);
        this.canvas.removeEventListener("contextmenu", this.disableContextMenu);
    } else {
        app.mouse.on("mousemove", this.onMouseMove, this);
        app.mouse.on("mousedown", this.onMouseDown, this);
        app.mouse.on("mouseup", this.onMouseUp, this);
        this.canvas.addEventListener("contextmenu", this.disableContextMenu);
    }

    this.currentDistance = this.distance;

    this.onWheel = (e) => {
        if (window.isChatActive) return;
        const delta = Math.sign(e.wheelDelta || -e.deltaY);
        this.currentDistance -= delta * this.zoomSpeed;
        this.currentDistance = pc.math.clamp(this.currentDistance, this.minDistance, this.maxDistance);
    };

    if (!this.isMobile) {
        this.canvas.addEventListener('wheel', this.onWheel, { passive: true });
    }

    this.on('destroy', function () {
        app.mouse.off("mousemove", this.onMouseMove, this);
        app.mouse.off("mousedown", this.onMouseDown, this);
        app.mouse.off("mouseup", this.onMouseUp, this);
        this.canvas.removeEventListener("contextmenu", this.disableContextMenu);
        if (!this.isMobile) {
            this.canvas.removeEventListener('wheel', this.onWheel);
        }
    }, this);
};

CameraMovement.prototype.update = function (dt) {
    if (this.isMobile) {
        if (window.touchJoypad && window.touchJoypad.sticks && window.touchJoypad.sticks[this.cameraJoystickId]) {
            const joystick = window.touchJoypad.sticks[this.cameraJoystickId];
            this.pitch += joystick.y * this.mobileOrbitSensitivity * dt;
            this.yaw -= joystick.x * this.mobileOrbitSensitivity * dt;
        }
    }

    this.pitch = pc.math.clamp(this.pitch, this.pitchMin, this.pitchMax);

    if (this.yaw < 0) this.yaw += 360;
    if (this.yaw >= 360) this.yaw -= 360;

    this.entity.setLocalEulerAngles(this.pitch, 0, 0);

    const cameraEntity = this.entity.findByName('Camera');
    if (cameraEntity) {
        const targetPos = new pc.Vec3(0, 0, this.currentDistance);
        const currentPos = cameraEntity.getLocalPosition();
        currentPos.lerp(currentPos, targetPos, 0.2);
        cameraEntity.setLocalPosition(currentPos);
    }
};

CameraMovement.prototype.onMouseMove = function (e) {
    if (pc.Mouse.isPointerLocked() && this.rightMouseDown) {
        this.yaw -= (this.mouseSpeed * e.dx) / 60;
        this.pitch -= (this.mouseSpeed * e.dy) / 60;
    }
};

CameraMovement.prototype.onMouseDown = function (e) {
    if (e.button === pc.MOUSEBUTTON_RIGHT) {
        this.rightMouseDown = true;
        this.app.mouse.enablePointerLock();
    }
};

CameraMovement.prototype.onMouseUp = function (e) {
    if (e.button === pc.MOUSEBUTTON_RIGHT) {
        this.rightMouseDown = false;
        this.app.mouse.disablePointerLock();
    }
};