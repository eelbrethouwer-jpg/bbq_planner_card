/* BBQ-bereidingsplanner v4.5.0 — HACS/Home Assistant live bridge.
   Alleen publiek bekende entiteitsnamen, GEEN wachtwoorden / API-tokens.
   Deze custom Lovelace-kaart gebruikt de bestaande ingelogde Home Assistant-sessie. */
(() => {
  'use strict';
  const SOURCE=new URL('./BBQ_bereidingsplanner_MEATER_v4.html?v=4.4.0', import.meta.url).href;
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
        card.appendChild(iframe);this.appendChild(card);this._iframe=iframe;
      }
      this._send();
    }
    connectedCallback(){window.addEventListener('message',this._onMsg);this._ensureCookbookSubscription();this._ensureReviewsSubscription();}
    disconnectedCallback(){window.removeEventListener('message',this._onMsg);this._stopCookbookSubscription();this._stopReviewsSubscription();}
    set hass(hass){this._hass=hass;this._send();this._ensureCookbookSubscription();this._ensureReviewsSubscription();}
    getCardSize(){return 12;}
    _snapshot(){
      if(!this._hass)return null;
      const probes={};
      for(const [name,prefix] of Object.entries(PROBES)){
        const result={};
        for(const [field,suffix] of Object.entries(SUFFIXES)){
          const item=this._hass.states[prefix+suffix];
          result[field]=item?{state:item.state,last_updated:item.last_updated}:null;
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
    _onMsg(event){
      if(event.origin!==location.origin||event.source!==this._iframe?.contentWindow||!event.data)return;
      if(event.data.__bbq==='bbq-child-ready-v1'){this._lastPayload='';this._send();this._loadCookbook();this._loadReviews();}
      if(event.data.__bbq==='bbq-library-request-v1')this._loadCookbook();
      if(event.data.__bbq==='bbq-library-write-v1'&&event.data.library&&typeof event.data.library==='object')this._saveCookbook(event.data.library);
      if(event.data.__bbq==='bbq-reviews-request-v1')this._loadReviews();
      if(event.data.__bbq==='bbq-reviews-write-v1'&&event.data.reviews&&typeof event.data.reviews==='object')this._saveReviews(event.data.reviews);
      if(event.data.__bbq==='bbq-child-height-v1'){
        const h=Number(event.data.height);
        if(Number.isFinite(h)&&h>250&&h<30000)this._iframe.style.height=Math.ceil(h)+'px';
      }
    }
  }
  if(!customElements.get('bbq-planner-meater-card'))customElements.define('bbq-planner-meater-card',BbqPlannerMeaterCard);
  window.customCards=window.customCards||[];
  if(!window.customCards.some(x=>x.type==='bbq-planner-meater-card')){
    window.customCards.push({type:'bbq-planner-meater-card',name:'BBQ-planner + MEATER',description:'Interactieve planning voor 2 kamado’s met live MEATER via Home Assistant',preview:false});
  }
})();
