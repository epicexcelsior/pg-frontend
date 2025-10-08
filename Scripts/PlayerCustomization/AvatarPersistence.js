(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  var STORAGE_PREFIX = 'avatar:recipe:';

  var AvatarPersistence = {
    save: function (id, recipe) {
      if (!id || !recipe) return;
      try {
        localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(recipe));
      } catch (err) {
        console.warn('AvatarPersistence: Failed to save recipe.', err);
      }
    },
    load: function (id) {
      if (!id) return null;
      try {
        var raw = localStorage.getItem(STORAGE_PREFIX + id);
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        console.warn('AvatarPersistence: Failed to load recipe.', err);
        return null;
      }
    },
    clear: function (id) {
      if (!id) return;
      try {
        localStorage.removeItem(STORAGE_PREFIX + id);
      } catch (err) {
        console.warn('AvatarPersistence: Failed to clear recipe.', err);
      }
    }
  };

  scope.PlayerCustomization = scope.PlayerCustomization || {};
  scope.PlayerCustomization.AvatarPersistence = AvatarPersistence;
  scope.AvatarPersistence = scope.AvatarPersistence || AvatarPersistence;
})();
