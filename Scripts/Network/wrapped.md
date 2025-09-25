
# C:\Users\Epic\Documents\GitHub\pg-colyseus\src\app.config.ts
```
import dotenv from 'dotenv';
dotenv.config();

import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import cors from 'cors'; // <-- Import cors here
import { matchMaker } from "@colyseus/core"; // Make sure @colyseus/core is installed

// --- Add this block ---
matchMaker.controller.getCorsHeaders = function(req) {
    const origin = req.headers.origin; // Get the origin from the request

    // Check if the origin is allowed (in this case, just PlayCanvas launch URL)
    const allowedOrigins = ['https://launch.playcanvas.com', 'https://play.plsgive.com', 'https://playcanv.as', 'https://dev.plsgive.com', 'http://localhost:5173'];
    const isAllowedOrigin = allowedOrigins.includes(origin);

    return {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : '', // IMPORTANT: Return the *request's origin* if it's allowed, or an *empty string* if not allowed
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        'Access-Control-Allow-Credentials': 'true', // Keep this - you *want* to allow credentials
        'Access-Control-Max-Age': '2592000'
    };
}

/**
 * Import your Room files
 */
import { MyRoom } from "./rooms/MyRoom";

export default config({
    initializeGameServer: (gameServer) => {
        /**
         * Define your room handlers:
         */
        gameServer.define('my_room', MyRoom);
    },

    initializeExpress: (app) => {
        /**
         * Add CORS middleware here, before other routes
         */
        app.use(cors({
            origin: [
                '*'      // For testing, you can keep '*' for now
            ]
        }));

        /**
         * Bind your custom express routes here:
         * Read more: https://expressjs.com/en/starter/basic-routing.html
         */
        app.get("/hello_world", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        /**
         * Use @colyseus/playground
         * (It is not recommended to expose this route in a production environment)
         */
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground);
        }

        /**
         * Use @colyseus/monitor
         * It is recommended to protect this route with a password
         * Read more: https://docs.colyseus.io/tools/monitor/#restrict-access-to-the-panel-using-a-password
         */
        app.use("/colyseus", monitor());
    },

    beforeListen: () => {
        /**
         * Before before gameServer.listen() is called.
         */
    }
});
```


# C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\config.json
```
{
  "colyseusEndpoint": "ws://localhost:2567",
  "privyHostOrigin": "https://localhost:5173",
  "cloudflareWorkerAnnounceEndpoint": "http://127.0.0.1:8787/announceDonation",
  "donationFeeRecipientAddress": "r1eKs83sknjVn8cSx5u7afNx8ykjoi1GWULwZvcaAio",
  "heliusRpcUrl": "https://mainnet.helius-rpc.com/?api-key=3a8dbca3-c068-49c7-9d16-f1224d21aa32",
  "donationFeePercentage": 10,
  "privyAppId": "ciot16npk0016jq0f805v642z"
}
```


# C:\Users\Epic\Documents\GitHub\pg-bundles\src\index.js
```
// C:\Users\Epic\Documents\GitHub\pg-bundles\src\index.js

// --- Core Libraries ---
import * as colyseus from 'colyseus.js';
import gsap from 'gsap';
import QRCode from 'qrcode'; // Add QRCode library
import { Buffer } from 'buffer';
import process from 'process';

// --- Solana Libraries ---
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { createSolanaRpc, lamports as gill_lamports, address as gill_address } from 'gill';
import {
    Transaction,
    Message,
    Connection,
    PublicKey,
    SystemProgram,
    LAMPORTS_PER_SOL,
    Keypair // <-- Also needed for Solana Pay
} from '@solana/web3.js';

// --- Custom Wallet Adapter ---
import { SIWSPhantomWalletAdapter } from './SIWSWalletAdapter';

console.log("Initializing PlsGive Bundle...");

// --- Setup Solana Dependencies ---
const endpoint = 'https://mainnet.helius-rpc.com/?api-key=3a8dbca3-c068-49c7-9d16-f1224d21aa32';
const { rpc } = createSolanaRpc(endpoint);
const phantom = new SIWSPhantomWalletAdapter();

// --- Create Global SDK Objects ---

// 1. SolanaSDK for structured access
const SolanaSDK = {
    wallet: phantom,
    rpc: rpc,
    colyseus, // Include colyseus here for consistency
    gsap,     // Include gsap here for consistency
    gill: { createSolanaRpc, lamports: gill_lamports, address: gill_address },
    web3: {
        Transaction,
        Message,
        Connection,
        PublicKey,
        SystemProgram,
        LAMPORTS_PER_SOL,
        Keypair
    }
};

// 2. Expose libraries on the global `window` object for PlayCanvas scripts
window.Buffer = Buffer;
window.process = process;
window.Colyseus = colyseus;
window.gsap = gsap;
window.QRCode = QRCode;
window.SolanaSDK = SolanaSDK;

// Deprecated/Legacy globals for compatibility
window.WalletAdapterNetwork = WalletAdapterNetwork;
window.PhantomWalletAdapter = SIWSPhantomWalletAdapter;

console.log("✅ PlsGive Bundle Loaded Successfully. Globals (Colyseus, gsap, QRCode, SolanaSDK) are now available.", {
    colyseus: typeof window.Colyseus,
    gsap: typeof window.gsap,
    qr: typeof window.QRCode,
    sdk: typeof window.SolanaSDK
});
```


# C:\Users\Epic\Documents\GitHub\pg-colyseus\src\index.ts
```
/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
 *
 * If you're self-hosting (without Colyseus Cloud), you can manually
 * instantiate a Colyseus Server as documented here:
 *
 * See: https://docs.colyseus.io/server/api/#constructor-options
 */
import { listen } from "@colyseus/tools";

// Import Colyseus config
import app from "./app.config";

// Create and listen on 2567 (or PORT environment variable.)
// Pass hostname as an option to the listen() function
listen(app); // <-- Modified line: added options object with hostname
```


# C:\Users\Epic\Documents\GitHub\pg-bundles\src\old_solana_ui.js
```
import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';

// Import default styles for the Wallet Adapter UI
import '@solana/wallet-adapter-react-ui/styles.css';

// Expose existing Solana functions to React
const connection = new Connection(clusterApiUrl(WalletAdapterNetwork.Devnet));

const wallets = [new PhantomWalletAdapter()];

const SolanaReactApp = () => {
    const wallet = useWallet();

    useEffect(() => {
        if (wallet.connected) {
            window.initSolanaWallet(wallet); // Expose wallet instance to PlayCanvas
            console.log('Wallet connected:', wallet.publicKey.toBase58());
        }
    }, [wallet.connected]);

    return (
        <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>
                <WalletMultiButton />
                <WalletDisconnectButton />
            </WalletModalProvider>
        </WalletProvider>
    );
};

window.renderSolanaUI = (elementId) => {
    const container = document.getElementById(elementId);
    if (container) {
        ReactDOM.render(<SolanaReactApp />, container);
    } else {
        console.error('Container for Solana UI not found');
    }
};
```


# C:\Users\Epic\Documents\GitHub\pg-bundles\src\SIWSWalletAdapter.js
```
// SIWSWalletAdapter.js

import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { createSignInMessageText } from '@solana/wallet-standard-util';

/**
 * Helper: Convert a Uint8Array to a base64 string.
 */
function uint8ToBase64(u8arr) {
     // The btoa method is not safe for all binary data.
     // Buffer.from is the reliable, standard way to handle this.
     return Buffer.from(u8arr).toString('base64');
}

export class SIWSPhantomWalletAdapter extends PhantomWalletAdapter {
     /**
      * signIn - Signs a SIWS message
      * @param {object} initialSignInInput - The initial SIWS sign-in input object from the server.
      * @returns {Promise<object>} - Resolves to an object containing:
      *                              { input: finalInputUsed, output: siwsOutput }
      */
     async signIn(initialSignInInput) {
          // Ensure the wallet is connected
          if (!this.connected) {
               // Attempt to connect if not already connected. Handle potential errors.
               try {
                    await this.connect();
               } catch (connectError) {
                    console.error("SIWS: Wallet connection failed during signIn:", connectError);
                    // Re-throw a more specific error or a custom error
                    throw new Error(`Wallet connection required for sign-in: ${connectError.message}`);
               }
          }

          // --- Create the input object that will actually be used for signing ---
          // Start with a copy of the input received from the server
          const finalSignInInput = { ...initialSignInInput };

          // If the input does not include an address, set it from the connected wallet.
          if (!finalSignInInput.address && this.publicKey) {
               finalSignInInput.address = this.publicKey.toBase58();
               console.log("SIWS: Added wallet address to signIn input:", finalSignInInput.address);
          } else if (!this.publicKey) {
               // This case should ideally not happen if connect() succeeded
               console.error("SIWS: Wallet connected but publicKey is missing.");
               throw new Error("Wallet public key is unavailable after connection.");
          }

          console.log("SIWS Final Input for Signing:", finalSignInInput);

          // Construct the SIWS message text using the final input object.
          const messageText = createSignInMessageText(finalSignInInput);
          console.log("Constructed SIWS message text:", messageText);

          // Encode the message as a Uint8Array.
          const messageUint8 = new TextEncoder().encode(messageText);
          console.log("Encoded message Uint8Array:", messageUint8);

          // Call signMessage() from the underlying wallet adapter.
          let signature;
          try {
               signature = await this.signMessage(messageUint8);
          } catch (signError) {
               console.error("SIWS: Error during wallet signMessage:", signError);
               // Provide more context if possible (e.g., user rejection)
               const userRejected = signError.message?.includes('User rejected') || signError.code === 4001;
               throw new Error(userRejected ? "Sign-in request cancelled in wallet." : `Failed to sign message: ${signError.message}`);
          }
          console.log("Obtained signature Uint8Array:", signature);

          // Construct the SIWS output object with base64 strings.
          const siwsOutput = {
               account: {
                    // Ensure publicKey is available and converted correctly
                    publicKey: uint8ToBase64(this.publicKey.toBytes())
               },
               signedMessage: uint8ToBase64(messageUint8),
               signature: uint8ToBase64(signature),
               signatureType: "ed25519" // Standard for Solana
          };

          // --- Return BOTH the input used and the output ---
          return {
               input: finalSignInInput, // The exact input used to generate the message
               output: siwsOutput      // The standard SIWS output
          };
     }
}
```


# C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\BoothSync.js
```
var BoothSync = pc.createScript('boothSync');

// initialize code called once per entity
BoothSync.prototype.initialize = function() {
    console.log("BoothSync: Initializing...");
    this.room = null;
    // No need to store booth entities here, just fire events

    // Listen for connection events
    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
};

BoothSync.prototype.onConnected = function(room) {
    console.log("BoothSync: Received colyseus:connected event.");
    if (!room) {
        console.error("BoothSync: Cannot initialize listeners. Room object is missing.");
        return;
    }
    this.room = room;

    // --- Setup Booth State Listeners ---
    console.log("BoothSync: Setting up booth state listeners...");

    // Listen for new booths being added
    this.room.state.booths.onAdd((booth, boothId) => {
        console.log(`BoothSync: Booth added: ${boothId}, Claimed by: ${booth.claimedBy || 'None'}`);
        this.handleBoothUpdate(booth, boothId, true); // Fire initial add event

        // Listen for changes on this specific booth
        booth.onChange(() => {
            console.log(`BoothSync: Booth changed: ${boothId}, Claimed by: ${booth.claimedBy || 'None'}`);
            this.handleBoothUpdate(booth, boothId, false); // Fire update event
        });
    });

    // Listen for booths being removed
    this.room.state.booths.onRemove((booth, boothId) => {
        // Note: The 'booth' object passed here might be the state *before* removal.
        // We primarily care about the boothId for removal events.
        console.log(`BoothSync: Booth removed: ${boothId}`);
        this.handleBoothRemove(boothId);
    });

    // --- Initial Population ---
    // Process booths already in the room when we join
    console.log("BoothSync: Processing existing booths...");
    this.room.state.booths.forEach((booth, boothId) => {
        console.log(`BoothSync: Processing existing booth: ${boothId}`);
        this.handleBoothUpdate(booth, boothId, true); // Fire initial add event

        // Attach onChange listener for existing booths too
         booth.onChange(() => {
            console.log(`BoothSync: Existing Booth changed: ${boothId}, Claimed by: ${booth.claimedBy || 'None'}`);
            this.handleBoothUpdate(booth, boothId, false); // Fire update event
        });
    });

    console.log("BoothSync: Booth listeners initialized.");
};

BoothSync.prototype.onDisconnected = function(data) {
    console.log("BoothSync: Received colyseus:disconnected event.", data);
    this.room = null;
    // No specific cleanup needed here unless we were tracking booth entities
};

BoothSync.prototype.handleBoothUpdate = function(boothState, boothId, isInitialAdd) {
    // Extract relevant data from the booth state
    const boothData = {
        boothId: boothId,
        claimedBy: boothState.claimedBy,
        claimedByUsername: boothState.claimedByUsername, // Include username
        // Add any other relevant booth properties from the state here
        // e.g., boothName: boothState.boothName,
    };

    // Fire specific event for initial add, generic update otherwise
    const eventName = isInitialAdd ? 'booth:added' : 'booth:updated';
    this.app.fire(eventName, boothData);

    // Optional: Log the event being fired
    // console.log(`BoothSync: Fired event '${eventName}' for booth ${boothId}`);
};

BoothSync.prototype.handleBoothRemove = function(boothId) {
    // Fire event for other systems
    this.app.fire('booth:removed', { boothId: boothId });
    // Optional: Log the event being fired
    // console.log(`BoothSync: Fired event 'booth:removed' for booth ${boothId}`);
};

// swap method called for script hot-reloading
// BoothSync.prototype.swap = function(old) { };
```


# C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Player\CameraMovement.js
```
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

CameraMovement.prototype.initialize = function () {
    if (this.entity.camera) {
        this.entity.camera.farClip = this.farClip;
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
    
    // Cache player reference
    var localPlayer = this.app.root.findByName('LocalPlayer');
    
    if (localPlayer && localPlayer.script.playerMovement) {
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
        this.worldPosVelocity.scale(0.9); // Damping
        this.worldPosVelocity.add(displacement);
        
        // Apply velocity with smoothing
        currentWorldPos.add(this.worldPosVelocity.clone().scale(normalizedDt));
        this.entity.setPosition(currentWorldPos);
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
```


# C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\ConnectionManager.js
```
var ConnectionManager = pc.createScript('connectionManager');

ConnectionManager.attributes.add('servicesEntity', {
    type: 'entity',
    title: 'Services Entity',
    description: 'The entity holding core services like ConfigLoader.'
});

ConnectionManager.prototype.initialize = function() {
    console.log("ConnectionManager: Initializing...");
    this.room = null;

    if (!this.app.services) {
        console.error("ConnectionManager: Services registry not found!");
        return;
    }
    this.configLoader = this.app.services.get('configLoader');

    if (this.configLoader && this.configLoader.config) {
        this.connect();
    } else {
        console.log("ConnectionManager: Waiting for config:loaded event...");
        this.app.once('config:loaded', this.connect, this);
    }

    this.app.on('network:disconnect', this.disconnect, this);
};

ConnectionManager.prototype.connect = async function() {
    const colyseusEndpoint = this.configLoader.get('colyseusEndpoint');
    if (!colyseusEndpoint) {
        console.error("ConnectionManager: Colyseus endpoint not found in config!");
        this.app.fire('colyseus:connectionError', { message: 'Colyseus endpoint missing in configuration.' });
        return;
    }

    const initialUsername = localStorage.getItem('userName') || `Guest_${Math.random().toString(36).substring(2, 7)}`;
    console.log(`ConnectionManager: Attempting connection to ${colyseusEndpoint} as ${initialUsername}...`);
    this.app.fire('colyseus:connecting');

    try {
        if (typeof Colyseus === 'undefined' || !Colyseus.Client) {
            console.error("ConnectionManager: Colyseus client library (Colyseus) is not available on the window object. Make sure your bundle.js is loaded and has executed before this script.");
            throw new Error("Colyseus client library not found.");
        }

        const client = new Colyseus.Client(colyseusEndpoint);
        this.room = await client.joinOrCreate("my_room", { username: initialUsername });

        if (!this.room) {
            throw new Error("Failed to join or create room. Room object is null.");
        }

        console.log("ConnectionManager: Successfully joined room. Session ID:", this.room.sessionId);
        this.app.room = this.room; // Expose room globally
        this.setupRoomLifecycleListeners();

        this.app.fire("colyseus:connected", this.room);

    } catch (e) {
        console.error("ConnectionManager: Colyseus connection failed:", e);
        this.room = null;
        this.app.fire("colyseus:connectionError", { message: e.message || 'Unknown connection error.', error: e });
    }
};

ConnectionManager.prototype.disconnect = function() {
    if (this.room) {
        console.log("ConnectionManager: Leaving room...");
        this.room.leave();
    } else {
        console.log("ConnectionManager: Not connected, cannot disconnect.");
    }
};

ConnectionManager.prototype.setupRoomLifecycleListeners = function() {
    if (!this.room) return;

    this.room.onLeave((code) => {
        console.log("ConnectionManager: Left room. Code:", code);
        const wasConnected = !!this.room;
        this.room = null;
        this.app.room = null;
        if (wasConnected) {
            this.app.fire("colyseus:disconnected", { code: code });
        }
    });

    this.room.onError((code, message) => {
        console.error("ConnectionManager: Room error. Code:", code, "Message:", message);
        this.app.fire("colyseus:roomError", { code: code, message: message });
    });
};
```


# C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\MessageBroker.js
```
// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\MessageBroker.js
var MessageBroker = pc.createScript('messageBroker');

MessageBroker.prototype.initialize = function () {
    this.setupAppEventListeners();
    if (this.app.room) {
        this.setupRoomMessageListeners(this.app.room);
    } else {
        this.app.once('colyseus:connected', this.setupRoomMessageListeners, this);
    }
};

MessageBroker.prototype.setupRoomMessageListeners = function (room) {
    if (!room) return;
    room.onMessage("claimSuccess", (data) => this.app.fire('booth:claimSuccess', data));
    room.onMessage("claimError", (data) => this.app.fire('booth:claimError', data));
    // [!code ++]
    // Renamed to match server-side refactor
    room.onMessage("announceDonation", (data) => { 
        this.app.fire('effects:donation', { recipient: data.recipient, amount: data.amountSOL });
        this.app.fire('chat:newMessage', { type: 'system', content: `${data.senderUsername} donated ${data.amountSOL} SOL!` });
    });
    // [!code --]
    room.onMessage("chatMessage", (data) => {
        const senderName = data?.sender?.username || 'Unknown';
        this.app.fire('chat:newMessage', { type: 'user', sender: senderName, content: data.content });
    });
};

MessageBroker.prototype.setupAppEventListeners = function () {
    this.app.on("player:move", (data) => this.sendMessage("updatePosition", data));
    this.app.on('user:setname', (username) => this.sendMessage("setUsername", { username }));
    this.app.on('booth:claimRequest', (data) => this.sendMessage('claimBooth', data));
    this.app.on('network:send:chatMessage', (data) => this.sendMessage("chatMessage", data));
    // [!code ++]
    // Renamed to match server-side refactor
    this.app.on('network:send:announceDonation', (data) => this.sendMessage("announceDonation", data)); 
    // [!code --]
    this.app.on('network:send:updateAddress', (address) => this.sendMessage('updateAddress', { walletAddress: address }));
    
    // [!code ++]
    // FIX: Add the missing listener to handle the unclaim request on logout.
    this.app.on('network:send:unclaimBooth', () => this.sendMessage('unclaimBooth'));
    // [!code --]
};

MessageBroker.prototype.sendMessage = function(type, payload) {
    if (this.app.room && this.app.room.connection.isOpen) {
        this.app.room.send(type, payload);
    } else {
        console.warn(`MessageBroker: Cannot send '${type}', room not available or connection closed.`);
    }
};
```


# C:\Users\Epic\Documents\GitHub\pg-colyseus\src\rooms\MyRoom.ts
```
import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player, Booth } from "./schema/MyRoomState";

export class MyRoom extends Room<MyRoomState> {
   maxClients = 16;
   maxSpeed = 5; // Units per second
   updateRate = 0.3; // Seconds - Used for speed validation buffer

   onCreate(options: any) {
      console.log("MyRoom creating...");
      this.setState(new MyRoomState());

      // Initialize Booths
      const boothIds = Array.from({ length: 16 }, (_, i) => `stall${i + 1}`);
      boothIds.forEach((id) => {
         const booth = new Booth();
         booth.boothId = id;
         // booth.label = "Unclaimed"; // You might set label later or based on claimedBy
         this.state.booths.set(id, booth);
      });
      console.log(`Initialized ${this.state.booths.size} booths.`);

      // --- Player Position Update Handler ---
      this.onMessage("updatePosition", (client, data) => {
         const player = this.state.players.get(client.sessionId);
         if (!player) return;

         // Basic validation of incoming data
         if (
            typeof data?.x !== "number" ||
            typeof data?.y !== "number" ||
            typeof data?.z !== "number" ||
            typeof data?.rotation !== "number"
         ) {
            console.warn(
               `[SERVER] Invalid position data received from ${client.sessionId}`
            );
            return;
         }

         // --- Speed Validation ---
         const lastPos = { x: player.x, y: player.y, z: player.z };
         const currentTime = Date.now();
         const lastUpdate = player.lastUpdatePosition || currentTime; // Use current time if first update
         const elapsedTime = Math.max(0.01, (currentTime - lastUpdate) / 1000); // Ensure elapsedTime > 0 to avoid division by zero or weirdness
         player.lastUpdatePosition = currentTime;

         const distance = Math.sqrt(
            Math.pow(data.x - lastPos.x, 2) +
            Math.pow(data.y - lastPos.y, 2) +
            Math.pow(data.z - lastPos.z, 2)
         );

         // Allow distance based on elapsed time + a buffer related to update rate
         const allowedDistance =
            this.maxSpeed * (elapsedTime + this.updateRate * 0.5); // Generous buffer

         if (distance > allowedDistance) {
            console.warn(
               `[SERVER] Possible speed hack detected for ${client.sessionId} (${player.username
               }). Dist: ${distance.toFixed(2)}, Allowed: ${allowedDistance.toFixed(
                  2
               )}, Time: ${elapsedTime.toFixed(3)}s`
            );
            // Optional: Instead of rejecting, you could clamp the position or flag the user
            // For now, we reject the update by not setting the position
            return;
         }
         // --- End Speed Validation ---

         // Validation passed, update player state
         player.x = data.x;
         player.y = data.y; // Make sure your game uses Y correctly
         player.z = data.z;
         player.rotation = data.rotation;
         // Ensure animation directions are numbers, default to 0 if not provided
         player.xDirection =
            typeof data.xDirection === "number" ? data.xDirection : 0;
         player.zDirection =
            typeof data.zDirection === "number" ? data.zDirection : 0;
      });

      // --- Booth Claim Handler ---
      this.onMessage("claimBooth", (client, data) => {
         const player = this.state.players.get(client.sessionId);
         if (!player) {
            client.send("claimError", {
               boothId: data?.boothId,
               reason: "Player state not found.",
            });
            return;
         }
         const boothId = data?.boothId;
         if (typeof boothId !== "string") {
            client.send("claimError", {
               boothId: boothId,
               reason: "Invalid booth ID provided.",
            });
            return;
         }
         const booth = this.state.booths.get(boothId);

         if (!booth) {
            client.send("claimError", {
               boothId,
               reason: `Booth ${boothId} doesn't exist.`,
            });
            return;
         }
         if (!player.walletAddress || player.walletAddress === "") {
            client.send("claimError", {
               boothId,
               reason: "Please connect your wallet to claim a booth.",
            });
            return;
         }
         if (player.claimedBoothId && player.claimedBoothId !== "") {
            client.send("claimError", {
               boothId,
               reason: "You have already claimed a booth.",
            });
            return;
         }
         if (booth.claimedBy && booth.claimedBy !== "") {
            // Check if it's claimed by someone else
            if (booth.claimedBy !== player.walletAddress) {
               client.send("claimError", {
                  boothId,
                  reason: `Booth already claimed by ${booth.claimedBy.substring(
                     0,
                     6
                  )}...`,
               });
               return;
            }
            // If claimed by self already (shouldn't happen if player.claimedBoothId check works, but as safety)
            console.warn(
               `Player ${client.sessionId} tried to claim booth ${boothId} which they already claimed according to booth state.`
            );
            // Optionally send success anyway or just log
            client.send("claimSuccess", {
               boothId,
               claimedBy: player.walletAddress,
            }); // Tell client it's fine
            return;
         }

         // --- Claim successful ---
         console.log(
            `[SERVER] Booth ${boothId} claimed by ${player.username} (${client.sessionId}) with address ${player.walletAddress}`
         );
         booth.claimedBy = player.walletAddress; // Use wallet address as the unique claimant ID
         booth.claimedByUsername = player.username; // Set the username of the claimant
         player.claimedBoothId = boothId; // <<<--- ADDED: Update the player's state to record which booth they claimed
         // booth.label = player.username || player.walletAddress.substring(0, 6) + "..."; // Update label (optional)

         // Broadcast necessary info (state sync handles the actual state change)
         // You might send less data here if client relies purely on state sync
         this.broadcast(
            "claimSuccess",
            { boothId, claimedBy: player.walletAddress },
            {
               /* except: client */
            }
         ); // Broadcast so UI updates promptly everywhere
      });

      // --- Unclaim Booth Handler ---
      this.onMessage("unclaimBooth", (client) => {
         try {
            const player = this.state.players.get(client.sessionId);
            if (!player) return;
            const boothId = player.claimedBoothId;
            if (!boothId) return;
            const booth = this.state.booths.get(boothId);
            if (!booth) return;
            // Only unclaim if the booth is owned by the player's current walletAddress
            if (booth.claimedBy && player.walletAddress && booth.claimedBy === player.walletAddress) {
               console.log(`[SERVER] Unclaiming booth ${boothId} for player ${client.sessionId} due to unclaim request.`);
               booth.claimedBy = "";
               booth.claimedByUsername = "";
               player.claimedBoothId = "";
            }
         } catch (e) {
            console.warn(`[SERVER] unclaimBooth error:`, e);
         }
      });

      // --- Wallet Address Update Handler ---
      this.onMessage("updateAddress", (client, data) => {
         const player = this.state.players.get(client.sessionId);
         if (!player) {
            console.warn(
               `[SERVER] updateAddress: No player found for sessionId: ${client.sessionId}`
            );
            return;
         }
         const walletAddress = data?.walletAddress;
         // Basic validation for wallet address format (adapt if needed for your chain)
         if (typeof walletAddress !== "string" || walletAddress.length < 10) {
            // Example basic check
            console.warn(
               `[SERVER] updateAddress received invalid walletAddress '${walletAddress}' from ${player.username} (${client.sessionId})`
            );
            client.send("updateAddressError", {
               reason: "Invalid wallet address format provided.",
            }); // Inform client
            return;
         }

         // Check if address changed before logging/updating
         if (player.walletAddress !== walletAddress) {
            console.log(
               `[SERVER] Player ${player.username} (${client.sessionId}) walletAddress updated to: ${walletAddress}`
            );
            player.walletAddress = walletAddress;
            // State sync handles broadcasting this change to other clients
         } else {
            console.log(
               `[SERVER] Player ${player.username} (${client.sessionId}) sent same walletAddress: ${walletAddress}`
            );
         }
      });

      // --- Donation Confirmation Handler ---
      this.onMessage("donationConfirmed", (client, message) => {
         // Basic validation of incoming message structure
         if (
            !message ||
            typeof message.signature !== "string" ||
            typeof message.recipient !== "string" ||
            typeof message.donor !== "string" ||
            typeof message.amountSOL !== "number"
         ) {
            console.warn(
               `[SERVER] Invalid donationConfirmed message format from ${client.sessionId}:`,
               message
            );
            return;
         }

         const player = this.state.players.get(client.sessionId);
         const username = player?.username || "Unknown Donor";

         console.log(
            `[SERVER] Donation Confirmed by ${username} (${client.sessionId}):`
         );
         console.log(`  Signature: ${message.signature.substring(0, 10)}...`); // Log shortened sig
         console.log(`  Recipient Addr: ${message.recipient}`);
         console.log(`  Donor Addr: ${message.donor}`);
         console.log(`  Amount SOL: ${message.amountSOL}`);

         // TODO: Add server-side validation (e.g., check signature on-chain) if needed for security.

         // Broadcast the confirmation so clients can show effects/messages
         // Include sender username for context in chat/UI
         this.broadcast(
            "donationConfirmed",
            {
               signature: message.signature,
               recipient: message.recipient, // Booth owner's address
               sender: message.donor, // Donor's address
               senderUsername: username, // Donor's game username
               amountSOL: message.amountSOL,
               donorTwitter: message.donorTwitter || null,
               recipientTwitter: message.recipientTwitter || null,
            },
            {
               /* options */
            }
         );
      });



      // --- Chat Message Handler ---
      this.onMessage("chatMessage", (client, data) => {
         try {
            const player = this.state.players.get(client.sessionId);
            if (!player) {
               console.warn(
                  `[SERVER] Chat message from unknown client ${client.sessionId}`
               );
               return;
            }

            // // --- ADDED: Check if player has a real username ---
            // if (player.username.startsWith('Guest_')) {
            //     console.warn(`[SERVER] Guest user ${player.username} (${client.sessionId}) attempted to send chat message. Blocked.`);
            //     // Optionally send a message back to the client telling them why
            //     // client.send("chatError", { reason: "You must set a username to chat." });
            //     return;
            // }
            // // --- END ADDED ---

            const messageContent = data?.content?.trim();
            if (
               !messageContent ||
               typeof messageContent !== "string" ||
               messageContent.length === 0 ||
               messageContent.length > 100
            ) {
               console.warn(
                  `[SERVER] Invalid chat message from ${player.username} (${client.sessionId}):`,
                  data
               );
               return;
            }

            const username =
               player.username || `Guest_${client.sessionId.substring(0, 4)}`;

            const chatMessage = {
               sender: {
                  sessionId: client.sessionId,
                  username: username,
               },
               content: messageContent,
               timestamp: Date.now(),
            };

            this.broadcast("chatMessage", chatMessage);
            console.log(`[CHAT] ${username}: ${messageContent}`);
         } catch (error) {
            console.error(`[SERVER] Error handling chat message:`, error);
            // Don't disconnect client on chat errors
         }
      });

      // ======================================================
      // --- NEW/REVISED: Username Update Handler ---
      // ======================================================
      this.onMessage("setUsername", (client, message) => {
         const player = this.state.players.get(client.sessionId);
         if (!player) {
            console.warn(
               `[SERVER] setUsername: Player not found for client ${client.sessionId}`
            );
            return; // Ignore if player state doesn't exist yet
         }

         const newUsername = message?.username?.trim(); // Get username from message payload and trim whitespace

         // --- Validation ---
         if (
            !newUsername ||
            typeof newUsername !== "string" ||
            newUsername.length === 0
         ) {
            console.warn(
               `[SERVER] Invalid username received from ${client.sessionId}. Payload:`,
               message
            );
            // Optionally send an error back to the client
            // client.send("setUsernameError", { reason: "Username cannot be empty." });
            return;
         }

         // Limit length (example: 16 characters)
         const validatedUsername = newUsername.substring(0, 16);

         // Check if the username is actually changing
         if (player.username !== validatedUsername) {
            console.log(
               `[SERVER] Player ${client.sessionId} (${player.username}) updated username to: ${validatedUsername}`
            );
            player.username = validatedUsername;
            // State synchronization will automatically broadcast this change to all clients
            // because 'username' is a @type field in the Player schema.
            // No manual broadcast needed here.

            // If a player claimed a booth, potentially update the booth label (optional)
            if (player.claimedBoothId) {
               const booth = this.state.booths.get(player.claimedBoothId);
               if (booth /* && booth.claimedBy === player.walletAddress */) {
                  // Extra check if needed
                  // booth.label = validatedUsername; // Update label if you use it this way
               }
            }
         } else {
            console.log(
               `[SERVER] Player ${client.sessionId} sent same username: ${validatedUsername}`
            );
         }
      });
      // ======================================================
      // --- END Username Update Handler ---
      // ======================================================

      // --- Remove the old/temporary updateUsername handler ---
      // The block that started with this.onMessage("updateUsername", ...) should be deleted.

      console.log("MyRoom created successfully and message handlers set up.");
   } // End onCreate

   onJoin(client: Client, options: any) {
      // --- Extract and Validate Initial Username ---
      let initialUsername = options?.username?.trim();
      if (
         !initialUsername ||
         typeof initialUsername !== "string" ||
         initialUsername.length === 0
      ) {
         initialUsername = `Guest_${client.sessionId.substring(0, 4)}`; // Default guest name
      }
      // Limit length on join as well
      const validatedUsername = initialUsername.substring(0, 16);
      console.log(
         `[SERVER] Client ${client.sessionId} attempting to join with initial username: '${validatedUsername}' (Raw options: ${options?.username})`
      );

      // --- Create Player State ---
      const player = new Player();
      player.username = validatedUsername; // Use the validated initial username
      player.walletAddress = ""; // Starts empty, updated via "updateAddress" message
      player.claimedBoothId = ""; // Starts empty, updated via "claimBooth"

      // Set initial spawn position (your existing logic)
      player.x = Math.random() * 4 - 2;
      player.y = 2; // Ensure this matches your ground level + player height/2
      player.z = 13 + Math.random() * 4 - 2;
      player.rotation = 0; // Start facing forward initially

      player.lastUpdatePosition = Date.now(); // Initialize for speed check

      // Add player to the state
      this.state.players.set(client.sessionId, player);
      console.log(
         `[SERVER] Player ${validatedUsername} (${client.sessionId}) joined successfully. State created.`
      );
   } // End onJoin

   onLeave(client: Client, consented: boolean) {
      const player = this.state.players.get(client.sessionId);
      const username = player?.username || `Player ${client.sessionId}`;

      if (player) {
         console.log(
            `[SERVER] ${username} (${client.sessionId}) left. Consented: ${consented}`
         );

         // --- Release Claimed Booth ---
         if (player.claimedBoothId) {
            const booth = this.state.booths.get(player.claimedBoothId);
            if (booth && booth.claimedBy === player.walletAddress) {
               // Check ownership before releasing
               console.log(
                  `[SERVER] Releasing booth ${player.claimedBoothId} claimed by ${username}.`
               );
               booth.claimedBy = ""; // Mark as unclaimed
               booth.claimedByUsername = ""; // Clear the username
            } else if (booth) {
               console.warn(
                  `[SERVER] Player ${username} left, but booth ${player.claimedBoothId} was claimed by someone else (${booth.claimedBy}) or already released.`
               );
            }
            player.claimedBoothId = ""; // Clear on player state too
         }
         // --- End Release Booth ---

         // Remove player from state - triggers automatic broadcast via schema changes
         this.state.players.delete(client.sessionId);
         console.log(
            `[SERVER] Player state for ${username} (${client.sessionId}) removed.`
         );
      } else {
         console.log(
            `[SERVER] Client ${client.sessionId} left, but no player state was found.`
         );
      }
   } // End onLeave

   onDispose() {
      console.log("[SERVER] Room", this.roomId, "disposing...");
      // Add any specific cleanup logic here if needed before the room is destroyed
   } // End onDispose
} // End MyRoom class
```


# C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\NetworkManager.js
```
///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var NetworkManager = pc.createScript('networkManager');

NetworkManager.prototype.initialize = function () {
    console.log("NetworkManager: Initializing (will wait for connection)...");
    // this.playerEntities = {}; // Moved to PlayerSync.js
    this.room = null; // Store room reference when connected

    // Listen for the connection event from ConnectionManager
    this.app.once('colyseus:connected', this.onConnected, this);
    this.app.once('colyseus:disconnected', this.onDisconnected, this); // Listen for disconnects too

    // Setup app listeners that DON'T depend on the room immediately
    this.setupAppListeners();
};

// Called when ConnectionManager successfully connects
NetworkManager.prototype.onConnected = function(room) {
    console.log("NetworkManager: Received colyseus:connected event.");
    if (!room) {
        console.error("NetworkManager: Connected event received but room object is missing!");
        return;
    }
    this.room = room; // Store the room reference

    // Now setup listeners that depend on the room
    this.setupRoomListeners();
    // Note: App listeners that SEND messages might need checks like `if (this.room)`
};

// Called when ConnectionManager disconnects
NetworkManager.prototype.onDisconnected = function(data) {
    console.log("NetworkManager: Received colyseus:disconnected event.", data);
    this.room = null; // Clear room reference
    // Player entity cleanup is now handled by PlayerSync.js
    // if (this.app.localPlayer) {
    //    this.app.localPlayer = null; // PlayerSync handles this too
    // }
    // Remove room-specific listeners if necessary (though app.once might handle this)
    // e.g., this.app.off('player:move', ...); // If not using .once or if re-connection is possible
};

// Removed connectToColyseus function - Handled by ConnectionManager.js

// Function to encapsulate setting up room listeners
NetworkManager.prototype.setupRoomListeners = function() {
    // this.room is now guaranteed to be set by onConnected before this is called
    if (!this.room) {
         console.error("NetworkManager: setupRoomListeners called but room is not available. This shouldn't happen.");
         return;
     }
    console.log("NetworkManager: Setting up room listeners...");

    // --- Player State Listeners Removed ---
    // Handled by PlayerSync.js

    // --- Booth State Listeners Removed ---
    // Handled by BoothSync.js

    // --- Message Listeners Removed ---
    // Handled by MessageBroker.js


    // --- Room Lifecycle Listeners Removed ---
    // Handled by ConnectionManager.js

    // --- Initial Population ---
    // Process players already in the room when we join
    // Player initial population removed - Handled by PlayerSync.js
    // Booth initial population removed - Handled by BoothSync.js
};

// Function to setup app-level listeners that depend on the room
NetworkManager.prototype.setupAppListeners = function() {
    console.log("NetworkManager: Setting up app listeners...");
    // App listeners for sending messages removed.
    // MessageBroker.js now listens for these app events and sends the messages.
};


// --- Helper Functions (from original_project) ---

// Removed updateUsernameOnServer function.
// MessageBroker listens for 'user:setname' and sends the update.
// Removed onPlayerAdd - Handled by PlayerSync.js

// Removed onPlayerRemove - Handled by PlayerSync.js

// Removed updateRemotePlayer - Handled by PlayerSync.js
// Stray brace removed.

// Removed updateBoothDisplay - UI updates should be handled by dedicated UI/Booth controllers
// listening for events fired by BoothSync.js (e.g., 'booth:added', 'booth:updated', 'booth:removed').

// swap method called for script hot-reloading
// inherit your script state here
// NetworkManager.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/
```


# C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Player\PlayerData.js
```
// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Player\PlayerData.js
var PlayerData = pc.createScript('playerData');

PlayerData.prototype.initialize = function() {
    this.walletAddress = null;
    this.username = localStorage.getItem('userName') || "";
    this.claimedBoothId = "";

    this.app.on('auth:stateChanged', this.handleAuthStateChange, this);
    this.app.on('booth:claimSuccess', this.handleBoothClaimSuccess, this);
};

PlayerData.prototype.handleAuthStateChange = function(authStateData) {
    const newAddress = authStateData.address || null;

    if (this.walletAddress !== newAddress) {
        this.walletAddress = newAddress;
        if (this.walletAddress) {
            console.log(`PlayerData: Wallet address set to ${this.walletAddress}. Notifying server.`);
            this.app.fire('network:send:updateAddress', this.walletAddress);
        }
        this.app.fire('player:data:changed', this);
    }

    // FIX: When disconnecting, we must also clear the claimed booth ID from local state.
    if (authStateData.state === 'disconnected' && this.claimedBoothId) {
        console.log("PlayerData: Disconnected. Clearing local claimedBoothId.");
        this.claimedBoothId = "";
        this.app.fire('player:data:changed', this);
    }
};

PlayerData.prototype.handleBoothClaimSuccess = function(data) {
    if (data && data.claimedBy && data.boothId && data.claimedBy === this.walletAddress) {
        if (this.claimedBoothId !== data.boothId) {
            this.claimedBoothId = data.boothId;
            console.log(`PlayerData: Confirmed claim of booth ${this.claimedBoothId}.`);
            this.app.fire('player:data:changed', this);
        }
    }
};

// --- GETTERS ---
PlayerData.prototype.getWalletAddress = function() { return this.walletAddress; };
PlayerData.prototype.getUsername = function() { return this.username; };
PlayerData.prototype.getClaimedBoothId = function() { return this.claimedBoothId; };
```


# C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Player\PlayerMovement.js
```
///<reference path="c:\Users\Epic\.vscode-insiders\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts"
var PlayerMovement = pc.createScript('playerMovement');

PlayerMovement.attributes.add('speed', { type: 'number', default: 0.09 });
PlayerMovement.attributes.add('joystickId', { type: 'string', default: 'joystick0' }); // Joystick ID for movement
PlayerMovement.attributes.add('interactButtonId', { type: 'string', default: 'interactButton' }); // Button ID for interact (E key)

function normalizeAngle(angle) {
    let newAngle = angle % 360;
    if (newAngle < 0) newAngle += 360;
    return newAngle;
}

PlayerMovement.prototype.initialize = function () {
    if (this.entity.name !== "LocalPlayer") {
        this.enabled = false;
        return;
    }

    var camera = this.entity.findByName("Camera Axis");
    this.cameraScript = camera.script.cameraMovement;

    this.lastReportedPos = this.entity.getPosition().clone();
    this.updateInterval = 0.2;
    this.timeSinceLastUpdate = 0;

    this.isMobile = pc.platform.touch;
    this.movementJoystickEntity = pc.app.root.findByName('MovementJoystick');
    this.touchJoypadScreenEntity = pc.app.root.findByName('TouchJoypadScreen');

    if (this.isMobile && this.touchJoypadScreenEntity) {
        this.touchJoypadScreenEntity.enabled = true;
    } else if (!this.isMobile && this.touchJoypadScreenEntity) {
        this.touchJoypadScreenEntity.enabled = false;
    }

    if (this.isMobile && this.movementJoystickEntity) {
        this.movementJoystickEntity.enabled = true;
    } else if (!this.isMobile && this.movementJoystickEntity) {
        this.movementJoystickEntity.enabled = false;
    }

    // --- ADDED: Initialize movement state and listeners ---
    this.playerMovementEnabled = true;
    this.app.on('ui:chat:focus', this.disableMovement, this);
    this.app.on('ui:chat:blur', this.enableMovement, this);
    this.app.on('tutorial:active', this.onTutorialActive, this);
    // --- END ADDED ---
};

PlayerMovement.prototype.disableMovement = function() {
    this.playerMovementEnabled = false;
};

PlayerMovement.prototype.enableMovement = function() {
    this.playerMovementEnabled = true;
};

PlayerMovement.prototype.onTutorialActive = function(isActive) {
    if (isActive) {
        this.disableMovement();
    } else {
        this.enableMovement();
    }
};

PlayerMovement.worldDirection = new pc.Vec3();
PlayerMovement.tempDirection = new pc.Vec3();

// Add tracking for current input values
PlayerMovement.prototype.currentInputX = 0;
PlayerMovement.prototype.currentInputZ = 0;

PlayerMovement.prototype.update = function (dt) {
    if (window.isChatActive || !this.playerMovementEnabled) return;

    if (this.entity.name !== "LocalPlayer") return;

    var app = this.app;

    this.currentInputX = 0;
    this.currentInputZ = 0;
    
    if (this.isMobile) {
        if (window.touchJoypad && window.touchJoypad.sticks && window.touchJoypad.sticks[this.joystickId]) {
            const joystick = window.touchJoypad.sticks[this.joystickId];
            this.currentInputX = joystick.x;
            this.currentInputZ = joystick.y;
        }
    } else {
        if (app.keyboard.isPressed(pc.KEY_A)) this.currentInputX -= 1;
        if (app.keyboard.isPressed(pc.KEY_D)) this.currentInputX += 1;
        if (app.keyboard.isPressed(pc.KEY_W)) this.currentInputZ += 1;
        if (app.keyboard.isPressed(pc.KEY_S)) this.currentInputZ -= 1;
    }

    // Get camera yaw and normalize it
    var yaw = this.cameraScript.yaw;
    yaw = normalizeAngle(yaw);
    var yawRad = yaw * pc.math.DEG_TO_RAD;

    // Calculate movement directions based on camera orientation
    var forward = new pc.Vec3(-Math.sin(yawRad), 0, -Math.cos(yawRad));
    var right = new pc.Vec3(Math.cos(yawRad), 0, -Math.sin(yawRad));

    // Combine movement input
    var move = new pc.Vec3();
    move.add(forward.scale(this.currentInputZ));
    move.add(right.scale(this.currentInputX));
    
    // Normalize movement vector if there's any input
    if (move.length() > 0) {
        move.normalize();
        
        // Only update rotation when actually moving
        var targetRot = new pc.Quat().setFromEulerAngles(0, yaw, 0);
        var currentRot = this.entity.getRotation();
        currentRot.slerp(currentRot, targetRot, 0.15); // Smooth rotation
        this.entity.setRotation(currentRot);
    }

    // Update position
    var newPos = this.entity.getPosition().clone();
    newPos.add(move.scale(this.speed * dt));

    this.entity.rigidbody.teleport(newPos);

    if (this.currentInputX !== 0 || this.currentInputZ !== 0) {
        if (this.entity.anim) {
            this.entity.anim.setFloat('xDirection', this.currentInputX);
            this.entity.anim.setFloat('zDirection', this.currentInputZ);
        }
    } else {
        if (this.entity.anim) {
            this.entity.anim.setFloat('xDirection', 0);
            this.entity.anim.setFloat('zDirection', 0);
        }
    }

    this.timeSinceLastUpdate += dt;
    var currentPos = this.entity.getPosition();
    var dist = currentPos.distance(this.lastReportedPos);

    if (dist > 0.01 || this.timeSinceLastUpdate >= this.updateInterval) {
        var rotation = yaw;
        this.app.fire("player:move", {
            x: currentPos.x,
            y: currentPos.y,
            z: currentPos.z,
            rotation: normalizeAngle(rotation),
            xDirection: this.currentInputX,
            zDirection: this.currentInputZ
        });
        this.lastReportedPos.copy(currentPos);
        this.timeSinceLastUpdate = 0;
    }

    if (this.isMobile) {
        if (window.touchJoypad && window.touchJoypad.buttons && window.touchJoypad.buttons.wasPressed(this.interactButtonId)) {
            this.simulateEKeyPress();
        }
    } else {
        if (app.keyboard.wasPressed(pc.KEY_E)) {
            this.simulateEKeyPress();
        }
    }
};

PlayerMovement.prototype.simulateEKeyPress = function () {
    this.app.fire('interact:keypress');
};
```


# C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\PlayerSync.js
```
// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Network\PlayerSync.js
var PlayerSync = pc.createScript('playerSync');

PlayerSync.attributes.add('playerPrefab', {
    type: 'asset',
    assetType: 'template',
    title: 'Player Prefab'
});

PlayerSync.prototype.initialize = function() {
    console.log("PlayerSync: Initializing script.");
    this.playerEntities = {};
    this.room = null;
    this.localSessionId = null;
    this.app.on('colyseus:connected', this.onConnected, this);
    this.app.on('colyseus:disconnected', this.onDisconnected, this);
    console.log("PlayerSync: Event listeners for 'colyseus:connected' and 'colyseus:disconnected' registered.");
};

PlayerSync.prototype.onConnected = function(room) {
    console.log("PlayerSync: 'colyseus:connected' event received.");
    if (!room) {
        console.error("PlayerSync: Room object is null or undefined.");
        return;
    }
    if (!this.playerPrefab) {
        console.error("PlayerSync: Player Prefab asset is not assigned in the editor.");
        return;
    }
    if (!this.playerPrefab.resource) {
        console.error("PlayerSync: Player Prefab resource has not been loaded.");
        return;
    }
    this.room = room;
    this.localSessionId = room.sessionId;

    this.room.state.players.onAdd((playerState, sessionId) => {
        console.log(`PlayerSync: onAdd event for session ID: ${sessionId}`, playerState);
        this.spawnPlayer(playerState, sessionId);
        playerState.onChange(() => this.handlePlayerChange(playerState, sessionId));
    });

    this.room.state.players.onRemove((playerState, sessionId) => {
        this.removePlayer(sessionId);
    });

    this.room.state.players.forEach((playerState, sessionId) => {
        this.spawnPlayer(playerState, sessionId);
        playerState.onChange(() => this.handlePlayerChange(playerState, sessionId));
    });
};

PlayerSync.prototype.onDisconnected = function(data) {
    for (const sessionId in this.playerEntities) {
        this.removePlayer(sessionId);
    }
    this.playerEntities = {};
    if (this.app.localPlayer) this.app.localPlayer = null;
    this.room = null;
    this.localSessionId = null;
};

PlayerSync.prototype.spawnPlayer = function(playerState, sessionId) {
    console.log(`PlayerSync: Spawning player for session ID: ${sessionId}`);
    if (this.playerEntities[sessionId]) {
        console.warn(`PlayerSync: Player entity for session ID ${sessionId} already exists. Aborting spawn.`);
        return;
    }
    
    const isLocalPlayer = (sessionId === this.localSessionId);
    const playerEntity = this.playerPrefab.resource.instantiate();
    playerEntity.name = isLocalPlayer ? "LocalPlayer" : sessionId;

    const camera = playerEntity.findByName("PlayerCamera");
    if (camera) camera.enabled = isLocalPlayer;
    
    const movementScript = playerEntity.script?.playerMovement;
    if (movementScript) movementScript.enabled = isLocalPlayer;

    if (isLocalPlayer) {
        this.app.localPlayer = playerEntity;
        if (!playerEntity.script?.playerData) {
            console.warn("PlayerSync: PlayerData script not found on LocalPlayer prefab.");
        }
    } else {
        if (playerEntity.script?.playerData) playerEntity.script.playerData.enabled = false;
    }

    playerEntity.enabled = true;
    playerEntity.setPosition(playerState.x, playerState.y, playerState.z);
    playerEntity.setEulerAngles(0, playerState.rotation, 0);
    console.log(`PlayerSync: Spawning player at position: (${playerState.x}, ${playerState.y}, ${playerState.z})`);
    this.app.root.addChild(playerEntity);
    this.playerEntities[sessionId] = playerEntity;
    this.updateNameplate(playerEntity, playerState.username);
    this.app.fire('player:spawned', { entity: playerEntity, isLocal: isLocalPlayer });
};

PlayerSync.prototype.removePlayer = function(sessionId) {
    const entity = this.playerEntities[sessionId];
    if (entity) {
        entity.destroy();
        delete this.playerEntities[sessionId];
        if (this.app.localPlayer === entity) this.app.localPlayer = null;
        this.app.fire('player:removed', { sessionId: sessionId });
    }
};

PlayerSync.prototype.handlePlayerChange = function(playerState, sessionId) {
    const entity = this.playerEntities[sessionId];
    if (!entity) return;

    if (sessionId === this.localSessionId) {
        const playerData = entity.script?.playerData;
        if (playerData && playerState.hasOwnProperty('username') && playerData.username !== playerState.username) {
            this.app.fire('player:data:update', { username: playerState.username });
        }
    } else {
        this.updateRemotePlayerVisuals(entity, playerState);
        if (playerState.username && entity.username !== playerState.username) {
            entity.username = playerState.username;
            this.updateNameplate(entity, playerState.username);
        }
    }
};

PlayerSync.prototype.updateRemotePlayerVisuals = function(entity, playerState) {
    const targetPos = new pc.Vec3(playerState.x, playerState.y, playerState.z);
    entity.setPosition(entity.getPosition().lerp(targetPos, 0.3));

    const targetRot = new pc.Quat().setFromEulerAngles(0, playerState.rotation, 0);
    entity.setRotation(entity.getRotation().slerp(targetRot, 0.3));

    if (entity.anim) {
        if (playerState.hasOwnProperty('xDirection')) entity.anim.setFloat('xDirection', playerState.xDirection);
        if (playerState.hasOwnProperty('zDirection')) entity.anim.setFloat('zDirection', playerState.zDirection);
    }
};

PlayerSync.prototype.updateNameplate = function(playerEntity, username) {
    const nameplate = playerEntity.findByName("NameplateText");
    if (nameplate?.element) {
        nameplate.element.text = username || "";
    }
};
```


# C:\Users\Epic\Documents\GitHub\pg-colyseus\src\rooms\schema\MyRoomState.ts
```
// MyRoomState.ts
import { MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") z: number = 0;
    @type("number") rotation: number = 0;
    @type("string") username: string = "";
    @type("string") walletAddress: string = "";
    @type("string") claimedBoothId: string = "";
    @type("number") lastUpdatePosition: number = 0;
    // Animation parameters
    @type("number") xDirection: number = 0;
    @type("number") zDirection: number = 0;
}
export class Booth extends Schema {
    @type("string") boothId: string = ""; // The unique identifier for the booth.
    @type("string") claimedBy: string = ""; // Empty string means unclaimed.
    @type("string") claimedByUsername: string = ""; // The username of the player who claimed the booth.
    @type("string") label: string = ""; // The text to display on the booth.
}

export class MyRoomState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: Booth }) booths = new MapSchema<Booth>();
}
```


