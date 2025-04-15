// Scripts/Donations/DonationService.js
var DonationService = pc.createScript('donationService');

DonationService.attributes.add('servicesEntity', {
    type: 'entity',
    title: 'Services Entity',
    description: 'The entity holding core services like ConfigLoader.'
});
DonationService.prototype.initialize = function () {
     console.log('DonationService initializing...');
     this.authService = this.app.services?.get('authService');

     if (!this.servicesEntity || !this.servicesEntity.script || !this.servicesEntity.script.configLoader) {
         console.error("DonationService: Services Entity or ConfigLoader script not found!");
         return;
     }
     this.configLoader = this.servicesEntity.script.configLoader;

     // These will be set by initiateDonation
     this.amount = 0;
     this.feeAmount = 0;
     this.recipient = '';
     this.recipientAmount = 0;

     // Configuration values (loaded from config)
     this.feeRecipient = '';
     this.workerProcessUrl = '';
     this.feePercentage = 0; // Default, will be overwritten

     if (!this.authService) {
         console.error("DonationService: AuthService not found. Donations will fail.");
     }
     if (this.app.config) {
         this.loadConfigValues();
     } else {
         console.log("DonationService: Waiting for config:loaded event...");
         this.app.once('config:loaded', this.loadConfigValues, this);
     }

     // Register with Services if needed (optional, depends if other scripts need direct access)
     // this.app.services?.register('donationService', this);
};

DonationService.prototype.loadConfigValues = function() {
    this.config = this.configLoader.config;
    if (!this.config) return; // Guard against race conditions

    this.workerProcessUrl = this.configLoader.get('cloudflareWorkerDonationEndpoint');
    this.feeRecipient = this.configLoader.get('donationFeeRecipientAddress'); // Assuming config holds the *fee* recipient
    const feePercent = this.configLoader.get('donationFeePercentage'); // Assuming config name

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


// Called by DonationPromptHtml (via event 'ui:donate:request') to start the process
// Example listener setup (in a UI Controller or similar):
// this.app.on('ui:donate:request', (data) => {
//    const donationService = this.app.services.get('donationService');
//    if (donationService) {
//        donationService.initiateDonation(data.amount, data.recipient);
//    }
// });
DonationService.prototype.initiateDonation = async function (donationAmount, recipientAddress) {
     // --- Prerequisite Checks ---
     if (!this.authService || !this.configLoader || !this.workerProcessUrl || !this.feeRecipient) {
         console.error("DonationService: Cannot initiate donation, service not fully configured or dependencies missing.");
         this.app.fire('ui:donation:error', 'Configuration Error.');
         return;
     }

     // --- Input Validation ---
     if (typeof donationAmount !== "number" || isNaN(donationAmount) || donationAmount <= 0) {
          console.error("Invalid donation amount:", donationAmount);
          this.app.fire('ui:donation:error', 'Invalid amount.');
          return;
     }
     if (!recipientAddress || typeof recipientAddress !== 'string') {
          console.error("Invalid recipient address:", recipientAddress);
          this.app.fire('ui:donation:error', 'Invalid recipient.');
          return;
     }
     try {
          new window.SolanaSDK.web3.PublicKey(recipientAddress);
          new window.SolanaSDK.web3.PublicKey(this.feeRecipient); // Validate fee recipient from config
     } catch (e) {
          console.error("Invalid recipient or fee recipient address format:", e);
          this.app.fire('ui:donation:error', 'Invalid address format.');
          return;
     }

     this.amount = donationAmount; // Intended donation amount
     this.recipient = recipientAddress;

     // --- Fee Calculation (Deducting Fee) ---
     if (this.feePercentage < 0 || this.feePercentage > 100) {
          console.error("Invalid fee percentage configured:", this.feePercentage);
          this.app.fire('ui:donation:error', 'Fee config error.');
          return;
     }
     this.feeAmount = parseFloat((donationAmount * (this.feePercentage / 100)).toFixed(9));
     this.recipientAmount = donationAmount - this.feeAmount;

     if (this.recipientAmount < 0) {
          console.error("Calculated recipient amount is negative:", this.recipientAmount);
          this.app.fire('ui:donation:error', 'Fee too high for donation amount.');
          return;
     }

     console.log(`Initiating donation: ${this.amount} SOL (total from payer), Recipient gets: ${this.recipientAmount} SOL, Fee: ${this.feeAmount} SOL to ${this.feeRecipient}`);

     // Call the main donation handler
     await this.handleDonation();
};


DonationService.prototype.handleDonation = async function () {
     // --- Prerequisites Check ---
     if (!window.SolanaSDK?.wallet || !window.SolanaSDK?.web3 || !window.SolanaSDK?.SystemProgram || !window.SolanaSDK?.connection) {
          console.error('DonationService: Solana SDK components not initialized.');
          this.app.fire('ui:donation:error', 'SDK Error.');
          this.app.fire('ui:donation:end');
          return;
     }
     const { wallet, web3, SystemProgram, connection: sdkConnection } = window.SolanaSDK;

     if (!this.authService.isAuthenticated()) { // Use AuthService
          console.error('DonationService: User not authenticated.');
          this.app.fire('ui:donation:error', 'Authentication required.');
          this.app.fire('ui:donation:end');
          return;
     }
     const sessionToken = this.authService.getSessionToken(); // Use AuthService
     const payerPublicKey = wallet.publicKey; // Wallet should be connected if authenticated

     if (!payerPublicKey) {
         console.error('DonationService: Wallet public key unavailable despite authenticated state.');
         this.app.fire('ui:donation:error', 'Wallet Error.');
         this.app.fire('ui:donation:end');
         return;
     }

     if (!this.recipient || !this.feeRecipient) {
          console.error('DonationService: Recipient or Fee Recipient address missing.');
          this.app.fire('ui:donation:error', 'Config Error.');
          this.app.fire('ui:donation:end');
          return;
     }

     console.log('Starting donation process for recipient:', this.recipient);
     this.app.fire('ui:donation:start'); // For UI feedback

     try {
          const recipientPublicKey = new web3.PublicKey(this.recipient);
          const feeRecipientPublicKey = new web3.PublicKey(this.feeRecipient);

          if (payerPublicKey.equals(recipientPublicKey)) {
               throw new Error("Client Bug: Cannot donate to self via this instruction.");
          }

          const feeLamports = Number(window.lamports(this.feeAmount));
          const recipientLamports = Number(window.lamports(this.recipientAmount));

          if (recipientLamports < 0 || feeLamports < 0) {
               throw new Error("Invalid lamport amounts calculated.");
          }

          // --- Get Recent Blockhash ---
          console.log("Fetching recent blockhash...");
          this.app.fire('ui:donation:status', 'Fetching network state...');
          const blockhashResponse = await sdkConnection.getLatestBlockhashAndContext('confirmed');
          const originalBlockhash = blockhashResponse.value.blockhash;
          const originalLastValidBlockHeight = blockhashResponse.value.lastValidBlockHeight;
          console.log("Got blockhash:", originalBlockhash);

          // --- Create Transaction Instructions ---
          const instructions = [];
          const computeUnits = 50000; // Adjust as needed
          const microLamportsPerCU = 1000; // Adjust based on network conditions

          // Add Compute Budget first
          instructions.push(web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: microLamportsPerCU }));
          instructions.push(web3.ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }));

          // Donation Instruction
          instructions.push(
               SystemProgram.transfer({
                    fromPubkey: payerPublicKey,
                    toPubkey: recipientPublicKey,
                    lamports: recipientLamports,
               })
          );
          // Fee Instruction
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

          // --- Create Transaction ---
          this.app.fire('ui:donation:status', 'Preparing transaction...');
          const transaction = new web3.Transaction({
               feePayer: payerPublicKey,
               recentBlockhash: originalBlockhash,
          }).add(...instructions);

          // --- Sign Transaction ---
          this.app.fire('ui:donation:status', 'Please approve in wallet...');
          let signedTransaction;
          try {
               if (typeof wallet.signTransaction !== 'function') {
                    throw new Error("Wallet adapter does not support 'signTransaction'.");
               }
               signedTransaction = await wallet.signTransaction(transaction);
               console.log("Transaction signed by wallet.");
          } catch (signError) {
               console.error("Wallet signing failed:", signError);
               throw new Error("Transaction cancelled in wallet.");
          }

          // --- Serialize Signed Transaction ---
          const serializedTx = signedTransaction.serialize({ requireAllSignatures: false, verifySignatures: false });
          const base64Transaction = Buffer.from(serializedTx).toString('base64');

          // --- Prepare Payload for Worker ---
          const expectedParams = {
               source: payerPublicKey.toBase58(),
               recipient: this.recipient,
               donationAmount: recipientLamports.toString(), // Send recipientLamports
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

          // --- Send to Cloudflare Worker ---
          console.log("Sending transaction to verification server...");
          this.app.fire('ui:donation:status', 'Verifying & sending...');
          const response = await fetch(this.workerProcessUrl, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(payload)
          });

          // --- Handle Worker Response ---
          const responseData = await response.json();
          if (!response.ok) {
               console.error(`Server verification/broadcast failed (${response.status}):`, responseData);
               const serverErrorMsg = responseData?.error || response.statusText;
               throw new Error(`Server Error: ${serverErrorMsg}`);
          }

          // --- Server Broadcast Successful ---
          const signature = responseData.signature;
          if (!signature) {
               throw new Error("Verification successful, but confirmation signature missing.");
          }
          console.log("Transaction processed and broadcast by server! Signature:", signature);
          this.app.fire('ui:donation:status', 'Confirming on network...');

          // --- SUCCESS PATH ---
          // Client-side confirmation can be added here if desired, but worker confirmation is primary.
          console.log("Donation successful!");
          this.app.fire('ui:donation:success', signature);
          // Fire event for NetworkManager/MessageBroker to broadcast confirmation (optional)
          // this.app.fire('network:send:donationConfirmed', {
          //      signature: signature,
          //      sender: payerPublicKey.toBase58(),
          //      recipient: this.recipient,
          //      amountSOL: this.recipientAmount, // Send recipient amount
          //      feeSOL: this.feeAmount
          // });

     } catch (error) { // Catch errors from blockhash fetch, signing, server send
          console.error("Donation process failed:", error);
          this.app.fire('ui:donation:error', error.message || "Donation failed.");
     } finally {
          console.log("Donation process finished.");
          this.app.fire('ui:donation:end'); // Ensure loading state removal
     }
};

// swap method called for script hot-reloading
// inherit your script state here
// DonationService.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// https://developer.playcanvas.com/en/user-manual/scripting/