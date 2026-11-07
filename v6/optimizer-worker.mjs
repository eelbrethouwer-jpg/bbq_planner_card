/* BBQ Regisseur v6 PR3: isolated, read-only optimizer execution. */
import {optimize} from '../engine/optimizer.mjs';

self.addEventListener('message', event => {
  const request = event.data;
  if (!request || request.type !== 'optimize' || !Number.isSafeInteger(request.id)) return;
  try {
    const result = optimize(request.input);
    self.postMessage({type:'result', id:request.id, result});
  } catch (error) {
    self.postMessage({
      type:'error', id:request.id,
      error:{code:'OPTIMIZATION_FAILED',message:error instanceof Error?error.message:String(error)}
    });
  }
});
