///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
// DonationHandler.js
var DonationHandler = pc.createScript('donationHandler');

// Expose attributes so you can configure them from the Editor if desired
DonationHandler.attributes.add('feeRecipient', {
    type: 'string',
    default: 'Ehc87LV7USXZ6FK1skzzSfmL7uG9W4tNjYwnGR9nMUpa',
    title: 'Fee Recipient Address'
});

DonationHandler.attributes.add('amount', {
    type: 'number',
    default: 0.01,
    title: 'Transaction Amount (SOL)'
});

DonationHandler.attributes.add('feeAmount', {
    type: 'number',
    default: 0.001,
    title: 'Fee Amount (SOL)'
});

// We'll set recipient dynamically via networkManager, but let's define it here:
DonationHandler.attributes.add('recipient', {
    type: 'string',
    default: '',
    title: 'Recipient Address'
});

DonationHandler.prototype.initialize = function () {
    console.log('DonationHandler initializing on entity:', this.entity.name);

    // This script is attached to the same entity as the button
    if (this.entity.button) {
        this.entity.button.on('click', this.handleDonation, this);
        console.log('DonationHandler: Click event attached to', this.entity.name);
    } else {
        console.error('No button component found on this entity:', this.entity.name);
    }
};

DonationHandler.prototype.handleDonation = async function () {
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
        const lamports = this.amount * 1e9;
        const feeLamports = this.feeAmount * 1e9;

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

        // After transaction is successful:
        var donationUI = this.app.root.findByName("BoothDonationUI");
        if (donationUI && donationUI.script && donationUI.script.donationPrompt) {
            donationUI.script.donationPrompt.hide();
        }

    } catch (error) {
        console.error('Transaction failed:', error);
        this.app.fire('transaction:error', error);
    }
};
