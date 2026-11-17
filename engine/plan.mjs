/* ES-module-ingang van de planningshulp (v5.7.0): kamadokeuze bij toevoegen, urgente conflicten met een directe oplossing,
   "Plan opnieuw vanaf nu" en een voorbije voorbereiding "avond vooraf".
   De rekenkern staat één keer in dist/bbq-eta.js (klassiek script, zie engine/eta.mjs). Geen kopie. */
import '../dist/bbq-eta.js';

const api = globalThis.BBQPlan;
if (!api || typeof api.lateStart !== 'function') throw new Error('Planningshulp niet geladen');

export const pickKamado = api.pickKamado;
export const urgentIssues = api.urgentIssues;
export const lateStart = api.lateStart;
export const prepOverdue = api.prepOverdue;
export const clockText = api.clockText;
