///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
var DonationManager = pc.createScript('donationManager');

// Expose attributes so you can configure them from the Editor if desired
DonationManager.attributes.add('feeRecipient', {
     type: 'string',
     default: 'Ehc87LV7USXZ6FK1skzzSfmL7uG9W4tNjYwnGR9nMUpa',
     title: 'Fee Recipient Address'
});

// We'll set amount dynamically via initiateDonation, default can be overwritten
DonationManager.attributes.add('amount', {
     type: 'number',
     default: 0.01,
     title: 'Transaction Amount (SOL)'
});

// The fee amount will be calculated as 5% of the donation
DonationManager.attributes.add('feeAmount', {
     type: 'number',
     default: 0.001,
     title: 'Fee Amount (SOL)'
});

// The recipient will be dynamically set to the booth owner’s address
DonationManager.attributes.add('recipient', {
     type: 'string',
     default: '',
     title: 'Recipient Address'
});

DonationManager.prototype.initialize = function () {
     console.log('DonationManager initializing on entity:', this.entity.name);
     // We remove the button binding since we'll call this function from other scripts.
};

// Public function to initiate a donation.
// Accepts donationAmount (SOL) and recipientAddress (booth owner’s public address)
DonationManager.prototype.initiateDonation = async function (donationAmount, recipientAddress) {
     // Update the donation amount and recipient dynamically.
     this.amount = donationAmount;
     this.recipient = recipientAddress;
     // Calculate the fee as 5% of the donation amount.
     this.feeAmount = donationAmount * 0.05;

     await this.handleDonation();
};

DonationManager.prototype.handleDonation = async function () {
     // Make sure the wallet is connected
     if (!window.SolanaSDK || !window.SolanaSDK.wallet.connected) {
          console.error('Wallet not connected');
          return;
     }
     if (!this.recipient) {
          console.error('Recipient address not set!');
          return;
     }

     try {
          // Create PublicKey objects
          console.log('Recipient:', this.recipient, 'Fee Recipient:', this.feeRecipient);
          const recipientPublicKey = new window.PublicKey(this.recipient);
          const feeRecipientPublicKey = new window.PublicKey(this.feeRecipient);

          // Convert SOL to lamports
          const lamports = Math.floor(this.amount * 1e9);
          const feeLamports = Math.floor(this.feeAmount * 1e9);
          
          // 1) Build instructions
          const transferInstruction1 = window.SystemProgram.transfer({
               fromPubkey: window.SolanaSDK.wallet.publicKey,
               toPubkey: recipientPublicKey,
               lamports,
          });

          const transferInstruction2 = window.SystemProgram.transfer({
               fromPubkey: window.SolanaSDK.wallet.publicKey,
               toPubkey: feeRecipientPublicKey,
               lamports: feeLamports,
          });

          // 2) Create transaction
          const transaction = new window.Transaction();
          transaction.add(transferInstruction1, transferInstruction2);

          // 3) Fetch blockhash & set fee payer
          const { blockhash } = await window.SolanaSDK.connection.getRecentBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = window.SolanaSDK.wallet.publicKey;

          // 4) Let the user sign
          const signedTx = await window.SolanaSDK.wallet.signTransaction(transaction);

          // 5) Send the raw transaction
          const rawTransaction = signedTx.serialize();
          const signature = await window.SolanaSDK.connection.sendRawTransaction(rawTransaction);

          // 6) Confirmation
          await window.SolanaSDK.connection.confirmTransaction(signature, "confirmed");

          console.log('Transaction successful:', signature);
          this.app.fire('transaction:success', { signature });

          // After a transaction succeeds, hide the donation UI:
          var donationUIEntity = this.app.root.findByName("HTMLDonationUI");
          if (donationUIEntity && donationUIEntity.script && donationUIEntity.script.donationPromptHtml) {
               donationUIEntity.script.donationPromptHtml.hide();
          }
     } catch (error) {
          console.log('Transaction failed:', error);
          //this.app.fire('transaction:error', error);
     }
};
