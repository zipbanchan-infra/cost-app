// 비용관리 계산 모듈(브라우저·node 공용). 3294bcb schema.sql 뷰와 같은 규칙.
(function (root) {
  var N = function (v) { return v === '' || v == null ? 0 : Number(v); };
  function months(periods) { var m = {}; periods.forEach(function (p) { if (p.compare_period) m[p.compare_period] = (m[p.compare_period] || 0) + 1; }); return m; }
  function perMap(periods) { var m = {}; periods.forEach(function (p) { m[String(p.ym)] = p.compare_period || ''; }); return m; }
  function isLabor(cfg, code, name) {
    if (cfg.laborCodes && cfg.laborCodes.indexOf(String(code)) >= 0) return true;
    return !!(cfg.laborPrefix && cfg.laborPrefix.some(function (x) { return String(name).replace('(판)', '').indexOf(x) === 0; }));
  }
  // 분모: 생산·경영지원 = 비묶음 채널 권장판매매출 x 이전가율, 온라인 공통 = 비묶음 채널 net_sales, 채널 = net_sales_tab
  function denominators(data, cfg) {
    var per = perMap(data.D_기간), d = {};
    data.D_매출.forEach(function (s) {
      var p = per[String(s.ym)]; if (!p) return;
      if (cfg.mode === 'gl') { if (!N(s.is_group)) d[p] = (d[p] || 0) + N(s.list_price_sales) * cfg.rate; }
      else {
        if (s.net_sales_tab !== '' && s.net_sales_tab != null) d[p + '|' + s.channel_id] = (d[p + '|' + s.channel_id] || 0) + N(s.net_sales_tab);
        if (!N(s.is_group)) { d[p + '|ONLINE_COMMON'] = (d[p + '|ONLINE_COMMON'] || 0) + N(s.net_sales); d[p] = (d[p] || 0) + N(s.net_sales); }
      }
    });
    return d;
  }
  function summary(data, cfg, cur, prev, mode) {
    var per = perMap(data.D_기간), mo = months(data.D_기간), den = denominators(data, cfg), acc = {}, names = {};
    if (cfg.mode === 'gl') {
      data.D_GL.forEach(function (g) { var p = per[String(g.ym)]; if (!p) return; var k = String(g.account_code); names[k] = g.account_name; acc[k] = acc[k] || {}; acc[k][p] = (acc[k][p] || 0) + N(g.amount); });
    } else {
      var cn = cfg.channelNames || {};
      data.D_채널비용.forEach(function (c) { var p = per[String(c.ym)]; if (!p) return; var k = String(c.channel_id); names[k] = cn[k] || k; acc[k] = acc[k] || {}; acc[k][p] = (acc[k][p] || 0) + N(c.amount); });
    }
    var rows = Object.keys(acc).sort().map(function (k) {
      var a = acc[k], c = a[cur] || 0, p = a[prev] || 0;
      var dc = cfg.mode === 'gl' ? den[cur] : (k === 'ONLINE_COMMON' ? den[cur + '|ONLINE_COMMON'] : den[cur + '|' + k]);
      var dp = cfg.mode === 'gl' ? den[prev] : (k === 'ONLINE_COMMON' ? den[prev + '|ONLINE_COMMON'] : den[prev + '|' + k]);
      var cr = dc > 0 ? c * 100 / dc : null, pr = dp > 0 ? p * 100 / dp : null;
      var ca = c / (mo[cur] || 1), pa = p / (mo[prev] || 1);
      return { code: k, name: names[k], labor: isLabor(cfg, k, names[k]), cur: c, prev: p, curAvg: ca, prevAvg: pa, dAvg: ca - pa, curRatio: cr, prevRatio: pr, dPP: cr != null && pr != null ? cr - pr : null };
    });
    var tc = rows.reduce(function (s, r) { return s + r.cur; }, 0), tp = rows.reduce(function (s, r) { return s + r.prev; }, 0);
    var tdc = cfg.mode === 'gl' ? den[cur] : den[cur], tdp = den[prev];
    var key = function (r) { return mode === '비율' ? (r.dPP == null ? -1e18 : r.dPP) : r.dAvg; };
    var top = rows.filter(function (r) { return !r.labor; }).sort(function (a, b) { return key(b) - key(a); }).slice(0, 10);
    return { rows: rows, top: top, totals: { cur: tc, prev: tp, curRatio: tdc > 0 ? tc * 100 / tdc : null, prevRatio: tdp > 0 ? tp * 100 / tdp : null, denCur: tdc, denPrev: tdp } };
  }
  function vendors(data, code, cur, prev) {
    var per = perMap(data.D_기간), v = {}, nat = {};
    data.D_원장.forEach(function (l) {
      if (String(l.account_code) !== String(code)) return;
      var p = per[String(l.ym)]; if (!p) return;
      var n = l.vendor_name; v[n] = v[n] || {}; v[n][p] = (v[n][p] || 0) + N(l.amount); if (l.nature) nat[n] = l.nature;
    });
    return Object.keys(v).map(function (n) { var c = v[n][cur] || 0, p = v[n][prev] || 0; return { name: n, cur: c, prev: p, diff: c - p, nature: nat[n] || '' }; }).sort(function (a, b) { return b.diff - a.diff; });
  }
  function planFromAmount(curAvg, amt) { return curAvg > 0 && typeof amt === 'number' ? amt * 100 / curAvg : ''; }
  function planFromRatio(curAvg, pct) { return curAvg > 0 && typeof pct === 'number' ? Math.round(curAvg * pct / 100) : ''; }
  var api = { summary: summary, vendors: vendors, planFromAmount: planFromAmount, planFromRatio: planFromRatio, perMap: perMap, months: months };
  if (typeof module !== 'undefined') module.exports = api; else root.CostCalc = api;
})(this);
