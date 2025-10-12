var NameplateBillboard = pc.createScript('nameplateBillboard');

NameplateBillboard.attributes.add('faceCamera', {
    type: 'boolean',
    default: true,
    title: 'Face Camera',
    description: 'Rotate an extra 180° so the front of the element faces the camera.'
});

NameplateBillboard.attributes.add('yawOnly', {
    type: 'boolean',
    default: true,
    title: 'Yaw Only',
    description: 'When enabled, only rotate around the Y axis (prevents the label from tilting).'
});

NameplateBillboard.attributes.add('useDistanceScale', {
    type: 'boolean',
    default: false,
    title: 'Scale With Distance'
});

NameplateBillboard.attributes.add('near', {
    type: 'number',
    default: 2.0,
    title: 'Near Distance'
});

NameplateBillboard.attributes.add('far', {
    type: 'number',
    default: 20.0,
    title: 'Far Distance'
});

NameplateBillboard.attributes.add('minScale', {
    type: 'number',
    default: 0.85,
    title: 'Min Scale'
});

NameplateBillboard.attributes.add('maxScale', {
    type: 'number',
    default: 1.25,
    title: 'Max Scale'
});

NameplateBillboard.attributes.add('cameraEntity', {
    type: 'entity',
    title: 'Camera (optional)'
});

NameplateBillboard.prototype.initialize = function () {
    this._camera = this.cameraEntity || null;
    this._baseScale = this.entity.getLocalScale().clone();
    this._lastCameraSearch = 0;
    this._tempVec = new pc.Vec3();
};

NameplateBillboard.prototype.update = function (dt) {
    var camera = this._getActiveCamera();
    if (!camera) {
        return;
    }

    var entityPos = this.entity.getPosition();
    var cameraPos = camera.getPosition();

    this._tempVec.copy(cameraPos).sub(entityPos);
    if (this._tempVec.lengthSq() < 1e-8) {
        return;
    }

    if (this.yawOnly) {
        this._tempVec.y = 0;
        if (this._tempVec.lengthSq() < 1e-8) {
            return;
        }
        this._tempVec.normalize();
        var yaw = Math.atan2(this._tempVec.x, this._tempVec.z) * pc.math.RAD_TO_DEG;
        if (this.faceCamera) {
            yaw += 180;
        }
        this.entity.setEulerAngles(0, yaw, 0);
    } else {
        this.entity.lookAt(cameraPos);
        if (this.faceCamera) {
            this.entity.rotateLocal(0, 180, 0);
        }
    }

    if (this.useDistanceScale) {
        var distance = cameraPos.distance(entityPos);
        var range = Math.max(0.0001, this.far - this.near);
        var t = pc.math.clamp((distance - this.near) / range, 0, 1);
        var scale = pc.math.lerp(this.minScale, this.maxScale, t);
        this.entity.setLocalScale(
            this._baseScale.x * scale,
            this._baseScale.y * scale,
            this._baseScale.z * scale
        );
    }
};

NameplateBillboard.prototype._getActiveCamera = function () {
    if (this._camera && this._camera.enabled) {
        return this._camera;
    }

    var now = Date.now();
    if (now - this._lastCameraSearch < 200) {
        return null;
    }
    this._lastCameraSearch = now;

    var cameraSystem = this.app.systems && this.app.systems.camera;
    if (!cameraSystem) {
        return null;
    }

    if (cameraSystem.activeCamera && cameraSystem.activeCamera.entity && cameraSystem.activeCamera.entity.enabled) {
        this._camera = cameraSystem.activeCamera.entity;
        return this._camera;
    }

    var cams = cameraSystem.cameras;
    if (cams && cams.length) {
        for (var i = 0; i < cams.length; i++) {
            var candidate = cams[i];
            if (candidate && candidate.entity && candidate.entity.enabled) {
                this._camera = candidate.entity;
                return this._camera;
            }
        }
    }

    var fallback = this.app.root.findOne(function (entity) {
        return entity.camera && entity.enabled;
    });
    if (fallback) {
        this._camera = fallback;
    }

    return this._camera;
};

NameplateBillboard.prototype.destroy = function () {
    this._camera = null;
};
