// COST1112 숫자 대조: 히트맵 칸(크기=금액, 색=단가 등락)과 추세(월별 단가·금액)를 원천 파일과 독립 계산으로 비교한다.
// 원천 파일(읽기만): /Users/janghoyeon/orca/workspaces/q4-cost-plan-ui-review/gs1/local_bundles/prod.json  (탭 D_구매월)
const fs = require('fs'), path = require('path');
const { open } = require('./lib.js');
const SRC = '/Users/janghoyeon/orca/workspaces/q4-cost-plan-ui-review/gs1/local_bundles/prod.json';
const b = JSON.parse(fs.readFileSync(SRC, 'utf8')); const tab = b.tabs['D_구매월']; const H = tab.header; const ix = n => H.indexOf(n);
const CUR = ['2607', '2608', '2609'], PREV = ['2507', '2508', '2509'];
const byItem = {}, byVend = {};   // item -> ym -> [amt,qty]
for (const r of tab.rows) { if (r[ix('division_id')] !== 'PROD') continue; const it = r[ix('item_code')], ym = r[ix('ym')], vd = r[ix('vendor_code')], a = +r[ix('supply_amt')] || 0, q = +r[ix('qty')] || 0;
  const m = (byItem[it] = byItem[it] || {}); const c = (m[ym] = m[ym] || [0, 0]); c[0] += a; c[1] += q;
  const vm = ((byVend[vd] = byVend[vd] || {})[it] = byVend[vd][it] || {}); const vc = (vm[ym] = vm[ym] || [0, 0]); vc[0] += a; vc[1] += q; }
const sum = (m, ys) => ys.reduce((s, y) => [s[0] + (m[y] ? m[y][0] : 0), s[1] + (m[y] ? m[y][1] : 0)], [0, 0]);
const chg = m => { const [ca, cq] = sum(m, CUR), [pa, pq] = sum(m, PREV); const cu = cq > 0 ? ca / cq : null, pu = pq > 0 ? pa / pq : null; return cu != null && pu > 0 ? (cu / pu - 1) * 100 : null; };
const near = (a, b, e) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= e);
let bad = 0, n = 0; const fail = (m, d) => { bad++; console.log('MISMATCH', m, JSON.stringify(d)); };
(async () => {
  console.log('원천 파일:', SRC, '/ 탭 D_구매월 PROD', Object.keys(byItem).length, '품목');
  const t = await open(); const p = t.p;
  for (const [axis, hash] of [['item', '#div=prod&s=3&a=5029&ax=item'], ['vend', '#div=prod&s=3&a=5029&ax=vend']]) {
    await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(700);
    const rows = await p.evaluate(() => R10CHART.HM.rows.map(r => ({ key: r.key, size: r.size, chg: r.pchg, m: r.m, pser: r.pser })));
    const cells = await p.$$eval('#r10HmMap [data-r10hc]', e => e.map(x => ({ key: x.dataset.r10hc, amt: +x.dataset.amt, chg: x.dataset.chg === '' ? null : +x.dataset.chg })));
    let itemSet = null;
    if (axis === 'vend') { itemSet = new Set(await p.evaluate(() => DB.sub5029.mat.map(x => x.item)));  /* 5029 부재료 품목 집합(앱이 계정에 연결한 품목 목록; 금액은 원천으로 재계산) */ }
    console.log(`[${axis}] 행 ${rows.length}개, 화면 칸 ${cells.length}개`);
    for (const r of rows) {
      let m;
      if (axis === 'item') m = byItem[r.key] || {};
      else { m = {}; for (const [it, im] of Object.entries(byVend[r.key] || {})) if (itemSet.has(it)) for (const [y, v] of Object.entries(im)) { (m[y] = m[y] || [0, 0]); m[y][0] += v[0]; m[y][1] += v[1]; } }
      n++; const sa = sum(m, CUR)[0]; if (!near(sa, r.size, 0.5)) fail(axis + ' 크기 ' + r.key, { src: sa, app: r.size });
      let sc;
      if (axis === 'item') sc = chg(m);
      else { // 거래처 단가 등락 = 품목별 단가 변화를 이번 수량으로 가중
        let imp = 0, den = 0; for (const [it, im] of Object.entries(byVend[r.key] || {})) { if (!itemSet.has(it)) continue; const [ca, cq] = sum(im, CUR), [pa, pq] = sum(im, PREV); const cu = cq > 0 ? ca / cq : null, pu = pq > 0 ? pa / pq : null; if (cu != null && pu > 0) { imp += cq * (cu - pu); den += cq * pu; } } sc = den > 0 ? imp / den * 100 : null; }
      n++; if (!near(sc, r.chg, 1e-6)) fail(axis + ' 단가등락 ' + r.key, { src: sc, app: r.chg });
      for (const y of ['2601', '2602', '2603', '2604', '2605', '2606', '2607', '2608', '2609']) {   // 추세 월별 금액
        const sv = m[y] ? m[y][0] : undefined; const av = r.m[y]; n++; if (!near(sv == null ? null : sv, av == null ? null : av, 0.5)) fail(axis + ' 추세금액 ' + r.key + ' ' + y, { src: sv, app: av });
        if (axis === 'item' && r.pser) { const sp = m[y] && m[y][1] > 0 ? m[y][0] / m[y][1] : undefined; n++; if (!near(sp == null ? null : sp, r.pser[y] == null ? null : r.pser[y], 1e-6)) fail('추세단가 ' + r.key + ' ' + y, { src: sp, app: r.pser[y] }); } }
    }
    // 화면에 실제로 그려진 칸의 data-* 가 행 값과 같은지
    for (const c of cells) { const r = rows.find(x => x.key === c.key); if (!r) continue; n += 2; if (!near(c.amt, r.size, 0.5)) fail('칸 data-amt ' + c.key, c); if (!near(c.chg, r.chg, 1e-3)) fail('칸 data-chg ' + c.key, c); }
  }
  // 화면에서 직접 보이는 추세 그래프 막대 값(툴팁 title)도 1개 확인: 첫 단가 있는 품목 칸
  await p.evaluate(() => { location.hash = '#div=prod&s=3&a=5029&ax=item'; }); await p.waitForTimeout(600);
  await p.locator('#r10HmMap [data-r10hc]:not([data-chg=""])').first().click(); await p.waitForTimeout(300);
  const sel = await p.evaluate(() => ({ key: document.getElementById('r10Trend').dataset.key, tips: [...document.querySelectorAll('#r10Trend [data-ym]')].map(e => [e.dataset.ym, e.dataset.v]) }));
  for (const [y, v] of sel.tips) { if (v === '') continue; const m = byItem[sel.key]; const sp = m[y] && m[y][1] > 0 ? m[y][0] / m[y][1] : null; n++; if (!near(sp, +v, 1e-6)) fail('화면 막대 단가 ' + sel.key + ' ' + y, { src: sp, app: +v }); }
  console.log(`비교 ${n}건, 불일치 ${bad}건`); await t.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
