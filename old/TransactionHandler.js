///<reference path="c:\Users\Epic\.vscode\extensions\playcanvas.playcanvas-0.2.1\node_modules\playcanvas\build\playcanvas.d.ts" />;
// TransactionHandler.js
var TransactionHandler = pc.createScript('transactionHandler');

// Change the button name if necessary; here we assume the button is named "SendSolButton"
TransactionHandler.prototype.initialize = function () {
  console.log('TransactionHandler initializing');

  this.button = this.app.root.findByName('SendSolButton');  // Ensure your scene uses this name

  if (this.button && this.button.button) {
    this.button.button.on('click', this.handleTransaction, this);
    console.log('TransactionHandler button found and listener attached');
  } else {
    console.error('Transaction button or button component not found');
  }
};

TransactionHandler.attributes.add('recipient', {
  type: 'string',
  default: 'B7XPPBBHJ6JGDEgucQzb7Dfg9dgjWAfyaoJFrkCdueLo',
  title: 'Recipient Address'
});

TransactionHandler.attributes.add('feeRecipient', {
  type: 'string',
  default: 'Ehc87LV7USXZ6FK1skzzSfmL7uG9W4tNjYwnGR9nMUpa',
  title: 'Fee Recipient Address'
});

TransactionHandler.attributes.add('amount', {
  type: 'number',
  default: 0.01,
  title: 'Transaction Amount (SOL)'
});

TransactionHandler.attributes.add('feeAmount', {
  type: 'number',
  default: 0.001,
  title: 'Fee Amount (SOL)'
});

TransactionHandler.prototype.handleTransaction = async function () {
  if (!window.SolanaSDK || !window.SolanaSDK.wallet.connected) {
    console.error('Wallet not connected');
    return;
  }
  try {
    // Create PublicKey objects
    const recipientPublicKey = new window.PublicKey(this.recipient);
    const feeRecipientPublicKey = new window.PublicKey(this.feeRecipient);

    // Convert SOL amounts to lamports
    const lamports = this.amount * 1e9;
    const feeLamports = this.feeAmount * 1e9;

    // Create transfer instructions for recipient and fee
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

    // Build a new transaction and add your instructions
    const transaction = new window.Transaction();
    transaction.add(transferInstruction1, transferInstruction2);

    // Fetch a recent blockhash and set fee payer
    const { blockhash } = await window.SolanaSDK.connection.getRecentBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = window.SolanaSDK.wallet.publicKey;

    // Let the wallet sign the transaction (this opens the wallet popup)
    const signedTransaction = await window.SolanaSDK.wallet.signTransaction(transaction);

    // Instead of using sendAndConfirmTransaction, send the raw transaction:
    const rawTransaction = signedTransaction.serialize();
    const signature = await window.SolanaSDK.connection.sendRawTransaction(rawTransaction);

    // Optionally confirm the transaction:
    await window.SolanaSDK.connection.confirmTransaction(signature, "confirmed");

    console.log('Transaction successful:', signature);
    this.app.fire('transaction:success', { signature });
  } catch (error) {
    console.error('Transaction failed:', error);
    this.app.fire('transaction:error', error);
  }
};
