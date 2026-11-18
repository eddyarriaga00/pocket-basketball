const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const [out, cols, ...files] = process.argv.slice(2);
  const b = await chromium.launch(); const pg = await b.newPage();
  const imgs = files.map(f => `<img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" style="width:${Math.floor(1560 / cols)}px;display:block">`).join('');
  await pg.setContent(`<body style="margin:0;background:#000"><div id="g" style="display:grid;grid-template-columns:repeat(${cols},1fr);width:1560px">${imgs}</div>`);
  await pg.waitForTimeout(300); await (await pg.$('#g')).screenshot({ path: out }); await b.close(); })();
