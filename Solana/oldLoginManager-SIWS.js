///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
// ///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
// // LoginManager.js
// var LoginManager = pc.createScript('loginManager');

// LoginManager.prototype.initialize = function () {
//      // Find the ConnectWallet button and its child text element
//      this.connectButton = this.app.root.findByName("ConnectWallet");
//      if (!this.connectButton) {
//           console.error("ConnectWallet button not found in the scene.");
//           return;
//      }

//      this.buttonText = this.connectButton.findByName("ConnectWalletText");
//      if (!this.buttonText || !this.buttonText.element) {
//           console.error("ConnectWalletText element not found or missing component.");
//           return;
//      }

//      // Set initial button text
//      this.buttonText.element.text = "Connect";

//      // Listen for click events on the button
//      this.connectButton.element.on('click', this.onConnectClick, this);

//      // Session token placeholder
//      this.sessionToken = null;
// };

// LoginManager.prototype.onConnectClick = async function () {
//      // Disable the button immediately to avoid multiple clicks
//      this.connectButton.active = false;
//      this.buttonText.element.text = "Connecting...";

//      // Step 1: Connect the wallet using the wallet adapter
//      try {
//           await window.SolanaSDK.wallet.connect();
//      } catch (err) {
//           console.error("Wallet connection failed:", err);
//           this.buttonText.element.text = "Connection Failed";
//           this.connectButton.active = true;
//           return;
//      }

//      // Wallet is connected. Get the public key.
//      var publicKey = window.SolanaSDK.wallet.publicKey;
//      this.buttonText.element.text = "Wallet Connected: " + publicKey.toBase58();

//      // Step 2: Fetch SIWS sign-in input from your Cloudflare Worker
//      var siwsInput;
//      try {
//           var inputResponse = await fetch("http://127.0.0.1:8787/request_siws_input");
//           if (!inputResponse.ok) {
//                throw new Error("Failed to fetch SIWS input");
//           }
//           siwsInput = await inputResponse.json();
//           console.log("Fetched SIWS Input:", siwsInput);
//      } catch (err) {
//           console.error("Error fetching SIWS input:", err);
//           this.buttonText.element.text = "Error fetching SIWS input";
//           this.connectButton.active = true;
//           return;
//      }

//      // Step 3: Use the wallet adapter’s SIWS signIn method to sign the SIWS input
//      var siwsOutput;
//      try {
//           if ("signIn" in window.SolanaSDK.wallet) {
//                siwsOutput = await window.SolanaSDK.wallet.signIn(siwsInput);
//           } else {
//                throw new Error("Wallet does not support SIWS signIn");
//           }
//           console.log("SIWS Output from wallet:", siwsOutput);
//      } catch (err) {
//           console.error("Error during SIWS signIn:", err);
//           this.buttonText.element.text = "Error signing SIWS message";
//           this.connectButton.active = true;
//           return;
//      }

//      // Step 4: Send the SIWS input and output to the /verify_siws endpoint
//      var sessionToken;
//      try {
//           var verifyPayload = {
//                input: siwsInput,
//                output: siwsOutput
//           };
//           var verifyResponse = await fetch("http://127.0.0.1:8787/verify_siws", {
//                method: "POST",
//                headers: {
//                     "Content-Type": "application/json"
//                },
//                body: JSON.stringify(verifyPayload)
//           });

//           if (!verifyResponse.ok) {
//                var errorData = await verifyResponse.json();
//                throw new Error("Verification failed: " + errorData.error);
//           }

//           var verifyData = await verifyResponse.json();
//           sessionToken = verifyData.sessionToken;
//           console.log("Session token received:", sessionToken);
//      } catch (err) {
//           console.error("Error verifying SIWS message:", err);
//           this.buttonText.element.text = "Error verifying SIWS";
//           this.connectButton.active = true;
//           return;
//      }

//      // Step 5: Update UI and store the session token
//      this.buttonText.element.text = "Connected (Token: " + sessionToken + ")";
//      this.sessionToken = sessionToken;
//      // Optionally, store sessionToken globally for later use
//      window.SolanaSessionToken = sessionToken;

//      // After SIWS verification succeeded
//      // this.client = new nakamajs.Client("defaultkey", "127.0.0.1", 7350, false);
//      // window.nakamaClient = this.client;
//      // console.log("Nakama client:", this.client);
//      // let nakamaSession;
//      // try {
//      //      nakamaSession = await client.authenticateCustom(sessionToken);
//      //      console.log("Nakama session:", nakamaSession.token);
//      //      window.NakamaSession = nakamaSession;
//      //      this.buttonText.element.text = "Authenticated with Nakama";
//      // } catch (e) {
//      //      console.error("Nakama auth failed:", e);
//      //      this.buttonText.element.text = "Nakama Auth Error";
//      //      this.connectButton.enabled = true;
//      //      return;
//      // }
// };
