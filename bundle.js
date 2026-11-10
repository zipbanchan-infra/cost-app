// GS9 M2: 화면 데이터 번들 조립기(서버 data_r6.py·sub_r10.py 의 /api/r6/data 와 같은 모양을 시트 탭에서 만듦). 브라우저·node 공용.
// 입력 T = { PROD:{D_GL,D_원장,D_매출,D_기간,D_구매_A,D_거래처_A,D_품목}, ONLINE:{D_채널비용,D_원장,D_매출,D_기간,업체계정}, MGMT:{D_GL,D_원장,D_매출,D_기간} } (탭 = 열 이름 키 객체 배열)
(function (root) {
  'use strict';
  var N = function (v) { return v === '' || v == null ? 0 : Number(v); };
  var S = function (v) { return v == null ? '' : String(v); };
  var isNull = function (v) { return v === '' || v == null; };
  var cmp = function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };
  // SQL group by ... order(키 순서대로 정렬한 뒤 첫 등장 순서) 와 같은 정렬
  function sortBy(rows, keys) { return rows.slice().sort(function (x, y) { for (var i = 0; i < keys.length; i++) { var c = cmp(S(x[keys[i]]), S(y[keys[i]])); if (c) return c; } return 0; }); }
  function sumBy(rows, keys, val, nullable) {   // [{keys.., v, any}] 키 순서 정렬, 합. nullable=true 면 모두 비면 null(SQL sum)
    var out = [], idx = {};
    sortBy(rows, keys).forEach(function (r) {
      var k = keys.map(function (c) { return S(r[c]); }).join('\u0001'), o = idx[k];
      if (!o) { o = idx[k] = { r: r, v: 0, any: false, n: 0 }; out.push(o); }
      var x = val(r); if (!isNull(x)) { o.v += Number(x); o.any = true; } o.n++;
    });
    return out;
  }
  var PRODRE = '(제품)', MGMTRE = '(판)';
  var SECTOR_RULES = [
    ['기타', /직원식당|샘플/], ['농산물', /^사과/],
    ['가공', /백설기|어묵|맛살|햄|비엔나|김치|당면|떡|마카로니|파스타|밀가루|빵가루|천사채|김자반|후레이크|누룽지|유자|생크림|휘핑|참치캔|두부|전분|크랜베리|스위트콘|그린빈스|레몬/],
    ['장류·양념', /간장|고추장|된장|고춧가루|설탕|소금|천일염|식초|기름|유_|현미유|올리브|오일|마요네즈|케찹|액젓|올리고당|알룰로스|스테비아|미원|다시다|후추|참깨|들깨|겨자|미향|정종|육수|엑기스|추출액|분말|카레|하이라이스|요리맛샘|해물장|식소다|계피|맛선생|짜장|고맥당|페이스트/],
    ['수산물', /멸치|새우|동태|황태|오징어|꼬막|대구|가자미|주꾸미|해물|미역|파래|다시마|김$|건파래/],
    ['축산물', /소고기|돼지고기|닭|한우|전란|메추리알|사골/]
  ];
  function sector(name, grp) {
    if (grp === 'ZIP_S') return '포장재'; if (grp === 'ZIP_E') return '소모품';
    for (var i = 0; i < SECTOR_RULES.length; i++) if (SECTOR_RULES[i][1].test(name || '')) return SECTOR_RULES[i][0];
    return '농산물';
  }
  var PACK_KW = /박스|상자|스티로폼|테이프|송장|아이스팩|보냉백|에어팩|버블|스트레치필름/;
  function classify(group) { return group === 'ZIP_M' ? '원재료' : (group === 'ZIP_S' || group === 'ZIP_E') ? '부재료' : '그 밖'; }
  function detail(name, group) {
    if (group !== 'ZIP_S' && group !== 'ZIP_E') return '';
    if (PACK_KW.test(name || '')) return '합포장재';
    return group === 'ZIP_S' ? '' : '소모품';
  }
  var isGL = function (s) { return /^(ZIPS_JIPGYE_2026_VENDOR|ECOUNT_JIPGYE_2026_VENDOR)/.test(S(s)); };
  var isEC = function (s) { return /^ECOUNT_JIPGYE_2026_VENDOR/.test(S(s)); };

  function glAcc(rows, maxYm, fix) {
    var acc = {}, order = [];
    var f = rows.filter(function (g) { return S(g.compare_period) !== '' && S(g.ym) <= maxYm; });
    sumBy(f, ['ym', 'account_code'], function (g) { return g.amount; }).forEach(function (o) {
      var ac = S(o.r.account_code);
      if (!acc[ac]) { acc[ac] = { code: ac, name: fix(S(o.r.account_name)), m: {} }; order.push(ac); }
      acc[ac].m[S(o.r.ym)] = o.v;
    });
    return order.map(function (k) { return acc[k]; });
  }
  // 서버의 group by (계정, 연월, 거래처) 순서로 거래처가 처음 나온 순서를 만든다(배열로 순서 보존: JS 객체는 숫자 모양 키를 먼저 돌려서 쓰지 않음)
  function ledgerOrder(rows) { return rows.slice().sort(function (x, y) { return cmp(S(x.account_code), S(y.account_code)) || cmp(S(x.ym), S(y.ym)) || cmp(S(x.vendor_code), S(y.vendor_code)); }); }
  function vendMap(ledger, div, maxYm) {
    var vend = {}, order = {};
    ledgerOrder(ledger.filter(function (l) { return S(l.division_id) === div && S(l.ym) <= maxYm; })).forEach(function (l) {
      var ac = S(l.account_code), vc = S(l.vendor_code), ym = S(l.ym);
      if (!vend[ac]) { vend[ac] = {}; order[ac] = []; }
      if (!vend[ac][vc]) { vend[ac][vc] = { code: vc, name: S(l.vendor_name), m: {} }; order[ac].push(vc); }
      vend[ac][vc].m[ym] = (vend[ac][vc].m[ym] || 0) + N(l.amount);
    });
    var out = {}; Object.keys(order).forEach(function (ac) { out[ac] = order[ac].map(function (v) { return vend[ac][v]; }); });
    return out;
  }
  function salesM(T, maxYm, rate) {
    var prod = {}, net = {}, f = (T.D_매출 || []).filter(function (s) { return !N(s.is_group) && S(s.ym) <= maxYm; });
    sumBy(f, ['ym'], function (s) { return s.list_price_sales; }).forEach(function (o) { prod[S(o.r.ym)] = o.v * rate; });
    sumBy(f, ['ym'], function (s) { return s.net_sales; }, true).forEach(function (o) { net[S(o.r.ym)] = o.any ? o.v : null; });
    return { prod: prod, net: net };
  }
  function itemMap(T) { var m = {}; (T.D_품목 || []).forEach(function (i) { m[S(i.item_code)] = i; }); return m; }

  function prodBundle(T, maxYm, rate) {
    var items = itemMap(T);
    var mat = {};
    var f = (T.D_구매_A || []).filter(function (p) { return S(p.ledger_division) === 'PROD' && S(p.account_code) !== '' && S(p.ym) <= maxYm && items[S(p.item_code)]; });
    // 금액·수량을 같은 키로 따로 합산(수량은 모두 비면 null)
    var amt = sumBy(f, ['account_code', 'ym', 'vendor_code', 'item_code'], function (p) { return p.supply_amt; });
    var qty = sumBy(f, ['account_code', 'ym', 'vendor_code', 'item_code'], function (p) { return p.qty; }, true);
    amt.forEach(function (o, i) {
      var ac = S(o.r.account_code), vc = S(o.r.vendor_code), ic = S(o.r.item_code), k = vc + '|' + ic, it = items[ic];
      mat[ac] = mat[ac] || { _o: [] };
      if (!mat[ac][k]) { mat[ac][k] = { key: k, vendor: vc, item: ic, name: S(it.item_name), spec: S(it.unit), m: {} }; mat[ac]._o.push(k); }
      mat[ac][k].m[S(o.r.ym)] = [o.v, qty[i].any ? qty[i].v : null];
    });
    var matOut = {}; Object.keys(mat).forEach(function (ac) { matOut[ac] = mat[ac]._o.map(function (k) { return mat[ac][k]; }); });
    return { acc: glAcc(T.D_GL || [], maxYm, function (n) { return n.split(PRODRE).join(''); }), vend: null, mat: matOut, salesM: salesM(T, maxYm, rate) };
  }
  function mgmtBundle(T, maxYm, rate) {
    var acc = glAcc(T.D_GL || [], maxYm, function (n) { return n.split(MGMTRE).join(''); });
    return { acc: acc, vend: null, mat: {}, salesM: salesM(T, maxYm, rate), labor: acc.filter(function (a) { return /^(직원급여|퇴직연금)/.test(a.name); }).map(function (a) { return a.code; }) };
  }
  function mat2Bundle(T, maxYm) {
    var items = itemMap(T), items2 = {}, order = [];
    var f = (T.D_구매_A || []).filter(function (p) { var it = items[S(p.item_code)]; return it && ['ZIP_M', 'ZIP_S', 'ZIP_E'].indexOf(S(it.item_group)) >= 0 && S(p.ym) <= maxYm; });
    var amt = sumBy(f, ['ym', 'item_code', 'vendor_code'], function (p) { return p.supply_amt; }), qty = sumBy(f, ['ym', 'item_code', 'vendor_code'], function (p) { return p.qty; }, true);
    var used = {};
    amt.forEach(function (o, i) {
      var ic = S(o.r.item_code), vc = S(o.r.vendor_code), ym = S(o.r.ym), q = qty[i].any ? qty[i].v : 0, it = items[ic];
      if (!items2[ic]) { items2[ic] = { c: ic, n: S(it.item_name), g: S(it.item_group), u: S(it.unit), sec: sector(S(it.item_name), S(it.item_group)), m: {}, v: {} }; order.push(ic); }
      var a = items2[ic].m[ym] = items2[ic].m[ym] || [0, 0]; a[0] += o.v; a[1] += q;
      items2[ic].v[vc] = items2[ic].v[vc] || {}; items2[ic].v[vc][ym] = [o.v, q]; used[vc] = 1;
    });
    var vname = {}; (T.D_거래처_A || []).forEach(function (v) { vname[S(v.vendor_code)] = S(v.vendor_name); });
    var vn = {}; Object.keys(used).forEach(function (v) { vn[v] = vname[v] !== undefined ? vname[v] : v; });
    var ia = {};
    var g = (T.D_구매_A || []).filter(function (p) { return S(p.account_code) !== '' && S(p.ym) <= maxYm; });
    var nn = sumBy(g, ['item_code', 'account_code'], function (p) { return p.n; }), ss = sumBy(g, ['item_code', 'account_code'], function (p) { return p.supply_amt; });
    nn.forEach(function (o, i) { var ic = S(o.r.item_code); ia[ic] = ia[ic] || {}; ia[ic][S(o.r.account_code)] = [o.v, ss[i].v]; });
    return { items: order.map(function (k) { return items2[k]; }), vn: vn, acc: ia };
  }
  function onlineBundle(T, maxYm) {
    var lines = sortBy((T.D_채널비용 || []).filter(function (c) { return S(c.ym) <= maxYm; }), ['ym', 'channel_id', 'cost_item']).map(function (c) { return { ym: S(c.ym), ch: S(c.channel_id), item: S(c.cost_item), acct: isNull(c.account_code) ? null : S(c.account_code), amt: N(c.amount) }; });
    var sales = sortBy((T.D_매출 || []).filter(function (s) { return !isNull(s.net_sales_tab) && S(s.ym) <= maxYm; }), ['channel_id', 'ym']).map(function (s) { return { ym: S(s.ym), ch: S(s.channel_id), s: N(s.net_sales_tab) }; });
    var f = (T.D_매출 || []).filter(function (s) { return !N(s.is_group) && S(s.ym) <= maxYm; });
    sumBy(f, ['ym'], function (s) { return s.net_sales; }, true).forEach(function (o) { sales.push({ ym: S(o.r.ym), ch: 'ONLINE_COMMON', s: o.any ? o.v : null }); });
    return { lines: lines, sales: sales };
  }
  function ovendBundle(T, maxYm) {
    var names = {}; (T.업체계정 || []).forEach(function (a) { names[S(a.account_code)] = S(a.name); });
    var ov = {}, order = [];
    var f = (T.D_원장 || []).filter(function (l) { return S(l.division_id) === 'ONLINE' && S(l.ym) <= maxYm; });
    ledgerOrder(f).forEach(function (l) {
      var ac = S(l.account_code), vc = S(l.vendor_code), ym = S(l.ym);
      if (!ov[ac]) { ov[ac] = { code: ac, name: (names[ac] !== undefined ? names[ac] : ac).split(MGMTRE).join(''), vend: {}, _o: [] }; order.push(ac); }
      if (!ov[ac].vend[vc]) { ov[ac].vend[vc] = { code: vc, name: S(l.vendor_name), m: {} }; ov[ac]._o.push(vc); }
      ov[ac].vend[vc].m[ym] = (ov[ac].vend[vc].m[ym] || 0) + N(l.amount);
    });
    return order.map(function (ac) { return { code: ov[ac].code, name: ov[ac].name, vend: ov[ac]._o.map(function (v) { return ov[ac].vend[v]; }) }; });
  }
  function vendMeta(T, divs, maxYm) {
    var vsrc = {}, codes = {}, nat = {}, ecm = {};
    divs.forEach(function (dv) {
      var rows = ((T[dv] || {}).D_원장 || []).filter(function (l) { return S(l.division_id) === dv && S(l.ym) <= maxYm; });
      sortBy(rows, ['account_code', 'source', 'ym', 'vendor_code']).forEach(function (l) {
        var ac = S(l.account_code), e = ((vsrc[dv] = vsrc[dv] || {})[ac] = vsrc[dv][ac] || { src: {}, months: {}, ec: {} });
        e.src[isGL(l.source) ? 'GL' : 'LEDGER'] = 1; if (isGL(l.source)) e.months[S(l.ym)] = 1; if (isEC(l.source)) e.ec[S(l.ym)] = 1;
        codes[S(l.vendor_code)] = 1; if (S(l.nature) !== '' && !nat[S(l.vendor_code)]) nat[S(l.vendor_code)] = S(l.nature);
      });
    });
    var out = {}; Object.keys(vsrc).forEach(function (dv) { out[dv] = {}; Object.keys(vsrc[dv]).forEach(function (ac) { var e = vsrc[dv][ac], ks = Object.keys(e.src); out[dv][ac] = { k: ks.length === 1 ? ks[0] : 'MIX', months: Object.keys(e.months).sort(), ec: Object.keys(e.ec).sort() }; }); });
    var vnat = {}; Object.keys(codes).forEach(function (vc) { if (nat[vc]) vnat[vc] = nat[vc]; });
    return { vsrc: out, vnat: vnat };
  }
  function sub5029(T, maxYm) {
    var items = itemMap(T), CLS = ['원재료', '부재료', '그 밖'], cnt = { '원재료': 0, '부재료': 0, '그 밖': 0 }, det = { '합포장재': 0, '소모품': 0, '일반 부재료': 0 }, sub = {}, nsub = 0;
    Object.keys(items).forEach(function (ic) {
      var k = classify(S(items[ic].item_group)); cnt[k]++;
      if (k === '부재료') { sub[ic] = 1; nsub++; var d = detail(S(items[ic].item_name), S(items[ic].item_group)); det[d || '일반 부재료']++; }
    });
    var vname = {}; (T.D_거래처_A || []).forEach(function (v) { vname[S(v.vendor_code)] = S(v.vendor_name); });
    var rows = (T.D_구매_A || []).filter(function (p) { return S(p.ym) <= maxYm; });
    var months = {}; rows.forEach(function (p) { months[S(p.ym)] = 1; });
    var amt = sumBy(rows, ['ym', 'item_code', 'vendor_code'], function (p) { return p.supply_amt; }), qty = sumBy(rows, ['ym', 'item_code', 'vendor_code'], function (p) { return isNull(p.qty) ? 0 : p.qty; });
    var vend = {}, vorder = [], mat = {}, morder = [], total = {};
    amt.forEach(function (o, i) {
      var ic = S(o.r.item_code); if (!sub[ic]) return;
      var vc = S(o.r.vendor_code), ym = S(o.r.ym), k = vc + '|' + ic, it = items[ic];
      if (!vend[vc]) { vend[vc] = { code: vc, name: vname[vc] !== undefined ? vname[vc] : vc, m: {} }; vorder.push(vc); }
      vend[vc].m[ym] = (vend[vc].m[ym] || 0) + o.v;
      if (!mat[k]) { mat[k] = { key: k, vendor: vc, item: ic, name: S(it.item_name), spec: S(it.unit), m: {} }; morder.push(k); }
      mat[k].m[ym] = [o.v, qty[i].v];
      total[ym] = (total[ym] || 0) + o.v;
    });
    return { acct: '5029', basis: 'purchase', count: cnt, detail: det, items: nsub, months: Object.keys(months).sort(), vend: vorder.map(function (k) { return vend[k]; }), mat: morder.map(function (k) { return mat[k]; }), total: total };
  }

  // allow = 허용 본부 목록, T = 본부별 탭, opts = {maxYm, rate}
  function assemble(T, allow, opts) {
    opts = opts || {}; var maxYm = opts.maxYm || '9999', rate = opts.rate == null ? 0.5 : opts.rate;
    var A = allow.slice().sort(), has = function (d) { return A.indexOf(d) >= 0 && T[d]; };
    var out = { allowed: A, prod: { acc: [], vend: {}, mat: {}, salesM: { prod: {}, net: {} } }, mat2: { items: [], vn: {}, acc: {} }, online: { lines: [], sales: [] }, ovend: [], mgmt: { acc: [], vend: {}, mat: {}, salesM: { prod: {}, net: {} }, labor: [] } };
    if (has('PROD')) { var p = prodBundle(T.PROD, maxYm, rate); p.vend = vendMap(T.PROD.D_원장 || [], 'PROD', maxYm); out.prod = p; out.mat2 = mat2Bundle(T.PROD, maxYm); }
    if (has('ONLINE')) { out.online = onlineBundle(T.ONLINE, maxYm); out.ovend = ovendBundle(T.ONLINE, maxYm); }
    if (has('MGMT')) { var m = mgmtBundle(T.MGMT, maxYm, rate); m.vend = vendMap(T.MGMT.D_원장 || [], 'MGMT', maxYm); out.mgmt = m; }
    var divs = ['PROD', 'ONLINE', 'MGMT'].filter(function (d) { return A.indexOf(d) >= 0; });
    if (divs.length) { var vm = vendMeta(T, divs, maxYm); out.vsrc = vm.vsrc; out.vnat = vm.vnat; }
    if (has('PROD')) out.sub5029 = sub5029(T.PROD, maxYm);
    return out;
  }
  var api = { assemble: assemble, sector: sector, classify: classify, detail: detail };
  if (typeof module !== 'undefined') module.exports = api; else root.R9Bundle = api;
})(this);
