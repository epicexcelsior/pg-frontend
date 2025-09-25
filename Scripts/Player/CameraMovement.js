///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts"
var CameraMovement = pc.createScript('cameraMovement');

CameraMovement.attributes.add('mouseSpeed', {
    type: 'number',
    default: 0.5,  // Reduced for better control
    description: 'Mouse Sensitivity'
});
CameraMovement.attributes.add('mobileOrbitSensitivity', {
    type: 'number',
    default: 0.5,
    description: 'Orbit Sensitivity (Mobile)'
});
CameraMovement.attributes.add('movementOrbitSpeed', {
    type: 'number',
    default: 1.8,  // Reduced for smoother movement
    description: 'How fast camera orbits during movement'
});
CameraMovement.attributes.add('distance', {
    type: 'number',
    default: 5,
    description: 'Distance from the pivot (player center)'
});
CameraMovement.attributes.add('followSpeed', {
    type: 'number',
    default: 8,
    description: 'How fast the camera follows the player'
});
CameraMovement.attributes.add('rotationLerpSpeed', {
    type: 'number',
    default: 0.08,  // Reduced for smoother rotation
    description: 'How smooth the camera rotation is'
});

CameraMovement.attributes.add('rotationDamping', {
    type: 'number',
    default: 0.92,  // Added damping factor
    description: 'How quickly rotation movement slows down'
});

CameraMovement.attributes.add('movementAcceleration', {
    type: 'number',
    default: 2.0,
    description: 'How quickly camera rotation accelerates during movement'
});
CameraMovement.attributes.add('pitchMin', {
    type: 'number',
    default: -85,
    description: 'Minimum pitch angle (down)'
});
CameraMovement.attributes.add('pitchMax', {
    type: 'number',
    default: 85,
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

CameraMovement.attributes.add('farClip', {
    type: 'number',
    default: 1000,
    description: 'The far clipping plane of the camera.'
});

CameraMovement.attributes.add('nearClip', {
    type: 'number',
    default: 0.1,
    description: 'The near clipping plane of the camera.'
});

CameraMovement.prototype.initialize = function () {
    if (this.entity.camera) {
        this.entity.camera.farClip = this.farClip;
        this.entity.camera.nearClip = this.nearClip;
    }
    this.yaw = 0;
    this.pitch = 0;
    this.rightMouseDown = false;
    this.cameraControlsEnabled = true;
    this.mouseMoveActive = false;
    this.lastMouseX = 0;
    this.targetYaw = 0;
    this.orbitVelocity = 0;

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

    // this.onWheel = (e) => {
    //     if (window.isChatActive) return;
    //     const delta = Math.sign(e.wheelDelta || -e.deltaY);
    //     this.currentDistance -= delta * this.zoomSpeed;
    //     this.currentDistance = pc.math.clamp(this.currentDistance, this.minDistance, this.maxDistance);
    // };

    // if (!this.isMobile) {
    //     this.canvas.addEventListener('wheel', this.onWheel, { passive: true });
    // }

    this.on('destroy', function () {
        app.mouse.off("mousemove", this.onMouseMove, this);
        app.mouse.off("mousedown", this.onMouseDown, this);
        app.mouse.off("mouseup", this.onMouseUp, this);
        this.canvas.removeEventListener("contextmenu", this.disableContextMenu);
        if (!this.isMobile) {
            this.canvas.removeEventListener('wheel', this.onWheel);
        }
    }, this);

    this.app.on('tutorial:active', this.onTutorialActive, this);
};

CameraMovement.prototype.onTutorialActive = function(isActive) {
    this.cameraControlsEnabled = !isActive;
    if (isActive && this.rightMouseDown) {
        this.app.mouse.disablePointerLock();
        this.rightMouseDown = false;
    }
};

CameraMovement.prototype.update = function (dt) {
    if (!this.cameraControlsEnabled) return;
    const normalizedDt = Math.min(dt, 1/30); // Cap delta time to prevent large jumps
    
    // Cache player reference with proper null check
    var localPlayer = this.app.root.findByName('LocalPlayer');
    
    // Guard clause: Only proceed if LocalPlayer exists and has the required script
    if (localPlayer && localPlayer.script && localPlayer.script.playerMovement) {
        const movement = localPlayer.script.playerMovement;
        const inputX = movement.currentInputX || 0;
        const inputZ = movement.currentInputZ || 0;
        
        // Calculate diagonal movement state
        const isDiagonal = Math.abs(inputZ) > 0.1 && Math.abs(inputX) > 0.1;
        const diagonalSpeedFactor = 0.65; // Reduce orbit speed during diagonal movement
        
        // Handle movement-based orbiting with acceleration
        if (Math.abs(inputX) > 0.1) {
            // Base orbit velocity calculation
            let targetVelocity = -inputX * this.movementOrbitSpeed;
            
            // Adjust velocity for diagonal movement
            if (isDiagonal) {
                // Determine orbit direction based on forward/backward movement
                const isMovingForward = inputZ < -0.1;
                const isMovingBackward = inputZ > 0.1;
                
                if (isMovingForward || isMovingBackward) {
                    // Keep orbit direction consistent with input direction
                    targetVelocity = Math.abs(targetVelocity) * -Math.sign(inputX);
                    
                    // Apply diagonal speed reduction
                    targetVelocity *= diagonalSpeedFactor;
                }
            }
            
            // Apply acceleration with improved smoothing
            this.orbitVelocity += (targetVelocity - this.orbitVelocity) * this.movementAcceleration * normalizedDt;
        }
    } else {
        // If LocalPlayer is not available, don't process movement-based orbiting
        // This prevents errors during initialization or when LocalPlayer is not yet spawned
        if (!localPlayer) {
            // LocalPlayer not found - this is normal during initialization
            return;
        }
    }

    // Apply and dampen orbit velocity with improved physics
    if (Math.abs(this.orbitVelocity) > 0.0001) {
        this.yaw += this.orbitVelocity * normalizedDt * 60;
        this.orbitVelocity *= Math.pow(this.rotationDamping, normalizedDt * 60);
    } else {
        this.orbitVelocity = 0; // Clean up tiny values
    }

    // Handle mobile camera controls
    if (this.isMobile) {
        if (window.touchJoypad && window.touchJoypad.sticks && window.touchJoypad.sticks[this.cameraJoystickId]) {
            const joystick = window.touchJoypad.sticks[this.cameraJoystickId];
            var joyX = joystick.x;
            var joyY = joystick.y;
            this.pitch += joyY * this.mobileOrbitSensitivity;
            this.yaw -= joyX * this.mobileOrbitSensitivity;
        }
    }

    // Clamp pitch within bounds
    this.pitch = pc.math.clamp(this.pitch, this.pitchMin, this.pitchMax);

    // Normalize yaw angle
    if (this.yaw < 0) this.yaw += 360;
    if (this.yaw >= 360) this.yaw -= 360;

    // Convert Euler angles to quaternion for smooth interpolation
    const targetQuat = new pc.Quat();
    targetQuat.setFromEulerAngles(this.pitch, this.yaw, 0);
    
    const currentQuat = this.entity.getRotation();
    currentQuat.slerp(currentQuat, targetQuat, this.rotationLerpSpeed * normalizedDt * 60);
    
    // Ensure proper up vector
    const up = new pc.Vec3(0, 1, 0);
    const forward = new pc.Vec3();
    currentQuat.transformVector(new pc.Vec3(0, 0, -1), forward);
    
    if (Math.abs(forward.y) > 0.99) {
        // Near vertical, adjust rotation to prevent flipping
        const right = new pc.Vec3(1, 0, 0);
        forward.cross(right, up);
        up.cross(forward, right);
        right.normalize();
        up.normalize();
        
        const correctedQuat = new pc.Quat();
        correctedQuat.setLookAt(forward, up);
        currentQuat.slerp(currentQuat, correctedQuat, 0.2);
    }
    
    this.entity.setRotation(currentQuat);

    // Update camera position with improved spring-based smoothing
    const cameraEntity = this.entity.findByName('PlayerCamera');
    if (cameraEntity) {
        // Set target position behind player with dynamic offset
        const targetPos = new pc.Vec3(0, 0, this.currentDistance);
        const currentPos = cameraEntity.getLocalPosition();
        
        // Calculate distance-based interpolation
        const distance = currentPos.distance(targetPos);
        const baseSpeed = this.followSpeed * normalizedDt;
        const speedMultiplier = Math.min(distance * 0.5, 2.0); // Faster catch-up when far
        
        // Spring-damped interpolation
        if (!this.positionVelocity) this.positionVelocity = new pc.Vec3();
        const springStrength = 15.0;
        const dampingFactor = 0.8;
        
        // Calculate spring force
        const displacement = new pc.Vec3();
        displacement.sub2(targetPos, currentPos);
        displacement.scale(springStrength * baseSpeed * speedMultiplier);
        
        // Apply damping
        this.positionVelocity.scale(dampingFactor);
        this.positionVelocity.add(displacement);
        
        // Apply velocity
        const newPos = currentPos.clone().add(this.positionVelocity.clone().scale(normalizedDt));
        cameraEntity.setLocalPosition(newPos);
    }
    
    // Update entity position to follow player with improved smoothing
    if (localPlayer) {
        const targetWorldPos = localPlayer.getPosition().clone();
        targetWorldPos.y += 1.5; // Offset camera pivot point above player
        
        const currentWorldPos = this.entity.getPosition();
        
        // Initialize world position velocity if needed
        if (!this.worldPosVelocity) this.worldPosVelocity = new pc.Vec3();
        
        // Calculate spring-based following
        const displacement = new pc.Vec3();
        displacement.sub2(targetWorldPos, currentWorldPos);
        
        // Dynamic follow speed based on distance
        const distance = displacement.length();
        const followMultiplier = Math.min(distance * 0.5, 2.0);
        
        // Apply spring physics
        const springStrength = 12.0;
        displacement.scale(springStrength * normalizedDt * followMultiplier);
        
        // Apply damping and update velocity
        this.worldPosVelocity.scale(0.85);
        this.worldPosVelocity.add(displacement);
        
        // Apply velocity to position
        const newWorldPos = currentWorldPos.clone().add(this.worldPosVelocity.clone().scale(normalizedDt));
        this.entity.setPosition(newWorldPos);
    }
};

CameraMovement.prototype.onMouseMove = function (e) {
    if (window.isChatActive || !this.cameraControlsEnabled) return;

    if (pc.Mouse.isPointerLocked() && this.rightMouseDown) {
        // Dynamic sensitivity based on pitch angle
        const pitchFactor = Math.cos(Math.abs(this.pitch) * Math.PI / 180);
        const sensitivity = this.mouseSpeed * (0.5 + 0.5 * pitchFactor);

        // Add velocity-based smoothing
        this.yawVelocity = (this.yawVelocity || 0) * 0.8 + (sensitivity * e.dx) / 60 * 0.2;
        this.pitchVelocity = (this.pitchVelocity || 0) * 0.8 + (sensitivity * e.dy) / 60 * 0.2;
        
        this.yaw -= this.yawVelocity;
        this.pitch -= this.pitchVelocity;
        
        // Additional safeguards against flipping
        if (Math.abs(this.pitch) > 85) {
            const correction = (Math.abs(this.pitch) - 85) * Math.sign(this.pitch);
            this.pitch -= correction;
            this.pitchVelocity = 0;
        }
    } else if (!this.rightMouseDown) {
        // Reduced automatic rotation with smooth transition
        const centerX = this.canvas.width / 2;
        const mouseDeltaX = (e.x - centerX) / centerX; // -1 to 1
        const targetVelocity = -mouseDeltaX * 0.2;
        this.orbitVelocity += (targetVelocity - this.orbitVelocity) * 0.1;
    }
};

CameraMovement.prototype.onMouseDown = function (e) {
    if (!this.cameraControlsEnabled) return;
    if (e.button === pc.MOUSEBUTTON_RIGHT) {
        this.rightMouseDown = true;
        this.app.mouse.enablePointerLock();
    }
};

CameraMovement.prototype.onMouseUp = function (e) {
    if (!this.cameraControlsEnabled) return;
    if (e.button === pc.MOUSEBUTTON_RIGHT) {
        this.rightMouseDown = false;
        this.app.mouse.disablePointerLock();
    }
};