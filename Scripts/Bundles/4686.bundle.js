/*! For license information please see 4686.bundle.js.LICENSE.txt */
"use strict";(self.webpackChunkpg_bundles=self.webpackChunkpg_bundles||[]).push([[4686],{4686:(e,t,i)=>{i.r(t),i.d(t,{W3mAllWalletsView:()=>Rt,W3mConnectingWcBasicView:()=>Pe,W3mDownloadsView:()=>St});var o=i(9806),r=i(848),n=i(8871),s=i(3748),a=i(4202),l=i(4591),c=i(7532),d=(i(1905),i(6405)),h=i(997),p=i(301),u=i(7177),w=i(3013),g=i(6181),m=(i(2004),function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s});let b=class extends o.WF{constructor(){super(),this.unsubscribe=[],this.tabIdx=void 0,this.connectors=p.a.state.connectors,this.count=a.N.state.count,this.filteredCount=a.N.state.filteredWallets.length,this.isFetchingRecommendedWallets=a.N.state.isFetchingRecommendedWallets,this.unsubscribe.push(p.a.subscribeKey("connectors",e=>this.connectors=e),a.N.subscribeKey("count",e=>this.count=e),a.N.subscribeKey("filteredWallets",e=>this.filteredCount=e.length),a.N.subscribeKey("isFetchingRecommendedWallets",e=>this.isFetchingRecommendedWallets=e))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){const e=this.connectors.find(e=>"walletConnect"===e.id),{allWallets:t}=s.H.state;if(!e||"HIDE"===t)return null;if("ONLY_MOBILE"===t&&!n.w.isMobile())return null;const i=a.N.state.featured.length,r=this.count+i,l=r<10?r:10*Math.floor(r/10),c=this.filteredCount>0?this.filteredCount:l;let p=`${c}`;this.filteredCount>0?p=`${this.filteredCount}`:c<r&&(p=`${c}+`);const w=u.x.hasAnyConnection(h.o.CONNECTOR_ID.WALLET_CONNECT);return o.qy`
      <wui-list-wallet
        name="Search Wallet"
        walletIcon="search"
        showAllWallets
        @click=${this.onAllWallets.bind(this)}
        tagLabel=${p}
        tagVariant="info"
        data-testid="all-wallets"
        tabIdx=${(0,d.J)(this.tabIdx)}
        .loading=${this.isFetchingRecommendedWallets}
        ?disabled=${w}
        size="sm"
      ></wui-list-wallet>
    `}onAllWallets(){w.E.sendEvent({type:"track",event:"CLICK_ALL_WALLETS"}),g.I.push("AllWallets",{redirectView:g.I.state.data?.redirectView})}};m([(0,r.MZ)()],b.prototype,"tabIdx",void 0),m([(0,r.wk)()],b.prototype,"connectors",void 0),m([(0,r.wk)()],b.prototype,"count",void 0),m([(0,r.wk)()],b.prototype,"filteredCount",void 0),m([(0,r.wk)()],b.prototype,"isFetchingRecommendedWallets",void 0),b=m([(0,c.EM)("w3m-all-wallets-widget")],b);var f=i(2558),y=i(8062),v=i(3821),$=i(5987);const x=c.AH`
  :host {
    margin-top: ${({spacing:e})=>e[1]};
  }
  wui-separator {
    margin: ${({spacing:e})=>e[3]} calc(${({spacing:e})=>e[3]} * -1)
      ${({spacing:e})=>e[2]} calc(${({spacing:e})=>e[3]} * -1);
    width: calc(100% + ${({spacing:e})=>e[3]} * 2);
  }
`;var k=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let C=class extends o.WF{constructor(){super(),this.unsubscribe=[],this.connectors=p.a.state.connectors,this.recommended=a.N.state.recommended,this.featured=a.N.state.featured,this.explorerWallets=a.N.state.explorerWallets,this.connections=u.x.state.connections,this.connectorImages=f.j.state.connectorImages,this.loadingTelegram=!1,this.unsubscribe.push(p.a.subscribeKey("connectors",e=>this.connectors=e),u.x.subscribeKey("connections",e=>this.connections=e),f.j.subscribeKey("connectorImages",e=>this.connectorImages=e),a.N.subscribeKey("recommended",e=>this.recommended=e),a.N.subscribeKey("featured",e=>this.featured=e),a.N.subscribeKey("explorerFilteredWallets",e=>{this.explorerWallets=e?.length?e:a.N.state.explorerWallets}),a.N.subscribeKey("explorerWallets",e=>{this.explorerWallets?.length||(this.explorerWallets=e)})),n.w.isTelegram()&&n.w.isIos()&&(this.loadingTelegram=!u.x.state.wcUri,this.unsubscribe.push(u.x.subscribeKey("wcUri",e=>this.loadingTelegram=!e)))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){return o.qy`
      <wui-flex flexDirection="column" gap="2"> ${this.connectorListTemplate()} </wui-flex>
    `}mapConnectorsToExplorerWallets(e,t){return e.map(e=>{if("MULTI_CHAIN"===e.type&&e.connectors){const i=e.connectors.map(e=>e.id),o=e.connectors.map(e=>e.name),r=e.connectors.map(e=>e.info?.rdns),n=t?.find(e=>i.includes(e.id)||o.includes(e.name)||e.rdns&&(r.includes(e.rdns)||i.includes(e.rdns)));return e.explorerWallet=n??e.explorerWallet,e}const i=t?.find(t=>t.id===e.id||t.rdns===e.info?.rdns||t.name===e.name);return e.explorerWallet=i??e.explorerWallet,e})}processConnectorsByType(e,t=!0){const i=$.g.sortConnectorsByExplorerWallet([...e]);return t?i.filter($.g.showConnector):i}connectorListTemplate(){const e=this.mapConnectorsToExplorerWallets(this.connectors,this.explorerWallets??[]),t=$.g.getConnectorsByType(e,this.recommended,this.featured),i=this.processConnectorsByType(t.announced.filter(e=>"walletConnect"!==e.id)),o=this.processConnectorsByType(t.injected),r=this.processConnectorsByType(t.multiChain.filter(e=>"WalletConnect"!==e.name),!1),s=t.custom,a=t.recent,l=this.processConnectorsByType(t.external.filter(e=>e.id!==h.o.CONNECTOR_ID.COINBASE_SDK)),c=t.recommended,d=t.featured,p=$.g.getConnectorTypeOrder({custom:s,recent:a,announced:i,injected:o,multiChain:r,recommended:c,featured:d,external:l}),u=this.connectors.find(e=>"walletConnect"===e.id),w=n.w.isMobile(),g=[];for(const e of p)switch(e){case"walletConnect":!w&&u&&g.push({kind:"connector",subtype:"walletConnect",connector:u});break;case"recent":$.g.getFilteredRecentWallets().forEach(e=>g.push({kind:"wallet",subtype:"recent",wallet:e}));break;case"injected":r.forEach(e=>g.push({kind:"connector",subtype:"multiChain",connector:e})),i.forEach(e=>g.push({kind:"connector",subtype:"announced",connector:e})),o.forEach(e=>g.push({kind:"connector",subtype:"injected",connector:e}));break;case"featured":d.forEach(e=>g.push({kind:"wallet",subtype:"featured",wallet:e}));break;case"custom":$.g.getFilteredCustomWallets(s??[]).forEach(e=>g.push({kind:"wallet",subtype:"custom",wallet:e}));break;case"external":l.forEach(e=>g.push({kind:"connector",subtype:"external",connector:e}));break;case"recommended":$.g.getCappedRecommendedWallets(c).forEach(e=>g.push({kind:"wallet",subtype:"recommended",wallet:e}));break;default:console.warn(`Unknown connector type: ${e}`)}return g.map((e,t)=>"connector"===e.kind?this.renderConnector(e,t):this.renderWallet(e,t))}renderConnector(e,t){const i=e.connector,r=y.$.getConnectorImage(i)||this.connectorImages[i?.imageId??""],n=(this.connections.get(i.chain)??[]).some(e=>v.y.isLowerCaseMatch(e.connectorId,i.id));let s,a;"multiChain"===e.subtype?(s="multichain",a="info"):"walletConnect"===e.subtype?(s="qr code",a="accent"):"injected"===e.subtype||"announced"===e.subtype?(s=n?"connected":"installed",a=n?"info":"success"):(s=void 0,a=void 0);const l=u.x.hasAnyConnection(h.o.CONNECTOR_ID.WALLET_CONNECT),c=("walletConnect"===e.subtype||"external"===e.subtype)&&l;return o.qy`
      <w3m-list-wallet
        displayIndex=${t}
        imageSrc=${(0,d.J)(r)}
        .installed=${!0}
        name=${i.name??"Unknown"}
        .tagVariant=${a}
        tagLabel=${(0,d.J)(s)}
        data-testid=${`wallet-selector-${i.id.toLowerCase()}`}
        size="sm"
        @click=${()=>this.onClickConnector(e)}
        tabIdx=${(0,d.J)(this.tabIdx)}
        ?disabled=${c}
        rdnsId=${(0,d.J)(i.explorerWallet?.rdns||void 0)}
        walletRank=${(0,d.J)(i.explorerWallet?.order)}
      >
      </w3m-list-wallet>
    `}onClickConnector(e){const t=g.I.state.data?.redirectView;return"walletConnect"===e.subtype?(p.a.setActiveConnector(e.connector),void(n.w.isMobile()?g.I.push("AllWallets"):g.I.push("ConnectingWalletConnect",{redirectView:t}))):"multiChain"===e.subtype?(p.a.setActiveConnector(e.connector),void g.I.push("ConnectingMultiChain",{redirectView:t})):"injected"===e.subtype?(p.a.setActiveConnector(e.connector),void g.I.push("ConnectingExternal",{connector:e.connector,redirectView:t,wallet:e.connector.explorerWallet})):"announced"===e.subtype?"walletConnect"===e.connector.id?void(n.w.isMobile()?g.I.push("AllWallets"):g.I.push("ConnectingWalletConnect",{redirectView:t})):void g.I.push("ConnectingExternal",{connector:e.connector,redirectView:t,wallet:e.connector.explorerWallet}):void g.I.push("ConnectingExternal",{connector:e.connector,redirectView:t})}renderWallet(e,t){const i=e.wallet,r=y.$.getWalletImage(i),n=u.x.hasAnyConnection(h.o.CONNECTOR_ID.WALLET_CONNECT),s=this.loadingTelegram,a="recent"===e.subtype?"recent":void 0,l="recent"===e.subtype?"info":void 0;return o.qy`
      <w3m-list-wallet
        displayIndex=${t}
        imageSrc=${(0,d.J)(r)}
        name=${i.name??"Unknown"}
        @click=${()=>this.onClickWallet(e)}
        size="sm"
        data-testid=${`wallet-selector-${i.id}`}
        tabIdx=${(0,d.J)(this.tabIdx)}
        ?loading=${s}
        ?disabled=${n}
        rdnsId=${(0,d.J)(i.rdns||void 0)}
        walletRank=${(0,d.J)(i.order)}
        tagLabel=${(0,d.J)(a)}
        .tagVariant=${l}
      >
      </w3m-list-wallet>
    `}onClickWallet(e){const t=g.I.state.data?.redirectView;if("featured"===e.subtype)return void p.a.selectWalletConnector(e.wallet);if("recent"===e.subtype){if(this.loadingTelegram)return;return void p.a.selectWalletConnector(e.wallet)}if("custom"===e.subtype){if(this.loadingTelegram)return;return void g.I.push("ConnectingWalletConnect",{wallet:e.wallet,redirectView:t})}if(this.loadingTelegram)return;const i=p.a.getConnector({id:e.wallet.id,rdns:e.wallet.rdns});i?g.I.push("ConnectingExternal",{connector:i,redirectView:t}):g.I.push("ConnectingWalletConnect",{wallet:e.wallet,redirectView:t})}};C.styles=x,k([(0,r.MZ)({type:Number})],C.prototype,"tabIdx",void 0),k([(0,r.wk)()],C.prototype,"connectors",void 0),k([(0,r.wk)()],C.prototype,"recommended",void 0),k([(0,r.wk)()],C.prototype,"featured",void 0),k([(0,r.wk)()],C.prototype,"explorerWallets",void 0),k([(0,r.wk)()],C.prototype,"connections",void 0),k([(0,r.wk)()],C.prototype,"connectorImages",void 0),k([(0,r.wk)()],C.prototype,"loadingTelegram",void 0),C=k([(0,c.EM)("w3m-connector-list")],C);var R=i(1170),E=i(3155),W=i(2084),I=i(1080),S=i(1866),T=i(5926),O=i(6712),P=i(343),M=(i(5163),i(8179),i(8668));const j=M.AH`
  :host {
    flex: 1;
    height: 100%;
  }

  button {
    width: 100%;
    height: 100%;
    display: inline-flex;
    align-items: center;
    padding: ${({spacing:e})=>e[1]} ${({spacing:e})=>e[2]};
    column-gap: ${({spacing:e})=>e[1]};
    color: ${({tokens:e})=>e.theme.textSecondary};
    border-radius: ${({borderRadius:e})=>e[20]};
    background-color: transparent;
    transition: background-color ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color;
  }

  /* -- Hover & Active states ----------------------------------------------------------- */
  button[data-active='true'] {
    color: ${({tokens:e})=>e.theme.textPrimary};
    background-color: ${({tokens:e})=>e.theme.foregroundTertiary};
  }

  button:hover:enabled:not([data-active='true']),
  button:active:enabled:not([data-active='true']) {
    wui-text,
    wui-icon {
      color: ${({tokens:e})=>e.theme.textPrimary};
    }
  }
`;var A=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};const q={lg:"lg-regular",md:"md-regular",sm:"sm-regular"},L={lg:"md",md:"sm",sm:"sm"};let _=class extends o.WF{constructor(){super(...arguments),this.icon="mobile",this.size="md",this.label="",this.active=!1}render(){return o.qy`
      <button data-active=${this.active}>
        ${this.icon?o.qy`<wui-icon size=${L[this.size]} name=${this.icon}></wui-icon>`:""}
        <wui-text variant=${q[this.size]}> ${this.label} </wui-text>
      </button>
    `}};_.styles=[O.W5,O.fD,j],A([(0,r.MZ)()],_.prototype,"icon",void 0),A([(0,r.MZ)()],_.prototype,"size",void 0),A([(0,r.MZ)()],_.prototype,"label",void 0),A([(0,r.MZ)({type:Boolean})],_.prototype,"active",void 0),_=A([(0,P.E)("wui-tab-item")],_);const z=M.AH`
  :host {
    display: inline-flex;
    align-items: center;
    background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    border-radius: ${({borderRadius:e})=>e[32]};
    padding: ${({spacing:e})=>e["01"]};
    box-sizing: border-box;
  }

  :host([data-size='sm']) {
    height: 26px;
  }

  :host([data-size='md']) {
    height: 36px;
  }
`;var N=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let Z=class extends o.WF{constructor(){super(...arguments),this.tabs=[],this.onTabChange=()=>null,this.size="md",this.activeTab=0}render(){return this.dataset.size=this.size,this.tabs.map((e,t)=>{const i=t===this.activeTab;return o.qy`
        <wui-tab-item
          @click=${()=>this.onTabClick(t)}
          icon=${e.icon}
          size=${this.size}
          label=${e.label}
          ?active=${i}
          data-active=${i}
          data-testid="tab-${e.label?.toLowerCase()}"
        ></wui-tab-item>
      `})}onTabClick(e){this.activeTab=e,this.onTabChange(e)}};Z.styles=[O.W5,O.fD,z],N([(0,r.MZ)({type:Array})],Z.prototype,"tabs",void 0),N([(0,r.MZ)()],Z.prototype,"onTabChange",void 0),N([(0,r.MZ)()],Z.prototype,"size",void 0),N([(0,r.wk)()],Z.prototype,"activeTab",void 0),Z=N([(0,P.E)("wui-tabs")],Z);var D=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let B=class extends o.WF{constructor(){super(...arguments),this.platformTabs=[],this.unsubscribe=[],this.platforms=[],this.onSelectPlatfrom=void 0}disconnectCallback(){this.unsubscribe.forEach(e=>e())}render(){const e=this.generateTabs();return o.qy`
      <wui-flex justifyContent="center" .padding=${["0","0","4","0"]}>
        <wui-tabs .tabs=${e} .onTabChange=${this.onTabChange.bind(this)}></wui-tabs>
      </wui-flex>
    `}generateTabs(){const e=this.platforms.map(e=>"browser"===e?{label:"Browser",icon:"extension",platform:"browser"}:"mobile"===e?{label:"Mobile",icon:"mobile",platform:"mobile"}:"qrcode"===e?{label:"Mobile",icon:"mobile",platform:"qrcode"}:"web"===e?{label:"Webapp",icon:"browser",platform:"web"}:"desktop"===e?{label:"Desktop",icon:"desktop",platform:"desktop"}:{label:"Browser",icon:"extension",platform:"unsupported"});return this.platformTabs=e.map(({platform:e})=>e),e}onTabChange(e){const t=this.platformTabs[e];t&&this.onSelectPlatfrom?.(t)}};D([(0,r.MZ)({type:Array})],B.prototype,"platforms",void 0),D([(0,r.MZ)()],B.prototype,"onSelectPlatfrom",void 0),B=D([(0,c.EM)("w3m-connecting-header")],B);var F=i(2391);i(725);const H=M.AH`
  :host {
    width: var(--local-width);
  }

  button {
    width: var(--local-width);
    white-space: nowrap;
    column-gap: ${({spacing:e})=>e[2]};
    transition:
      scale ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-1"]},
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      border-radius ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]};
    will-change: scale, background-color, border-radius;
    cursor: pointer;
  }

  /* -- Sizes --------------------------------------------------- */
  button[data-size='sm'] {
    border-radius: ${({borderRadius:e})=>e[2]};
    padding: 0 ${({spacing:e})=>e[2]};
    height: 28px;
  }

  button[data-size='md'] {
    border-radius: ${({borderRadius:e})=>e[3]};
    padding: 0 ${({spacing:e})=>e[4]};
    height: 38px;
  }

  button[data-size='lg'] {
    border-radius: ${({borderRadius:e})=>e[4]};
    padding: 0 ${({spacing:e})=>e[5]};
    height: 48px;
  }

  /* -- Variants --------------------------------------------------------- */
  button[data-variant='accent-primary'] {
    background-color: ${({tokens:e})=>e.core.backgroundAccentPrimary};
    color: ${({tokens:e})=>e.theme.textInvert};
  }

  button[data-variant='accent-secondary'] {
    background-color: ${({tokens:e})=>e.core.foregroundAccent010};
    color: ${({tokens:e})=>e.core.textAccentPrimary};
  }

  button[data-variant='neutral-primary'] {
    background-color: ${({tokens:e})=>e.theme.backgroundInvert};
    color: ${({tokens:e})=>e.theme.textInvert};
  }

  button[data-variant='neutral-secondary'] {
    background-color: transparent;
    border: 1px solid ${({tokens:e})=>e.theme.borderSecondary};
    color: ${({tokens:e})=>e.theme.textPrimary};
  }

  button[data-variant='neutral-tertiary'] {
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    color: ${({tokens:e})=>e.theme.textPrimary};
  }

  button[data-variant='error-primary'] {
    background-color: ${({tokens:e})=>e.core.textError};
    color: ${({tokens:e})=>e.theme.textInvert};
  }

  button[data-variant='error-secondary'] {
    background-color: ${({tokens:e})=>e.core.backgroundError};
    color: ${({tokens:e})=>e.core.textError};
  }

  button[data-variant='shade'] {
    background: var(--wui-color-gray-glass-002);
    color: var(--wui-color-fg-200);
    border: none;
    box-shadow: inset 0 0 0 1px var(--wui-color-gray-glass-005);
  }

  /* -- Focus states --------------------------------------------------- */
  button[data-size='sm']:focus-visible:enabled {
    border-radius: 28px;
  }

  button[data-size='md']:focus-visible:enabled {
    border-radius: 38px;
  }

  button[data-size='lg']:focus-visible:enabled {
    border-radius: 48px;
  }
  button[data-variant='shade']:focus-visible:enabled {
    background: var(--wui-color-gray-glass-005);
    box-shadow:
      inset 0 0 0 1px var(--wui-color-gray-glass-010),
      0 0 0 4px var(--wui-color-gray-glass-002);
  }

  /* -- Hover & Active states ----------------------------------------------------------- */
  @media (hover: hover) {
    button[data-size='sm']:hover:enabled {
      border-radius: 28px;
    }

    button[data-size='md']:hover:enabled {
      border-radius: 38px;
    }

    button[data-size='lg']:hover:enabled {
      border-radius: 48px;
    }

    button[data-variant='shade']:hover:enabled {
      background: var(--wui-color-gray-glass-002);
    }

    button[data-variant='shade']:active:enabled {
      background: var(--wui-color-gray-glass-005);
    }
  }

  button[data-size='sm']:active:enabled {
    border-radius: 28px;
  }

  button[data-size='md']:active:enabled {
    border-radius: 38px;
  }

  button[data-size='lg']:active:enabled {
    border-radius: 48px;
  }

  /* -- Disabled states --------------------------------------------------- */
  button:disabled {
    opacity: 0.3;
  }
`;var U=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};const V={lg:"lg-regular-mono",md:"md-regular-mono",sm:"sm-regular-mono"},J={lg:"md",md:"md",sm:"sm"};let K=class extends o.WF{constructor(){super(...arguments),this.size="lg",this.disabled=!1,this.fullWidth=!1,this.loading=!1,this.variant="accent-primary"}render(){this.style.cssText=`\n    --local-width: ${this.fullWidth?"100%":"auto"};\n     `;const e=this.textVariant??V[this.size];return o.qy`
      <button data-variant=${this.variant} data-size=${this.size} ?disabled=${this.disabled}>
        ${this.loadingTemplate()}
        <slot name="iconLeft"></slot>
        <wui-text variant=${e} color="inherit">
          <slot></slot>
        </wui-text>
        <slot name="iconRight"></slot>
      </button>
    `}loadingTemplate(){if(this.loading){const e=J[this.size],t="neutral-primary"===this.variant||"accent-primary"===this.variant?"invert":"primary";return o.qy`<wui-loading-spinner color=${t} size=${e}></wui-loading-spinner>`}return null}};K.styles=[O.W5,O.fD,H],U([(0,r.MZ)()],K.prototype,"size",void 0),U([(0,r.MZ)({type:Boolean})],K.prototype,"disabled",void 0),U([(0,r.MZ)({type:Boolean})],K.prototype,"fullWidth",void 0),U([(0,r.MZ)({type:Boolean})],K.prototype,"loading",void 0),U([(0,r.MZ)()],K.prototype,"variant",void 0),U([(0,r.MZ)()],K.prototype,"textVariant",void 0),K=U([(0,P.E)("wui-button")],K),i(2139),i(5375),i(8460);const G=M.AH`
  :host {
    display: block;
    width: 100px;
    height: 100px;
  }

  svg {
    width: 100px;
    height: 100px;
  }

  rect {
    fill: none;
    stroke: ${e=>e.colors.accent100};
    stroke-width: 3px;
    stroke-linecap: round;
    animation: dash 1s linear infinite;
  }

  @keyframes dash {
    to {
      stroke-dashoffset: 0px;
    }
  }
`;var Q=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let X=class extends o.WF{constructor(){super(...arguments),this.radius=36}render(){return this.svgLoaderTemplate()}svgLoaderTemplate(){const e=this.radius>50?50:this.radius,t=36-e,i=116+t,r=245+t,n=360+1.75*t;return o.qy`
      <svg viewBox="0 0 110 110" width="110" height="110">
        <rect
          x="2"
          y="2"
          width="106"
          height="106"
          rx=${e}
          stroke-dasharray="${i} ${r}"
          stroke-dashoffset=${n}
        />
      </svg>
    `}};X.styles=[O.W5,G],Q([(0,r.MZ)({type:Number})],X.prototype,"radius",void 0),X=Q([(0,P.E)("wui-loading-thumbnail")],X),i(4661),i(304),i(8836);const Y=M.AH`
  wui-flex {
    width: 100%;
    height: 52px;
    box-sizing: border-box;
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: ${({borderRadius:e})=>e[5]};
    padding-left: ${({spacing:e})=>e[3]};
    padding-right: ${({spacing:e})=>e[3]};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({spacing:e})=>e[6]};
  }

  wui-text {
    color: ${({tokens:e})=>e.theme.textSecondary};
  }

  wui-icon {
    width: 12px;
    height: 12px;
  }
`;var ee=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let te=class extends o.WF{constructor(){super(...arguments),this.disabled=!1,this.label="",this.buttonLabel=""}render(){return o.qy`
      <wui-flex justifyContent="space-between" alignItems="center">
        <wui-text variant="lg-regular" color="inherit">${this.label}</wui-text>
        <wui-button variant="accent-secondary" size="sm">
          ${this.buttonLabel}
          <wui-icon name="chevronRight" color="inherit" size="inherit" slot="iconRight"></wui-icon>
        </wui-button>
      </wui-flex>
    `}};te.styles=[O.W5,O.fD,Y],ee([(0,r.MZ)({type:Boolean})],te.prototype,"disabled",void 0),ee([(0,r.MZ)()],te.prototype,"label",void 0),ee([(0,r.MZ)()],te.prototype,"buttonLabel",void 0),te=ee([(0,P.E)("wui-cta-button")],te);const ie=c.AH`
  :host {
    display: block;
    padding: 0 ${({spacing:e})=>e[5]} ${({spacing:e})=>e[5]};
  }
`;var oe=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let re=class extends o.WF{constructor(){super(...arguments),this.wallet=void 0}render(){if(!this.wallet)return this.style.display="none",null;const{name:e,app_store:t,play_store:i,chrome_store:r,homepage:s}=this.wallet,a=n.w.isMobile(),l=n.w.isIos(),d=n.w.isAndroid(),h=[t,i,s,r].filter(Boolean).length>1,p=c.Zv.getTruncateString({string:e,charsStart:12,charsEnd:0,truncate:"end"});return h&&!a?o.qy`
        <wui-cta-button
          label=${`Don't have ${p}?`}
          buttonLabel="Get"
          @click=${()=>g.I.push("Downloads",{wallet:this.wallet})}
        ></wui-cta-button>
      `:!h&&s?o.qy`
        <wui-cta-button
          label=${`Don't have ${p}?`}
          buttonLabel="Get"
          @click=${this.onHomePage.bind(this)}
        ></wui-cta-button>
      `:t&&l?o.qy`
        <wui-cta-button
          label=${`Don't have ${p}?`}
          buttonLabel="Get"
          @click=${this.onAppStore.bind(this)}
        ></wui-cta-button>
      `:i&&d?o.qy`
        <wui-cta-button
          label=${`Don't have ${p}?`}
          buttonLabel="Get"
          @click=${this.onPlayStore.bind(this)}
        ></wui-cta-button>
      `:(this.style.display="none",null)}onAppStore(){this.wallet?.app_store&&n.w.openHref(this.wallet.app_store,"_blank")}onPlayStore(){this.wallet?.play_store&&n.w.openHref(this.wallet.play_store,"_blank")}onHomePage(){this.wallet?.homepage&&n.w.openHref(this.wallet.homepage,"_blank")}};re.styles=[ie],oe([(0,r.MZ)({type:Object})],re.prototype,"wallet",void 0),re=oe([(0,c.EM)("w3m-mobile-download-links")],re);const ne=c.AH`
  @keyframes shake {
    0% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(3px);
    }
    50% {
      transform: translateX(-3px);
    }
    75% {
      transform: translateX(3px);
    }
    100% {
      transform: translateX(0);
    }
  }

  wui-flex:first-child:not(:only-child) {
    position: relative;
  }

  wui-wallet-image {
    width: 56px;
    height: 56px;
  }

  wui-loading-thumbnail {
    position: absolute;
  }

  wui-icon-box {
    position: absolute;
    right: calc(${({spacing:e})=>e[1]} * -1);
    bottom: calc(${({spacing:e})=>e[1]} * -1);
    opacity: 0;
    transform: scale(0.5);
    transition-property: opacity, transform;
    transition-duration: ${({durations:e})=>e.lg};
    transition-timing-function: ${({easings:e})=>e["ease-out-power-2"]};
    will-change: opacity, transform;
  }

  wui-text[align='center'] {
    width: 100%;
    padding: 0px ${({spacing:e})=>e[4]};
  }

  [data-error='true'] wui-icon-box {
    opacity: 1;
    transform: scale(1);
  }

  [data-error='true'] > wui-flex:first-child {
    animation: shake 250ms ${({easings:e})=>e["ease-out-power-2"]} both;
  }

  [data-retry='false'] wui-link {
    display: none;
  }

  [data-retry='true'] wui-link {
    display: block;
    opacity: 1;
  }

  w3m-mobile-download-links {
    padding: 0px;
    width: 100%;
  }
`;var se=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};class ae extends o.WF{constructor(){super(),this.wallet=g.I.state.data?.wallet,this.connector=g.I.state.data?.connector,this.timeout=void 0,this.secondaryBtnIcon="refresh",this.onConnect=void 0,this.onRender=void 0,this.onAutoConnect=void 0,this.isWalletConnect=!0,this.unsubscribe=[],this.imageSrc=y.$.getConnectorImage(this.connector)??y.$.getWalletImage(this.wallet),this.name=this.wallet?.name??this.connector?.name??"Wallet",this.isRetrying=!1,this.uri=u.x.state.wcUri,this.error=u.x.state.wcError,this.ready=!1,this.showRetry=!1,this.label=void 0,this.secondaryBtnLabel="Try again",this.secondaryLabel="Accept connection request in the wallet",this.isLoading=!1,this.isMobile=!1,this.onRetry=void 0,this.unsubscribe.push(u.x.subscribeKey("wcUri",e=>{this.uri=e,this.isRetrying&&this.onRetry&&(this.isRetrying=!1,this.onConnect?.())}),u.x.subscribeKey("wcError",e=>this.error=e)),(n.w.isTelegram()||n.w.isSafari())&&n.w.isIos()&&u.x.state.wcUri&&this.onConnect?.()}firstUpdated(){this.onAutoConnect?.(),this.showRetry=!this.onAutoConnect}disconnectedCallback(){this.unsubscribe.forEach(e=>e()),u.x.setWcError(!1),clearTimeout(this.timeout)}render(){this.onRender?.(),this.onShowRetry();const e=this.error?"Connection can be declined if a previous request is still active":this.secondaryLabel;let t="";return this.label?t=this.label:(t=`Continue in ${this.name}`,this.error&&(t="Connection declined")),o.qy`
      <wui-flex
        data-error=${(0,d.J)(this.error)}
        data-retry=${this.showRetry}
        flexDirection="column"
        alignItems="center"
        .padding=${["10","5","5","5"]}
        gap="6"
      >
        <wui-flex gap="2" justifyContent="center" alignItems="center">
          <wui-wallet-image size="lg" imageSrc=${(0,d.J)(this.imageSrc)}></wui-wallet-image>

          ${this.error?null:this.loaderTemplate()}

          <wui-icon-box
            color="error"
            icon="close"
            size="sm"
            border
            borderColor="wui-color-bg-125"
          ></wui-icon-box>
        </wui-flex>

        <wui-flex flexDirection="column" alignItems="center" gap="6"> <wui-flex
          flexDirection="column"
          alignItems="center"
          gap="2"
          .padding=${["2","0","0","0"]}
        >
          <wui-text align="center" variant="lg-medium" color=${this.error?"error":"primary"}>
            ${t}
          </wui-text>
          <wui-text align="center" variant="lg-regular" color="secondary">${e}</wui-text>
        </wui-flex>

        ${this.secondaryBtnLabel?o.qy`
                <wui-button
                  variant="neutral-secondary"
                  size="md"
                  ?disabled=${this.isRetrying||this.isLoading}
                  @click=${this.onTryAgain.bind(this)}
                  data-testid="w3m-connecting-widget-secondary-button"
                >
                  <wui-icon
                    color="inherit"
                    slot="iconLeft"
                    name=${this.secondaryBtnIcon}
                  ></wui-icon>
                  ${this.secondaryBtnLabel}
                </wui-button>
              `:null}
      </wui-flex>

      ${this.isWalletConnect?o.qy`
              <wui-flex .padding=${["0","5","5","5"]} justifyContent="center">
                <wui-link
                  @click=${this.onCopyUri}
                  variant="secondary"
                  icon="copy"
                  data-testid="wui-link-copy"
                >
                  Copy link
                </wui-link>
              </wui-flex>
            `:null}

      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links></wui-flex>
      </wui-flex>
    `}onShowRetry(){if(this.error&&!this.showRetry){this.showRetry=!0;const e=this.shadowRoot?.querySelector("wui-button");e?.animate([{opacity:0},{opacity:1}],{fill:"forwards",easing:"ease"})}}onTryAgain(){u.x.setWcError(!1),this.onRetry?(this.isRetrying=!0,this.onRetry?.()):this.onConnect?.()}loaderTemplate(){const e=F.W.state.themeVariables["--w3m-border-radius-master"],t=e?parseInt(e.replace("px",""),10):4;return o.qy`<wui-loading-thumbnail radius=${9*t}></wui-loading-thumbnail>`}onCopyUri(){try{this.uri&&(n.w.copyToClopboard(this.uri),W.P.showSuccess("Link copied"))}catch{W.P.showError("Failed to copy")}}}ae.styles=ne,se([(0,r.wk)()],ae.prototype,"isRetrying",void 0),se([(0,r.wk)()],ae.prototype,"uri",void 0),se([(0,r.wk)()],ae.prototype,"error",void 0),se([(0,r.wk)()],ae.prototype,"ready",void 0),se([(0,r.wk)()],ae.prototype,"showRetry",void 0),se([(0,r.wk)()],ae.prototype,"label",void 0),se([(0,r.wk)()],ae.prototype,"secondaryBtnLabel",void 0),se([(0,r.wk)()],ae.prototype,"secondaryLabel",void 0),se([(0,r.wk)()],ae.prototype,"isLoading",void 0),se([(0,r.MZ)({type:Boolean})],ae.prototype,"isMobile",void 0),se([(0,r.MZ)()],ae.prototype,"onRetry",void 0);let le=class extends ae{constructor(){if(super(),!this.wallet)throw new Error("w3m-connecting-wc-browser: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.onAutoConnect=this.onConnectProxy.bind(this),w.E.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"browser",displayIndex:this.wallet?.display_index,walletRank:this.wallet.order,view:g.I.state.view}})}async onConnectProxy(){try{this.error=!1;const{connectors:e}=p.a.state,t=e.find(e=>"ANNOUNCED"===e.type&&e.info?.rdns===this.wallet?.rdns||"INJECTED"===e.type||e.name===this.wallet?.name);if(!t)throw new Error("w3m-connecting-wc-browser: No connector found");await u.x.connectExternal(t,t.chain),I.W.close(),w.E.sendEvent({type:"track",event:"CONNECT_SUCCESS",properties:{method:"browser",name:this.wallet?.name||"Unknown",view:g.I.state.view,walletRank:this.wallet?.order}})}catch(e){e instanceof S.A&&e.originalName===R.RQ.PROVIDER_RPC_ERROR_NAME.USER_REJECTED_REQUEST?w.E.sendEvent({type:"track",event:"USER_REJECTED",properties:{message:e.message}}):w.E.sendEvent({type:"track",event:"CONNECT_ERROR",properties:{message:e?.message??"Unknown"}}),this.error=!0}}};le=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s}([(0,c.EM)("w3m-connecting-wc-browser")],le);let ce=class extends ae{constructor(){if(super(),!this.wallet)throw new Error("w3m-connecting-wc-desktop: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.onRender=this.onRenderProxy.bind(this),w.E.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"desktop",displayIndex:this.wallet?.display_index,walletRank:this.wallet.order,view:g.I.state.view}})}onRenderProxy(){!this.ready&&this.uri&&(this.ready=!0,this.onConnect?.())}onConnectProxy(){if(this.wallet?.desktop_link&&this.uri)try{this.error=!1;const{desktop_link:e,name:t}=this.wallet,{redirect:i,href:o}=n.w.formatNativeUrl(e,this.uri);u.x.setWcLinking({name:t,href:o}),u.x.setRecentWallet(this.wallet),n.w.openHref(i,"_blank")}catch{this.error=!0}}};ce=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s}([(0,c.EM)("w3m-connecting-wc-desktop")],ce);var de=i(7355),he=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let pe=class extends ae{constructor(){if(super(),this.btnLabelTimeout=void 0,this.redirectDeeplink=void 0,this.redirectUniversalLink=void 0,this.target=void 0,this.preferUniversalLinks=s.H.state.experimental_preferUniversalLinks,this.isLoading=!0,this.onConnect=()=>{if(this.wallet?.mobile_link&&this.uri)try{this.error=!1;const{mobile_link:e,link_mode:t,name:i}=this.wallet,{redirect:o,redirectUniversalLink:r,href:s}=n.w.formatNativeUrl(e,this.uri,t);this.redirectDeeplink=o,this.redirectUniversalLink=r,this.target=n.w.isIframe()?"_top":"_self",u.x.setWcLinking({name:i,href:s}),u.x.setRecentWallet(this.wallet),this.preferUniversalLinks&&this.redirectUniversalLink?n.w.openHref(this.redirectUniversalLink,this.target):n.w.openHref(this.redirectDeeplink,this.target)}catch(e){w.E.sendEvent({type:"track",event:"CONNECT_PROXY_ERROR",properties:{message:e instanceof Error?e.message:"Error parsing the deeplink",uri:this.uri,mobile_link:this.wallet.mobile_link,name:this.wallet.name}}),this.error=!0}},!this.wallet)throw new Error("w3m-connecting-wc-mobile: No wallet provided");this.secondaryBtnLabel="Open",this.secondaryLabel=de.oU.CONNECT_LABELS.MOBILE,this.secondaryBtnIcon="externalLink",this.onHandleURI(),this.unsubscribe.push(u.x.subscribeKey("wcUri",()=>{this.onHandleURI()})),w.E.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"mobile",displayIndex:this.wallet?.display_index,walletRank:this.wallet.order,view:g.I.state.view}})}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.btnLabelTimeout)}onHandleURI(){this.isLoading=!this.uri,!this.ready&&this.uri&&(this.ready=!0,this.onConnect?.())}onTryAgain(){u.x.setWcError(!1),this.onConnect?.()}};he([(0,r.wk)()],pe.prototype,"redirectDeeplink",void 0),he([(0,r.wk)()],pe.prototype,"redirectUniversalLink",void 0),he([(0,r.wk)()],pe.prototype,"target",void 0),he([(0,r.wk)()],pe.prototype,"preferUniversalLinks",void 0),he([(0,r.wk)()],pe.prototype,"isLoading",void 0),pe=he([(0,c.EM)("w3m-connecting-wc-mobile")],pe),i(2686);var ue=i(7583);function we(e,t,i){return e!==t&&(e-t<0?t-e:e-t)<=i+.1}const ge={generate({uri:e,size:t,logoSize:i,padding:r=8,dotColor:n="var(--apkt-colors-black)"}){const s=[],a=function(e){const t=Array.prototype.slice.call(ue.create(e,{errorCorrectionLevel:"Q"}).modules.data,0),i=Math.sqrt(t.length);return t.reduce((e,t,o)=>(o%i===0?e.push([t]):e[e.length-1].push(t))&&e,[])}(e),l=(t-2*r)/a.length,c=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];c.forEach(({x:e,y:t})=>{const i=(a.length-7)*l*e+r,d=(a.length-7)*l*t+r,h=.45;for(let e=0;e<c.length;e+=1){const t=l*(7-2*e);s.push(o.JW`
            <rect
              fill=${2===e?"var(--apkt-colors-black)":"var(--apkt-colors-white)"}
              width=${0===e?t-10:t}
              rx= ${0===e?(t-10)*h:t*h}
              ry= ${0===e?(t-10)*h:t*h}
              stroke=${n}
              stroke-width=${0===e?10:0}
              height=${0===e?t-10:t}
              x= ${0===e?d+l*e+5:d+l*e}
              y= ${0===e?i+l*e+5:i+l*e}
            />
          `)}});const d=Math.floor((i+25)/l),h=a.length/2-d/2,p=a.length/2+d/2-1,u=[];a.forEach((e,t)=>{e.forEach((e,i)=>{if(a[t][i]&&!(t<7&&i<7||t>a.length-8&&i<7||t<7&&i>a.length-8||t>h&&t<p&&i>h&&i<p)){const e=t*l+l/2+r,o=i*l+l/2+r;u.push([e,o])}})});const w={};return u.forEach(([e,t])=>{w[e]?w[e]?.push(t):w[e]=[t]}),Object.entries(w).map(([e,t])=>{const i=t.filter(e=>t.every(t=>!we(e,t,l)));return[Number(e),i]}).forEach(([e,t])=>{t.forEach(t=>{s.push(o.JW`<circle cx=${e} cy=${t} fill=${n} r=${l/2.5} />`)})}),Object.entries(w).filter(([e,t])=>t.length>1).map(([e,t])=>{const i=t.filter(e=>t.some(t=>we(e,t,l)));return[Number(e),i]}).map(([e,t])=>{t.sort((e,t)=>e<t?-1:1);const i=[];for(const e of t){const t=i.find(t=>t.some(t=>we(e,t,l)));t?t.push(e):i.push([e])}return[e,i.map(e=>[e[0],e[e.length-1]])]}).forEach(([e,t])=>{t.forEach(([t,i])=>{s.push(o.JW`
              <line
                x1=${e}
                x2=${e}
                y1=${t}
                y2=${i}
                stroke=${n}
                stroke-width=${l/1.25}
                stroke-linecap="round"
              />
            `)})}),s}},me=M.AH`
  :host {
    position: relative;
    user-select: none;
    display: block;
    overflow: hidden;
    aspect-ratio: 1 / 1;
    width: 100%;
    height: 100%;
    background-color: ${({colors:e})=>e.white};
    border: 1px solid ${({tokens:e})=>e.theme.borderPrimary};
  }

  :host {
    border-radius: ${({borderRadius:e})=>e[4]};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :host([data-clear='true']) > wui-icon {
    display: none;
  }

  svg:first-child,
  wui-image,
  wui-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateY(-50%) translateX(-50%);
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    box-shadow: inset 0 0 0 4px ${({tokens:e})=>e.theme.backgroundPrimary};
    border-radius: ${({borderRadius:e})=>e[6]};
  }

  wui-image {
    width: 25%;
    height: 25%;
    border-radius: ${({borderRadius:e})=>e[2]};
  }

  wui-icon {
    width: 100%;
    height: 100%;
    color: #3396ff !important;
    transform: translateY(-50%) translateX(-50%) scale(0.25);
  }

  wui-icon > svg {
    width: inherit;
    height: inherit;
  }
`;var be=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let fe=class extends o.WF{constructor(){super(...arguments),this.uri="",this.size=0,this.theme="dark",this.imageSrc=void 0,this.alt=void 0,this.arenaClear=void 0,this.farcaster=void 0}render(){return this.dataset.theme=this.theme,this.dataset.clear=String(this.arenaClear),this.style.cssText=`--local-size: ${this.size}px`,o.qy`<wui-flex
      alignItems="center"
      justifyContent="center"
      class="wui-qr-code"
      direction="column"
      gap="4"
      width="100%"
      style="height: 100%"
    >
      ${this.templateVisual()} ${this.templateSvg()}
    </wui-flex>`}templateSvg(){return o.JW`
      <svg height=${this.size} width=${this.size}>
        ${ge.generate({uri:this.uri,size:this.size,logoSize:this.arenaClear?0:this.size/4})}
      </svg>
    `}templateVisual(){return this.imageSrc?o.qy`<wui-image src=${this.imageSrc} alt=${this.alt??"logo"}></wui-image>`:this.farcaster?o.qy`<wui-icon
        class="farcaster"
        size="inherit"
        color="inherit"
        name="farcaster"
      ></wui-icon>`:o.qy`<wui-icon size="inherit" color="inherit" name="walletConnect"></wui-icon>`}};fe.styles=[O.W5,me],be([(0,r.MZ)()],fe.prototype,"uri",void 0),be([(0,r.MZ)({type:Number})],fe.prototype,"size",void 0),be([(0,r.MZ)()],fe.prototype,"theme",void 0),be([(0,r.MZ)()],fe.prototype,"imageSrc",void 0),be([(0,r.MZ)()],fe.prototype,"alt",void 0),be([(0,r.MZ)({type:Boolean})],fe.prototype,"arenaClear",void 0),be([(0,r.MZ)({type:Boolean})],fe.prototype,"farcaster",void 0),fe=be([(0,P.E)("wui-qr-code")],fe);const ye=M.AH`
  :host {
    display: block;
    background: linear-gradient(
      90deg,
      ${({tokens:e})=>e.theme.foregroundSecondary} 0%,
      ${({tokens:e})=>e.theme.foregroundTertiary} 50%,
      ${({tokens:e})=>e.theme.foregroundSecondary} 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1s ease-in-out infinite;
    border-radius: ${({borderRadius:e})=>e[2]};
  }

  :host([data-rounded='true']) {
    border-radius: ${({borderRadius:e})=>e[16]};
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
`;var ve=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let $e=class extends o.WF{constructor(){super(...arguments),this.width="",this.height="",this.variant="default",this.rounded=!1}render(){return this.style.cssText=`\n      width: ${this.width};\n      height: ${this.height};\n    `,this.dataset.rounded=this.rounded?"true":"false",o.qy`<slot></slot>`}};$e.styles=[ye],ve([(0,r.MZ)()],$e.prototype,"width",void 0),ve([(0,r.MZ)()],$e.prototype,"height",void 0),ve([(0,r.MZ)()],$e.prototype,"variant",void 0),ve([(0,r.MZ)({type:Boolean})],$e.prototype,"rounded",void 0),$e=ve([(0,P.E)("wui-shimmer")],$e),i(7081);const xe=c.AH`
  wui-shimmer {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: ${({borderRadius:e})=>e[4]};
  }

  wui-qr-code {
    opacity: 0;
    animation-duration: ${({durations:e})=>e.xl};
    animation-timing-function: ${({easings:e})=>e["ease-out-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;var ke=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let Ce=class extends ae{constructor(){super(),this.basic=!1,this.forceUpdate=()=>{this.requestUpdate()},window.addEventListener("resize",this.forceUpdate)}firstUpdated(){this.basic||w.E.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet?.name??"WalletConnect",platform:"qrcode",displayIndex:this.wallet?.display_index,walletRank:this.wallet?.order,view:g.I.state.view}})}disconnectedCallback(){super.disconnectedCallback(),this.unsubscribe?.forEach(e=>e()),window.removeEventListener("resize",this.forceUpdate)}render(){return this.onRenderProxy(),o.qy`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        .padding=${["0","5","5","5"]}
        gap="5"
      >
        <wui-shimmer width="100%"> ${this.qrCodeTemplate()} </wui-shimmer>
        <wui-text variant="lg-medium" color="primary"> Scan this QR Code with your phone </wui-text>
        ${this.copyTemplate()}
      </wui-flex>
      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links>
    `}onRenderProxy(){!this.ready&&this.uri&&(this.timeout=setTimeout(()=>{this.ready=!0},200))}qrCodeTemplate(){if(!this.uri||!this.ready)return null;const e=this.getBoundingClientRect().width-40,t=this.wallet?this.wallet.name:void 0;u.x.setWcLinking(void 0),u.x.setRecentWallet(this.wallet);let i=this.uri;if(this.wallet?.mobile_link){const{redirect:e}=n.w.formatNativeUrl(this.wallet?.mobile_link,this.uri,null);i=e}return o.qy` <wui-qr-code
      size=${e}
      theme=${F.W.state.themeMode}
      uri=${i}
      imageSrc=${(0,d.J)(y.$.getWalletImage(this.wallet))}
      color=${(0,d.J)(F.W.state.themeVariables["--w3m-qr-color"])}
      alt=${(0,d.J)(t)}
      data-testid="wui-qr-code"
    ></wui-qr-code>`}copyTemplate(){const e=!this.uri||!this.ready;return o.qy`<wui-button
      .disabled=${e}
      @click=${this.onCopyUri}
      variant="neutral-secondary"
      size="sm"
      data-testid="copy-wc2-uri"
    >
      Copy link
      <wui-icon size="sm" color="inherit" name="copy" slot="iconRight"></wui-icon>
    </wui-button>`}};Ce.styles=xe,ke([(0,r.MZ)({type:Boolean})],Ce.prototype,"basic",void 0),Ce=ke([(0,c.EM)("w3m-connecting-wc-qrcode")],Ce);let Re=class extends o.WF{constructor(){if(super(),this.wallet=g.I.state.data?.wallet,!this.wallet)throw new Error("w3m-connecting-wc-unsupported: No wallet provided");w.E.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"browser",displayIndex:this.wallet?.display_index,walletRank:this.wallet?.order,view:g.I.state.view}})}render(){return o.qy`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        .padding=${["10","5","5","5"]}
        gap="5"
      >
        <wui-wallet-image
          size="lg"
          imageSrc=${(0,d.J)(y.$.getWalletImage(this.wallet))}
        ></wui-wallet-image>

        <wui-text variant="md-regular" color="primary">Not Detected</wui-text>
      </wui-flex>

      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links>
    `}};Re=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s}([(0,c.EM)("w3m-connecting-wc-unsupported")],Re);var Ee=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let We=class extends ae{constructor(){if(super(),this.isLoading=!0,!this.wallet)throw new Error("w3m-connecting-wc-web: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.secondaryBtnLabel="Open",this.secondaryLabel=de.oU.CONNECT_LABELS.MOBILE,this.secondaryBtnIcon="externalLink",this.updateLoadingState(),this.unsubscribe.push(u.x.subscribeKey("wcUri",()=>{this.updateLoadingState()})),w.E.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"web",displayIndex:this.wallet?.display_index,walletRank:this.wallet?.order,view:g.I.state.view}})}updateLoadingState(){this.isLoading=!this.uri}onConnectProxy(){if(this.wallet?.webapp_link&&this.uri)try{this.error=!1;const{webapp_link:e,name:t}=this.wallet,{redirect:i,href:o}=n.w.formatUniversalUrl(e,this.uri);u.x.setWcLinking({name:t,href:o}),u.x.setRecentWallet(this.wallet),n.w.openHref(i,"_blank")}catch{this.error=!0}}};Ee([(0,r.wk)()],We.prototype,"isLoading",void 0),We=Ee([(0,c.EM)("w3m-connecting-wc-web")],We);const Ie=c.AH`
  :host([data-mobile-fullscreen='true']) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  :host([data-mobile-fullscreen='true']) wui-ux-by-reown {
    margin-top: auto;
  }
`;var Se=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let Te=class extends o.WF{constructor(){super(),this.wallet=g.I.state.data?.wallet,this.unsubscribe=[],this.platform=void 0,this.platforms=[],this.isSiwxEnabled=Boolean(s.H.state.siwx),this.remoteFeatures=s.H.state.remoteFeatures,this.displayBranding=!0,this.basic=!1,this.determinePlatforms(),this.initializeConnection(),this.unsubscribe.push(s.H.subscribeKey("remoteFeatures",e=>this.remoteFeatures=e))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){return s.H.state.enableMobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),o.qy`
      ${this.headerTemplate()}
      <div class="platform-container">${this.platformTemplate()}</div>
      ${this.reownBrandingTemplate()}
    `}reownBrandingTemplate(){return this.remoteFeatures?.reownBranding&&this.displayBranding?o.qy`<wui-ux-by-reown></wui-ux-by-reown>`:null}async initializeConnection(e=!1){if("browser"!==this.platform&&(!s.H.state.manualWCControl||e))try{const{wcPairingExpiry:t,status:i}=u.x.state,{redirectView:o}=g.I.state.data??{};if(e||s.H.state.enableEmbedded||n.w.isPairingExpired(t)||"connecting"===i){const e=u.x.getConnections(E.W.state.activeChain),t=this.remoteFeatures?.multiWallet,i=e.length>0;await u.x.connectWalletConnect({cache:"never"}),this.isSiwxEnabled||(i&&t?(g.I.replace("ProfileWallets"),W.P.showSuccess("New Wallet Added")):o?g.I.replace(o):I.W.close())}}catch(e){if(e instanceof Error&&e.message.includes("An error occurred when attempting to switch chain")&&!s.H.state.enableNetworkSwitch&&E.W.state.activeChain)return E.W.setActiveCaipNetwork(T.R.getUnsupportedNetwork(`${E.W.state.activeChain}:${E.W.state.activeCaipNetwork?.id}`)),void E.W.showUnsupportedChainUI();e instanceof S.A&&e.originalName===R.RQ.PROVIDER_RPC_ERROR_NAME.USER_REJECTED_REQUEST?w.E.sendEvent({type:"track",event:"USER_REJECTED",properties:{message:e.message}}):w.E.sendEvent({type:"track",event:"CONNECT_ERROR",properties:{message:e?.message??"Unknown"}}),u.x.setWcError(!0),W.P.showError(e.message??"Connection error"),u.x.resetWcConnection(),g.I.goBack()}}determinePlatforms(){if(!this.wallet)return this.platforms.push("qrcode"),void(this.platform="qrcode");if(this.platform)return;const{mobile_link:e,desktop_link:t,webapp_link:i,injected:o,rdns:r}=this.wallet,a=o?.map(({injected_id:e})=>e).filter(Boolean),l=[...r?[r]:a??[]],c=!s.H.state.isUniversalProvider&&l.length,d=e,h=i,p=u.x.checkInstalled(l),w=c&&p,g=t&&!n.w.isMobile();w&&!E.W.state.noAdapters&&this.platforms.push("browser"),d&&this.platforms.push(n.w.isMobile()?"mobile":"qrcode"),h&&this.platforms.push("web"),g&&this.platforms.push("desktop"),w||!c||E.W.state.noAdapters||this.platforms.push("unsupported"),this.platform=this.platforms[0]}platformTemplate(){switch(this.platform){case"browser":return o.qy`<w3m-connecting-wc-browser></w3m-connecting-wc-browser>`;case"web":return o.qy`<w3m-connecting-wc-web></w3m-connecting-wc-web>`;case"desktop":return o.qy`
          <w3m-connecting-wc-desktop .onRetry=${()=>this.initializeConnection(!0)}>
          </w3m-connecting-wc-desktop>
        `;case"mobile":return o.qy`
          <w3m-connecting-wc-mobile isMobile .onRetry=${()=>this.initializeConnection(!0)}>
          </w3m-connecting-wc-mobile>
        `;case"qrcode":return o.qy`<w3m-connecting-wc-qrcode ?basic=${this.basic}></w3m-connecting-wc-qrcode>`;default:return o.qy`<w3m-connecting-wc-unsupported></w3m-connecting-wc-unsupported>`}}headerTemplate(){return this.platforms.length>1?o.qy`
      <w3m-connecting-header
        .platforms=${this.platforms}
        .onSelectPlatfrom=${this.onSelectPlatform.bind(this)}
      >
      </w3m-connecting-header>
    `:null}async onSelectPlatform(e){const t=this.shadowRoot?.querySelector("div");t&&(await t.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.platform=e,t.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"}))}};Te.styles=Ie,Se([(0,r.wk)()],Te.prototype,"platform",void 0),Se([(0,r.wk)()],Te.prototype,"platforms",void 0),Se([(0,r.wk)()],Te.prototype,"isSiwxEnabled",void 0),Se([(0,r.wk)()],Te.prototype,"remoteFeatures",void 0),Se([(0,r.MZ)({type:Boolean})],Te.prototype,"displayBranding",void 0),Se([(0,r.MZ)({type:Boolean})],Te.prototype,"basic",void 0),Te=Se([(0,c.EM)("w3m-connecting-wc-view")],Te);var Oe=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let Pe=class extends o.WF{constructor(){super(),this.unsubscribe=[],this.isMobile=n.w.isMobile(),this.remoteFeatures=s.H.state.remoteFeatures,this.unsubscribe.push(s.H.subscribeKey("remoteFeatures",e=>this.remoteFeatures=e))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){if(this.isMobile){const{featured:e,recommended:t}=a.N.state,{customWallets:i}=s.H.state,r=l.i.getRecentWallets(),n=e.length||t.length||i?.length||r.length;return o.qy`<wui-flex flexDirection="column" gap="2" .margin=${["1","3","3","3"]}>
        ${n?o.qy`<w3m-connector-list></w3m-connector-list>`:null}
        <w3m-all-wallets-widget></w3m-all-wallets-widget>
      </wui-flex>`}return o.qy`<wui-flex flexDirection="column" .padding=${["0","0","4","0"]}>
        <w3m-connecting-wc-view ?basic=${!0} .displayBranding=${!1}></w3m-connecting-wc-view>
        <wui-flex flexDirection="column" .padding=${["0","3","0","3"]}>
          <w3m-all-wallets-widget></w3m-all-wallets-widget>
        </wui-flex>
      </wui-flex>
      ${this.reownBrandingTemplate()} `}reownBrandingTemplate(){return this.remoteFeatures?.reownBranding?o.qy` <wui-flex flexDirection="column" .padding=${["1","0","1","0"]}>
      <wui-ux-by-reown></wui-ux-by-reown>
    </wui-flex>`:null}};Oe([(0,r.wk)()],Pe.prototype,"isMobile",void 0),Oe([(0,r.wk)()],Pe.prototype,"remoteFeatures",void 0),Pe=Oe([(0,c.EM)("w3m-connecting-wc-basic-view")],Pe);var Me=i(6752);const{I:je}=Me.ge;var Ae=i(7804);const qe=(e,t)=>{const i=e._$AN;if(void 0===i)return!1;for(const e of i)e._$AO?.(t,!1),qe(e,t);return!0},Le=e=>{let t,i;do{if(void 0===(t=e._$AM))break;i=t._$AN,i.delete(e),e=t}while(0===i?.size)},_e=e=>{for(let t;t=e._$AM;e=t){let i=t._$AN;if(void 0===i)t._$AN=i=new Set;else if(i.has(e))break;i.add(e),Ze(t)}};function ze(e){void 0!==this._$AN?(Le(this),this._$AM=e,_e(this)):this._$AM=e}function Ne(e,t=!1,i=0){const o=this._$AH,r=this._$AN;if(void 0!==r&&0!==r.size)if(t)if(Array.isArray(o))for(let e=i;e<o.length;e++)qe(o[e],!1),Le(o[e]);else null!=o&&(qe(o,!1),Le(o));else qe(this,e)}const Ze=e=>{e.type==Ae.OA.CHILD&&(e._$AP??=Ne,e._$AQ??=ze)};class De extends Ae.WL{constructor(){super(...arguments),this._$AN=void 0}_$AT(e,t,i){super._$AT(e,t,i),_e(this),this.isConnected=e._$AU}_$AO(e,t=!0){e!==this.isConnected&&(this.isConnected=e,e?this.reconnected?.():this.disconnected?.()),t&&(qe(this,e),Le(this))}setValue(e){if((()=>void 0===this._$Ct.strings)())this._$Ct._$AI(e,this);else{const t=[...this._$Ct._$AH];t[this._$Ci]=e,this._$Ct._$AI(t,this,0)}}disconnected(){}reconnected(){}}const Be=()=>new Fe;class Fe{}const He=new WeakMap,Ue=(0,Ae.u$)(class extends De{render(e){return Me.s6}update(e,[t]){const i=t!==this.G;return i&&void 0!==this.G&&this.rt(void 0),(i||this.lt!==this.ct)&&(this.G=t,this.ht=e.options?.host,this.rt(this.ct=e.element)),Me.s6}rt(e){if(this.isConnected||(e=void 0),"function"==typeof this.G){const t=this.ht??globalThis;let i=He.get(t);void 0===i&&(i=new WeakMap,He.set(t,i)),void 0!==i.get(this.G)&&this.G.call(this.ht,void 0),i.set(this.G,e),void 0!==e&&this.G.call(this.ht,e)}else this.G.value=e}get lt(){return"function"==typeof this.G?He.get(this.ht??globalThis)?.get(this.G):this.G?.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}}),Ve=M.AH`
  :host {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  label {
    position: relative;
    display: inline-block;
    user-select: none;
    transition:
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      color ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      border ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      box-shadow ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      width ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      height ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      transform ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      opacity ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color, color, border, box-shadow, width, height, transform, opacity;
  }

  input {
    width: 0;
    height: 0;
    opacity: 0;
  }

  span {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: ${({colors:e})=>e.neutrals300};
    border-radius: ${({borderRadius:e})=>e.round};
    border: 1px solid transparent;
    will-change: border;
    transition:
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      color ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      border ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      box-shadow ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      width ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      height ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]},
      transform ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      opacity ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color, color, border, box-shadow, width, height, transform, opacity;
  }

  span:before {
    content: '';
    position: absolute;
    background-color: ${({colors:e})=>e.white};
    border-radius: 50%;
  }

  /* -- Sizes --------------------------------------------------------- */
  label[data-size='lg'] {
    width: 48px;
    height: 32px;
  }

  label[data-size='md'] {
    width: 40px;
    height: 28px;
  }

  label[data-size='sm'] {
    width: 32px;
    height: 22px;
  }

  label[data-size='lg'] > span:before {
    height: 24px;
    width: 24px;
    left: 4px;
    top: 3px;
  }

  label[data-size='md'] > span:before {
    height: 20px;
    width: 20px;
    left: 4px;
    top: 3px;
  }

  label[data-size='sm'] > span:before {
    height: 16px;
    width: 16px;
    left: 3px;
    top: 2px;
  }

  /* -- Focus states --------------------------------------------------- */
  input:focus-visible:not(:checked) + span,
  input:focus:not(:checked) + span {
    border: 1px solid ${({tokens:e})=>e.core.iconAccentPrimary};
    background-color: ${({tokens:e})=>e.theme.textTertiary};
    box-shadow: 0px 0px 0px 4px rgba(9, 136, 240, 0.2);
  }

  input:focus-visible:checked + span,
  input:focus:checked + span {
    border: 1px solid ${({tokens:e})=>e.core.iconAccentPrimary};
    box-shadow: 0px 0px 0px 4px rgba(9, 136, 240, 0.2);
  }

  /* -- Checked states --------------------------------------------------- */
  input:checked + span {
    background-color: ${({tokens:e})=>e.core.iconAccentPrimary};
  }

  label[data-size='lg'] > input:checked + span:before {
    transform: translateX(calc(100% - 9px));
  }

  label[data-size='md'] > input:checked + span:before {
    transform: translateX(calc(100% - 9px));
  }

  label[data-size='sm'] > input:checked + span:before {
    transform: translateX(calc(100% - 7px));
  }

  /* -- Hover states ------------------------------------------------------- */
  label:hover > input:not(:checked):not(:disabled) + span {
    background-color: ${({colors:e})=>e.neutrals400};
  }

  label:hover > input:checked:not(:disabled) + span {
    background-color: ${({colors:e})=>e.accent080};
  }

  /* -- Disabled state --------------------------------------------------- */
  label:has(input:disabled) {
    pointer-events: none;
    user-select: none;
  }

  input:not(:checked):disabled + span {
    background-color: ${({colors:e})=>e.neutrals700};
  }

  input:checked:disabled + span {
    background-color: ${({colors:e})=>e.neutrals700};
  }

  input:not(:checked):disabled + span::before {
    background-color: ${({colors:e})=>e.neutrals400};
  }

  input:checked:disabled + span::before {
    background-color: ${({tokens:e})=>e.theme.textTertiary};
  }
`;var Je=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let Ke=class extends o.WF{constructor(){super(...arguments),this.inputElementRef=Be(),this.checked=!1,this.disabled=!1,this.size="md"}render(){return o.qy`
      <label data-size=${this.size}>
        <input
          ${Ue(this.inputElementRef)}
          type="checkbox"
          ?checked=${this.checked}
          ?disabled=${this.disabled}
          @change=${this.dispatchChangeEvent.bind(this)}
        />
        <span></span>
      </label>
    `}dispatchChangeEvent(){this.dispatchEvent(new CustomEvent("switchChange",{detail:this.inputElementRef.value?.checked,bubbles:!0,composed:!0}))}};Ke.styles=[O.W5,O.fD,Ve],Je([(0,r.MZ)({type:Boolean})],Ke.prototype,"checked",void 0),Je([(0,r.MZ)({type:Boolean})],Ke.prototype,"disabled",void 0),Je([(0,r.MZ)()],Ke.prototype,"size",void 0),Ke=Je([(0,P.E)("wui-toggle")],Ke);const Ge=M.AH`
  :host {
    height: auto;
  }

  :host > wui-flex {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: ${({spacing:e})=>e[2]};
    padding: ${({spacing:e})=>e[2]} ${({spacing:e})=>e[3]};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: ${({borderRadius:e})=>e[4]};
    box-shadow: inset 0 0 0 1px ${({tokens:e})=>e.theme.foregroundPrimary};
    transition: background-color ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color;
    cursor: pointer;
  }

  wui-switch {
    pointer-events: none;
  }
`;var Qe=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let Xe=class extends o.WF{constructor(){super(...arguments),this.checked=!1}render(){return o.qy`
      <wui-flex>
        <wui-icon size="xl" name="walletConnectBrown"></wui-icon>
        <wui-toggle
          ?checked=${this.checked}
          size="sm"
          @switchChange=${this.handleToggleChange.bind(this)}
        ></wui-toggle>
      </wui-flex>
    `}handleToggleChange(e){e.stopPropagation(),this.checked=e.detail,this.dispatchSwitchEvent()}dispatchSwitchEvent(){this.dispatchEvent(new CustomEvent("certifiedSwitchChange",{detail:this.checked,bubbles:!0,composed:!0}))}};Xe.styles=[O.W5,O.fD,Ge],Qe([(0,r.MZ)({type:Boolean})],Xe.prototype,"checked",void 0),Xe=Qe([(0,P.E)("wui-certified-switch")],Xe);const Ye=M.AH`
  :host {
    position: relative;
    width: 100%;
    display: inline-flex;
    flex-direction: column;
    gap: ${({spacing:e})=>e[3]};
    color: ${({tokens:e})=>e.theme.textPrimary};
    caret-color: ${({tokens:e})=>e.core.textAccentPrimary};
  }

  .wui-input-text-container {
    position: relative;
    display: flex;
  }

  input {
    width: 100%;
    border-radius: ${({borderRadius:e})=>e[4]};
    color: inherit;
    background: transparent;
    border: 1px solid ${({tokens:e})=>e.theme.borderPrimary};
    caret-color: ${({tokens:e})=>e.core.textAccentPrimary};
    padding: ${({spacing:e})=>e[3]} ${({spacing:e})=>e[3]}
      ${({spacing:e})=>e[3]} ${({spacing:e})=>e[10]};
    font-size: ${({textSize:e})=>e.large};
    line-height: ${({typography:e})=>e["lg-regular"].lineHeight};
    letter-spacing: ${({typography:e})=>e["lg-regular"].letterSpacing};
    font-weight: ${({fontWeight:e})=>e.regular};
    font-family: ${({fontFamily:e})=>e.regular};
  }

  input[data-size='lg'] {
    padding: ${({spacing:e})=>e[4]} ${({spacing:e})=>e[3]}
      ${({spacing:e})=>e[4]} ${({spacing:e})=>e[10]};
  }

  @media (hover: hover) and (pointer: fine) {
    input:hover:enabled {
      border: 1px solid ${({tokens:e})=>e.theme.borderSecondary};
    }
  }

  input:disabled {
    cursor: unset;
    border: 1px solid ${({tokens:e})=>e.theme.borderPrimary};
  }

  input::placeholder {
    color: ${({tokens:e})=>e.theme.textSecondary};
  }

  input:focus:enabled {
    border: 1px solid ${({tokens:e})=>e.theme.borderSecondary};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    -webkit-box-shadow: 0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent040};
    -moz-box-shadow: 0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent040};
    box-shadow: 0px 0px 0px 4px ${({tokens:e})=>e.core.foregroundAccent040};
  }

  div.wui-input-text-container:has(input:disabled) {
    opacity: 0.5;
  }

  wui-icon.wui-input-text-left-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    left: ${({spacing:e})=>e[4]};
    color: ${({tokens:e})=>e.theme.iconDefault};
  }

  button.wui-input-text-submit-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({spacing:e})=>e[3]};
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: ${({borderRadius:e})=>e[2]};
    color: ${({tokens:e})=>e.core.textAccentPrimary};
  }

  button.wui-input-text-submit-button:disabled {
    opacity: 1;
  }

  button.wui-input-text-submit-button.loading wui-icon {
    animation: spin 1s linear infinite;
  }

  button.wui-input-text-submit-button:hover {
    background: ${({tokens:e})=>e.core.foregroundAccent010};
  }

  input:has(+ .wui-input-text-submit-button) {
    padding-right: ${({spacing:e})=>e[12]};
  }

  input[type='number'] {
    -moz-appearance: textfield;
  }

  input[type='search']::-webkit-search-decoration,
  input[type='search']::-webkit-search-cancel-button,
  input[type='search']::-webkit-search-results-button,
  input[type='search']::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }

  /* -- Keyframes --------------------------------------------------- */
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;var et=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let tt=class extends o.WF{constructor(){super(...arguments),this.inputElementRef=Be(),this.disabled=!1,this.loading=!1,this.placeholder="",this.type="text",this.value="",this.size="md"}render(){return o.qy` <div class="wui-input-text-container">
        ${this.templateLeftIcon()}
        <input
          data-size=${this.size}
          ${Ue(this.inputElementRef)}
          data-testid="wui-input-text"
          type=${this.type}
          enterkeyhint=${(0,d.J)(this.enterKeyHint)}
          ?disabled=${this.disabled}
          placeholder=${this.placeholder}
          @input=${this.dispatchInputChangeEvent.bind(this)}
          @keydown=${this.onKeyDown}
          .value=${this.value||""}
        />
        ${this.templateSubmitButton()}
        <slot class="wui-input-text-slot"></slot>
      </div>
      ${this.templateError()} ${this.templateWarning()}`}templateLeftIcon(){return this.icon?o.qy`<wui-icon
        class="wui-input-text-left-icon"
        size="md"
        data-size=${this.size}
        color="inherit"
        name=${this.icon}
      ></wui-icon>`:null}templateSubmitButton(){return this.onSubmit?o.qy`<button
        class="wui-input-text-submit-button ${this.loading?"loading":""}"
        @click=${this.onSubmit?.bind(this)}
        ?disabled=${this.disabled||this.loading}
      >
        ${this.loading?o.qy`<wui-icon name="spinner" size="md"></wui-icon>`:o.qy`<wui-icon name="chevronRight" size="md"></wui-icon>`}
      </button>`:null}templateError(){return this.errorText?o.qy`<wui-text variant="sm-regular" color="error">${this.errorText}</wui-text>`:null}templateWarning(){return this.warningText?o.qy`<wui-text variant="sm-regular" color="warning">${this.warningText}</wui-text>`:null}dispatchInputChangeEvent(){this.dispatchEvent(new CustomEvent("inputChange",{detail:this.inputElementRef.value?.value,bubbles:!0,composed:!0}))}};tt.styles=[O.W5,O.fD,Ye],et([(0,r.MZ)()],tt.prototype,"icon",void 0),et([(0,r.MZ)({type:Boolean})],tt.prototype,"disabled",void 0),et([(0,r.MZ)({type:Boolean})],tt.prototype,"loading",void 0),et([(0,r.MZ)()],tt.prototype,"placeholder",void 0),et([(0,r.MZ)()],tt.prototype,"type",void 0),et([(0,r.MZ)()],tt.prototype,"value",void 0),et([(0,r.MZ)()],tt.prototype,"errorText",void 0),et([(0,r.MZ)()],tt.prototype,"warningText",void 0),et([(0,r.MZ)()],tt.prototype,"onSubmit",void 0),et([(0,r.MZ)()],tt.prototype,"size",void 0),et([(0,r.MZ)({attribute:!1})],tt.prototype,"onKeyDown",void 0),tt=et([(0,P.E)("wui-input-text")],tt);const it=M.AH`
  :host {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  wui-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({spacing:e})=>e[3]};
    color: ${({tokens:e})=>e.theme.iconDefault};
    cursor: pointer;
    padding: ${({spacing:e})=>e[2]};
    background-color: transparent;
    border-radius: ${({borderRadius:e})=>e[4]};
    transition: background-color ${({durations:e})=>e.lg}
      ${({easings:e})=>e["ease-out-power-2"]};
  }

  @media (hover: hover) {
    wui-icon:hover {
      background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    }
  }
`;var ot=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let rt=class extends o.WF{constructor(){super(...arguments),this.inputComponentRef=Be(),this.inputValue=""}render(){return o.qy`
      <wui-input-text
        ${Ue(this.inputComponentRef)}
        placeholder="Search wallet"
        icon="search"
        type="search"
        enterKeyHint="search"
        size="sm"
        @inputChange=${this.onInputChange}
      >
        ${this.inputValue?o.qy`<wui-icon
              @click=${this.clearValue}
              color="inherit"
              size="sm"
              name="close"
            ></wui-icon>`:null}
      </wui-input-text>
    `}onInputChange(e){this.inputValue=e.detail||""}clearValue(){const e=this.inputComponentRef.value,t=e?.inputElementRef.value;t&&(t.value="",this.inputValue="",t.focus(),t.dispatchEvent(new Event("input")))}};rt.styles=[O.W5,it],ot([(0,r.MZ)()],rt.prototype,"inputValue",void 0),rt=ot([(0,P.E)("wui-search-bar")],rt);const nt=o.JW`<svg  viewBox="0 0 48 54" fill="none">
  <path
    d="M43.4605 10.7248L28.0485 1.61089C25.5438 0.129705 22.4562 0.129705 19.9515 1.61088L4.53951 10.7248C2.03626 12.2051 0.5 14.9365 0.5 17.886V36.1139C0.5 39.0635 2.03626 41.7949 4.53951 43.2752L19.9515 52.3891C22.4562 53.8703 25.5438 53.8703 28.0485 52.3891L43.4605 43.2752C45.9637 41.7949 47.5 39.0635 47.5 36.114V17.8861C47.5 14.9365 45.9637 12.2051 43.4605 10.7248Z"
  />
</svg>`,st=M.AH`
  :host {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 104px;
    width: 104px;
    row-gap: ${({spacing:e})=>e[2]};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: ${({borderRadius:e})=>e[5]};
    position: relative;
  }

  wui-shimmer[data-type='network'] {
    border: none;
    -webkit-clip-path: var(--apkt-path-network);
    clip-path: var(--apkt-path-network);
  }

  svg {
    position: absolute;
    width: 48px;
    height: 54px;
    z-index: 1;
  }

  svg > path {
    stroke: ${({tokens:e})=>e.theme.foregroundSecondary};
    stroke-width: 1px;
  }

  @media (max-width: 350px) {
    :host {
      width: 100%;
    }
  }
`;var at=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let lt=class extends o.WF{constructor(){super(...arguments),this.type="wallet"}render(){return o.qy`
      ${this.shimmerTemplate()}
      <wui-shimmer width="80px" height="20px"></wui-shimmer>
    `}shimmerTemplate(){return"network"===this.type?o.qy` <wui-shimmer data-type=${this.type} width="48px" height="54px"></wui-shimmer>
        ${nt}`:o.qy`<wui-shimmer width="56px" height="56px"></wui-shimmer>`}};lt.styles=[O.W5,O.fD,st],at([(0,r.MZ)()],lt.prototype,"type",void 0),lt=at([(0,P.E)("wui-card-select-loader")],lt);var ct=i(9603);const dt=o.AH`
  :host {
    display: grid;
    width: inherit;
    height: inherit;
  }
`;var ht=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let pt=class extends o.WF{render(){return this.style.cssText=`\n      grid-template-rows: ${this.gridTemplateRows};\n      grid-template-columns: ${this.gridTemplateColumns};\n      justify-items: ${this.justifyItems};\n      align-items: ${this.alignItems};\n      justify-content: ${this.justifyContent};\n      align-content: ${this.alignContent};\n      column-gap: ${this.columnGap&&`var(--apkt-spacing-${this.columnGap})`};\n      row-gap: ${this.rowGap&&`var(--apkt-spacing-${this.rowGap})`};\n      gap: ${this.gap&&`var(--apkt-spacing-${this.gap})`};\n      padding-top: ${this.padding&&ct.Z.getSpacingStyles(this.padding,0)};\n      padding-right: ${this.padding&&ct.Z.getSpacingStyles(this.padding,1)};\n      padding-bottom: ${this.padding&&ct.Z.getSpacingStyles(this.padding,2)};\n      padding-left: ${this.padding&&ct.Z.getSpacingStyles(this.padding,3)};\n      margin-top: ${this.margin&&ct.Z.getSpacingStyles(this.margin,0)};\n      margin-right: ${this.margin&&ct.Z.getSpacingStyles(this.margin,1)};\n      margin-bottom: ${this.margin&&ct.Z.getSpacingStyles(this.margin,2)};\n      margin-left: ${this.margin&&ct.Z.getSpacingStyles(this.margin,3)};\n    `,o.qy`<slot></slot>`}};pt.styles=[O.W5,dt],ht([(0,r.MZ)()],pt.prototype,"gridTemplateRows",void 0),ht([(0,r.MZ)()],pt.prototype,"gridTemplateColumns",void 0),ht([(0,r.MZ)()],pt.prototype,"justifyItems",void 0),ht([(0,r.MZ)()],pt.prototype,"alignItems",void 0),ht([(0,r.MZ)()],pt.prototype,"justifyContent",void 0),ht([(0,r.MZ)()],pt.prototype,"alignContent",void 0),ht([(0,r.MZ)()],pt.prototype,"columnGap",void 0),ht([(0,r.MZ)()],pt.prototype,"rowGap",void 0),ht([(0,r.MZ)()],pt.prototype,"gap",void 0),ht([(0,r.MZ)()],pt.prototype,"padding",void 0),ht([(0,r.MZ)()],pt.prototype,"margin",void 0),pt=ht([(0,P.E)("wui-grid")],pt);var ut=i(15);const wt=c.AH`
  button {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    width: 104px;
    row-gap: ${({spacing:e})=>e[2]};
    padding: ${({spacing:e})=>e[3]} ${({spacing:e})=>e[0]};
    background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    border-radius: clamp(0px, ${({borderRadius:e})=>e[4]}, 20px);
    transition:
      color ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-1"]},
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]},
      border-radius ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-1"]};
    will-change: background-color, color, border-radius;
    outline: none;
    border: none;
  }

  button > wui-flex > wui-text {
    color: ${({tokens:e})=>e.theme.textPrimary};
    max-width: 86px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    justify-content: center;
  }

  button > wui-flex > wui-text.certified {
    max-width: 66px;
  }

  @media (hover: hover) and (pointer: fine) {
    button:hover:enabled {
      background-color: ${({tokens:e})=>e.theme.foregroundSecondary};
    }
  }

  button:disabled > wui-flex > wui-text {
    color: ${({tokens:e})=>e.core.glass010};
  }

  [data-selected='true'] {
    background-color: ${({colors:e})=>e.accent020};
  }

  @media (hover: hover) and (pointer: fine) {
    [data-selected='true']:hover:enabled {
      background-color: ${({colors:e})=>e.accent010};
    }
  }

  [data-selected='true']:active:enabled {
    background-color: ${({colors:e})=>e.accent010};
  }

  @media (max-width: 350px) {
    button {
      width: 100%;
    }
  }
`;var gt=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let mt=class extends o.WF{constructor(){super(),this.observer=new IntersectionObserver(()=>{}),this.visible=!1,this.imageSrc=void 0,this.imageLoading=!1,this.isImpressed=!1,this.explorerId="",this.walletQuery="",this.certified=!1,this.displayIndex=0,this.wallet=void 0,this.observer=new IntersectionObserver(e=>{e.forEach(e=>{e.isIntersecting?(this.visible=!0,this.fetchImageSrc(),this.sendImpressionEvent()):this.visible=!1})},{threshold:.01})}firstUpdated(){this.observer.observe(this)}disconnectedCallback(){this.observer.disconnect()}render(){const e="certified"===this.wallet?.badge_type;return o.qy`
      <button>
        ${this.imageTemplate()}
        <wui-flex flexDirection="row" alignItems="center" justifyContent="center" gap="1">
          <wui-text
            variant="md-regular"
            color="inherit"
            class=${(0,d.J)(e?"certified":void 0)}
            >${this.wallet?.name}</wui-text
          >
          ${e?o.qy`<wui-icon size="sm" name="walletConnectBrown"></wui-icon>`:null}
        </wui-flex>
      </button>
    `}imageTemplate(){return!this.visible&&!this.imageSrc||this.imageLoading?this.shimmerTemplate():o.qy`
      <wui-wallet-image
        size="lg"
        imageSrc=${(0,d.J)(this.imageSrc)}
        name=${(0,d.J)(this.wallet?.name)}
        .installed=${this.wallet?.installed??!1}
        badgeSize="sm"
      >
      </wui-wallet-image>
    `}shimmerTemplate(){return o.qy`<wui-shimmer width="56px" height="56px"></wui-shimmer>`}async fetchImageSrc(){this.wallet&&(this.imageSrc=y.$.getWalletImage(this.wallet),this.imageSrc||(this.imageLoading=!0,this.imageSrc=await y.$.fetchWalletImage(this.wallet.image_id),this.imageLoading=!1))}sendImpressionEvent(){this.wallet&&!this.isImpressed&&(this.isImpressed=!0,w.E.sendWalletImpressionEvent({name:this.wallet.name,walletRank:this.wallet.order,explorerId:this.explorerId,view:g.I.state.view,query:this.walletQuery,certified:this.certified,displayIndex:this.displayIndex}))}};mt.styles=wt,gt([(0,r.wk)()],mt.prototype,"visible",void 0),gt([(0,r.wk)()],mt.prototype,"imageSrc",void 0),gt([(0,r.wk)()],mt.prototype,"imageLoading",void 0),gt([(0,r.wk)()],mt.prototype,"isImpressed",void 0),gt([(0,r.MZ)()],mt.prototype,"explorerId",void 0),gt([(0,r.MZ)()],mt.prototype,"walletQuery",void 0),gt([(0,r.MZ)()],mt.prototype,"certified",void 0),gt([(0,r.MZ)()],mt.prototype,"displayIndex",void 0),gt([(0,r.MZ)({type:Object})],mt.prototype,"wallet",void 0),mt=gt([(0,c.EM)("w3m-all-wallets-list-item")],mt);const bt=c.AH`
  wui-grid {
    max-height: clamp(360px, 400px, 80vh);
    overflow: scroll;
    scrollbar-width: none;
    grid-auto-rows: min-content;
    grid-template-columns: repeat(auto-fill, 104px);
  }

  :host([data-mobile-fullscreen='true']) wui-grid {
    max-height: none;
  }

  @media (max-width: 350px) {
    wui-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  wui-grid[data-scroll='false'] {
    overflow: hidden;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  w3m-all-wallets-list-item {
    opacity: 0;
    animation-duration: ${({durations:e})=>e.xl};
    animation-timing-function: ${({easings:e})=>e["ease-inout-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  wui-loading-spinner {
    padding-top: ${({spacing:e})=>e[4]};
    padding-bottom: ${({spacing:e})=>e[4]};
    justify-content: center;
    grid-column: 1 / span 4;
  }
`;var ft=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};const yt="local-paginator";let vt=class extends o.WF{constructor(){super(),this.unsubscribe=[],this.paginationObserver=void 0,this.loading=!a.N.state.wallets.length,this.wallets=a.N.state.wallets,this.recommended=a.N.state.recommended,this.featured=a.N.state.featured,this.filteredWallets=a.N.state.filteredWallets,this.mobileFullScreen=s.H.state.enableMobileFullScreen,this.unsubscribe.push(a.N.subscribeKey("wallets",e=>this.wallets=e),a.N.subscribeKey("recommended",e=>this.recommended=e),a.N.subscribeKey("featured",e=>this.featured=e),a.N.subscribeKey("filteredWallets",e=>this.filteredWallets=e))}firstUpdated(){this.initialFetch(),this.createPaginationObserver()}disconnectedCallback(){this.unsubscribe.forEach(e=>e()),this.paginationObserver?.disconnect()}render(){return this.mobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),o.qy`
      <wui-grid
        data-scroll=${!this.loading}
        .padding=${["0","3","3","3"]}
        gap="2"
        justifyContent="space-between"
      >
        ${this.loading?this.shimmerTemplate(16):this.walletsTemplate()}
        ${this.paginationLoaderTemplate()}
      </wui-grid>
    `}async initialFetch(){this.loading=!0;const e=this.shadowRoot?.querySelector("wui-grid");e&&(await a.N.fetchWalletsByPage({page:1}),await e.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.loading=!1,e.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"}))}shimmerTemplate(e,t){return[...Array(e)].map(()=>o.qy`
        <wui-card-select-loader type="wallet" id=${(0,d.J)(t)}></wui-card-select-loader>
      `)}getWallets(){const e=[...this.featured,...this.recommended];this.filteredWallets?.length>0?e.push(...this.filteredWallets):e.push(...this.wallets);const t=n.w.uniqueBy(e,"id"),i=ut.A.markWalletsAsInstalled(t);return ut.A.markWalletsWithDisplayIndex(i)}walletsTemplate(){return this.getWallets().map((e,t)=>o.qy`
        <w3m-all-wallets-list-item
          data-testid="wallet-search-item-${e.id}"
          @click=${()=>this.onConnectWallet(e)}
          .wallet=${e}
          explorerId=${e.id}
          certified=${"certified"===this.badge}
          displayIndex=${t}
        ></w3m-all-wallets-list-item>
      `)}paginationLoaderTemplate(){const{wallets:e,recommended:t,featured:i,count:o,mobileFilteredOutWalletsLength:r}=a.N.state,n=window.innerWidth<352?3:4,s=e.length+t.length;let l=Math.ceil(s/n)*n-s+n;return l-=e.length?i.length%n:0,0===o&&i.length>0?null:0===o||[...i,...e,...t].length<o-(r??0)?this.shimmerTemplate(l,yt):null}createPaginationObserver(){const e=this.shadowRoot?.querySelector(`#${yt}`);e&&(this.paginationObserver=new IntersectionObserver(([e])=>{if(e?.isIntersecting&&!this.loading){const{page:e,count:t,wallets:i}=a.N.state;i.length<t&&a.N.fetchWalletsByPage({page:e+1})}}),this.paginationObserver.observe(e))}onConnectWallet(e){p.a.selectWalletConnector(e)}};vt.styles=bt,ft([(0,r.wk)()],vt.prototype,"loading",void 0),ft([(0,r.wk)()],vt.prototype,"wallets",void 0),ft([(0,r.wk)()],vt.prototype,"recommended",void 0),ft([(0,r.wk)()],vt.prototype,"featured",void 0),ft([(0,r.wk)()],vt.prototype,"filteredWallets",void 0),ft([(0,r.wk)()],vt.prototype,"badge",void 0),ft([(0,r.wk)()],vt.prototype,"mobileFullScreen",void 0),vt=ft([(0,c.EM)("w3m-all-wallets-list")],vt);const $t=o.AH`
  wui-grid,
  wui-loading-spinner,
  wui-flex {
    height: 360px;
  }

  wui-grid {
    overflow: scroll;
    scrollbar-width: none;
    grid-auto-rows: min-content;
    grid-template-columns: repeat(auto-fill, 104px);
  }

  :host([data-mobile-fullscreen='true']) wui-grid {
    max-height: none;
    height: auto;
  }

  wui-grid[data-scroll='false'] {
    overflow: hidden;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  wui-loading-spinner {
    justify-content: center;
    align-items: center;
  }

  @media (max-width: 350px) {
    wui-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`;var xt=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let kt=class extends o.WF{constructor(){super(...arguments),this.prevQuery="",this.prevBadge=void 0,this.loading=!0,this.mobileFullScreen=s.H.state.enableMobileFullScreen,this.query=""}render(){return this.mobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),this.onSearch(),this.loading?o.qy`<wui-loading-spinner color="accent-primary"></wui-loading-spinner>`:this.walletsTemplate()}async onSearch(){this.query.trim()===this.prevQuery.trim()&&this.badge===this.prevBadge||(this.prevQuery=this.query,this.prevBadge=this.badge,this.loading=!0,await a.N.searchWallet({search:this.query,badge:this.badge}),this.loading=!1)}walletsTemplate(){const{search:e}=a.N.state,t=ut.A.markWalletsAsInstalled(e);return e.length?o.qy`
      <wui-grid
        data-testid="wallet-list"
        .padding=${["0","3","3","3"]}
        rowGap="4"
        columngap="2"
        justifyContent="space-between"
      >
        ${t.map((e,t)=>o.qy`
            <w3m-all-wallets-list-item
              @click=${()=>this.onConnectWallet(e)}
              .wallet=${e}
              data-testid="wallet-search-item-${e.id}"
              explorerId=${e.id}
              certified=${"certified"===this.badge}
              walletQuery=${this.query}
              displayIndex=${t}
            ></w3m-all-wallets-list-item>
          `)}
      </wui-grid>
    `:o.qy`
        <wui-flex
          data-testid="no-wallet-found"
          justifyContent="center"
          alignItems="center"
          gap="3"
          flexDirection="column"
        >
          <wui-icon-box size="lg" color="default" icon="wallet"></wui-icon-box>
          <wui-text data-testid="no-wallet-found-text" color="secondary" variant="md-medium">
            No Wallet found
          </wui-text>
        </wui-flex>
      `}onConnectWallet(e){p.a.selectWalletConnector(e)}};kt.styles=$t,xt([(0,r.wk)()],kt.prototype,"loading",void 0),xt([(0,r.wk)()],kt.prototype,"mobileFullScreen",void 0),xt([(0,r.MZ)()],kt.prototype,"query",void 0),xt([(0,r.MZ)()],kt.prototype,"badge",void 0),kt=xt([(0,c.EM)("w3m-all-wallets-search")],kt);var Ct=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let Rt=class extends o.WF{constructor(){super(...arguments),this.search="",this.badge=void 0,this.onDebouncedSearch=n.w.debounce(e=>{this.search=e})}render(){const e=this.search.length>=2;return o.qy`
      <wui-flex .padding=${["1","3","3","3"]} gap="2" alignItems="center">
        <wui-search-bar @inputChange=${this.onInputChange.bind(this)}></wui-search-bar>
        <wui-certified-switch
          ?checked=${"certified"===this.badge}
          @certifiedSwitchChange=${this.onCertifiedSwitchChange.bind(this)}
          data-testid="wui-certified-switch"
        ></wui-certified-switch>
        ${this.qrButtonTemplate()}
      </wui-flex>
      ${e||this.badge?o.qy`<w3m-all-wallets-search
            query=${this.search}
            .badge=${this.badge}
          ></w3m-all-wallets-search>`:o.qy`<w3m-all-wallets-list .badge=${this.badge}></w3m-all-wallets-list>`}
    `}onInputChange(e){this.onDebouncedSearch(e.detail)}onCertifiedSwitchChange(e){e.detail?(this.badge="certified",W.P.showSvg("Only WalletConnect certified",{icon:"walletConnectBrown",iconColor:"accent-100"})):this.badge=void 0}qrButtonTemplate(){return n.w.isMobile()?o.qy`
        <wui-icon-box
          size="xl"
          iconSize="xl"
          color="accent-primary"
          icon="qrCode"
          border
          borderColor="wui-accent-glass-010"
          @click=${this.onWalletConnectQr.bind(this)}
        ></wui-icon-box>
      `:null}onWalletConnectQr(){g.I.push("ConnectingWalletConnect")}};Ct([(0,r.wk)()],Rt.prototype,"search",void 0),Ct([(0,r.wk)()],Rt.prototype,"badge",void 0),Rt=Ct([(0,c.EM)("w3m-all-wallets-view")],Rt);const Et=M.AH`
  :host {
    width: 100%;
  }

  button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({spacing:e})=>e[3]};
    width: 100%;
    background-color: ${({tokens:e})=>e.theme.backgroundPrimary};
    border-radius: ${({borderRadius:e})=>e[4]};
    transition:
      background-color ${({durations:e})=>e.lg}
        ${({easings:e})=>e["ease-out-power-2"]},
      scale ${({durations:e})=>e.lg} ${({easings:e})=>e["ease-out-power-2"]};
    will-change: background-color, scale;
  }

  wui-text {
    text-transform: capitalize;
  }

  wui-image {
    color: ${({tokens:e})=>e.theme.textPrimary};
  }

  @media (hover: hover) {
    button:hover:enabled {
      background-color: ${({tokens:e})=>e.theme.foregroundPrimary};
    }
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;var Wt=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s};let It=class extends o.WF{constructor(){super(...arguments),this.imageSrc="google",this.loading=!1,this.disabled=!1,this.rightIcon=!0,this.rounded=!1,this.fullSize=!1}render(){return this.dataset.rounded=this.rounded?"true":"false",o.qy`
      <button
        ?disabled=${!!this.loading||Boolean(this.disabled)}
        data-loading=${this.loading}
        tabindex=${(0,d.J)(this.tabIdx)}
      >
        <wui-flex gap="2" alignItems="center">
          ${this.templateLeftIcon()}
          <wui-flex gap="1">
            <slot></slot>
          </wui-flex>
        </wui-flex>
        ${this.templateRightIcon()}
      </button>
    `}templateLeftIcon(){return this.icon?o.qy`<wui-image
        icon=${this.icon}
        iconColor=${(0,d.J)(this.iconColor)}
        ?boxed=${!0}
        ?rounded=${this.rounded}
      ></wui-image>`:o.qy`<wui-image
      ?boxed=${!0}
      ?rounded=${this.rounded}
      ?fullSize=${this.fullSize}
      src=${this.imageSrc}
    ></wui-image>`}templateRightIcon(){return this.rightIcon?this.loading?o.qy`<wui-loading-spinner size="md" color="accent-primary"></wui-loading-spinner>`:o.qy`<wui-icon name="chevronRight" size="lg" color="default"></wui-icon>`:null}};It.styles=[O.W5,O.fD,Et],Wt([(0,r.MZ)()],It.prototype,"imageSrc",void 0),Wt([(0,r.MZ)()],It.prototype,"icon",void 0),Wt([(0,r.MZ)()],It.prototype,"iconColor",void 0),Wt([(0,r.MZ)({type:Boolean})],It.prototype,"loading",void 0),Wt([(0,r.MZ)()],It.prototype,"tabIdx",void 0),Wt([(0,r.MZ)({type:Boolean})],It.prototype,"disabled",void 0),Wt([(0,r.MZ)({type:Boolean})],It.prototype,"rightIcon",void 0),Wt([(0,r.MZ)({type:Boolean})],It.prototype,"rounded",void 0),Wt([(0,r.MZ)({type:Boolean})],It.prototype,"fullSize",void 0),It=Wt([(0,P.E)("wui-list-item")],It);let St=class extends o.WF{constructor(){super(...arguments),this.wallet=g.I.state.data?.wallet}render(){if(!this.wallet)throw new Error("w3m-downloads-view");return o.qy`
      <wui-flex gap="2" flexDirection="column" .padding=${["3","3","4","3"]}>
        ${this.chromeTemplate()} ${this.iosTemplate()} ${this.androidTemplate()}
        ${this.homepageTemplate()}
      </wui-flex>
    `}chromeTemplate(){return this.wallet?.chrome_store?o.qy`<wui-list-item
      variant="icon"
      icon="chromeStore"
      iconVariant="square"
      @click=${this.onChromeStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">Chrome Extension</wui-text>
    </wui-list-item>`:null}iosTemplate(){return this.wallet?.app_store?o.qy`<wui-list-item
      variant="icon"
      icon="appStore"
      iconVariant="square"
      @click=${this.onAppStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">iOS App</wui-text>
    </wui-list-item>`:null}androidTemplate(){return this.wallet?.play_store?o.qy`<wui-list-item
      variant="icon"
      icon="playStore"
      iconVariant="square"
      @click=${this.onPlayStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">Android App</wui-text>
    </wui-list-item>`:null}homepageTemplate(){return this.wallet?.homepage?o.qy`
      <wui-list-item
        variant="icon"
        icon="browser"
        iconVariant="square-blue"
        @click=${this.onHomePage.bind(this)}
        chevron
      >
        <wui-text variant="md-medium" color="primary">Website</wui-text>
      </wui-list-item>
    `:null}openStore(e){e.href&&this.wallet&&(w.E.sendEvent({type:"track",event:"GET_WALLET",properties:{name:this.wallet.name,walletRank:this.wallet.order,explorerId:this.wallet.id,type:e.type}}),n.w.openHref(e.href,"_blank"))}onChromeStore(){this.wallet?.chrome_store&&this.openStore({href:this.wallet.chrome_store,type:"chrome_store"})}onAppStore(){this.wallet?.app_store&&this.openStore({href:this.wallet.app_store,type:"app_store"})}onPlayStore(){this.wallet?.play_store&&this.openStore({href:this.wallet.play_store,type:"play_store"})}onHomePage(){this.wallet?.homepage&&this.openStore({href:this.wallet.homepage,type:"homepage"})}};St=function(e,t,i,o){var r,n=arguments.length,s=n<3?t:null===o?o=Object.getOwnPropertyDescriptor(t,i):o;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)s=Reflect.decorate(e,t,i,o);else for(var a=e.length-1;a>=0;a--)(r=e[a])&&(s=(n<3?r(s):n>3?r(t,i,s):r(t,i))||s);return n>3&&s&&Object.defineProperty(t,i,s),s}([(0,c.EM)("w3m-downloads-view")],St)}}]);