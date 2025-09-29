// C:\Users\Epic\Documents\GitHub\pg-frontend\Scripts\UI\TwitterSharePrompt.js
var TwitterSharePrompt = pc.createScript("twitterSharePrompt");

TwitterSharePrompt.prototype.initialize = function () {
  this.currentAddress = null;
  this.activeData = null;
  this.autoHideHandle = null;
  this.privyManager = this.app.services?.get("privyManager") || null;

  this.injectStyles();
  this.buildDom();

  this.app.on("auth:stateChanged", this.onAuthStateChanged, this);
  this.app.on("donation:tweetReady", this.onDonationTweetReady, this);

  if (
    this.privyManager &&
    typeof this.privyManager.getWalletAddress === "function"
  ) {
    this.currentAddress = this.privyManager.getWalletAddress();
  }
};

TwitterSharePrompt.prototype.injectStyles = function () {
  if (document.getElementById("tweet-share-prompt-styles")) {
    return;
  }
  var style = document.createElement("style");
  style.id = "tweet-share-prompt-styles";
  style.innerHTML =
    "" +
    "#tweet-share-prompt{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(32px);" +
    "background:rgba(17,17,17,0.92);color:#fff;z-index:2000;padding:18px 20px;border-radius:14px;" +
    "box-shadow:0 18px 36px rgba(0,0,0,0.35);display:flex;flex-direction:column;gap:12px;" +
    "width:clamp(260px,48vw,420px);font-family:'Segoe UI',Tahoma,sans-serif;opacity:0;pointer-events:none;" +
    "transition:opacity 0.25s ease,transform 0.25s ease;backdrop-filter:blur(10px);}" +
    "#tweet-share-prompt.tweet-share-visible{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0);}" +
    "#tweet-share-prompt .tweet-share-title{font-size:16px;font-weight:600;line-height:1.4;}" +
    "#tweet-share-prompt .tweet-share-body{font-size:14px;line-height:1.5;color:rgba(255,255,255,0.85);}" +
    "#tweet-share-prompt .tweet-share-actions{display:flex;gap:10px;}" +
    "#tweet-share-prompt button{flex:1;border:none;border-radius:10px;padding:10px 14px;font-size:14px;font-weight:600;" +
    "cursor:pointer;transition:transform 0.15s ease,box-shadow 0.15s ease;}" +
    "#tweet-share-prompt button.share-primary{background:linear-gradient(135deg,#1d9bf0,#1d77f2);color:#fff;box-shadow:0 8px 16px rgba(23,140,255,0.35);}" +
    "#tweet-share-prompt button.share-primary:hover{transform:translateY(-1px);box-shadow:0 10px 20px rgba(23,140,255,0.45);}" +
    "#tweet-share-prompt button.share-secondary{background:rgba(255,255,255,0.12);color:#f1f1f1;}" +
    "#tweet-share-prompt button.share-secondary:hover{background:rgba(255,255,255,0.18);}" +
    "#tweet-share-prompt a{color:#9ad0ff;font-size:13px;text-decoration:none;}" +
    "#tweet-share-prompt a:hover{text-decoration:underline;}";
  document.head.appendChild(style);
};

TwitterSharePrompt.prototype.buildDom = function () {
  this.rootEl = document.createElement("div");
  this.rootEl.id = "tweet-share-prompt";

  var title = document.createElement("div");
  title.className = "tweet-share-title";
  title.textContent = "Donation tweet is live!";

  var body = document.createElement("div");
  body.className = "tweet-share-body";
  body.textContent =
    "Share the announcement with your followers and keep the love going.";

  var actions = document.createElement("div");
  actions.className = "tweet-share-actions";

  this.shareButton = document.createElement("button");
  this.shareButton.className = "share-primary";
  this.shareButton.type = "button";
  this.shareButton.textContent = "Share on X";
  this.handleShareClickBound = this.handleShareClick.bind(this);
  this.shareButton.addEventListener("click", this.handleShareClickBound);

  this.dismissButton = document.createElement("button");
  this.dismissButton.className = "share-secondary";
  this.dismissButton.type = "button";
  this.dismissButton.textContent = "Not now";
  this.hidePromptBound = this.hidePrompt.bind(this);
  this.dismissButton.addEventListener("click", this.hidePromptBound);

  actions.appendChild(this.shareButton);
  actions.appendChild(this.dismissButton);

  this.viewLink = document.createElement("a");
  this.viewLink.target = "_blank";
  this.viewLink.rel = "noopener";
  this.viewLink.textContent = "Open tweet in X";

  this.rootEl.appendChild(title);
  this.rootEl.appendChild(body);
  this.rootEl.appendChild(actions);
  this.rootEl.appendChild(this.viewLink);

  document.body.appendChild(this.rootEl);
};

TwitterSharePrompt.prototype.onAuthStateChanged = function (state) {
  if (state && typeof state.address === "string" && state.address.length) {
    this.currentAddress = state.address;
  } else if (!state || !state.isAuthenticated) {
    this.currentAddress = null;
    this.hidePrompt();
  }
};

TwitterSharePrompt.prototype.onDonationTweetReady = function (data) {
  if (!data || !data.tweetUrl || !data.signature) {
    return;
  }

  var address = this.currentAddress;
  if (!address) {
    return;
  }

  var isSender = data.sender && data.sender === address;
  var isRecipient = data.recipient && data.recipient === address;
  if (!isSender && !isRecipient) {
    return;
  }

  this.activeData = data;
  this.role = isSender ? "sender" : "recipient";
  this.updatePromptContent(data, this.role);
  this.showPrompt();
};

TwitterSharePrompt.prototype.updatePromptContent = function (data, role) {
  var titleEl = this.rootEl.querySelector(".tweet-share-title");
  var bodyEl = this.rootEl.querySelector(".tweet-share-body");

  var amountLabel = this.formatAmount(data.amount || data.amountSOL);
  var counterpartHandle =
    role === "sender" ? data.recipientTwitter : data.senderTwitter;
  var counterpartAddress = role === "sender" ? data.recipient : data.sender;
  var counterpartLabel = counterpartHandle
    ? "@" + counterpartHandle
    : this.truncateAddress(counterpartAddress);

  if (role === "sender") {
    titleEl.textContent = "Nice! Your donation tweet just posted.";
    bodyEl.textContent =
      "Let everyone know you backed " +
      counterpartLabel +
      " with " +
      amountLabel +
      " SOL.";
  } else {
    titleEl.textContent = "Someone just donated to you!";
    bodyEl.textContent =
      counterpartLabel +
      " sent you " +
      amountLabel +
      " SOL. Thank them publicly?";
  }

  if (data.tweetUrl) {
    this.viewLink.href = data.tweetUrl;
    this.viewLink.style.display = "inline";
  } else {
    this.viewLink.removeAttribute("href");
    this.viewLink.style.display = "none";
  }
};

TwitterSharePrompt.prototype.showPrompt = function () {
  if (!this.rootEl) {
    return;
  }
  this.rootEl.classList.add("tweet-share-visible");

  if (this.autoHideHandle) {
    window.clearTimeout(this.autoHideHandle);
  }
  var self = this;
  this.autoHideHandle = window.setTimeout(function () {
    self.hidePrompt();
  }, 22000);
};

TwitterSharePrompt.prototype.hidePrompt = function () {
  if (!this.rootEl) {
    return;
  }
  this.rootEl.classList.remove("tweet-share-visible");
  if (this.autoHideHandle) {
    window.clearTimeout(this.autoHideHandle);
    this.autoHideHandle = null;
  }
};

TwitterSharePrompt.prototype.handleShareClick = function () {
  if (!this.activeData || !this.activeData.tweetUrl) {
    this.hidePrompt();
    return;
  }

  var amountLabel = this.formatAmount(
    this.activeData.amount || this.activeData.amountSOL
  );
  var recipientLabel = this.activeData.recipientTwitter
    ? "@" + this.activeData.recipientTwitter
    : this.truncateAddress(this.activeData.recipient);
  var senderLabel = this.activeData.senderTwitter
    ? "@" + this.activeData.senderTwitter
    : this.truncateAddress(this.activeData.sender);

  var shareText;
  if (this.role === "sender") {
    shareText =
      "I just donated " +
      amountLabel +
      " $SOL to " +
      recipientLabel +
      " on @playplsgive!";
  } else {
    shareText =
      senderLabel +
      " just donated " +
      amountLabel +
      " $SOL to my booth on @playplsgive!";
  }

  var intentUrl =
    "https://twitter.com/intent/tweet?text=" +
    encodeURIComponent(shareText) +
    "&url=" +
    encodeURIComponent(this.activeData.tweetUrl);

  try {
    window.open(intentUrl, "_blank", "noopener");
  } catch (error) {
    console.warn("TwitterSharePrompt: Unable to open share window.", error);
  }

  this.hidePrompt();
};

TwitterSharePrompt.prototype.truncateAddress = function (address) {
  if (!address || typeof address !== "string") {
    return "someone";
  }
  if (address.length <= 8) {
    return address;
  }
  return (
    address.substring(0, 4) + "..." + address.substring(address.length - 4)
  );
};

TwitterSharePrompt.prototype.formatAmount = function (value) {
  var numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "0.0";
  }
  var formatted = numeric.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return formatted.length ? formatted : numeric.toString();
};

TwitterSharePrompt.prototype.destroy = function () {
  this.app.off("auth:stateChanged", this.onAuthStateChanged, this);
  this.app.off("donation:tweetReady", this.onDonationTweetReady, this);

  if (this.shareButton) {
    this.shareButton.removeEventListener("click", this.handleShareClick);
  }
  if (this.dismissButton) {
    this.dismissButton.removeEventListener("click", this.hidePrompt);
  }
  if (this.rootEl && this.rootEl.parentNode) {
    this.rootEl.parentNode.removeChild(this.rootEl);
  }
  this.rootEl = null;
  this.shareButton = null;
  this.dismissButton = null;
  this.viewLink = null;
  if (this.autoHideHandle) {
    window.clearTimeout(this.autoHideHandle);
    this.autoHideHandle = null;
  }
};
