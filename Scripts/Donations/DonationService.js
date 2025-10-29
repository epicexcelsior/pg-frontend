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
    this.balanceRefreshTimeout = null;

    this.privyManager = this.app.services.get("privyManager");
    this.feedbackService = this.app.services.get("feedbackService");
    this.configLoader = this.app.services.get("configLoader");
    this.messageBroker = this.app.services.get("messageBroker");

    this.lastStateChangeAt = 0;
    this.donationStartAt = 0;
    this.awaitingSignatureStaleMs = 20000;

    this.pendingAnnouncements = new Map();
    this.announcementRetryHandles = new Map();
    this.solanaConnection = null;

    this.tweetRecords = new Map();

    this.feeRecipient = this.configLoader.get("donationFeeRecipientAddress");
    this.feePercentage = Number(this.configLoader.get("donationFeePercentage")) || 0;
    this.heliusRpcUrl = this.configLoader.get("heliusRpcUrl");

    this.app.on("ui:donate:request", this.initiateDonation, this);
    this.app.on("solanapay:poll", this.pollForSolanaPayTransaction, this);
    this.app.on("solanapay:poll:stop", this.stopPolling, this);
    this.app.on("donation:announcementFailed", this.onDonationAnnouncementFailed, this);
    this.app.on("effects:donation", this.onDonationEffect, this);
    this.app.on("donation:tweetPublished", this.onDonationTweetPublished, this);

    console.log("DonationService initialized.");
};

DonationService.prototype.setState = function (newState, data = {}) {
    this.state = newState;
    this.lastStateChangeAt = Date.now();
    console.log(`DonationService: State changed to ${newState}`, data);

    const { error, signature } = data;

    switch (newState) {
        case DonationState.BUILDING_TRANSACTION:
            if (data) {
                const recipientAmount = typeof data.recipientAmount === 'number' ? data.recipientAmount : null;
                if (recipientAmount !== null) {
                    this.feedbackService?.showInfo(`Preparing transaction: sending ${recipientAmount.toFixed(4)} SOL.`, 6000);
                }
            }
            break;
        case DonationState.AWAITING_SIGNATURE:
            this.feedbackService?.showInfo("Please approve the transaction in the Privy popup.", 10000);
            break;
        case DonationState.SUCCESS: {
            this.feedbackService?.showSuccess(`Donation successful! Tx: ${signature.substring(0, 8)}...`);
            this.isDonationInProgress = false;
            const successAddress = this.privyManager?.getWalletAddress();
            if (successAddress) {
                this.app.fire('wallet:refreshBalance', { address: successAddress, source: 'donation:success' });
                this.scheduleBalanceRefresh(500);
            }
            break;
        }
        case DonationState.FAILED_SIGNING:
            this.feedbackService?.showError("Transaction Cancelled", error?.message || "The signing request was rejected.", false);
            this.isDonationInProgress = false;
            break;
        case DonationState.FAILED_VALIDATION:
        case DonationState.FAILED_BUILD:
        case DonationState.FAILED:
            this.feedbackService?.showError("Donation Error", error?.message || "An unknown error occurred.", true);
            this.isDonationInProgress = false;
            break;
        case DonationState.FAILED_CONFIRMATION:
            this.feedbackService?.showWarning('Donation Pending Verification', error?.message || 'Waiting for network confirmation. We\'ll retry automatically.', false);
            this.isDonationInProgress = false;
            break;
    }

    if (newState === DonationState.SUCCESS ||
        newState === DonationState.FAILED_SIGNING ||
        newState === DonationState.FAILED_VALIDATION ||
        newState === DonationState.FAILED_BUILD ||
        newState === DonationState.FAILED_CONFIRMATION ||
        newState === DonationState.FAILED) {
        this.isDonationInProgress = false;
    }

    this.app.fire("donation:stateChanged", { state: newState, ...data });
};

DonationService.prototype.resolveSolanaWeb3Modules = function () {
    const sdk = window.SolanaSDK || {};
    const candidates = [sdk.web3, window.solanaWeb3, sdk].filter(Boolean);
    const modules = {};
    const keys = ['Transaction', 'SystemProgram', 'PublicKey', 'LAMPORTS_PER_SOL', 'Connection', 'Keypair'];

    keys.forEach((key) => {
        for (let i = 0; i < candidates.length; i += 1) {
            const candidate = candidates[i];
            if (candidate && candidate[key]) {
                modules[key] = candidate[key];
                break;
            }
        }
    });

    return modules;
};

DonationService.prototype.initiateDonation = async function (data) {
    const { amount, recipient, isSolanaPay } = data;

    if (isSolanaPay) {
        this.handleSolanaPayDonation(amount, recipient);
        return;
    }

    const now = Date.now();
    if (this.isDonationInProgress) {
        if (this.state === DonationState.AWAITING_SIGNATURE && (now - this.lastStateChangeAt) > this.awaitingSignatureStaleMs) {
            console.warn('DonationService: Detected stale signing state. Resetting donation flow.');
            this.isDonationInProgress = false;
            this.state = DonationState.IDLE;
        } else {
            this.feedbackService?.showWarning("A donation is already in progress.");
            return;
        }
    }

    this.isDonationInProgress = true;
    this.donationStartAt = now;
    this.setState(DonationState.VALIDATING_INPUT);

    if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
        this.setState(DonationState.FAILED_VALIDATION, { error: new Error("Invalid donation amount."), amount });
        this.isDonationInProgress = false;
        return;
    }
    if (!recipient) {
        this.setState(DonationState.FAILED_VALIDATION, { error: new Error("Recipient address is missing."), amount });
        this.isDonationInProgress = false;
        return;
    }

    try {
        const senderAddress = this.privyManager?.getWalletAddress();
        if (!senderAddress) {
            this.privyManager?.login();
            throw { message: "Please log in to make a donation.", code: 'VALIDATION_ERROR' };
        }

        const web3 = this.resolveSolanaWeb3Modules();
        const missingKeys = ['Transaction', 'SystemProgram', 'PublicKey', 'LAMPORTS_PER_SOL', 'Connection']
            .filter((key) => !web3[key]);
        if (missingKeys.length > 0) {
            throw {
                message: `Solana SDK is not ready yet (missing: ${missingKeys.join(', ')}). Please ensure the PlayCanvas bundle is up to date.`,
                code: 'BUILD_ERROR'
            };
        }

        const Transaction = web3.Transaction;
        const SystemProgram = web3.SystemProgram;
        const PublicKey = web3.PublicKey;
        const LAMPORTS_PER_SOL = web3.LAMPORTS_PER_SOL || 1_000_000_000;
        const Connection = web3.Connection;

        if (typeof SystemProgram.transfer !== 'function') {
            throw { message: 'Solana SystemProgram.transfer is unavailable.', code: 'BUILD_ERROR' };
        }

        const feeRecipientKey = new PublicKey(this.feeRecipient);
        const senderPubkey = new PublicKey(senderAddress);
        const recipientPubkey = new PublicKey(recipient);

        const feeAmount = Math.max(amount * (this.feePercentage / 100), 0);
        const recipientAmount = Math.max(amount - feeAmount, 0);
        const recipientLamports = Math.round(recipientAmount * LAMPORTS_PER_SOL);
        const feeLamports = Math.round(feeAmount * LAMPORTS_PER_SOL);
        const totalLamports = recipientLamports + feeLamports;

        if (recipientLamports <= 0) {
            throw {
                message: 'Donation amount is too small after fees are applied. Please increase the amount.',
                code: 'VALIDATION_ERROR'
            };
        }

        this.setState(DonationState.BUILDING_TRANSACTION, {
            recipient: recipient,
            recipientAmount: recipientAmount,
            feeAmount: feeAmount,
            totalAmount: amount
        });

        const transaction = new Transaction();
        transaction.add(SystemProgram.transfer({
            fromPubkey: senderPubkey,
            toPubkey: recipientPubkey,
            lamports: recipientLamports,
        }));

        if (feeLamports > 0) {
            transaction.add(SystemProgram.transfer({
                fromPubkey: senderPubkey,
                toPubkey: feeRecipientKey,
                lamports: feeLamports,
            }));
        }

        if (!this.heliusRpcUrl) {
            throw { message: 'Solana RPC endpoint is not configured.', code: 'BUILD_ERROR' };
        }

        const connection = this.ensureSolanaConnection(Connection);
        if (!connection) {
            throw { message: 'Unable to initialize Solana connection.', code: 'BUILD_ERROR' };
        }

        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
        transaction.feePayer = senderPubkey;

        const serializedTx = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
        const base64Tx = this.uint8ArrayToBase64(serializedTx);

        this.setState(DonationState.AWAITING_SIGNATURE);
        const result = await this.privyManager.sendTransaction(base64Tx);

        const finalSignature = typeof result === 'string' ? result : result?.signature;
        if (!finalSignature) {
            throw { message: "Transaction failed or signature was not returned.", code: 'SIGNATURE_ERROR' };
        }

        let confirmationSucceeded = false;
        let confirmationError = null;
        try {
            this.feedbackService?.showInfo('Waiting for Solana network confirmation...', 6000);
            await this.waitForSignatureConfirmation(finalSignature);
            confirmationSucceeded = true;
        } catch (error) {
            confirmationError = error instanceof Error ? error : new Error(String(error));
            console.warn('DonationService: Signature confirmation pending.', confirmationError);
        }

        if (confirmationError && confirmationError.message === 'Transaction failed during confirmation.') {
            throw { message: confirmationError.message, code: 'CONFIRMATION_ERROR' };
        }

        this.setState(DonationState.SUCCESS, { signature: finalSignature });

        const announcePayload = {
            signature: finalSignature,
            recipient: recipient,
            amountSOL: amount,
            recipientLamports: recipientLamports,
            feeLamports: feeLamports,
            totalLamports: totalLamports,
            donor: senderAddress,
        };
        this.registerPendingAnnouncement(finalSignature, announcePayload);
        this.sendPendingAnnouncement(finalSignature);

        if (!confirmationSucceeded) {
            this.feedbackService?.showInfo('Transaction submitted. Verification may take a moment while the network finalizes it.', 6000);
        }
    } catch (error) {
        console.error("DonationService Error:", error);
        const failureCode = error?.code;
        if (failureCode === 'VALIDATION_ERROR') {
            this.setState(DonationState.FAILED_VALIDATION, { error });
        } else if (failureCode === 'SIGNATURE_ERROR' || this.state === DonationState.AWAITING_SIGNATURE) {
            this.setState(DonationState.FAILED_SIGNING, { error });
        } else if (failureCode === 'CONFIRMATION_ERROR') {
            this.setState(DonationState.FAILED_CONFIRMATION, { error });
        } else {
            this.setState(DonationState.FAILED_BUILD, { error });
        }
    } finally {
        if (this.state !== DonationState.SUCCESS && this.state !== DonationState.AWAITING_SIGNATURE) {
            this.isDonationInProgress = false;
        }
    }
};

DonationService.prototype.handleSolanaPayDonation = function (amount, recipient) {
    this.isDonationInProgress = true;
    this.setState(DonationState.VALIDATING_INPUT);

    const web3 = this.resolveSolanaWeb3Modules();
    const Keypair = web3.Keypair;
    if (!Keypair || typeof Keypair.generate !== 'function') {
        this.setState(DonationState.FAILED_BUILD, { error: new Error('Solana Keypair generator is unavailable. Please ensure the bundle is rebuilt.') });
        this.isDonationInProgress = false;
        return;
    }

    const reference = Keypair.generate();
    const referencePublicKey = reference.publicKey.toBase58();

    const label = "Donation to Booth Owner";
    const message = `Donation of ${amount} SOL to ${recipient.substring(0, 4)}... via PlsGive`;
    const url = `solana:${recipient}?amount=${amount}&reference=${referencePublicKey}&label=${encodeURIComponent(label)}&message=${encodeURIComponent(message)}`;

    window.QRCode.toDataURL(url, { width: 220, margin: 1 }, (err, dataUrl) => {
        if (err) {
            this.setState(DonationState.FAILED_BUILD, { error: new Error("Failed to generate QR code.") });
            return;
        }
        this.app.fire("donation:showQR", { qrDataUrl: dataUrl, solanaPayUrl: url, reference: referencePublicKey, amount, recipient });
        this.setState(DonationState.AWAITING_MOBILE_PAYMENT);
    });
};

DonationService.prototype.pollForSolanaPayTransaction = async function (data) {
    if (this.state === DonationState.POLLING_SOLANAPAY_TX) return;
    this.setState(DonationState.POLLING_SOLANAPAY_TX);

    const web3 = this.resolveSolanaWeb3Modules();
    const Connection = web3.Connection;
    const PublicKey = web3.PublicKey;
    const LAMPORTS_PER_SOL = web3.LAMPORTS_PER_SOL || 1_000_000_000;
    if (!Connection || !PublicKey) {
        console.warn('DonationService: Solana web3 modules not ready for polling.');
        this.setState(DonationState.FAILED_BUILD, { error: new Error('Solana SDK is not ready for polling yet.') });
        this.isDonationInProgress = false;
        return;
    }

    const connection = new Connection(this.heliusRpcUrl, 'confirmed');
    const referencePublicKey = new PublicKey(data.reference);
    const maxPolls = 60;
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
                const amountLamports = Math.round((Number(data.amount) || 0) * LAMPORTS_PER_SOL);
                const announcePayload = {
                    signature,
                    recipient: data.recipient,
                    amountSOL: data.amount,
                    recipientLamports: amountLamports,
                    feeLamports: 0,
                    totalLamports: amountLamports,
                    donor: null,
                };
                this.app.fire('network:send', 'announceDonation', announcePayload);
                const senderAddress = this.privyManager?.getWalletAddress();
                if (senderAddress) {
                    this.app.fire('wallet:refreshBalance', { address: senderAddress, source: 'solanapay:success' });
                    this.scheduleBalanceRefresh(500);
                }
                this.stopPolling();
                return;
            }
        } catch (error) {
            console.error("Polling error:", error);
        }
        pollCount += 1;
        this.pollingTimeout = setTimeout(executePoll, 3000);
    };
    executePoll();
};
DonationService.prototype.scheduleBalanceRefresh = function (delayMs) {
    if (this.balanceRefreshTimeout) {
        window.clearTimeout(this.balanceRefreshTimeout);
        this.balanceRefreshTimeout = null;
    }

    const address = this.privyManager?.getWalletAddress();
    if (!address) {
        return;
    }

    const delay = typeof delayMs === 'number' && delayMs >= 0 ? delayMs : 0;
    const targetAddress = address;

    this.balanceRefreshTimeout = window.setTimeout(() => {
        this.balanceRefreshTimeout = null;
        this.app.fire('wallet:refreshBalance', { address: targetAddress, source: 'donation:balance:schedule' });
    }, delay);
};

DonationService.prototype.stopPolling = function () {
    if (this.pollingTimeout) {
        clearTimeout(this.pollingTimeout);
        this.pollingTimeout = null;
    }
    if (this.balanceRefreshTimeout) {
        window.clearTimeout(this.balanceRefreshTimeout);
        this.balanceRefreshTimeout = null;
    }
    if (this.state === DonationState.POLLING_SOLANAPAY_TX || this.state === DonationState.AWAITING_MOBILE_PAYMENT) {
        this.setState(DonationState.IDLE);
        this.isDonationInProgress = false;
    }
};

DonationService.prototype.onDonationAnnouncementFailed = function (data) {
    const signature = data?.signature || null;
    const reason = data?.reason || 'The donation could not be verified yet. The backend will retry automatically.';

    this.feedbackService?.showWarning('Donation Pending Verification', reason, false);
    this.isDonationInProgress = false;

    if (signature && this.pendingAnnouncements.has(signature)) {
        this.scheduleAnnouncementRetry(signature);
    }

    const address = this.privyManager?.getWalletAddress();
    if (address) {
        this.app.fire('wallet:refreshBalance', { address: address, source: 'donation:announcementFailed' });
        this.scheduleBalanceRefresh(2500);
    }
};

DonationService.prototype.onDonationEffect = function (data) {
    if (!data || !data.signature) {
        return;
    }
    this.clearPendingAnnouncement(data.signature);
};

DonationService.prototype.onDonationTweetPublished = function (data) {
    if (!data || !data.signature) {
        return;
    }

    this.tweetRecords.set(data.signature, data);
    this.clearPendingAnnouncement(data.signature);
    this.app.fire('donation:tweetReady', data);
};

DonationService.prototype.ensureSolanaConnection = function (ConnectionCtor) {
    if (this.solanaConnection) {
        return this.solanaConnection;
    }
    if (!ConnectionCtor || !this.heliusRpcUrl) {
        return null;
    }
    try {
        this.solanaConnection = new ConnectionCtor(this.heliusRpcUrl, 'confirmed');
    } catch (error) {
        console.error('DonationService: Failed to create Solana connection.', error);
        this.solanaConnection = null;
    }
    return this.solanaConnection;
};

DonationService.prototype.waitForSignatureConfirmation = async function (signature, timeoutMs) {
    const connection = this.solanaConnection;
    if (!connection) {
        throw new Error('Solana connection unavailable for confirmation.');
    }

    const effectiveTimeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 20000;
    const pollInterval = 1500;
    const start = Date.now();

    while (Date.now() - start < effectiveTimeout) {
        try {
            const statusResponse = await connection.getSignatureStatuses([signature]);
            const status = statusResponse?.value?.[0] || null;
            if (status) {
                if (status.err) {
                    throw new Error('Transaction failed during confirmation.');
                }
                const confirmation = status.confirmationStatus || null;
                if (confirmation === 'confirmed' || confirmation === 'finalized') {
                    return status;
                }
                if (typeof status.confirmations === 'number' && status.confirmations > 0) {
                    return status;
                }
            }
        } catch (error) {
            console.warn('DonationService: Error while polling signature status.', error);
        }
        await this.delay(pollInterval);
    }

    throw new Error('Timed out waiting for Solana confirmation.');
};

DonationService.prototype.registerPendingAnnouncement = function (signature, payload) {
    if (!signature) {
        return;
    }
    this.clearPendingAnnouncement(signature);
    this.pendingAnnouncements.set(signature, {
        payload: payload,
        attempts: 0,
        maxAttempts: 5
    });
};

DonationService.prototype.sendPendingAnnouncement = function (signature) {
    const entry = this.pendingAnnouncements.get(signature);
    if (!entry) {
        return;
    }
    if (entry.attempts >= entry.maxAttempts) {
        this.clearPendingAnnouncement(signature);
        return;
    }
    entry.attempts += 1;
    this.app.fire('network:send', 'announceDonation', entry.payload);
};

DonationService.prototype.scheduleAnnouncementRetry = function (signature) {
    const entry = this.pendingAnnouncements.get(signature);
    if (!entry) {
        return;
    }
    if (entry.attempts >= entry.maxAttempts) {
        this.clearPendingAnnouncement(signature);
        return;
    }

    const existingHandle = this.announcementRetryHandles.get(signature);
    if (existingHandle) {
        window.clearTimeout(existingHandle);
    }

    const handle = window.setTimeout(() => {
        this.announcementRetryHandles.delete(signature);
        this.sendPendingAnnouncement(signature);
    }, 2000);
    this.announcementRetryHandles.set(signature, handle);
};

DonationService.prototype.clearPendingAnnouncement = function (signature) {
    if (!signature) {
        return;
    }
    const handle = this.announcementRetryHandles.get(signature);
    if (handle) {
        window.clearTimeout(handle);
        this.announcementRetryHandles.delete(signature);
    }
    this.pendingAnnouncements.delete(signature);
};

DonationService.prototype.delay = function (ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
};

DonationService.prototype.uint8ArrayToBase64 = function (bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};
DonationService.prototype.destroy = function () {
    this.stopPolling();
    if (this.balanceRefreshTimeout) {
        window.clearTimeout(this.balanceRefreshTimeout);
        this.balanceRefreshTimeout = null;
    }
    if (this.announcementRetryHandles) {
        this.announcementRetryHandles.forEach((handle) => window.clearTimeout(handle));
        this.announcementRetryHandles.clear();
    }
    if (this.pendingAnnouncements) {
        this.pendingAnnouncements.clear();
    }
    this.solanaConnection = null;

    if (this.tweetRecords) {
        this.tweetRecords.clear();
        this.tweetRecords = null;
    }
    this.app.off('ui:donate:request', this.initiateDonation, this);
    this.app.off('solanapay:poll', this.pollForSolanaPayTransaction, this);
    this.app.off('solanapay:poll:stop', this.stopPolling, this);
    this.app.off('donation:announcementFailed', this.onDonationAnnouncementFailed, this);
    this.app.off('effects:donation', this.onDonationEffect, this);
    this.app.off('donation:tweetPublished', this.onDonationTweetPublished, this);
};







