/* BBQ-bereidingsplanner v4.2.0 — HACS/Home Assistant live bridge.
   Alleen publiek bekende entiteitsnamen, GEEN wachtwoorden / API-tokens.
   Deze custom Lovelace-kaart gebruikt de bestaande ingelogde Home Assistant-sessie. */
(() => {
  'use strict';
  const SOURCE=new URL('./BBQ_bereidingsplanner_MEATER_v4.html?v=4.2.0', import.meta.url).href;
  const PROBES={
    pro:'sensor.meater_probe_00e865be_',
    plus:'sensor.meater_probe_c7dbf045_'
  };
  const SUFFIXES={
    internal:'interne_temperatuur',ambient:'omgevingstemperatuur',target:'doeltemperatuur',
    status:'kookstatus',cooking:'kookt',peak:'piektemperatuur',
    remaining:'resterende_tijd',elapsed:'tijd_verstreken'
  };
  class BbqPlannerMeaterCard extends HTMLElement {
    constructor(){
      super();this._hass=null;this._iframe=null;this._lastPayload='';this._onMsg=this._onMsg.bind(this);
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
    connectedCallback(){window.addEventListener('message',this._onMsg);}
    disconnectedCallback(){window.removeEventListener('message',this._onMsg);}
    set hass(hass){this._hass=hass;this._send();}
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
    _onMsg(event){
      if(event.origin!==location.origin||event.source!==this._iframe?.contentWindow||!event.data)return;
      if(event.data.__bbq==='bbq-child-ready-v1'){this._lastPayload='';this._send();}
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
