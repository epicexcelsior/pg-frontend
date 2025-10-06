/* global pc */
(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  function ensureRootBone(armature) {
    if (!armature) return null;
    var existing = armature.findByName('Root');
    if (existing) {
      // A root bone exists, but we should still return the main armature
      // for retargeting, to avoid breaking animations.
      return armature;
    }

    // Create a placeholder Root bone if one doesn't exist, as the render
    // components of the avatar parts expect to find it by name.
    // Do NOT reparent any other bones into it.
    var root = new pc.Entity('Root');
    root.setLocalPosition(0, 0, 0);
    root.setLocalRotation(pc.Quat.IDENTITY);
    root.setLocalScale(1, 1, 1);
    armature.addChild(root);

    // Return the main armature for retargeting.
    return armature;
  }

  function ensureSlot(armature, name, boneParents) {
    var slot = armature.findByName(name);
    if (slot) return slot;
    var entity = new pc.Entity(name);
    if (boneParents && boneParents[name]) {
      var bone = armature.findByName(boneParents[name]);
      (bone || armature).addChild(entity);
    } else {
      armature.addChild(entity);
    }
    return entity;
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

    playerEntity.__avatarAnchors = anchors;
    return anchors;
  };
})();
