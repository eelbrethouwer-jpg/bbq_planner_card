/*
 * PR3 — fail-closed cross-tab mutex for cooperating v6 clients.
 * Web Locks are origin-scoped; no insecure localStorage "lease" fallback.
 *
 * IMPORTANT: The published v5 application does not take this lock. Therefore
 * the lock alone does NOT make it safe to connect v6 writes to public v5.
 */
export const LOCK_NAME='bbq-v6-plan-write-v1';

export function createPlanLock({lockManager,lockName=LOCK_NAME}={}){
  if(!lockManager||typeof lockManager.request!=='function')
    throw new Error('WEB_LOCKS_UNAVAILABLE');
  if(typeof lockName!=='string'||!lockName)
    throw new Error('INVALID_LOCK_NAME');
  return async function withExclusiveLock(operation){
    if(typeof operation!=='function')throw new TypeError('Operation required');
    return lockManager.request(lockName,{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock)throw new Error('PLAN_LOCK_BUSY');
      return operation();
    });
  };
}
