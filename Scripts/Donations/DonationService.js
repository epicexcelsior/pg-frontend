// Scripts/Donations/DonationService.js
var DonationService = pc.createScript('donationService');

// Enum for Donation States
const DonationState = {
     IDLE: 'idle',
     VALIDATING_INPUT: 'validating_input',
     FETCHING_BALANCE: 'fetching_balance', // Added
     FETCHING_BLOCKHASH: 'fetching_blockhash', // Added
     CREATING_TRANSACTION: 'creating_transaction', // Added
     AWAITING_SIGNATURE: 'awaiting_signature', // Added
     SUBMITTING_TO_BACKEND: 'submitting_to_backend',
     TX_SUBMITTED_PROCESSING: 'tx_submitted_processing',
     CONFIRMING_TRANSACTION: 'confirming_transaction',
     SUCCESS: 'success',
     FAILED: 'failed', // Generic failure state
     FAILED_VALIDATION: 'failed_validation', // Specific failure states
     FAILED_BALANCE: 'failed_balance',
     FAILED_SIGNING: 'failed_signing',
     FAILED_SUBMISSION: 'failed_submission',
     FAILED_CONFIRMATION: 'confirmation',
     NO_WALLET: 'no_wallet' // New state for when wallet is not installed
};

DonationService.attributes.add('servicesEntity', {
     type: 'entity',
     title: 'Services Entity',
     description: 'The entity holding core services like ConfigLoader.'
});

DonationService.prototype.initialize = function () {
     console.log('DonationService initializing...');
     this.authService = null;
     this.feedbackService = null;
     this.configLoader = null;
     this.state = DonationState.IDLE;
     this.lastError = null;
     this.currentTransactionSignature = null;
     this.isDonationInProgress = false;
     this.triggerElement = null;

     if (!this.servicesEntity || !this.servicesEntity.script) {
          console.error("DonationService: Services Entity or ConfigLoader script not found! Cannot load config.");
          return;
     }
     this.configLoader = this.servicesEntity.script.configLoader;

     // Get services from registry
     if (this.app.services) {
          this.authService = this.app.services.get('authService');
          this.feedbackService = this.app.services.get('feedbackService');

          if (!this.authService) console.warn("DonationService: AuthService not found in registry.");
          if (!this.feedbackService) console.warn("DonationService: FeedbackService not found in registry.");
     } else {
          console.warn("DonationService: Services registry (app.services) not found during initialization.");
     }

     // Configuration values
     this.amount = 0;
     this.feeAmount = 0;
     this.recipient = '';
     this.recipientAmount = 0;
     this.feeRecipient = '';
     this.workerProcessUrl = '';
     this.feePercentage = 0;

     if (this.configLoader && this.configLoader.config) {
          this.loadConfigValues();
     } else {
          console.log("DonationService: Waiting for config:loaded event...");
          this.app.once('config:loaded', this.loadConfigValues, this);
     }

     // Register with Services
     this.app.services?.register('donationService', this);

     // Listen for UI requests
     this.app.on('ui:donate:request', this._onDonateRequest, this);

     console.log('DonationService initialized.');
};

DonationService.prototype.loadConfigValues = function () {
     if (!this.configLoader) {
          console.error("DonationService: ConfigLoader not available in loadConfigValues.");
          return;
     }

     this.workerProcessUrl = this.configLoader.get('cloudflareWorkerDonationEndpoint');
     this.feeRecipient = this.configLoader.get('donationFeeRecipientAddress');
     const feePercent = this.configLoader.get('donationFeePercentage');

     if (!this.workerProcessUrl) console.error("DonationService: cloudflareWorkerDonationEndpoint missing from config.");
     if (!this.feeRecipient) console.error("DonationService: donationFeeRecipientAddress (for fees) missing from config.");
     if (typeof feePercent !== 'number') {
          console.error("DonationService: donationFeePercentage missing or invalid in config. Defaulting to 0.");
          this.feePercentage = 0;
     } else {
          this.feePercentage = feePercent;
     }
     console.log(`DonationService: Config values loaded - Fee %: ${this.feePercentage}, Fee Recipient: ${this.feeRecipient}`);
};

DonationService.prototype.setState = function (newState, error = null, signature = null) {
     if (this.state === newState && !error && !signature) return;

     console.log(`DonationService: State changing from ${this.state} to ${newState}`);
     const previousState = this.state;
     this.state = newState;
     this.lastError = error ? (error.message || String(error)) : null;
     this.currentTransactionSignature = signature || (newState === DonationState.SUCCESS ? this.currentTransactionSignature : null);

     if (this.feedbackService) {
          const loadingStates = [
               DonationState.FETCHING_BALANCE, DonationState.FETCHING_BLOCKHASH,
               DonationState.CREATING_TRANSACTION, DonationState.AWAITING_SIGNATURE,
               DonationState.SUBMITTING_TO_BACKEND, DonationState.CONFIRMING_TRANSACTION
          ];
          const endStates = [DonationState.IDLE, DonationState.SUCCESS, DonationState.FAILED, DonationState.FAILED_VALIDATION,
               DonationState.FAILED_BALANCE, DonationState.FAILED_SIGNING, DonationState.FAILED_SUBMISSION,
               DonationState.FAILED_CONFIRMATION];

          if (this.triggerElement && (endStates.includes(newState) || !loadingStates.includes(newState))) {
               this.feedbackService.hideInlineLoading(this.triggerElement);
          }

          switch (newState) {
               case DonationState.NO_WALLET:
                    if (this.triggerElement) {
                         this.feedbackService.hideInlineLoading(this.triggerElement);
                    }
                    break;
               case DonationState.VALIDATING_INPUT:
                    break;
               case DonationState.FETCHING_BALANCE:
               case DonationState.FETCHING_BLOCKHASH:
                    if (this.triggerElement) this.feedbackService.showInlineLoading(this.triggerElement, 'Preparing...');
                    break;
               case DonationState.CREATING_TRANSACTION:
                    if (this.triggerElement) this.feedbackService.showInlineLoading(this.triggerElement, 'Creating Tx...');
                    break;
               case DonationState.AWAITING_SIGNATURE:
                    if (this.triggerElement) this.feedbackService.showInlineLoading(this.triggerElement, 'Check Wallet');
                    this.feedbackService.showInfo("Please approve the transaction in your wallet.", 10000);
                    break;
               case DonationState.SUBMITTING_TO_BACKEND:
                    if (this.triggerElement) this.feedbackService.showInlineLoading(this.triggerElement, 'Submitting...');
                    break;
               case DonationState.TX_SUBMITTED_PROCESSING:
                    if (this.triggerElement) this.feedbackService.showInlineLoading(this.triggerElement, 'Processing...');
                    if (signature) {
                         this.feedbackService.showInfo(`Transaction submitted (${signature.substring(0, 8)}...). Awaiting confirmation.`, 15000);
                    } else {
                         this.feedbackService.showInfo("Transaction submitted. Awaiting confirmation.", 15000);
                    }
                    break;
               case DonationState.CONFIRMING_TRANSACTION:
                    if (this.triggerElement) this.feedbackService.showInlineLoading(this.triggerElement, 'Confirming...');
                    break;
               case DonationState.SUCCESS:
                    this.feedbackService.showSuccess(`Donation successful! Tx: ${this.currentTransactionSignature?.substring(0, 8)}...`);
                    this.isDonationInProgress = false;
                    this.triggerElement = null;
                    break;
               case DonationState.FAILED_VALIDATION:
               case DonationState.FAILED_BALANCE:
               case DonationState.FAILED_SIGNING:
               case DonationState.FAILED_SUBMISSION:
               case DonationState.FAILED_CONFIRMATION:
               case DonationState.FAILED:
                    console.error("DonationService Error:", this.lastError);
                    this._handleDonateError(error || new Error("Unknown donation error"), newState);
                    this.isDonationInProgress = false;
                    this.triggerElement = null;
                    break;
               case DonationState.IDLE:
                    this.isDonationInProgress = false;
                    this.triggerElement = null;
                    break;
          }
     } else {
          console.warn("FeedbackService not available in DonationService.setState");
     }

     this.app.fire('donation:stateChanged', { state: this.state, error: this.lastError, signature: this.currentTransactionSignature });
};

DonationService.prototype._onDonateRequest = function (data) {
     if (!data || typeof data.amount !== 'number' || !data.recipient) {
          console.error("DonationService: Invalid data received from 'ui:donate:request'.", data);
          if (this.feedbackService) this.feedbackService.showError("Donation Error", "Invalid donation request data.", true);
          return;
     }
     this.triggerElement = data.triggerElement || null;
     if (!this.triggerElement) {
          console.warn("DonationService: No triggerElement provided in 'ui:donate:request'. Inline loading feedback will not be shown on the button.");
     }

     this.initiateDonation(data.amount, data.recipient);
};

DonationService.prototype.initiateDonation = async function (donationAmount, recipientAddress) {
     console.log("Donation:", this.authService, this.feedbackService, this.configLoader, this.workerProcessUrl, this.feeRecipient);

     if (!window.SolanaSDK || !window.SolanaSDK.wallet) {
          console.error("DonationService: Solana wallet extension not found.");
          this.setState(DonationState.NO_WALLET);
          if (this.feedbackService) {
               this.feedbackService.showBlockingPrompt(
                    "Do you have a Solana wallet?",
                    "Please install the Phantom wallet browser extension. More wallets will be supported in the future.",
                    [
                         { label: 'Install Phantom', callback: () => window.open('https://phantom.app/', '_blank'), style: { backgroundColor: '#aa9fec', color: 'white' } },
                         { label: 'OK', callback: () => { }, type: 'secondary' }
                    ]
               );
          }
          return;
     }

     if (!this.authService || !this.feedbackService || !this.configLoader || !this.workerProcessUrl || !this.feeRecipient) {
          console.error("DonationService: Cannot initiate donation, service not fully configured or dependencies missing.");
          if (this.feedbackService) {
               this.setState(DonationState.FAILED, new Error("Configuration Error: Services missing."));
          } else {
               console.error("Critical Error: FeedbackService is missing, cannot set FAILED state properly.");
          }
          return;
     }
     if (!this.authService.isAuthenticated()) {
          console.error('DonationService: User not authenticated.');
          this.setState(DonationState.FAILED, new Error("Authentication required. Please sign in."));
          return;
     }

     if (this.isDonationInProgress) {
          console.warn("DonationService: Donation already in progress.");
          if (this.feedbackService) this.feedbackService.showWarning("Donation already in progress. Please wait.", 5000);
          return;
     }

     this.isDonationInProgress = true;

     this.setState(DonationState.VALIDATING_INPUT);
     const MIN_DONATION = 0.001;
     if (typeof donationAmount !== "number" || isNaN(donationAmount) || donationAmount < MIN_DONATION) {
          console.error("Invalid donation amount:", donationAmount);
          this.setState(DonationState.FAILED_VALIDATION, new Error(`Invalid amount. Minimum is ${MIN_DONATION} SOL.`));
          return;
     }
     if (!recipientAddress || typeof recipientAddress !== 'string') {
          console.error("Invalid recipient address:", recipientAddress);
          this.setState(DonationState.FAILED_VALIDATION, new Error("Invalid recipient address."));
          return;
     }
     try {
          new window.SolanaSDK.web3.PublicKey(recipientAddress);
          new window.SolanaSDK.web3.PublicKey(this.feeRecipient);
     } catch (e) {
          console.error("Invalid recipient or fee recipient address format:", e);
          this.setState(DonationState.FAILED_VALIDATION, new Error("Invalid address format (recipient or fee recipient)."));
          return;
     }

     this.amount = donationAmount;
     this.recipient = recipientAddress;

     if (this.feePercentage < 0 || this.feePercentage > 100) {
          console.error("Invalid fee percentage configured:", this.feePercentage);
          this.setState(DonationState.FAILED_VALIDATION, new Error("Fee configuration error."));
          return;
     }
     this.feeAmount = parseFloat((donationAmount * (this.feePercentage / 100)).toFixed(9));
     this.recipientAmount = donationAmount - this.feeAmount;

     if (this.recipientAmount < 0) {
          console.error("Calculated recipient amount is negative:", this.recipientAmount);
          this.setState(DonationState.FAILED_VALIDATION, new Error("Fee is higher than the donation amount."));
          return;
     }

     console.log(`Initiating donation: ${this.amount} SOL (total from payer), Recipient gets: ${this.recipientAmount} SOL, Fee: ${this.feeAmount} SOL to ${this.feeRecipient}`);

     this.setState(DonationState.FETCHING_BALANCE);
     const payerPublicKey = this.authService.getWalletAddress();
     if (!payerPublicKey) {
          this.setState(DonationState.FAILED, new Error("Wallet address unavailable."));
          return;
     }
     const requiredLamports = Number(window.lamports(donationAmount));
     try {
          const balanceLamports = await this._getUserBalance(payerPublicKey);
          if (balanceLamports === null) {
               throw new Error("Could not fetch balance.");
          }
          const estimatedTxFeeLamports = 20000;
          if (balanceLamports < requiredLamports + estimatedTxFeeLamports) {
               console.warn(`Insufficient balance: Required=${requiredLamports + estimatedTxFeeLamports}, Available=${balanceLamports}`);
               this.setState(DonationState.FAILED_BALANCE, new Error(`Insufficient SOL balance. You need approx. ${window.sol(requiredLamports + estimatedTxFeeLamports)} SOL.`));
               return;
          }
          console.log(`Balance check passed: Required=${requiredLamports + estimatedTxFeeLamports}, Available=${balanceLamports}`);
     } catch (balanceError) {
          console.error("Balance check failed:", balanceError);
          this.setState(DonationState.FAILED, new Error(`Failed to check balance: ${balanceError.message}`));
          return;
     }

     await this.handleDonation();
};

DonationService.prototype.handleDonation = async function () {
     const { wallet, web3, SystemProgram, connection: sdkConnection } = window.SolanaSDK;
     const sessionToken = this.authService.getSessionToken();
     const payerPublicKey = new web3.PublicKey(this.authService.getWalletAddress());

     console.log('Starting donation transaction build for recipient:', this.recipient);

     try {
          const recipientPublicKey = new web3.PublicKey(this.recipient);
          const feeRecipientPublicKey = new web3.PublicKey(this.feeRecipient);

          if (payerPublicKey.equals(recipientPublicKey)) {
               throw new Error("Cannot donate to self.");
          }

          const feeLamports = Number(window.lamports(this.feeAmount));
          const recipientLamports = Number(window.lamports(this.recipientAmount));

          if (recipientLamports < 0 || feeLamports < 0) {
               throw new Error("Invalid negative lamport amounts calculated.");
          }

          this.setState(DonationState.FETCHING_BLOCKHASH);
          console.log("Fetching recent blockhash...");
          const blockhashResponse = await sdkConnection.getLatestBlockhashAndContext('confirmed');
          const originalBlockhash = blockhashResponse.value.blockhash;
          const originalLastValidBlockHeight = blockhashResponse.value.lastValidBlockHeight;
          console.log("Got blockhash:", originalBlockhash);

          this.setState(DonationState.CREATING_TRANSACTION);
          const instructions = [];
          const computeUnits = 50000;
          const microLamportsPerCU = 1000;

          instructions.push(web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: microLamportsPerCU }));
          instructions.push(web3.ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }));

          instructions.push(
               SystemProgram.transfer({
                    fromPubkey: payerPublicKey,
                    toPubkey: recipientPublicKey,
                    lamports: recipientLamports,
               })
          );
          if (feeLamports > 0) {
               instructions.push(
                    SystemProgram.transfer({
                         fromPubkey: payerPublicKey,
                         toPubkey: feeRecipientPublicKey,
                         lamports: feeLamports,
                    })
               );
          }
          console.log("Built transfer instructions.");

          const transaction = new web3.Transaction({
               feePayer: payerPublicKey,
               recentBlockhash: originalBlockhash,
          }).add(...instructions);

          this.setState(DonationState.AWAITING_SIGNATURE);
          let signedTransaction;
          try {
               if (typeof wallet.signTransaction !== 'function') {
                    throw new Error("Wallet adapter error: 'signTransaction' method missing.");
               }
               signedTransaction = await wallet.signTransaction(transaction);
               console.log("Transaction signed by wallet.");
          } catch (signError) {
               console.error("Wallet signing failed:", signError);
               if (signError.message?.toLowerCase().includes('cancelled in wallet') || signError.message?.toLowerCase().includes('rejected')) {
                    throw new Error("Transaction cancelled in wallet.");
               } else {
                    throw new Error(`Wallet signing error: ${signError.message}`);
               }
          }

          const serializedTx = signedTransaction.serialize({ requireAllSignatures: false, verifySignatures: false });
          const base64Transaction = Buffer.from(serializedTx).toString('base64');

          const expectedParams = {
               source: payerPublicKey.toBase58(),
               recipient: this.recipient,
               donationAmount: recipientLamports.toString(),
               feeRecipient: this.feeRecipient,
               feeAmount: feeLamports.toString(),
               blockhash: originalBlockhash,
               lastValidBlockHeight: originalLastValidBlockHeight
          };
          const payload = {
               sessionToken: sessionToken,
               rawTransaction: base64Transaction,
               expectedParams: expectedParams
          };

          this.setState(DonationState.SUBMITTING_TO_BACKEND);
          console.log("Sending transaction to verification server...");
          const response = await fetch(this.workerProcessUrl, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(payload)
          });

          let responseData;
          try {
               responseData = await response.json();
          } catch (jsonError) {
               console.error(`Server returned non-JSON response (${response.status}): ${await response.text()}`);
               throw new Error(`Server Error: ${response.status}): Invalid response format.`);
          }

          if (!response.ok) {
               console.error(`Server verification/broadcast failed (${response.status}):`, responseData);
               const serverErrorMsg = responseData?.error || `Status ${response.status}`;
               throw new Error(`Server Error: ${serverErrorMsg}`, { cause: { status: response.status, body: responseData } });
          }

          const signature = responseData.signature;
          if (!signature) {
               throw new Error("Server Error: Verification successful, but signature missing from response.");
          }
          console.log("Transaction processed and broadcast by server! Signature:", signature);
          this.setState(DonationState.TX_SUBMITTED_PROCESSING, null, signature);

          this.setState(DonationState.CONFIRMING_TRANSACTION, null, signature);
          await this._pollConfirmation(signature, originalBlockhash, originalLastValidBlockHeight);

          this.setState(DonationState.SUCCESS, null, signature);
          console.log(`[DonationService] Firing 'donation:confirmedForBackend' event for signature: ${signature}`);
          
          this.app.fire('donation:confirmedForBackend', {
               signature: signature,
               recipient: this.recipient,
               donor: payerPublicKey.toBase58(),
               amountSOL: this.amount
          });

     } catch (error) {
          console.error("Donation process failed:", error);
          let failureState = DonationState.FAILED;
          const errorMsgLower = error.message?.toLowerCase() || "";
          if (errorMsgLower.includes("cancelled in wallet") || errorMsgLower.includes("signing error")) {
               failureState = DonationState.FAILED_SIGNING;
          } else if (errorMsgLower.includes("server error")) {
               failureState = DonationState.FAILED_SUBMISSION;
          } else if (errorMsgLower.includes("confirmation failed")) {
               failureState = DonationState.FAILED_CONFIRMATION;
          }
          this.setState(failureState, error);
     }
};

DonationService.prototype._getUserBalance = async function (publicKeyString) {
     if (!window.SolanaSDK?.connection || !window.SolanaSDK?.web3) return null;
     try {
          const publicKey = new window.SolanaSDK.web3.PublicKey(publicKeyString);
          const balance = await window.SolanaSDK.connection.getBalance(publicKey, 'confirmed');
          return balance;
     } catch (err) {
          console.error("Error fetching balance:", err);
          return null;
     }
};

DonationService.prototype._pollConfirmation = async function (signature, blockhash, lastValidBlockHeight) {
     if (!window.SolanaSDK?.connection) {
          throw new Error("Confirmation failed: Solana connection lost.");
     }
     console.log(`Polling confirmation for ${signature}...`);

     try {
          const result = await window.SolanaSDK.connection.confirmTransaction({
               signature: signature,
               blockhash: blockhash,
               lastValidBlockHeight: lastValidBlockHeight
          }, 'confirmed');

          if (result.value.err) {
               console.error("Transaction confirmation failed:", result.value.err);
               throw new Error(`Confirmation failed: ${JSON.stringify(result.value.err)}`);
          }

          console.log(`Transaction ${signature} confirmed successfully!`);

     } catch (error) {
          console.error(`Error during transaction confirmation polling for ${signature}:`, error);
          if (error.message.includes('failed') || error.message.includes('timed out')) {
               throw new Error(`Confirmation failed: Transaction was not confirmed within the timeout period.`);
          } else {
               throw new Error(`Confirmation failed: An unexpected error occurred during polling (${error.message}).`);
          }
     }
};

DonationService.prototype._handleDonateError = function (error, failureState) {
     let userMessage = "Donation failed. Please try again.";
     let isCritical = true;

     const errorMsgLower = error.message?.toLowerCase() || "";
     const cause = error.cause;

     switch (failureState) {
          case DonationState.NO_WALLET:
               userMessage = "Please install a Solana wallet extension (e.g., Phantom) to make donations.";
               isCritical = false;
               break;
          case DonationState.FAILED_VALIDATION:
               userMessage = `Invalid Input: ${error.message}`;
               isCritical = false;
               break;
          case DonationState.FAILED_BALANCE:
               userMessage = error.message;
               isCritical = false;
               break;
          case DonationState.FAILED_SIGNING:
               userMessage = error.message;
               isCritical = false;
               break;
          case DonationState.FAILED_SUBMISSION:
               if (cause?.status === 401) {
                    userMessage = "Authentication Error: Your session is invalid. Please sign in again.";
                    this.authService?.handleSessionExpired();
               } else if (cause?.status === 400) {
                    userMessage = `Donation Error: ${cause.body?.error || "Transaction details were invalid or rejected by the server."}`;
               } else if (cause?.status === 500 && cause.body?.error) {
                    const backendError = cause.body.error.toLowerCase();
                    if (backendError.includes("insufficient funds")) {
                         userMessage = "Donation Failed: Insufficient SOL balance for this donation and transaction fees.";
                    } else if (backendError.includes("blockhash expired") || backendError.includes("blockhash not found")) {
                         userMessage = "Donation Failed: Network information outdated. Please try again.";
                    } else if (backendError.includes("simulation failed")) {
                         userMessage = "Donation Failed: The network predicts this transaction will fail. Check details or balance.";
                    } else if (backendError.includes("failed to broadcast")) {
                         userMessage = "Donation Failed: Could not send transaction to the network.";
                    } else {
                         userMessage = `Donation Failed: ${error.message || "An unknown error occurred."}`;
                    }
               } else if (errorMsgLower.includes("network error") || errorMsgLower.includes("failed to fetch")) {
                    userMessage = "Donation Failed: Network error submitting donation.";
               } else {
                    userMessage = `Donation Failed: ${error.message}`;
               }
               break;
          case DonationState.FAILED_CONFIRMATION:
               userMessage = `Confirmation Failed: ${error.message}`;
               if (this.currentTransactionSignature) {
                    userMessage += ` (Tx: ${this.currentTransactionSignature.substring(0, 8)}...)`;
               }
               break;
          case DonationState.FAILED:
          default:
               userMessage = `Donation Failed: ${error.message || "An unknown error occurred."}`;
               break;
     }

     if (this.feedbackService) {
          this.feedbackService.showError("Donation Failed", userMessage, isCritical);
     } else {
          console.error("Donation Failed (FeedbackService unavailable):", userMessage);
     }
};