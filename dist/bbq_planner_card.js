/* BBQ-bereidingsplanner v4.3.0 — HACS/Home Assistant live bridge.
   Alleen publiek bekende entiteitsnamen, GEEN wachtwoorden / API-tokens.
   Deze custom Lovelace-kaart gebruikt de bestaande ingelogde Home Assistant-sessie. */
(() => {
  'use strict';
  const SOURCE=new URL('./BBQ_bereidingsplanner_MEATER_v4.html?v=4.3.0', import.meta.url).href;
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
  class BbqPlannerMeaterCard extends HTMLElement {
    constructor(){
      super();this._hass=null;this._iframe=null;this._lastPayload='';this._onMsg=this._onMsg.bind(this);
      this._cookbookConn=null;this._cookbookUnsub=null;this._syncQueue=Promise.resolve();
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
    connectedCallback(){window.addEventListener('message',this._onMsg);this._ensureCookbookSubscription();}
    disconnectedCallback(){window.removeEventListener('message',this._onMsg);this._stopCookbookSubscription();}
    set hass(hass){this._hass=hass;this._send();this._ensureCookbookSubscription();}
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
    _onMsg(event){
      if(event.origin!==location.origin||event.source!==this._iframe?.contentWindow||!event.data)return;
      if(event.data.__bbq==='bbq-child-ready-v1'){this._lastPayload='';this._send();this._loadCookbook();}
      if(event.data.__bbq==='bbq-library-request-v1')this._loadCookbook();
      if(event.data.__bbq==='bbq-library-write-v1'&&event.data.library&&typeof event.data.library==='object')this._saveCookbook(event.data.library);
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
