/* global pc */
(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  function tintUnder(entity, color) {
    if (!entity || !color) return;
    var r = typeof color.r === 'number' ? color.r : 1;
    var g = typeof color.g === 'number' ? color.g : 1;
    var b = typeof color.b === 'number' ? color.b : 1;
    var renders = entity.findComponents('render');
    for (var i = 0; i < renders.length; i++) {
      var renderComponent = renders[i];
      var meshInstances = renderComponent.meshInstances || [];
      for (var j = 0; j < meshInstances.length; j++) {
        var material = meshInstances[j].material;
        if (!material) continue;
        if (material.diffuse && material.diffuse.set) {
          material.diffuse.set(r, g, b);
        }
        if (material.albedo && material.albedo.set) {
          material.albedo.set(r, g, b);
        }
        if (material.update) material.update();
      }
    }
  }

  scope.PlayerCustomization = scope.PlayerCustomization || {};
  scope.PlayerCustomization.MaterialTint = scope.PlayerCustomization.MaterialTint || {};
  scope.PlayerCustomization.MaterialTint.tintUnder = tintUnder;
  scope.tintUnder = scope.tintUnder || tintUnder;
})();
