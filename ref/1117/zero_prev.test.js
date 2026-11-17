const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const chartSource = fs.readFileSync(path.join(root, 'r10_chart.js'), 'utf8');

function app(div = 'prod', cmp = 'q3', mode = 'amt') {
  const sales = { '2507': 30000, '2601': 60000, '2607': 60000, '2608': 60000, '2609': 60000 };
  const vendors = [
    { code: 'OLD', name: 'Existing vendor', m: { '2507': 300, '2601': 600, '2607': 600 } },
    { code: 'NEW', name: 'New vendor', m: { '2607': 900 } }
  ];
  const division = {
    acc: [
      { code: '6100', name: 'Comparable account', m: { '2507': 300, '2601': 600, '2607': 1500 } },
      { code: '6200', name: 'No vendor history', m: { '2507': 300, '2607': 900 } },
      { code: '6300', name: 'No account history', m: { '2607': 900 } },
      { code: '5029', name: 'Purchase account', m: { '2507': 300, '2607': 1500 } }
    ],
    vend: { '6100': vendors, '6200': [vendors[1]], '6300': vendors },
    mat: {}, salesM: { prod: sales, net: sales }, labor: []
  };
  const data = {
    allowed: ['PROD', 'MGMT', 'ONLINE'], prod: structuredClone(division), mgmt: structuredClone(division),
    online: { lines: [{ ym: '2507', ch: 'D2C', item: '광고선전비', amt: 300 }, { ym: '2607', ch: 'D2C', item: '광고선전비', amt: 1500 }], sales: Object.entries(sales).map(([ym, s]) => ({ ym, s, ch: 'ONLINE_COMMON' })) },
    ovend: [{ code: '8338', name: 'Online account', vend: structuredClone(vendors) }],
    mat2: { items: [], vn: {} },
    sub5029: { vend: vendors, mat: [
      { item: 'ZIP_S_A', vendor: 'OLD', m: { '2507': [300, 3], '2607': [600, 3] } },
      { item: 'ZIP_S_B', vendor: 'NEW', m: { '2607': [900, 3] } }
    ], total: { '2507': 300, '2607': 1500 } }
  };
  const format = n => Math.round(n).toLocaleString('ko-KR');
  const context = vm.createContext({
    console, URLSearchParams, location: { hash: '' },
    document: { body: { classList: { contains: () => true } } },
    PMON3: { '25Q3': ['2507', '2508', '2509'], '26H1': ['2601', '2602', '2603', '2604', '2605', '2606'], '26Q3': ['2607', '2608', '2609'] },
    R6_DATA: data, addEventListener() {},
    V5: {
      f: format, sg: format, man: n => n + '원', esc: s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
      per: y => y.startsWith('25') ? '25Q3' : +y.slice(2) < 7 ? '26H1' : '26Q3',
      PMN: { '25Q3': 3, '26H1': 6, '26Q3': 3 },
      MONTHS: Object.keys(sales), J: (k, d) => d, mode: () => mode,
      salesM: y => sales[y] || 10000, setSide() {}, setBases() {}, basisLabel: () => 'Sales',
      ST: { moves: [], plans: [] }, chartM: () => '', vYm: format, pct: (a, b) => a / b * 100 + '%'
    }
  });
  context.window = context;
  vm.runInContext(appSource.replace("V5.mount('flow');parseHash();render();window.R6_READY=true;", ''), context);
  vm.runInContext(chartSource, context);
  vm.runInContext(`st.div='${div}';st.cmp='${cmp}';useDiv();`, context);
  return { context, run: code => vm.runInContext(code, context) };
}

test('A1: new ledger vendor uses zero previous amount and current monthly delta', () => {
  const a = app();
  const x = a.run("issues(true).find(i=>i.id==='6100').drivers.find(d=>d.id==='NEW').x");
  assert.equal(x.nd, false);
  assert.equal(x.ap, 0);
  assert.equal(x.pa, 0);
  assert.equal(x.d, 300);
  assert.equal(x.r, null);
  assert.equal(x.rp, 0);
  assert.equal(x.pp, x.rc);
});

for (const div of ['prod', 'mgmt', 'online']) {
  test(`${div}: ledger heatmap and vendor drill agree without mutating source`, () => {
    const a = app(div);
    const before = JSON.stringify(a.context.R6_DATA);
    a.run("st.hm='vend'");
    const tile = a.run("hmModel().all.find(i=>i.id.endsWith('|NEW'))");
    assert.equal(tile.isNew, false);
    assert.equal(tile.pa, 0);
    assert.match(tile.tip, /월평균 0원/);
    a.run(`st.a='vd';st.va='${div === 'online' ? '8338' : '6100'}';st.vv='NEW'`);
    const x = a.run('cur().x');
    assert.equal(x.nd, false);
    assert.equal(x.ap, 0);
    assert.equal(x.d, 300);
    assert.match(a.run('stepVendDrill()'), /월평균 0원/);
    assert.doesNotMatch(a.run('stepVendDrill()'), /Infinity|NaN/);
    const summary = a.run('R10CHART.vdCfg().views.all().sum');
    assert.doesNotMatch(summary, /비교 기간 없음/);
    assert.equal(JSON.stringify(a.context.R6_DATA), before);
  });
}

test('A2: missing account or all vendor history stays incomparable', () => {
  const a = app();
  for (const code of ['6200', '6300']) {
    assert.equal(a.run(`issues(true).find(i=>i.id==='${code}').drivers.find(d=>d.id==='NEW').nd`), true);
    a.run(`st.a='${code}'`);
    a.run('R10CHART.prodCfg(cur()).views.vend()');
    assert.equal(a.context.R10CHART.HM.rows.find(r => r.key === 'NEW').nd, true);
    a.run(`st.a='vd';st.va='${code}';st.vv='NEW'`);
    assert.equal(a.run('cur().nd'), true);
  }
  assert.equal(a.run("cmpM({'2607':900}).nd"), true);
  assert.equal(a.run("pchg({m:{'2607':[900,3]}},'q3').pu"), null);
});

test('A3: existing vendor averages and unequal comparison periods stay intact', () => {
  for (const [cmp, ap] of [['q3', 100], ['h1', 100]]) {
    const a = app('prod', cmp);
    const x = a.run("issues(true).find(i=>i.id==='6100').drivers.find(d=>d.id==='OLD').x");
    assert.equal(x.ap, ap);
    assert.equal(x.ac, 200);
    assert.equal(x.d, 100);
    assert.equal(x.r, 100);
    assert.equal(a.run("issues(true).find(i=>i.id==='6100').drivers.find(d=>d.id==='NEW').x.d"), 300);
  }
  const a = app('prod', 'q4');
  assert.equal(a.run("issues(true).find(i=>i.id==='6100').drivers.find(d=>d.id==='NEW').nd"), true);
});

test('A3: purchase vendor and item price comparisons stay unchanged', () => {
  const a = app();
  const x = a.run("issues(true).find(i=>i.id==='5029').drivers.find(d=>d.id==='NEW').x");
  assert.equal(x.nd, false);
  assert.equal(x.ap, 0);
  assert.equal(x.d, 300);
  assert.equal(x.r, null);
  assert.equal(x.pp, null);
  const old = a.run("pchg({m:{'2507':[300,3],'2607':[600,3]}},'q3')");
  assert.equal(old.chg, 100);
  assert.equal(a.run("pchg({m:{'2607':[900,3]}},'q3').chg"), null);
});

for (const div of ['prod', 'mgmt', 'online']) {
  test(`${div}: account chart reports new vendor delta in amount and ratio modes`, () => {
    for (const mode of ['amt', 'ratio']) {
      const a = app(div, 'q3', mode);
      a.run(`st.a='${div === 'online' ? '광고선전비' : '6100'}'`);
      const cfg = div === 'online' ? "R10CHART.onlineCfg(issues(true).find(i=>i.code==='8338'))" : 'R10CHART.prodCfg(cur())';
      a.run(`${cfg}.views.vend()`);
      const r = a.context.R10CHART.HM.rows.find(r => r.key === 'NEW');
      assert.equal(r.nd, false);
      assert.equal(r.r.p, 0);
      assert.equal(r.r.d, mode === 'amt' ? 300 : r.r.x.rc);
      assert.equal(r.achg, null);
    }
  });
}

test('zero rows prove coverage; absent sales, credits and online channels stay safe', () => {
  const a = app();
  a.run("PD.vend['6100'][0].m={'2507':0};PD.vend['6100'][1].m={'2607':-900}");
  let x = a.run("issues(true).find(i=>i.id==='6100').drivers.find(d=>d.id==='NEW').x");
  assert.equal(x.nd, false);
  assert.equal(x.d, -300);
  assert.equal(x.r, null);
  a.run('V5.salesM=()=>null');
  x = a.run("issues(true).find(i=>i.id==='6100').drivers.find(d=>d.id==='NEW').x");
  assert.equal(x.d, -300);
  assert.equal(x.pp, null);
  a.run("st.div='online';OL.lines.push({ym:'2607',ch:'KURLY',item:'광고선전비',amt:900,g:'광고선전비'});useDiv()");
  assert.equal(a.run("issues(true).find(i=>i.code==='8338').drivers.find(d=>d.id==='KURLY').nd"), true);
});

test('repair: selected online vendor renders its own amount and online-sales ratio comparison', () => {
  for (const mode of ['amt', 'ratio']) {
    const a = app('online', 'q3', mode);
    a.run("st.a='광고선전비'");
    const render = "R10CHART.onlineCfg(cur()).views.vend().extra";
    assert.doesNotMatch(a.run(render), /id="r10VendorCompare"/);
    a.run("R10CHART.HM.sel='NEW'");
    const html = a.run(render);
    assert.match(html, /선택 거래처 New vendor 비교/);
    assert.match(html, /월평균 금액/);
    assert.match(html, /25Q3[^<]*0원/);
    assert.match(html, /26Q3[^<]*300원/);
    assert.match(html, /증감[^<]*\+300원/);
    if (mode === 'ratio') {
      assert.match(html, /온라인 매출 기준 비율/);
      assert.match(html, /25Q3[^<]*0\.00%/);
      assert.match(html, /26Q3[^<]*0\.50%/);
      assert.match(html, /증감[^<]*\+0\.5%p/);
    }
    assert.match(html, /data-r10tr="price"[^>]*disabled/);
    assert.match(html, /월별 금액\(원\)/);
    assert.doesNotMatch(html, /NaN|Infinity/);
    a.run("R10CHART.HM.sel='OLD'");
    const old = a.run(render);
    assert.match(old, /선택 거래처 Existing vendor 비교/);
    assert.doesNotMatch(old, /선택 거래처 New vendor 비교/);
  }
});

test('repair: selected vendor summary keeps genuine absence and missing sales visible', () => {
  const a = app('online', 'q3', 'ratio');
  a.run("st.a='광고선전비';DB.ovend[0].vend=DB.ovend[0].vend.filter(v=>v.code==='NEW')");
  const render = "R10CHART.onlineCfg(cur()).views.vend().extra";
  a.run(render);
  a.run("R10CHART.HM.sel='NEW'");
  assert.match(a.run(render), /25Q3[^<]*비교 기간 없음/);
  a.run('V5.salesM=()=>null');
  assert.match(a.run(render), /매출 자료 없음/);
  assert.doesNotMatch(a.run(render), /NaN|Infinity/);
});

test('repair: spark tooltip turns V5 missing-sales markup into escaped text', () => {
  const a = app('prod', 'q3', 'ratio');
  a.run(`V5.vYm=()=>'<span class="nos">매출 줄 없음</span>'`);
  const html = a.run("spark({'2607':900})");
  assert.doesNotMatch(html, /title="[^"]*<span/);
  assert.match(html, /title="25\.07 매출 줄 없음"/);
  assert.doesNotMatch(html, /title="[^"]*class=/);
});
