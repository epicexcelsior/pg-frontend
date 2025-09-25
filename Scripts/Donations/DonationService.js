// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\Donations\DonationService.js
var DonationService = pc.createScript("donationService");

const DonationState = {
    IDLE: "idle",
    VALIDATING_INPUT: "validating_input",
    BUILDING_TRANSACTION: "building_transaction",
    AWAITING_SIGNATURE: "awaiting_signature",
    AWAITING_MOBILE_PAYMENT: "awaiting_mobile_payment",
    POLLING_SOLANAPAY_TX: "polling_solanapay_tx",
    SUCCESS: "success",
    FAILED: "failed",
    FAILED_VALIDATION: "failed_validation",
    FAILED_BUILD: "failed_build",
    FAILED_SIGNING: "failed_signing",
    FAILED_CONFIRMATION: "failed_confirmation",
};

DonationService.prototype.initialize = function () {
    console.log("DonationService initializing...");
    this.state = DonationState.IDLE;
    this.isDonationInProgress = false;
    this.pollingTimeout = null;

    // Get services from the global registry
    this.privyManager = this.app.services.get("privyManager");
    this.feedbackService = this.app.services.get("feedbackService");
    this.configLoader = this.app.services.get("configLoader");
    this.messageBroker = this.app.services.get("messageBroker"); // For sending success message

    this.feeRecipient = this.configLoader.get("donationFeeRecipientAddress");
    this.feePercentage = this.configLoader.get("donationFeePercentage");
    this.heliusRpcUrl = this.configLoader.get("heliusRpcUrl");

    // Listen for UI events
    this.app.on("ui:donate:request", this.initiateDonation, this);
    this.app.on("solanapay:poll", this.pollForSolanaPayTransaction, this);
    this.app.on("solanapay:poll:stop", this.stopPolling, this);

    console.log("DonationService initialized.");
};

DonationService.prototype.setState = function (newState, data = {}) {
    this.state = newState;
    console.log(`DonationService: State changed to ${newState}`, data);

    const { error, signature } = data;

    // Use FeedbackService to show toasts/modals to the user
    switch (newState) {
        case DonationState.AWAITING_SIGNATURE:
            this.feedbackService?.showInfo("Please approve the transaction in the Privy popup.", 10000);
            break;
        case DonationState.SUCCESS:
            this.feedbackService?.showSuccess(`Donation successful! Tx: ${signature.substring(0, 8)}...`);
            this.isDonationInProgress = false;
            break;
        case DonationState.FAILED_SIGNING:
            this.feedbackService?.showError("Transaction Cancelled", error?.message || "The signing request was rejected.", false);
            this.isDonationInProgress = false;
            break;
        case DonationState.FAILED:
        case DonationState.FAILED_BUILD:
        case DonationState.FAILED_VALIDATION:
            this.feedbackService?.showError("Donation Error", error?.message || "An unknown error occurred.", true);
            this.isDonationInProgress = false;
            break;
    }

    this.app.fire("donation:stateChanged", { state: newState, ...data });
};

DonationService.prototype.initiateDonation = async function (data) {
    const { amount, recipient, isSolanaPay } = data;

    if (isSolanaPay) {
        this.handleSolanaPayDonation(amount, recipient);
        return;
    }

    if (this.isDonationInProgress) {
        this.feedbackService?.showWarning("A donation is already in progress.");
        return;
    }

    this.isDonationInProgress = true;
    this.setState(DonationState.VALIDATING_INPUT);

    try {
        if (typeof amount !== 'number' || amount <= 0) {
            throw new Error("Invalid donation amount.");
        }
        if (!recipient) {
            throw new Error("Recipient address is missing.");
        }
        
        const senderAddress = this.privyManager.getWalletAddress();
        if (!senderAddress) {
            this.privyManager.login(); // Prompt login if not authenticated
            throw new Error("Please log in to make a donation.");
        }

        // --- Client-Side Transaction Building ---
        this.setState(DonationState.BUILDING_TRANSACTION);

        const { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } = window.SolanaSDK.web3;

        const feeAmount = amount * (this.feePercentage / 100);
        const recipientAmount = amount - feeAmount;

        const transaction = new Transaction();
        const senderPubkey = new PublicKey(senderAddress);
        
        // Add instruction for the main recipient
        transaction.add(SystemProgram.transfer({
            fromPubkey: senderPubkey,
            toPubkey: new PublicKey(recipient),
            lamports: Math.floor(recipientAmount * LAMPORTS_PER_SOL),
        }));
        
        // Add instruction for the fee recipient
        transaction.add(SystemProgram.transfer({
            fromPubkey: senderPubkey,
            toPubkey: new PublicKey(this.feeRecipient),
            lamports: Math.floor(feeAmount * LAMPORTS_PER_SOL),
        }));

        const connection = new Connection(this.heliusRpcUrl, 'confirmed');
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderPubkey;
        
        // Serialize and encode the transaction for the popup
        const serializedTx = transaction.serialize({ requireAllSignatures: false });
        const base64Tx = Buffer.from(serializedTx).toString('base64');

        // --- Hand off to Privy for Signing ---
        this.setState(DonationState.AWAITING_SIGNATURE);
        const result = await this.privyManager.sendTransaction(base64Tx);

        if (!result || !result.signature) {
             throw new Error("Transaction failed or signature was not returned.");
        }
        
        const finalSignature = result.signature; // This should already be a base58 string from Privy, but if it's base64, decode it
        
        // --- Success ---
        this.setState(DonationState.SUCCESS, { signature: finalSignature });

        // Announce the donation to the server for in-game effects
        this.app.fire('network:send:announceDonation', { 
            signature: finalSignature,
            recipient: recipient,
            amountSOL: amount
        });

    } catch (error) {
        console.error("DonationService Error:", error);
        const state = this.state === DonationState.AWAITING_SIGNATURE ? DonationState.FAILED_SIGNING : DonationState.FAILED_BUILD;
        this.setState(state, { error });
    } finally {
        this.isDonationInProgress = false;
    }
};

// --- Solana Pay and Polling Logic (Largely Unchanged) ---

DonationService.prototype.handleSolanaPayDonation = function (amount, recipient) {
    this.isDonationInProgress = true;
    this.setState(DonationState.VALIDATING_INPUT);

    const { Keypair } = window.SolanaSDK.web3;
    const reference = new Keypair();
    const referencePublicKey = reference.publicKey.toBase58();

    const label = "Donation to Booth Owner";
    const message = `Donation of ${amount} SOL to ${recipient.substring(0, 4)}... via PlsGive`;
    const url = `solana:${recipient}?amount=${amount}&reference=${referencePublicKey}&label=${encodeURIComponent(label)}&message=${encodeURIComponent(message)}`;

    window.QRCode.toDataURL(url, { width: 220, margin: 1 }, (err, dataUrl) => {
        if (err) {
            this.setState(DonationState.FAILED_BUILD, { error: new Error("Failed to generate QR code.") });
            return;
        }
        this.app.fire("donation:showQR", { qrDataUrl: dataUrl, solanaPayUrl: url, reference: reference.publicKey.toBase58() });
        this.setState(DonationState.AWAITING_MOBILE_PAYMENT);
    });
};

DonationService.prototype.pollForSolanaPayTransaction = async function (data) {
    if (this.state === DonationState.POLLING_SOLANAPAY_TX) return;
    this.setState(DonationState.POLLING_SOLANAPAY_TX);

    const connection = new Connection(this.heliusRpcUrl, 'confirmed');
    const referencePublicKey = new window.SolanaSDK.web3.PublicKey(data.reference);
    const maxPolls = 60; // 3 minutes
    let pollCount = 0;

    const executePoll = async () => {
        if (pollCount >= maxPolls) {
            this.stopPolling();
            this.setState(DonationState.FAILED_CONFIRMATION, { error: new Error("Donation not found in time.") });
            return;
        }
        try {
            const signatures = await connection.getSignaturesForAddress(referencePublicKey, { limit: 1 }, 'confirmed');
            if (signatures && signatures.length > 0 && signatures[0].signature) {
                const signature = signatures[0].signature;
                this.setState(DonationState.SUCCESS, { signature });
                this.app.fire('network:send:announceDonation', { signature, recipient: data.recipient, amountSOL: data.amount });
                this.stopPolling();
                return;
            }
        } catch (error) {
            console.error("Polling error:", error);
        }
        pollCount++;
        this.pollingTimeout = setTimeout(executePoll, 3000);
    };
    executePoll();
};

DonationService.prototype.stopPolling = function () {
    if (this.pollingTimeout) {
        clearTimeout(this.pollingTimeout);
        this.pollingTimeout = null;
    }
    if (this.state === DonationState.POLLING_SOLANAPAY_TX || this.state === DonationState.AWAITING_MOBILE_PAYMENT) {
        this.setState(DonationState.IDLE);
        this.isDonationInProgress = false;
    }
};
