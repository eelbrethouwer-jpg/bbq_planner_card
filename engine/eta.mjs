/* ES-module-ingang van de ETA-schattingsmodule (v5.4.0).
   De rekenkern staat één keer in dist/bbq-eta.js: een klassiek script, zodat de productieplanner
   (klassieke scripts, geen module-lader) hem met een gewone <script src> laadt. Deze ingang voert
   precies dat bestand uit en exporteert dezelfde, pure functies voor tests en v6. Geen kopie. */
import '../dist/bbq-eta.js';

const api = globalThis.BBQEta;
if (!api || typeof api.estimate !== 'function') throw new Error('ETA-module niet geladen');

export const estimate = api.estimate;
export const ETA_DEFAULTS = api.defaults;
export const ETA_VERSION = api.version;
