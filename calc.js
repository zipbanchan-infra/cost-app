// 비용관리 계산 모듈(브라우저·node 공용). 3294bcb schema.sql 뷰와 같은 규칙.
(function (root) {
  var N = function (v) { return v === '' || v == null ? 0 : Number(v); };
  function perMap(periods) { var m = {}; periods.forEach(function (p) { m[String(p.ym)] = p.compare_period || ''; }); return m; }
  // 기간 이름 -> 달 집합. 이름은 D_기간.compare_period 또는 cfg.extraPeriods(예: 전월·전분기 달 묶음)
  function monthSet(data, cfg, name) {
    var ex = cfg && cfg.extraPeriods && cfg.extraPeriods[name], s = {};
    if (ex) { ex.forEach(function (y) { s[y] = 1; }); return s; }
    data.D_기간.forEach(function (p) { if ((p.compare_period || '') === name) s[String(p.ym)] = 1; });
    return s;
  }
  function months(periods) { var m = {}; periods.forEach(function (p) { if (p.compare_period) m[p.compare_period] = (m[p.compare_period] || 0) + 1; }); return m; }
  function size(s) { return Object.keys(s).length; }
  function isLabor(cfg, code, name) {
    if (cfg.laborCodes && cfg.laborCodes.indexOf(String(code)) >= 0) return true;
    return !!(cfg.laborPrefix && cfg.laborPrefix.some(function (x) { return String(name).replace('(판)', '').indexOf(x) === 0; }));
  }
  // 분모(달 집합 기준): 생산·경영지원 = 비묶음 채널 권장판매매출 x 이전가율 / 온라인: 채널 = net_sales_tab, 공통·합계 = 비묶음 채널 net_sales
  function den(data, cfg, set) {
    var d = { total: 0, ch: {} };
    data.D_매출.forEach(function (s) {
      if (!set[String(s.ym)]) return;
      if (cfg.mode === 'gl') { if (!N(s.is_group)) d.total += N(s.list_price_sales) * cfg.rate; }
      else {
        if (s.net_sales_tab !== '' && s.net_sales_tab != null) d.ch[s.channel_id] = (d.ch[s.channel_id] || 0) + N(s.net_sales_tab);
        if (!N(s.is_group)) { d.ch.ONLINE_COMMON = (d.ch.ONLINE_COMMON || 0) + N(s.net_sales); d.total += N(s.net_sales); }
      }
    });
    return d;
  }
  // 계정(채널)별 월 금액. 경영지원은 P_공통비(원장에 그 달 금액이 없는 계정만)를 더함
  function monthly(data, cfg) {
    var acc = {}, names = {}, glKey = {};
    if (cfg.mode === 'gl') {
      data.D_GL.forEach(function (g) { var k = String(g.account_code), y = String(g.ym); names[k] = g.account_name; acc[k] = acc[k] || {}; acc[k][y] = (acc[k][y] || 0) + N(g.amount); if (N(g.amount)) glKey[k + '|' + y] = 1; });
      (data.P_공통비 || []).forEach(function (c) {
        if (c.deleted_at || !c.account_code) return;
        var k = String(c.account_code), y = String(c.ym);
        if (glKey[k + '|' + y]) return;
        names[k] = names[k] || k; acc[k] = acc[k] || {}; acc[k][y] = (acc[k][y] || 0) + N(c.amount);
      });
    } else {
      var cn = cfg.channelNames || {};
      data.D_채널비용.forEach(function (c) { var k = String(c.channel_id), y = String(c.ym); names[k] = cn[k] || k; acc[k] = acc[k] || {}; acc[k][y] = (acc[k][y] || 0) + N(c.amount); });
    }
    return { acc: acc, names: names };
  }
  function sumSet(m, set) { var t = 0; for (var y in set) t += m[y] || 0; return t; }
  function summary(data, cfg, cur, prev, mode) {
    var cs = monthSet(data, cfg, cur), ps = monthSet(data, cfg, prev), nc = size(cs) || 1, np = size(ps) || 1;
    var dc = den(data, cfg, cs), dp = den(data, cfg, ps), mm = monthly(data, cfg);
    var rows = Object.keys(mm.acc).sort().map(function (k) {
      var c = sumSet(mm.acc[k], cs), p = sumSet(mm.acc[k], ps);
      var xc = cfg.mode === 'gl' ? dc.total : dc.ch[k], xp = cfg.mode === 'gl' ? dp.total : dp.ch[k];
      var cr = xc > 0 ? c * 100 / xc : null, pr = xp > 0 ? p * 100 / xp : null, ca = c / nc, pa = p / np;
      return { code: k, name: mm.names[k], labor: isLabor(cfg, k, mm.names[k]), cur: c, prev: p, curAvg: ca, prevAvg: pa, dAvg: ca - pa, curRatio: cr, prevRatio: pr, dPP: cr != null && pr != null ? cr - pr : null };
    });
    var tot = function (f, flt) { return rows.filter(flt || function () { return true; }).reduce(function (s, r) { return s + r[f]; }, 0); };
    var nl = function (r) { return !r.labor; };
    var tc = tot('cur'), tp = tot('prev');
    var key = function (r) { return mode === '비율' ? (r.dPP == null ? -1e18 : r.dPP) : r.dAvg; };
    var top = rows.filter(nl).sort(function (a, b) { return key(b) - key(a); }).slice(0, 10);
    return { rows: rows, top: top, nCur: nc, nPrev: np,
      totals: { cur: tc, prev: tp, curRatio: dc.total > 0 ? tc * 100 / dc.total : null, prevRatio: dp.total > 0 ? tp * 100 / dp.total : null, denCur: dc.total, denPrev: dp.total,
        curNoLabor: tot('cur', nl), prevNoLabor: tot('prev', nl) } };
  }
  var isGLsrc = function (s) { return /^(ZIPS_JIPGYE_|ECOUNT_JIPGYE_)/.test(String(s || '')); };
  function vendors(data, code, cur, prev, cfg) {
    var cs = monthSet(data, cfg || {}, cur), ps = monthSet(data, cfg || {}, prev), v = {}, nat = {}, src = {};
    data.D_원장.forEach(function (l) {
      if (String(l.account_code) !== String(code)) return;
      var y = String(l.ym), n = l.vendor_name; v[n] = v[n] || { c: 0, p: 0 };
      if (cs[y]) v[n].c += N(l.amount); if (ps[y]) v[n].p += N(l.amount);
      if (l.nature) nat[n] = l.nature; src[n] = src[n] === undefined || src[n] === (isGLsrc(l.source) ? '회계집계표' : '원장') ? (isGLsrc(l.source) ? '회계집계표' : '원장') : '혼합';
    });
    return Object.keys(v).map(function (n) { return { name: n, cur: v[n].c, prev: v[n].p, diff: v[n].c - v[n].p, nature: nat[n] || '', src: src[n] }; }).sort(function (a, b) { return b.diff - a.diff; });
  }
  // 원장 외 차이 = 계정 마감 합 - 거래처 줄 합
  function vendorGap(sumRow, vlist) { return { cur: sumRow.cur - vlist.reduce(function (s, x) { return s + x.cur; }, 0), prev: sumRow.prev - vlist.reduce(function (s, x) { return s + x.prev; }, 0) }; }
  // 월별(스파크라인·월표): [{ym, amt, ratio}]
  function series(data, cfg, code) {
    var mm = monthly(data, cfg), yms = data.D_기간.map(function (p) { return String(p.ym); }).sort();
    var out = [];
    yms.forEach(function (y) {
      var one = {}; one[y] = 1; var d = den(data, cfg, one), a = (mm.acc[code] || {})[y];
      if (a === undefined) return;
      var x = cfg.mode === 'gl' ? d.total : d.ch[code];
      out.push({ ym: y, amt: a, ratio: x > 0 ? a * 100 / x : null });
    });
    return out;
  }
  function heat(data, cfg, mode) {
    var mm = monthly(data, cfg), yms = data.D_기간.map(function (p) { return String(p.ym); }).sort().filter(function (y) { return Object.keys(mm.acc).some(function (k) { return mm.acc[k][y] !== undefined; }); });
    var rows = Object.keys(mm.acc).sort().map(function (k) {
      return { code: k, name: mm.names[k], labor: isLabor(cfg, k, mm.names[k]), cells: yms.map(function (y) {
        var a = mm.acc[k][y]; if (a === undefined) return null;
        if (mode !== '비율') return a;
        var one = {}; one[y] = 1; var d = den(data, cfg, one), x = cfg.mode === 'gl' ? d.total : d.ch[k]; return x > 0 ? a * 100 / x : null; }) };
    });
    return { yms: yms, rows: rows };
  }
  // 품목 단가(생산): 월 가중평균 단가, 마지막 단가 변동, 절감 여력 = (오른 폭) x 이번 기간 수량
  function items(data, cur, cfg) {
    var cs = monthSet(data, cfg || {}, cur), by = {}, nm = {};
    (data.D_품목 || []).forEach(function (i) { nm[String(i.item_code)] = i; });
    (data.D_구매월 || []).forEach(function (p) {
      var k = String(p.item_code), y = String(p.ym); by[k] = by[k] || {}; by[k][y] = by[k][y] || [0, 0];
      by[k][y][0] += N(p.supply_amt); by[k][y][1] += N(p.qty);
    });
    var out = [];
    Object.keys(by).forEach(function (k) {
      var ys = Object.keys(by[k]).sort(), prev = null, rise = null, qty = 0, amt = 0;
      ys.forEach(function (y) { var s = by[k][y]; if (cs[y]) { qty += s[1]; amt += s[0]; } if (!s[1]) return; var u = Math.round(s[0] / s[1]); if (prev && u !== prev.u) rise = { ym: y, from: prev.u, to: u }; prev = { ym: y, u: u }; });
      var i = nm[k] || {};
      out.push({ code: k, name: i.item_name || k, group: i.item_group || '', unit: i.unit || '', qty: qty, amt: amt, last: prev ? prev.u : null, rise: rise, saving: rise && rise.to > rise.from ? (rise.to - rise.from) * qty : 0 });
    });
    return out.sort(function (a, b) { return b.saving - a.saving || b.amt - a.amt; });
  }
  function planFromAmount(curAvg, amt) { return curAvg > 0 && typeof amt === 'number' ? amt * 100 / curAvg : ''; }
  function planFromRatio(curAvg, pct) { return curAvg > 0 && typeof pct === 'number' ? Math.round(curAvg * pct / 100) : ''; }
  var api = { summary: summary, vendors: vendors, vendorGap: vendorGap, series: series, heat: heat, items: items, planFromAmount: planFromAmount, planFromRatio: planFromRatio, perMap: perMap, months: months, monthSet: monthSet };
  if (typeof module !== 'undefined') module.exports = api; else root.CostCalc = api;
})(this);
