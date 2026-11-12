const { open } = require('./lib.js');
(async () => { const t = await open(); const p = t.p; let bad = 0;
 for (const d of ['online', 'mgmt', 'prod']) {
  await p.evaluate(d => { location.hash = '#div=' + d; }, d); await p.waitForTimeout(500);
  const n = await p.locator('.r10-row[data-issue]').count();
  for (let k = 0; k < Math.min(n, 3); k++) {
   await p.evaluate(d => { location.hash = '#div=' + d; }, d); await p.waitForSelector('.r10-row[data-issue]'); await p.locator('.r10-row[data-issue]').nth(k).click(); await p.waitForTimeout(400);
   const axes = await p.$$eval('[data-r10ax]:not([disabled])', b => b.map(x => x.dataset.r10ax));
   for (const ax of axes) { await p.click(`[data-r10ax="${ax}"]`); await p.waitForTimeout(350);
    const r = await p.evaluate(() => ({ s: st.s, hm: document.querySelectorAll('#r10HmMap [data-r10hc]').length, price: R10CHART.HM.price }));
    const click = await p.locator('#r10HmMap [data-r10hc]').count() ? (await p.locator('#r10HmMap [data-r10hc]').first().click(), await p.waitForTimeout(150), await p.evaluate(() => !!document.querySelector('.r10-trend:not(.empty)'))) : null;
    console.log(d, k, ax, JSON.stringify(r), 'trend', click); }
  } }
 console.log('errs', t.errs); await t.close(); })();
