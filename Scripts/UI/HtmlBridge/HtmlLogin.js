///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts"
var HtmlLoginManager = pc.createScript('htmlLoginManager');

HtmlLoginManager.attributes.add('cssAsset', { type: 'asset', assetType: 'css', title: 'Login UI CSS' });
HtmlLoginManager.attributes.add('htmlAsset', { type: 'asset', assetType: 'html', title: 'Login UI HTML' });
HtmlLoginManager.attributes.add('loginLogoTexture', { type: 'asset', assetType: 'texture', title: 'Login Logo Texture' });
HtmlLoginManager.attributes.add('preloaderEntity', { type: 'entity', title: 'Scene Preloader Entity' });

HtmlLoginManager.prototype.initialize = function () {
     console.log("HtmlLoginManager: Initializing...");

     if (this.preloaderEntity) {
          this.scenePreloader = this.preloaderEntity.script.scenePreloader;
          console.log("HtmlLoginManager: ScenePreloader script found.");
     } else {
          console.error("HtmlLoginManager: Could not find the ScenePreloader script instance!");
     }

     if (this.cssAsset) {
          if (this.cssAsset.resource) {
               this.injectCss(this.cssAsset.resource);
          } else {
               this.cssAsset.ready(asset => this.injectCss(asset.resource));
          }
     } else {
          console.error("HtmlLoginManager: CSS Asset attribute is not assigned!");
     }

     if (this.htmlAsset) {
          if (this.htmlAsset.resource) {
               this.injectHtml(this.htmlAsset.resource);
          } else {
               this.htmlAsset.ready(asset => this.injectHtml(asset.resource));
          }
     } else {
          console.error("HtmlLoginManager: HTML Asset attribute is not assigned!");
     }

     console.log("HtmlLoginManager: Initialize completed.");
};

HtmlLoginManager.prototype.injectCss = function (cssResource) {
     if (!cssResource) return;
     var style = document.createElement('style');
     document.head.appendChild(style);
     style.innerHTML = cssResource.data || cssResource;
};

HtmlLoginManager.prototype.injectHtml = function (htmlResource) {
     if (!htmlResource) return;
     if (this.container) return;
     this.container = document.createElement('div');
     this.container.innerHTML = htmlResource.data || htmlResource;
     document.body.appendChild(this.container);

     this.loginContainerEl = document.getElementById('login-container');
     this.usernameInputEl = document.getElementById('username-input');
     this.playButtonEl = document.getElementById('play-button');
     this.loginLogoEl = document.getElementById('login-logo');

     if (this.loginLogoTexture && this.loginLogoEl) {
          if (this.loginLogoTexture.resource) {
               this.setLoginLogoSource();
          } else {
               this.loginLogoTexture.ready(asset => this.setLoginLogoSource());
          }
     }

     if (this.playButtonEl) {
          this.playButtonEl.addEventListener('click', this.onSubmitClick.bind(this));
     }
};

HtmlLoginManager.prototype.setLoginLogoSource = function () {
     if (this.loginLogoEl && this.loginLogoTexture && this.loginLogoTexture.resource) {
          const logoUrl = this.loginLogoTexture.getFileUrl();
          this.loginLogoEl.src = logoUrl;
          this.loginLogoEl.onerror = () => {
               console.error("Error loading image into login logo element. URL:", logoUrl);
          };
     }
};

HtmlLoginManager.prototype.onSubmitClick = function () {
     var username = this.usernameInputEl.value.trim();
     if (!username) return;
     window.userName = username;
     localStorage.setItem('userName', username);
     this.playButtonEl.disabled = true;
     this.playButtonEl.innerText = "Loading...";

     if (!this.scenePreloader) {
          console.error("HtmlLoginManager: Preloader not found during submit.");
          this.playButtonEl.innerText = "Error!";
          return;
     }

     if (!this.scenePreloader.isLoaded()) {
          const error = this.scenePreloader.getError();
          if (error) {
               console.error("HtmlLoginManager: Preload failed:", error);
               this.playButtonEl.innerText = "Preload Error!";
               return;
          }

          this.app.once('scene:preload:success', this.proceedToGame, this);
          this.app.once('scene:preload:error', (sceneName, err) => {
               console.error("HtmlLoginManager: Preload failed while waiting:", err);
               this.playButtonEl.innerText = "Preload Error!";
               this.app.off('scene:preload:success', this.proceedToGame, this);
          }, this);
          return;
     }

     this.proceedToGame();
};

HtmlLoginManager.prototype.proceedToGame = function () {
     const confirmedUsername = window.userName;

     if (!this.scenePreloader || !this.scenePreloader.isLoaded()) {
          console.error("HtmlLoginManager: Cannot proceed, preload not ready or failed.");
          if (this.playButtonEl) this.playButtonEl.innerText = "Error!";
          return;
     }

     const loadedRoot = this.scenePreloader.getLoadedRoot();
     if (!loadedRoot) {
          console.error("HtmlLoginManager: Failed to get loaded root entity.");
          if (this.playButtonEl) this.playButtonEl.innerText = "Error!";
          return;
     }

     if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
          this.container = null;
          this.loginContainerEl = null;
          this.usernameInputEl = null;
          this.playButtonEl = null;
          this.loginLogoEl = null;
     }

     this.app.root.addChild(loadedRoot);

     this.app.fire('game:start');

     if (confirmedUsername) {
          this.app.fire('user:setname', confirmedUsername);
     }
};

// swap method (keep as is)
// HtmlLoginManager.prototype.swap = function(old) { };