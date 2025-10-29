(function () {
  var scope = (typeof window !== 'undefined' && window) ||
              (typeof globalThis !== 'undefined' && globalThis) ||
              {};

  var constants = {
    DEFAULT_RPM_AVATAR_ID: '68febb59c22c764a620b7b90'
  };

  scope.PlayerCustomization = scope.PlayerCustomization || {};
  scope.PlayerCustomization.DEFAULT_RPM_AVATAR_ID = constants.DEFAULT_RPM_AVATAR_ID;
  scope.PlayerCustomization.CONSTANTS = constants;
})();
