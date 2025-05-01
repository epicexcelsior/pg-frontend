// Scripts/UI/WalletDisplay.js
var WalletDisplay = pc.createScript("walletDisplay");

// --- Attributes ---
WalletDisplay.attributes.add("servicesEntity", {
  type: "entity",
  title: "Services Entity",
  description: "The entity with the AuthService script.",
});
WalletDisplay.attributes.add("walletAddressTextEntity", {
  type: "entity",
  title: "Wallet Address Text Entity",
  description: "The Text Element entity to display the wallet address.",
});
WalletDisplay.attributes.add("walletBalanceTextEntity", {
  type: "entity",
  title: "Wallet Balance Text Entity",
  description: "The Text Element entity to display the wallet balance.",
});
WalletDisplay.attributes.add("connectButtonEntity", {
  type: "entity",
  title: "Connect/Disconnect Button Entity",
  description:
    "The Button Element entity used for connecting and disconnecting.",
});
// Optional: Add disconnect button attribute if you have a separate one
// WalletDisplay.attributes.add('disconnectButtonEntity', { type: 'entity', title: 'Disconnect Button Entity' });

// --- Initialize ---
WalletDisplay.prototype.initialize = function () {
  console.log("WalletDisplay initializing...");
  this.authService = null;
  this.solanaConnection = null;

  // Get AuthService instance
  if (this.servicesEntity?.script?.authService) {
    this.authService = this.servicesEntity.script.authService;
  } else if (this.app.services?.get) {
    // Fallback to registry
    this.authService = this.app.services.get("authService");
    if (this.authService)
      console.warn(
        "WalletDisplay: Using app.services fallback to get AuthService."
      );
  }

  if (!this.authService) {
    console.error(
      "WalletDisplay: AuthService instance not found. UI will not function correctly."
    );
    // Disable button if service is missing
    if (this.connectButtonEntity?.button)
      this.connectButtonEntity.button.enabled = false;
    return; // Stop initialization if service is missing
  }

  // Find UI elements
  this.addressTextElement = this.walletAddressTextEntity?.element;
  this.balanceTextElement = this.walletBalanceTextEntity?.element;
  this.connectButton = this.connectButtonEntity?.button;
  // Attempt to find a child Text element for the button label
  this.connectButtonTextElement =
    this.connectButtonEntity?.findByName("Text")?.element;

  // Validate UI elements
  if (!this.addressTextElement)
    console.warn(
      "WalletDisplay: Wallet Address Text Entity or Element component not found."
    );
  if (!this.balanceTextElement)
    console.warn(
      "WalletDisplay: Wallet Balance Text Entity or Element component not found."
    );
  if (!this.connectButton)
    console.warn(
      "WalletDisplay: Connect Button Entity or Button component not found."
    );
  if (!this.connectButtonTextElement)
    console.warn(
      "WalletDisplay: Text element child of Connect Button not found (needed for label changes)."
    );

  // Add button listeners
  if (this.connectButton) {
    this.connectButton.on("click", this.onConnectClick, this);
  }
  // Add listener for separate disconnect button if attribute exists

  // Listen to AuthService events
  this.app.on("auth:stateChanged", this.onAuthStateChanged, this);

  // Setup Solana connection for balance checks (needs config)
  this.setupSolanaConnection();

  // Initial UI update based on current auth state
  this.updateDisplay();

  console.log("WalletDisplay initialized.");
};

// --- Solana Connection Setup ---
WalletDisplay.prototype.setupSolanaConnection = function () {
  // Check if config and SDK are ready
  if (this.app.config && window.SolanaSDK?.web3) {
    const rpcEndpoint = this.app.config.get("solanaRpcEndpoint");
    if (rpcEndpoint) {
      try {
        // Use 'confirmed' for balance checks, 'processed' might be too optimistic
        this.solanaConnection = new window.SolanaSDK.web3.Connection(
          rpcEndpoint,
          "confirmed"
        );
        console.log(
          "WalletDisplay: Solana connection setup for balance checks using:",
          rpcEndpoint
        );
      } catch (e) {
        console.error("WalletDisplay: Failed to create Solana connection:", e);
        this.solanaConnection = null; // Ensure it's null on error
      }
    } else {
      console.error("WalletDisplay: solanaRpcEndpoint not found in config.");
    }
  } else {
    console.warn(
      "WalletDisplay: ConfigLoader or Solana SDK not ready during initial connection setup."
    );
    // Optionally listen for config:loaded if it might load later
    this.app.once("config:loaded", this.setupSolanaConnection, this);
  }
};

// --- Event Handlers ---
WalletDisplay.prototype.onConnectClick = function () {
  if (!this.authService) {
    console.error(
      "WalletDisplay: AuthService not available for connect click."
    );
    return;
  }

  const state = this.authService.getState();

  if (state === "connected") {
    // If button is clicked while connected, treat as logout request
    console.log("WalletDisplay: Disconnect/Logout requested via button.");
    this.app.fire("auth:logout:request"); // Fire event for AuthService to handle
  } else if (state === "disconnected" || state === "error") {
    // If disconnected or error, attempt connection
    console.log("WalletDisplay: Connect requested via button.");
    this.authService.connectWalletFlow(); // AuthService handles the flow and state changes
  } else {
    // If connecting/verifying, button should ideally be disabled, but handle defensively
    console.log("WalletDisplay: Connect button clicked while in state:", state);
  }
};

WalletDisplay.prototype.onAuthStateChanged = function (data) {
  console.log("WalletDisplay: Received auth:stateChanged event:", data);
  // Update UI whenever the auth state changes
  this.updateDisplay();
};

// --- UI Update Logic ---
WalletDisplay.prototype.updateDisplay = function () {
  if (!this.authService) {
    // Handle case where service failed to initialize
    if (this.addressTextElement)
      this.addressTextElement.text = "Auth Service Error";
    if (this.balanceTextElement) this.balanceTextElement.text = "";
    if (this.connectButtonTextElement)
      this.connectButtonTextElement.text = "Error";
    if (this.connectButton) this.connectButton.enabled = false;
    return;
  }

  const state = this.authService.getState();
  const address = this.authService.getWalletAddress();
  const error = this.authService.getLastError();

  let connectButtonText = "Connect";
  let connectButtonEnabled = true;
  let addressText = "Not Connected";
  let balanceText = ""; // Clear balance initially, fetched async

  switch (state) {
    case "connecting_wallet":
    case "fetching_siws":
    case "signing_siws":
    case "verifying_siws":
      addressText = "Connecting...";
      connectButtonText = "Connecting...";
      connectButtonEnabled = false; // Disable button during process
      break;
    case "connected":
      addressText = this.formatAddress(address);
      connectButtonText = "Disconnect"; // Change button text to reflect action
      connectButtonEnabled = true;
      this.fetchAndUpdateBalance(address); // Fetch balance now that we are connected
      break;
    case "disconnected":
      addressText = "Not Connected";
      connectButtonText = "Connect";
      connectButtonEnabled = true;
      break;
    case "error":
      // Keep address text showing the error for feedback
      addressText = `Error: ${this.formatError(error)}`;
      connectButtonText = "Retry Connect"; // Allow user to retry
      connectButtonEnabled = true;
      break;
    default:
      addressText = "Unknown State";
      connectButtonText = "Error";
      connectButtonEnabled = false; // Disable button in unknown state
  }

  // Update UI Elements
  if (this.addressTextElement) {
    this.addressTextElement.text = addressText;
  }
  if (this.balanceTextElement) {
    // Only clear balance text here; it's updated asynchronously by fetchAndUpdateBalance
    if (state !== "connected") {
      this.balanceTextElement.text = ""; // Clear if not connected
    }
  }
  if (this.connectButtonTextElement) {
    this.connectButtonTextElement.text = connectButtonText;
  }
  if (this.connectButton) {
    // Ensure button component itself is enabled/disabled
    this.connectButtonEntity.enabled = connectButtonEnabled;
  }
};

// --- Balance Fetching ---
WalletDisplay.prototype.fetchAndUpdateBalance = async function (address) {
  // Ensure we have a connection and a valid address
  if (!this.solanaConnection) {
    console.warn(
      "WalletDisplay: Cannot fetch balance, Solana connection not available."
    );
    if (this.balanceTextElement)
      this.balanceTextElement.text = "Balance: N/A (RPC)";
    return;
  }
  if (!address) {
    console.warn("WalletDisplay: Cannot fetch balance, address is missing.");
    if (this.balanceTextElement) this.balanceTextElement.text = ""; // Clear if no address
    return;
  }

  // Indicate fetching state
  if (this.balanceTextElement)
    this.balanceTextElement.text = "Balance: Fetching...";

  try {
    const publicKey = new window.SolanaSDK.web3.PublicKey(address);
    const balanceLamports = await this.solanaConnection.getBalance(publicKey);
    // Use the constant for lamports per SOL for clarity and future-proofing
    const balanceSOL = balanceLamports / window.SolanaSDK.web3.LAMPORTS_PER_SOL;

    if (this.balanceTextElement) {
      // IMPORTANT: Check if still connected to the *same address* before updating UI
      // This prevents race conditions if the user disconnects/reconnects quickly
      if (
        this.authService &&
        this.authService.isAuthenticated() &&
        this.authService.getWalletAddress() === address
      ) {
        this.balanceTextElement.text = `Balance: ${balanceSOL.toFixed(4)} SOL`;
      } else {
        console.log(
          "WalletDisplay: Auth state or address changed during balance fetch, discarding result."
        );
        this.balanceTextElement.text = ""; // Clear if state changed
      }
    }
  } catch (error) {
    console.error("WalletDisplay: Failed to fetch balance:", error);
    if (this.balanceTextElement) {
      // Check if still connected before showing error
      if (
        this.authService &&
        this.authService.isAuthenticated() &&
        this.authService.getWalletAddress() === address
      ) {
        this.balanceTextElement.text = "Balance: Error";
      } else {
        this.balanceTextElement.text = ""; // Clear if state changed
      }
    }
  }
};

// --- Utility Functions ---
WalletDisplay.prototype.formatAddress = function (address) {
  if (!address || typeof address !== "string" || address.length < 8)
    return "Invalid Address";
  // Shorten address for display: e.g., 1234...abcd
  return `${address.substring(0, 4)}...${address.substring(
    address.length - 4
  )}`;
};

WalletDisplay.prototype.formatError = function (errorMsg) {
  if (!errorMsg) return "Unknown Error";
  // Provide user-friendly messages for common errors
  if (errorMsg.includes("User rejected")) return "Connection Cancelled";
  if (errorMsg.includes("Wallet not found")) return "Wallet Not Found";
  if (errorMsg.includes("Verification failed"))
    return "Auth Verification Failed";
  if (errorMsg.includes("Configuration error")) return "Config Error";
  // Limit length for display
  return errorMsg.length > 30 ? errorMsg.substring(0, 27) + "..." : errorMsg;
};

// swap method called for script hot-reloading
// inherit your script state here
// WalletDisplay.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/
