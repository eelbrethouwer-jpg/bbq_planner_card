/* BBQ-bereidingsplanner v5.5.1 — HACS/Home Assistant live bridge.
   Alleen publiek bekende entiteitsnamen, GEEN wachtwoorden / API-tokens.
   Deze custom Lovelace-kaart gebruikt de bestaande ingelogde Home Assistant-sessie. */
(() => {
  'use strict';
  const SOURCE=new URL('./BBQ_bereidingsplanner_MEATER_v4.html?v=5.5.1', import.meta.url).href;
  const PROBES={
    pro:'sensor.meater_probe_00e865be_',
    plus:'sensor.meater_probe_c7dbf045_'
  };
  const SUFFIXES={
    internal:'interne_temperatuur',ambient:'omgevingstemperatuur',target:'doeltemperatuur',
    status:'kookstatus',cooking:'kookt',peak:'piektemperatuur',
    remaining:'resterende_tijd',elapsed:'tijd_verstreken'
  };
  /* Per-user persistent cookbook via Home Assistant frontend user-data WebSocket commands.
     HA authentication is inherited from the existing hass connection; no secret is sent to the iframe. */
  const COOKBOOK_KEY='bbq_planner_cookbook_v1';
  function libraryStamp(item){return Date.parse(item?.updatedAt)||0;}
  function cleanBooks(book){
    const b=book&&typeof book==='object'&&!Array.isArray(book)?book:{};
    return {version:1,recipes:Array.isArray(b.recipes)?b.recipes.slice(-80).filter(x=>x&&typeof x.name==='string'&&x.name.trim()):[],
      deleted:Array.isArray(b.deleted)?b.deleted.slice(-200).filter(x=>x&&typeof x.name==='string'&&x.name.trim()):[]};
  }
  function mergeBooks(remote,incoming){
    const map=new Map();
    for(const group of [cleanBooks(remote),cleanBooks(incoming)]){
      for(const r of group.recipes){const key=r.name.trim().toLocaleLowerCase('nl-NL'),old=map.get(key);if(!old||libraryStamp(r)>=libraryStamp(old.item))map.set(key,{kind:'recipe',item:r});}
      for(const d of group.deleted){const key=d.name.trim().toLocaleLowerCase('nl-NL'),old=map.get(key);if(!old||libraryStamp(d)>=libraryStamp(old.item))map.set(key,{kind:'deleted',item:d});}
    }
    return {version:1,recipes:[...map.values()].filter(x=>x.kind==='recipe').map(x=>x.item).slice(-80),
      deleted:[...map.values()].filter(x=>x.kind==='deleted').map(x=>x.item).slice(-200)};
  }
  const REVIEWS_KEY='bbq_planner_reviews_v1';
  function reviewKey(item){
    if(item&&typeof item.id==='string'&&item.id.trim())return item.id.trim().slice(0,220);
    return [item?.createdAt||'',item?.name||'',item?.rating??'',item?.finalCore??'',item?.comment||''].join('|').slice(0,2600);
  }
  function cleanReview(item){
    if(!item||typeof item!=='object'||typeof item.name!=='string'||!item.name.trim())return null;
    const createdAt=Number.isFinite(Date.parse(item.createdAt))?new Date(item.createdAt).toISOString():new Date(0).toISOString();
    const num=(v,min,max)=>{const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null;};
    return {
      id:reviewKey(item),
      name:item.name.trim().slice(0,150),
      date:String(item.date||'').slice(0,40),
      createdAt,
      rating:Math.max(1,Math.min(5,Number(item.rating)||5)),
      finalCore:num(item.finalCore,-10,120),
      grill:num(item.grill,0,500),
      targetCore:item.targetCore==null?null:String(item.targetCore).slice(0,12),
      thermometer:['pro','plus'].includes(item.thermometer)?item.thermometer:'none',
      lastMeasured:num(item.lastMeasured,-30,500),
      ambient:num(item.ambient,-30,500),
      comment:String(item.comment||'').slice(0,2000),
      actualMinutes:item.actualMinutes==null||item.actualMinutes===''?null:num(item.actualMinutes,1,10000),
      photo:typeof item.photo==='string'&&item.photo.length<=30000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(item.photo)?item.photo:''
    };
  }
  function cleanReviews(raw){
    const source=Array.isArray(raw)?raw:(raw&&Array.isArray(raw.reviews)?raw.reviews:[]);
    const map=new Map();
    for(const rawItem of source.slice(-500)){
      const item=cleanReview(rawItem);if(!item)continue;
      map.set(reviewKey(item),item);
    }
    const sorted=[...map.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-250);
    let pictures=0;for(let i=sorted.length-1;i>=0;i--)if(sorted[i].photo&&++pictures>30)sorted[i].photo='';
    return {version:1,reviews:sorted};
  }
  function mergeReviews(remote,incoming){
    const map=new Map();
    for(const group of [cleanReviews(remote),cleanReviews(incoming)]){
      for(const item of group.reviews){const key=reviewKey(item),old=map.get(key);map.set(key,old?.photo&&!item.photo?{...item,photo:old.photo}:item);}
    }
    return {version:1,reviews:[...map.values()].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-250)};
  }

  class BbqPlannerMeaterCard extends HTMLElement {
    constructor(){
      super();this._hass=null;this._iframe=null;this._lastPayload='';this._onMsg=this._onMsg.bind(this);
      this._cookbookConn=null;this._cookbookUnsub=null;this._reviewsConn=null;this._reviewsUnsub=null;this._syncQueue=Promise.resolve();
      this._historyWanted=false;this._historyBusy=false;
      // v5.5.1: full-screen layout in a Home Assistant panel view (layout only; no data or message changes).
      this._fullscreen=false;this._fitRaf=0;this._fitTimer=0;this._fitBound=false;this._card=null;this._safeProbe=null;
      this._scheduleFit=this._scheduleFit.bind(this);this._onOrientation=this._onOrientation.bind(this);
    }
    setConfig(cfg){
      this._config=cfg||{};
      if(!this._iframe){
        this.innerHTML='';
        const card=document.createElement('ha-card');
        card.style.cssText='display:block;overflow:hidden;background:#0c1318;border-radius:16px;';
        const iframe=document.createElement('iframe');
        iframe.title='BBQ-bereidingsplanner met MEATER live';iframe.loading='eager';
        iframe.style.cssText='width:100%;min-height:900px;height:1100px;display:block;border:0;background:#0c1318;';
        iframe.src=SOURCE;
        iframe.addEventListener('load',()=>{this._lastPayload='';this._send();});
        card.appendChild(iframe);this.appendChild(card);this._iframe=iframe;this._card=card;
      }
      this._updateFullscreen();
      this._send();
    }
    connectedCallback(){
      window.addEventListener('message',this._onMsg);this._ensureCookbookSubscription();this._ensureReviewsSubscription();
      // The panel view may attach the card before its own shadow tree is complete: detect now and after the next frame.
      this._updateFullscreen();requestAnimationFrame(()=>this._updateFullscreen());
    }
    disconnectedCallback(){
      window.removeEventListener('message',this._onMsg);this._stopCookbookSubscription();this._stopReviewsSubscription();
      this._unbindFit();
    }
    /* v5.5.1 full screen. Choice: only the iframe scrolls, the Home Assistant page itself does not.
       The planner has its own fixed bottom navigation inside the iframe; that navigation is only reachable when the
       iframe bottom coincides with the visible screen bottom. A taller iframe inside a scrolling HA page would give two
       nested scroll areas and push the navigation off screen.
       fullscreen: true  -> always full screen; fullscreen: false -> previous behaviour (v4.7 viewport estimate);
       not set           -> full screen only when the card sits in a hui-panel-view (auto-detected). */
    _inPanelView(){
      let node=this;
      for(let depth=0;node&&depth<60;depth++){
        const name=node.localName;
        if(name==='hui-panel-view')return true;
        if(name==='hui-masonry-view'||name==='hui-sections-view'||name==='hui-sidebar-view')return false;
        const parent=node.parentNode;
        node=parent&&parent.nodeType===11&&parent.host?parent.host:parent; // 11 = shadow root: continue at its host
        if(node&&node.nodeType===9)break; // document
      }
      return false;
    }
    _fullscreenWanted(){
      const option=this._config?.fullscreen;
      if(option===true||option==='true')return true;
      if(option===false||option==='false')return false;
      return this.isConnected&&this._inPanelView();
    }
    _updateFullscreen(){
      if(!this._iframe||!this._card)return;
      const wanted=this._fullscreenWanted();
      if(wanted===this._fullscreen){if(wanted&&this.isConnected){this._bindFit();this._scheduleFit();}return;}
      this._fullscreen=wanted;
      if(wanted){
        this.style.display='block';
        this._card.style.cssText='display:block;box-sizing:border-box;overflow:hidden;background:#0c1318;border-radius:0;'+
          'padding:0 0 env(safe-area-inset-bottom,0px) 0;margin:0;';
        this._iframe.style.cssText='width:100%;height:100%;min-height:0;display:block;border:0;background:#0c1318;';
        if(!this._safeProbe){
          const probe=document.createElement('div');
          probe.setAttribute('aria-hidden','true');
          probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;padding:0 0 env(safe-area-inset-bottom,0px) 0;';
          this._card.appendChild(probe);this._safeProbe=probe;
        }
        if(this.isConnected){this._bindFit();this._fit();}
      }else{
        this._unbindFit();
        this.style.display='';
        this._card.style.cssText='display:block;overflow:hidden;background:#0c1318;border-radius:16px;';
        if(this._safeProbe){this._safeProbe.remove();this._safeProbe=null;}
        this._iframe.style.cssText='width:100%;min-height:900px;height:1100px;display:block;border:0;background:#0c1318;';
      }
    }
    _bindFit(){
      if(this._fitBound)return;this._fitBound=true;
      window.addEventListener('resize',this._scheduleFit);
      window.addEventListener('orientationchange',this._onOrientation);
      window.visualViewport?.addEventListener('resize',this._scheduleFit);
      if(typeof ResizeObserver==='function'){
        this._fitObserver=new ResizeObserver(this._scheduleFit);
        this._fitObserver.observe(document.documentElement);
      }
    }
    _unbindFit(){
      if(!this._fitBound)return;this._fitBound=false;
      window.removeEventListener('resize',this._scheduleFit);
      window.removeEventListener('orientationchange',this._onOrientation);
      window.visualViewport?.removeEventListener('resize',this._scheduleFit);
      this._fitObserver?.disconnect();this._fitObserver=null;
      if(this._fitRaf)cancelAnimationFrame(this._fitRaf);this._fitRaf=0;
      clearTimeout(this._fitTimer);this._fitTimer=0;
    }
    _onOrientation(){
      // iOS reports the new viewport size late after a rotation: measure now and once more after it settles.
      this._scheduleFit();clearTimeout(this._fitTimer);this._fitTimer=setTimeout(this._scheduleFit,350);
    }
    _scheduleFit(){
      if(!this._fullscreen||this._fitRaf)return;
      this._fitRaf=requestAnimationFrame(()=>{this._fitRaf=0;this._fit();});
    }
    _viewportHeight(){
      // Layout viewport (the area that position:fixed content and the HA app use). The visual viewport also shrinks for
      // the on-screen keyboard and pinch zoom; resizing the iframe while typing would make the input jump.
      return Math.round(window.innerHeight||document.documentElement.clientHeight||0);
    }
    _fit(){
      if(!this._fullscreen||!this._card||!this.isConnected)return;
      const viewport=this._viewportHeight();if(!viewport)return;
      const scroller=document.scrollingElement||document.documentElement;
      const top=Math.max(0,this._card.getBoundingClientRect().top+(scroller.scrollTop||0));
      const apply=height=>{this._card.style.height=Math.max(240,Math.floor(height))+'px';};
      const overflow=()=>Math.max(0,Math.ceil(scroller.scrollHeight-viewport));
      const base=viewport-top;
      apply(base);
      // Padding or margins of the HA view below the card would still make the page scroll a few pixels: take them off.
      const extra=overflow();
      if(extra>0&&extra<400){apply(base-extra);if(overflow()>=extra)apply(base);}
    }
    set hass(hass){this._hass=hass;this._send();this._ensureCookbookSubscription();this._ensureReviewsSubscription();if(this._historyWanted)this._loadHistory();}
    getCardSize(){return 12;}
    _snapshot(){
      if(!this._hass)return null;
      const probes={};
      // v5.5: while the frontend has lost its connection to HA, hass.states is frozen. Report the probes as
      // unavailable instead of letting an old value look current (hass.connected is part of the HA frontend state).
      const offline=this._hass.connected===false;
      for(const [name,prefix] of Object.entries(PROBES)){
        const result={};
        for(const [field,suffix] of Object.entries(SUFFIXES)){
          const item=this._hass.states[prefix+suffix];
          // last_reported (HA >= 2024.3) is only forwarded when the frontend provides it; today's hass.states does not.
          result[field]=item?{state:offline?'unavailable':item.state,last_updated:item.last_updated,
            ...(typeof item.last_reported==='string'&&item.last_reported?{last_reported:item.last_reported}:{})}:null;
        }
        probes[name]=result;
      }
      return {__bbq:'bbq-ha-sensors-v1',probes};
    }
    _send(){
      if(!this._iframe?.contentWindow)return;
      const message=this._snapshot();if(!message)return;
      const serialized=JSON.stringify(message);
      if(serialized===this._lastPayload)return;
      this._lastPayload=serialized;
      this._iframe.contentWindow.postMessage(message,location.origin);
    }
    /* v5.4: once per iframe load, the last 3 hours of core and ambient readings of the known probe sensors,
       via the recorder WebSocket command history/history_during_period (compressed {s, lu} rows, lu in seconds).
       Verified against home-assistant/core homeassistant/components/history/websocket_api.py.
       Any failure: silently fall back to live readings only. Nothing is logged (private data). */
    async _loadHistory(){
      const connection=this._hass?.connection,states=this._hass?.states;
      if(this._historyBusy||!connection?.sendMessagePromise||!states||!this._iframe?.contentWindow)return;
      const ids=[],field={};
      for(const [name,prefix] of Object.entries(PROBES))for(const key of ['internal','ambient']){
        const id=prefix+SUFFIXES[key];if(states[id]){ids.push(id);field[id]=[name,key];}
      }
      // Review PR #44, finding 4: without known sensors yet, keep the request open and retry on a later hass update.
      if(!ids.length)return;
      this._historyWanted=false;this._historyBusy=true;
      try{
        const response=await connection.sendMessagePromise({type:'history/history_during_period',
          start_time:new Date(Date.now()-3*3600000).toISOString(),entity_ids:ids,
          minimal_response:true,no_attributes:true,significant_changes_only:false,include_start_time_state:false});
        const probes={pro:{internal:[],ambient:[]},plus:{internal:[],ambient:[]}};
        for(const id of ids){
          const rows=Array.isArray(response?.[id])?response[id].slice(-2000):[];
          for(const row of rows){
            const t=Math.round(Number(row?.lu)*1000),v=Number(row?.s);
            if(Number.isFinite(t)&&t>0&&Number.isFinite(v))probes[field[id][0]][field[id][1]].push([t,v]);
          }
        }
        if(this._iframe?.contentWindow)this._iframe.contentWindow.postMessage({__bbq:'bbq-ha-history-v1',probes},location.origin);
      }catch(e){/* no history: live readings only */}
      finally{this._historyBusy=false;}
    }
    _sendCookbook(message){
      if(this._iframe?.contentWindow)this._iframe.contentWindow.postMessage(message,location.origin);
    }
    _sendCookbookError(e){
      const msg=String(e?.message||e||'verbinding mislukt').slice(0,160);
      this._sendCookbook({__bbq:'bbq-library-error-v1',error:msg});
    }
    async _loadCookbook(){
      const connection=this._hass?.connection;
      if(!connection?.sendMessagePromise)return;
      try{
        const response=await connection.sendMessagePromise({type:'frontend/get_user_data',key:COOKBOOK_KEY});
        this._sendCookbook({__bbq:'bbq-library-snapshot-v1',library:cleanBooks(response?.value)});
      }catch(e){this._sendCookbookError(e);}
    }
    _ensureCookbookSubscription(){
      const connection=this._hass?.connection;
      if(!this.isConnected||!connection||this._cookbookConn===connection)return;
      this._stopCookbookSubscription();
      this._cookbookConn=connection;
      if(typeof connection.subscribeMessage!=='function'){this._loadCookbook();return;}
      connection.subscribeMessage(
        response=>this._sendCookbook({__bbq:'bbq-library-snapshot-v1',library:cleanBooks(response?.value)}),
        {type:'frontend/subscribe_user_data',key:COOKBOOK_KEY}
      ).then(unsub=>{
        if(this._cookbookConn!==connection||!this.isConnected){unsub();return;}
        this._cookbookUnsub=unsub;
      }).catch(e=>this._sendCookbookError(e));
    }
    _stopCookbookSubscription(){
      if(this._cookbookUnsub){this._cookbookUnsub();this._cookbookUnsub=null;}
      this._cookbookConn=null;
    }
    _saveCookbook(payload){
      // Serialize writes from this card; check newest server state before each merge.
      this._syncQueue=this._syncQueue.catch(()=>{}).then(async()=>{
        const connection=this._hass?.connection;
        if(!connection?.sendMessagePromise)throw Error('Home Assistant niet beschikbaar');
        if(JSON.stringify(payload).length>1200000)throw Error('Receptenbibliotheek te groot');
        const previous=await connection.sendMessagePromise({type:'frontend/get_user_data',key:COOKBOOK_KEY});
        const merged=mergeBooks(previous?.value,payload);
        await connection.sendMessagePromise({type:'frontend/set_user_data',key:COOKBOOK_KEY,value:merged});
        this._sendCookbook({__bbq:'bbq-library-snapshot-v1',library:merged});
      }).catch(e=>this._sendCookbookError(e));
    }
    _sendReviews(message){
      if(this._iframe?.contentWindow)this._iframe.contentWindow.postMessage(message,location.origin);
    }
    _sendReviewsError(e){
      const msg=String(e?.message||e||'verbinding mislukt').slice(0,160);
      this._sendReviews({__bbq:'bbq-reviews-error-v1',error:msg});
    }
    async _loadReviews(){
      const connection=this._hass?.connection;
      if(!connection?.sendMessagePromise)return;
      try{
        const response=await connection.sendMessagePromise({type:'frontend/get_user_data',key:REVIEWS_KEY});
        this._sendReviews({__bbq:'bbq-reviews-snapshot-v1',reviews:cleanReviews(response?.value)});
      }catch(e){this._sendReviewsError(e);}
    }
    _ensureReviewsSubscription(){
      const connection=this._hass?.connection;
      if(!this.isConnected||!connection||this._reviewsConn===connection)return;
      this._stopReviewsSubscription();
      this._reviewsConn=connection;
      if(typeof connection.subscribeMessage!=='function'){this._loadReviews();return;}
      connection.subscribeMessage(
        response=>this._sendReviews({__bbq:'bbq-reviews-snapshot-v1',reviews:cleanReviews(response?.value)}),
        {type:'frontend/subscribe_user_data',key:REVIEWS_KEY}
      ).then(unsub=>{
        if(this._reviewsConn!==connection||!this.isConnected){unsub();return;}
        this._reviewsUnsub=unsub;
      }).catch(e=>this._sendReviewsError(e));
    }
    _stopReviewsSubscription(){
      if(this._reviewsUnsub){this._reviewsUnsub();this._reviewsUnsub=null;}
      this._reviewsConn=null;
    }
    _saveReviews(payload){
      this._syncQueue=this._syncQueue.catch(()=>{}).then(async()=>{
        const connection=this._hass?.connection;
        if(!connection?.sendMessagePromise)throw Error('Home Assistant niet beschikbaar');
        if(JSON.stringify(payload).length>900000)throw Error('Bereidingshistorie te groot');
        const previous=await connection.sendMessagePromise({type:'frontend/get_user_data',key:REVIEWS_KEY});
        const merged=mergeReviews(previous?.value,payload);
        await connection.sendMessagePromise({type:'frontend/set_user_data',key:REVIEWS_KEY,value:merged});
        this._sendReviews({__bbq:'bbq-reviews-snapshot-v1',reviews:merged});
      }).catch(e=>this._sendReviewsError(e));
    }
    async _sendNotification(payload){
      const service=String(payload.service||'').trim();
      const message=String(payload.message||'').slice(0,230);
      const key=String(payload.key||'').slice(0,220);
      let ok=false,error='';
      try{
        if(!/^notify\.mobile_app_[a-z0-9_]{1,70}$/.test(service)||!message||!key)throw Error('Ongeldige meldingsinstellingen');
        if(typeof this._hass?.callService!=='function')throw Error('Geen Home Assistant meldingsverbinding');
        if(!this._notifyKeys)this._notifyKeys=new Set();
        if(this._notifyKeys.has(key))return;
        await this._hass.callService('notify',service.slice(7),{title:'BBQ Regisseur',message});
        this._notifyKeys.add(key);
        if(this._notifyKeys.size>200)this._notifyKeys.clear();
        ok=true;
      }catch(e){error=String(e?.message||'Verzenden mislukt').slice(0,130);}
      if(this._iframe?.contentWindow)this._iframe.contentWindow.postMessage({__bbq:'bbq-notify-result-v1',ok,error},location.origin);
    }
    _onMsg(event){
      if(event.origin!==location.origin||event.source!==this._iframe?.contentWindow||!event.data)return;
      if(event.data.__bbq==='bbq-child-ready-v1'){this._lastPayload='';this._send();this._loadCookbook();this._loadReviews();this._historyWanted=true;this._loadHistory();}
      if(event.data.__bbq==='bbq-library-request-v1')this._loadCookbook();
      if(event.data.__bbq==='bbq-library-write-v1'&&event.data.library&&typeof event.data.library==='object')this._saveCookbook(event.data.library);
      if(event.data.__bbq==='bbq-reviews-request-v1')this._loadReviews();
      if(event.data.__bbq==='bbq-reviews-write-v1'&&event.data.reviews&&typeof event.data.reviews==='object')this._saveReviews(event.data.reviews);
      if(event.data.__bbq==='bbq-notify-request-v1')this._sendNotification(event.data);
      if(event.data.__bbq==='bbq-child-height-v1'){
        const h=Number(event.data.height);
        if(this._fullscreen){this._scheduleFit();return;}
        if(event.data.mode==='viewport'){
          // v4.7: constrain iframe to visible phone viewport so fixed navigation stays on screen.
          this._iframe.style.cssText='width:100%;height:calc(100dvh - 118px);min-height:460px;max-height:94dvh;display:block;border:0;background:#0c1318;overflow:auto;';
        }else if(Number.isFinite(h)&&h>250&&h<30000)this._iframe.style.height=Math.ceil(h)+'px';
      }
    }
  }
  if(!customElements.get('bbq-planner-meater-card'))customElements.define('bbq-planner-meater-card',BbqPlannerMeaterCard);
  window.customCards=window.customCards||[];
  if(!window.customCards.some(x=>x.type==='bbq-planner-meater-card')){
    window.customCards.push({type:'bbq-planner-meater-card',name:'BBQ-planner + MEATER',description:'Interactieve planning voor 2 kamado’s met live MEATER via Home Assistant',preview:false});
  }
})();
