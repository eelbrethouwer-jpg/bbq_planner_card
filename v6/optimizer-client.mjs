/* PR3: one-shot module workers prevent blocking the UI and stale results. */
const stoppedError=()=>{
  const error=new Error('Optimizer request cancelled');
  error.name='AbortError';
  return error;
};
const defaultFactory=()=>new Worker(new URL('./optimizer-worker.mjs',import.meta.url),{type:'module'});

/**
 * Returns an isolated optimizer client. No localStorage, network, or apply behavior.
 * Each run gets a new Worker; cancelling terminates that Worker (not just its callback).
 */
export function createOptimizerClient({workerFactory=defaultFactory,onStateChange=()=>{}}={}){
  let current=null,sequence=0,disposed=false;
  let state={status:'idle',result:null,error:null};
  const notify=(next)=>{
    state=next;
    onStateChange({...state});
  };
  function cancel(){
    if(!current)return;
    const prior=current;
    current=null;
    prior.worker.terminate();
    prior.reject(stoppedError());
    notify({status:'idle',result:null,error:null});
  }
  function run(input){
    if(disposed)return Promise.reject(new Error('Optimizer client disposed'));
    cancel();
    let worker;
    try{worker=workerFactory()}catch(error){
      notify({status:'error',result:null,error:'WORKER_UNAVAILABLE'});
      return Promise.reject(error);
    }
    const id=++sequence;
    return new Promise((resolve,reject)=>{
      current={id,worker,resolve,reject};
      notify({status:'running',result:null,error:null});
      function finish(message,error){
        if(!current||current.id!==id)return;
        current=null;
        worker.terminate();
        if(error){
          notify({status:'error',result:null,error:error.message||'OPTIMIZATION_FAILED'});
          reject(error);
        }else{
          notify({status:'complete',result:message.result,error:null});
          resolve(message.result);
        }
      }
      worker.addEventListener('message',event=>{
        const data=event.data;
        if(!data||data.id!==id)return;
        if(data.type==='error')finish(null,new Error(data.error?.message||'OPTIMIZATION_FAILED'));
        else if(data.type==='result')finish(data,null);
      });
      worker.addEventListener('error',event=>{
        finish(null,new Error(event.message||'WORKER_FAILED'));
      });
      try{worker.postMessage({type:'optimize',id,input});}
      catch(error){finish(null,error);}
    });
  }
  function dispose(){
    cancel();
    disposed=true;
  }
  return {run,cancel,dispose,getState:()=>({...state})};
}
