/* a contact sheet of looks, drawn with the game's own portrait function:
   node tools/looks.js <out.png> <mode: hair (styles, beards, headband, goggles) | face (the eight faces) | body (builds, sleeve, pads, tattoos) | arm (sleeve and tattoos, large)> */
const { chromium } = require('playwright');
require('fs').mkdirSync('.shots', { recursive: true }); const [OUT = '.shots/looks.png', MODE = 'hair'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 1300, height: 900 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
  await pg.evaluate(MODE => {
    const hairs = ['short', 'buzz', 'high', 'afro', 'twists', 'fade', 'cornrows', 'bun', 'mohawk', 'locs', 'curly', 'ponytail', 'long', 'braids', 'spiky'];
    let looks = [];
    if (MODE === 'hair') looks = hairs.map((h, i) => [h, { hair: h, hairColor: '#17110d', face: i % 5 }, i % 2 ? 4 : 2]).concat([['stubble', { hair: 'short', beard: 'stubble' }, 3], ['goatee', { hair: 'fade', beard: 'goatee' }, 4], ['full', { hair: 'buzz', beard: 'full' }, 1], ['mustache', { hair: 'short', beard: 'mustache' }, 2], ['chinstrap', { hair: 'fade', beard: 'chinstrap' }, 3], ['band', { hair: 'afro', band: '#f2f2f2' }, 4], ['goggles', { hair: 'short', goggles: 'black' }, 2], ['blond', { hair: 'high', hairColor: '#c9a35a' }, 0]]);
    else if (MODE === 'body') looks = [['plain', {}], ['slim', { build: 'slim' }], ['strong', { build: 'strong' }], ['big', { build: 'big' }], ['sleeve', { sleeve: '#111111' }], ['wrist', { wrist: '#f2f2f2' }], ['one', { legs: 'one' }], ['pads', { legs: 'pads' }], ['both', { legs: 'both' }], ['tights', { legs: 'tights' }], ['high socks', { socks: 'high' }], ['low socks', { socks: 'low' }], ['bicep', { bicep: '#f2f2f2' }], ['pink', { hair: 'mohawk', hairColor: '#e0489a' }], ['tat1', { tat: 1 }], ['tat2', { tat: 2 }], ['tat3', { tat: 3 }], ['tat4', { tat: 4 }], ['back', {}, 3, { back: true }], ['ponytail', { hair: 'ponytail' }, 2, { back: true, tight: true }], ['long', { hair: 'long', hairColor: '#4a3020' }, 1, { back: true, tight: true }], ['curly', { hair: 'curly' }, 4, { back: true, tight: true }], ['bun', { hair: 'bun' }, 3, { back: true, tight: true }]].map(l => [l[0], Object.assign({ hair: 'short' }, l[1]), l[2] == null ? 3 : l[2], l[3]]);
    if (MODE === 'arm') looks = [['sleeve', { hair: 'short', sleeve: '#111111' }, 1], ['tat1', { hair: 'short', tat: 1 }, 1], ['tat3', { hair: 'short', tat: 3 }, 1], ['tat4', { hair: 'short', tat: 4 }, 1], ['tee', { hair: 'short', tee: '#f2f2f2' }, 3], ['tee+sleeve', { hair: 'fade', tee: '#111111', sleeve: '#111111' }, 2]];
    if (MODE === 'face') looks = [0, 1, 2, 3, 4, 5, 6, 7].map(f => ['face ' + f, { hair: 'short', face: f }, f % 6]);
    const team = PB.TEAMS ? PB.TEAMS[3] : PB.team(0);
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;background:#26262b;z-index:99999;display:flex;flex-wrap:wrap;align-content:flex-start;gap:4px;padding:6px;font:12px sans-serif;color:#fff';
    for (const [name, look, skin, o] of looks) { const url = PB.R.portrait({ id: 'x' + name, first: 'A', last: 'B', pos: 'SG', ht: 78, skin, num: 7, r: {}, look }, team, MODE === 'body' ? 150 : MODE === 'arm' ? 300 : 200, Object.assign(MODE === 'body' ? { body: true } : MODE === 'arm' ? { body: true, tight: true } : { close: true }, o || {}));
      const d = document.createElement('div'); d.innerHTML = `<img src="${url}" style="display:block;background:#3a3a40"><div style="text-align:center">${name}</div>`; host.appendChild(d); }
    document.body.appendChild(host);
  }, MODE);
  await pg.waitForTimeout(600); await pg.screenshot({ path: OUT }); console.log('errors', errs); await b.close(); process.exit(0);
})();
