/* global pc */
(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  var DEFAULT_HEAD_NAMES = [
    'Head',
    'head',
    'mixamorig:Head',
    'Wolf3D_Head',
    'HeadTop_End',
    'HeadTop'
  ];

  var DEFAULT_NECK_NAMES = [
    'Neck',
    'neck',
    'mixamorig:Neck',
    'Wolf3D_Neck',
    'Neck1',
    'NeckTop'
  ];

  function ensureEntity(parent, name) {
    if (!parent) return null;
    var existing = parent.findByName(name);
    if (existing) return existing;
    var entity = new pc.Entity(name);
    entity.setLocalPosition(0, 0, 0);
    entity.setLocalEulerAngles(0, 0, 0);
    entity.setLocalScale(1, 1, 1);
    parent.addChild(entity);
    return entity;
  }

  function ensureRootBone(armature) {
    if (!armature) return null;
    var existing = armature.findByName('Root');
    if (existing) return armature;

    var root = new pc.Entity('Root');
    root.setLocalPosition(0, 0, 0);
    root.setLocalRotation(pc.Quat.IDENTITY);
    root.setLocalScale(1, 1, 1);
    armature.addChild(root);
    return armature;
  }

  function ensureSlot(armature, name, boneParents) {
    if (!armature) return null;
    var slot = armature.findByName(name);
    if (slot) return slot;
    var entity = new pc.Entity(name);
    entity.setLocalPosition(0, 0, 0);
    entity.setLocalEulerAngles(0, 0, 0);
    entity.setLocalScale(1, 1, 1);
    if (boneParents && boneParents[name]) {
      var bone = armature.findByName(boneParents[name]);
      (bone || armature).addChild(entity);
    } else {
      armature.addChild(entity);
    }
    return entity;
  }

  function findFirstByNames(root, names) {
    if (!root || !names || !names.length) return null;
    for (var i = 0; i < names.length; i++) {
      var direct = root.findByName(names[i]);
      if (direct) return direct;
    }
    var queue = [root];
    while (queue.length) {
      var node = queue.shift();
      if (!node) continue;
      if (node.name) {
        var lower = node.name.toLowerCase();
        for (var j = 0; j < names.length; j++) {
          if (lower === names[j].toLowerCase()) {
            return node;
          }
        }
      }
      for (var c = 0; c < node.children.length; c++) {
        queue.push(node.children[c]);
      }
    }
    return null;
  }

  function setAnchorParent(anchor, parent, localOffset) {
    if (!anchor || !parent) return;
    var prevParent = anchor.parent;
    if (prevParent === parent) return;
    anchor.reparent(parent);
    if (localOffset) {
      anchor.setLocalPosition(localOffset.x, localOffset.y, localOffset.z);
    } else {
      anchor.setLocalPosition(0, 0, 0);
    }
    anchor.setLocalEulerAngles(0, 0, 0);
    anchor.setLocalScale(1, 1, 1);
  }

  function defaultHeadOffset(entity) {
    var bounds = entity && entity.render && entity.render.meshInstances && entity.render.meshInstances[0]
      ? entity.render.meshInstances[0].aabb
      : null;
    if (bounds) {
      return new pc.Vec3(0, bounds.halfExtents.y * 1.4, 0);
    }
    return new pc.Vec3(0, 1.6, 0);
  }

  scope.PlayerCustomization = scope.PlayerCustomization || {};

  scope.PlayerCustomization.ensureAvatarAnchors = function (playerEntity, options) {
    options = options || {};
    if (!playerEntity) throw new Error('ensureAvatarAnchors: playerEntity is required');

    if (playerEntity.__avatarAnchors && !options.forceRefresh) {
      return playerEntity.__avatarAnchors;
    }

    var armatureName = options.armatureName || 'Armature';
    var armature = playerEntity.findByName(armatureName) || playerEntity;
    if (!armature) {
      throw new Error("ensureAvatarAnchors: unable to locate armature '" + armatureName + "' under " + playerEntity.name);
    }

    var rootBone = ensureRootBone(armature) || armature;

    var slotNames = {
      SlotHead: 'head',
      SlotBody: 'body',
      SlotLegs: 'legs',
      SlotFeet: 'feet'
    };

    var anchors = {};
    for (var slotName in slotNames) {
      if (!Object.prototype.hasOwnProperty.call(slotNames, slotName)) continue;
      var slotEntity = ensureSlot(armature, slotName, options.boneParents);
      anchors[slotNames[slotName]] = slotEntity;
    }

    anchors.rootBone = rootBone;
    anchors.armature = armature;
    anchors.modelRoot = ensureEntity(playerEntity, options.modelRootName || 'AvatarModelRoot');
    anchors.headAnchor = ensureEntity(anchors.modelRoot, options.headAnchorName || 'AvatarHeadAnchor');
    anchors.nameplateAnchor = ensureEntity(anchors.headAnchor, options.nameplateAnchorName || 'AvatarNameplateAnchor');

    playerEntity.__avatarAnchors = anchors;
    return anchors;
  };

  scope.PlayerCustomization.updateAvatarAnchors = function (anchors, modelEntity, opts) {
    if (!anchors || !modelEntity) return;
    opts = opts || {};
    var headNames = opts.headNames || DEFAULT_HEAD_NAMES;
    var neckNames = opts.neckNames || DEFAULT_NECK_NAMES;

    var armature = modelEntity.findByName && modelEntity.findByName('Armature');
    if (!armature) {
      armature = findFirstByNames(modelEntity, ['Armature', 'Wolf3D_Avatar', 'Hips']);
    }

    if (armature) {
      anchors.armature = armature;
      anchors.rootBone = ensureRootBone(armature);
    }

    var headBone = findFirstByNames(modelEntity, headNames);
    var neckBone = findFirstByNames(modelEntity, neckNames);

    if (anchors.headAnchor) {
      if (headBone) {
        setAnchorParent(anchors.headAnchor, headBone, new pc.Vec3(0, 0.04, 0));
      } else if (neckBone) {
        setAnchorParent(anchors.headAnchor, neckBone, new pc.Vec3(0, 0.12, 0));
      } else {
        setAnchorParent(anchors.headAnchor, anchors.modelRoot, defaultHeadOffset(modelEntity));
      }
    }

    if (anchors.nameplateAnchor) {
      setAnchorParent(anchors.nameplateAnchor, anchors.headAnchor, new pc.Vec3(0, 0.28, 0));
    }
  };
})();

