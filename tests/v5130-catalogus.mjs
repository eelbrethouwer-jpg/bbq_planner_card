/* v5.13.0 / v5.14.0: validatie van de BBQ Junkie-receptencatalogus (V48_RECIPES).
   Puur Node, geen DOM en geen netwerk: de catalogus wordt uit dist/BBQ_bereidingsplanner_MEATER_v4.html gelezen en
   uitgevoerd. Dit controleert vorm, plausibiliteit en voedselveiligheid van de gegevens, niet of de externe foto's
   of receptpagina's online bereikbaar zijn (daarvoor is geen netwerk in CI). */
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('dist/BBQ_bereidingsplanner_MEATER_v4.html', 'utf8');
const between = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  assert.ok(a >= 0 && b > a, 'marker niet gevonden: ' + from);
  return html.slice(a, b);
};
const CATEGORIES = new Function(between('const CATEGORIES=', ';\n') + ';return CATEGORIES;')();
const METHODS = new Function(between('const METHODS=', ';\n') + ';return METHODS;')();
const validV45Photo = new Function(between('function validV45Photo', '\nfunction ') + ';return validV45Photo;')();
const catalogSrc = between('const V48_RECIPES=[', '/* v5.13.0');
const V48_RECIPES = new Function(catalogSrc + ';return V48_RECIPES;')();
const comboSrc = between('const V513_COMBO=', 'function v48Match');
const v48RecipeData = new Function('V48_RECIPES', comboSrc + ';return v48RecipeData;')(V48_RECIPES);

let n = 0;
const ok = (name, fn) => { fn(); n++; };

ok('aantal en ids', () => {
  assert.ok(V48_RECIPES.length >= 35, 'catalogus uitgebreid: ' + V48_RECIPES.length);
  assert.deepEqual(V48_RECIPES.map(r => r.id), V48_RECIPES.map((_, i) => i + 1), 'ids lopen door vanaf 1');
  assert.equal(new Set(V48_RECIPES.map(r => r.id)).size, V48_RECIPES.length);
});
ok('de oorspronkelijke 11 recepten staan nog op dezelfde plek', () => {
  const first = ['texas-style-buikspek', 'ribeye-groene-asperges-smashed-potatoes', 'hot-honey-chickenwings', 'omgekeerde-ananas-cake',
    'varkensrack-met-kruiden-parmezaan-korst', 'jalapeno-popper-pig-shots', 'cheesy-garlic-hotdogs', 'smoked-creamcheese', 'gegrilde-perzik',
    'gegrilde-bimi', 'iberico-secreto-met-mojo-verde'];
  assert.deepEqual(V48_RECIPES.slice(0, 11).map(r => r.url.split('/').at(-2)), first);
});
ok('unieke slug, naam en label', () => {
  for (const key of ['url', 'name', 'label', 'photo']) assert.equal(new Set(V48_RECIPES.map(r => r[key].toLowerCase())).size, V48_RECIPES.length, 'uniek: ' + key);
});

for (const r of V48_RECIPES) {
  const at = ' [' + r.label + ']';
  ok('vorm' + at, () => {
    const slug = r.url.replace(/^https:\/\/bbq-junkie\.nl\/bbq-recepten\//, '').replace(/\/$/, '');
    assert.match(r.url, /^https:\/\/bbq-junkie\.nl\/bbq-recepten\/[a-z0-9-]+\/$/, 'linkformaat' + at);
    assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug' + at);
    assert.equal(r.name, 'BBQ Junkie · ' + r.label);
    assert.ok(CATEGORIES[r.category], 'categorie' + at);
    assert.ok(METHODS[r.method], 'methode' + at);
    assert.ok(Number.isInteger(r.persons) && r.persons >= 1 && r.persons <= 50, 'personen' + at);
  });
  ok('foto' + at, () => {
    assert.ok(r.photo.length <= 300, 'foto-URL lengte' + at);
    assert.ok(validV45Photo(r.photo), 'foto volgt validV45Photo' + at + ': ' + r.photo);
    assert.match(r.photo, /^https:\/\/bbq-junkie\.nl\/wp-content\/uploads\/\d{4}\/\d{2}\/[a-z0-9-]+\.(?:jpg|jpeg|webp)$/i);
  });
  ok('tijden en temperaturen' + at, () => {
    for (const k of ['prep', 'cook', 'rest', 'total', 'grill']) assert.ok(Number.isFinite(r[k]) && r[k] >= 0, k + at);
    assert.ok(r.cook >= 1 && r.cook <= 1200, 'bereidingstijd' + at);
    assert.ok(r.prep <= 600 && r.rest <= 180, 'voorbereiding/rust' + at);
    assert.ok(r.total >= r.cook + r.rest && r.total <= 1500, 'totaaltijd' + at);
    assert.ok(r.grill >= 80 && r.grill <= 300, 'BBQ-temperatuur' + at);
  });
  ok('kerntemperatuur en voedselveiligheid' + at, () => {
    const text = (r.label + ' ' + r.ingredients).toLowerCase();
    const isMince = /gehakt|gehaktbal|meatball|moink|burger/.test(text);
    const core = r.core === '' ? null : Number(r.core);
    assert.ok(core === null || (Number.isFinite(core) && core >= 40 && core <= 110 && core < r.grill), 'kern plausibel' + at);
    if (r.category === 'gevogelte') assert.ok(core !== null && core >= 75, 'gevogelte >= 75 °C' + at);
    if (isMince) assert.ok(core !== null && core >= 72, 'gehakt >= 72 °C' + at);
    if (r.category === 'varken' && core !== null) assert.ok(core >= 62, 'varken >= 62 °C' + at);
    if (r.category === 'rund' && core !== null) assert.ok(core >= 48, 'rund (heel stuk) >= 48 °C' + at);
    if (/pulled|burnt ends|buikspek/i.test(r.label)) assert.ok(core !== null && core >= 90, 'langzaam gegaard varken >= 90 °C' + at);
    // v5.14.0: low & slow (brisket, ribs, short ribs) en nieuwe categorieen.
    if (/brisket|spareribs|short ribs/i.test(r.label)) assert.ok(core !== null && core >= 90 && core <= 100, 'low & slow doel 90-100 °C' + at);
    if (r.category === 'vis') assert.ok(core === null || core >= 50, 'vis >= 50 °C (bron 52, zie release-notities)' + at);
    if (r.category === 'lam' && core !== null) assert.ok(core >= 48 && core <= 75, 'lam plausibel (heel vlees)' + at);
    if (r.category === 'schaaldieren' && core !== null) assert.ok(core >= 60, 'schaaldieren >= 60 °C' + at);
    if (['groenten', 'vegetarisch', 'dessert'].includes(r.category)) {
      assert.ok(core === null, 'geen kerndoel bij groenten/vegetarisch/dessert' + at);
      assert.ok(r.cook <= 120 && r.grill <= 250, 'plausibele tijd en temperatuur' + at);
    }
    if (r.category === 'vis' || r.category === 'schaaldieren') assert.ok(r.cook <= 90 && r.grill <= 260, 'vis gaart kort en niet te heet' + at);
    if (r.category === 'lam' && core !== null) assert.ok(r.method === 'combo' || r.grill <= 250, 'lam: reverse sear of redelijke temperatuur' + at);
  });
  ok('tekstlengte en inhoud' + at, () => {
    for (const k of ['ingredients', 'preparation', 'methodText', 'note']) {
      assert.equal(typeof r[k], 'string', k + at);
      assert.ok(r[k].length > 0 && r[k].length <= 400, k + ' <= 400 tekens (' + r[k].length + ')' + at);
      assert.doesNotMatch(r[k], /<|>|https?:\/\//, k + ' bevat geen markup of links' + at);
    }
    assert.ok(r.label.length <= 80);
  });
  ok('importgegevens' + at, () => {
    const d = v48RecipeData(r);
    assert.equal(d.recipeSource, r.url);
    assert.ok(validV45Photo(d.photo));
    assert.ok(d.notes.length <= 2000 && d.recipeSteps.length === 3);
    assert.equal(d.method, r.method);
    if (r.method === 'combo' || r.method === 'directindirect') {
      assert.ok(d.phase2Temp >= 150 && d.phase2Temp <= 300, 'reverse sear heeft een fase-2-temperatuur' + at);
      assert.ok(d.phase2Minutes >= 1 && d.transitionMins >= 0, 'fase-2-duur' + at);
      assert.ok(d.phase2Temp > r.grill, 'fase 2 heter dan fase 1' + at);
    }
  });
}
ok('nieuwe recepten van v5.13.0 en v5.14.0 aanwezig', () => {
  const slugs = V48_RECIPES.map(r => r.url.split('/').at(-2));
  for (const s of ['rosbief-van-de-bbq', 'bbq-klassieker-moink-balls', 'pork-belly-burnt-ends', 'butter-chicken', 'italian-meatball-subs', 'rendang-dutch-oven', 'vlaams-stoofvlees',
    'zalm-van-een-plankje', 'chimichurri-garnalen', 'gevlinderde-kip', 'coca-cola-drumsticks', 'lamsrack-van-de-bbq', 'gerookte-lamsbout', 'texas-style-brisket',
    'overheerlijk-spareribs-recept', 'short-ribs', 'gepofte-bieten-bbq', 'courgette-bootjes', 'blauwe-bessen-crumble'])
    assert.ok(slugs.includes(s), s);
});
ok('de eerste 23 recepten (v5.13.0) staan nog op dezelfde plek; nieuwe ids 24 t/m 35 achteraan', () => {
  assert.equal(V48_RECIPES[22].url.split('/').at(-2), 'flat-iron-steak-met-charcoal-chimichurri');
  assert.equal(V48_RECIPES[23].url.split('/').at(-2), 'zalm-van-een-plankje');
  assert.equal(V48_RECIPES.length, 35);
});
ok('v5.14.0 verdeling over categorieen: meer variatie', () => {
  const by = {};
  for (const r of V48_RECIPES) by[r.category] = (by[r.category] || 0) + 1;
  for (const c of ['vis', 'schaaldieren', 'lam', 'groenten', 'vegetarisch', 'dessert']) assert.ok(by[c] >= 1, 'categorie aanwezig: ' + c);
  assert.ok(by.lam >= 2 && by.gevogelte >= 6 && by.rund >= 8, JSON.stringify(by));
});
ok('lam (reverse sear) heeft fase 2 via V513_COMBO; geen lege fase 2', () => {
  for (const s of ['lamsrack-van-de-bbq', 'gerookte-lamsbout']) {
    const r = V48_RECIPES.find(x => x.url.includes('/' + s + '/'));
    const d = v48RecipeData(r);
    assert.equal(r.method, 'combo');
    assert.ok(d.phase2Temp >= 190 && d.phase2Temp <= 250 && d.phase2Minutes >= 1 && d.phase2Minutes < r.cook && d.transitionMins >= 0, s);
  }
});
ok('geen automatische import: catalogus wordt alleen via de toevoegen-knop opgeslagen', () => {
  assert.match(html, /data-v48-action="import"/);
  assert.equal((html.match(/saveLocalRecipe\(v48RecipeData\(/g) || []).length, 1, 'één aanroep, in de klikafhandeling');
  const before = html.slice(0, html.indexOf('saveLocalRecipe(v48RecipeData('));
  assert.ok(before.lastIndexOf("btn.dataset.v48Action==='import'") > before.lastIndexOf('function v48Init'), 'alleen binnen de import-handler');
});
console.log('OK v5.14.0 catalogus: ' + V48_RECIPES.length + ' recepten, ' + n + ' controles');
