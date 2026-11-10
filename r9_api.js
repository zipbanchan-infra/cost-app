// GS9 M3·M4: 서버(server_r6.py·server_r6_app.py)가 하던 /api 일을 시트로 옮긴 어댑터(me·r6/data·state·plans·mgmt/common-costs).
// 서버 규칙(검사·상태·삭제·되돌리기)을 그대로 옮겼고, AI·채널 이동은 지원하지 않는다(v1 제외). 브라우저·node 공용.
(function (root) {
  'use strict';
  var MAX_KRW = 9007199254740991;
  var PLAN_REQ = ['account', 'vendor', 'method', 'target', 'due', 'basis'];
  var PLAN_MAX = { account: 200, vendor: 200, method: 500, target: 500, basis: 2000 };
  var PLAN_STATES = ['계획', '진행', '완료', '보류'];
  var STATE_STATUS = { '계획': '초안', '진행': '진행', '완료': '완료', '보류': '보류' };
  var PLAN_EXTRA_MAX = { owner: 100, memo: 1000 };
  var MGMT_MEMO_MAX = 500, MGMT_MAX_KRW = 1e10, MGMT_PERIOD = /^([0-9]{2}Q[1-4]|[0-9]{2}(0[1-9]|1[0-2]))$/;
  var TRASH_DAYS = 30, TRASH_LIMIT = 20;
  var PLAN_COLS = ['id', 'division_id', 'account_code', 'target_period', 'content', 'status', 'created_by', 'created_at', 'page', 'is_example', 'updated_by', 'updated_at', 'deleted_by', 'deleted_at', 'created_name', 'updated_name', 'deleted_name'];
  var EVENT_COLS = ['id', 'plan_id', 'action', 'by_user', 'at', 'before_json', 'after_json'];
  var COST_COLS = ['id', 'account_code', 'period', 'amount_krw', 'memo', 'created_by', 'created_name', 'created_at'];
  var TAB = { plans: 'P_계획_A', events: 'P_이력_A', costs: 'P_공통비_A' };
  var DATA_TABS = {
    PROD: ['D_GL', 'D_원장', 'D_매출', 'D_기간', 'D_구매_A', 'D_거래처_A', 'D_품목'],
    ONLINE: ['D_채널비용', 'D_원장', 'D_매출', 'D_기간', '업체계정'],
    MGMT: ['D_GL', 'D_원장', 'D_매출', 'D_기간']
  };
  var isStr = function (v) { return typeof v === 'string'; };
  var isInt = function (v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; };
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var trim = function (s) { return String(s).trim(); };

  // ---------- 서버 검사 규칙 이식 ----------
  function planError(p, partial) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return { error: 'bad_plan' };
    for (var i = 0; i < PLAN_REQ.length; i++) {
      var k = PLAN_REQ[i];
      if (!has(p, k)) { if (partial) continue; return { error: 'required', field: k }; }
      if (!isStr(p[k])) return { error: 'bad_plan', field: k };
      if (!trim(p[k])) return { error: 'required', field: k };
    }
    if (has(p, 'due')) {
      var d = trim(p.due);
      if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d)) return { error: 'bad_date', field: 'due', reason: 'format' };
      var y = +d.slice(0, 4), m = +d.slice(5, 7), dd = +d.slice(8), t = new Date(y, m - 1, dd);
      if (t.getFullYear() !== y || t.getMonth() !== m - 1 || t.getDate() !== dd) return { error: 'bad_date', field: 'due', reason: 'no_such_date' };
    }
    if (has(p, 'target_amount_krw')) {
      var v = p.target_amount_krw;
      if (v !== null && v !== undefined && (!isInt(v) || v < 0 || v > MAX_KRW)) return { error: 'bad_number', field: 'target_amount_krw' };
    }
    for (var f in PLAN_MAX) if (isStr(p[f]) && trim(p[f]).length > PLAN_MAX[f]) return { error: 'too_long', field: f, max: PLAN_MAX[f], len: trim(p[f]).length };
    return null;
  }
  function planExtraError(p, items) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return { error: 'bad_plan' };
    for (var k in PLAN_EXTRA_MAX) if (has(p, k)) {
      if (p[k] !== null && !isStr(p[k])) return { error: 'bad_plan', field: k };
      if (isStr(p[k]) && trim(p[k]).length > PLAN_EXTRA_MAX[k]) return { error: 'too_long', field: k, max: PLAN_EXTRA_MAX[k], len: trim(p[k]).length };
    }
    if (has(p, 'item_code') && p.item_code !== null && p.item_code !== '') {
      if (!isStr(p.item_code) || (items && !has(items, p.item_code))) return { error: 'bad_item', field: 'item_code' };
    }
    if (has(p, 'state') && PLAN_STATES.indexOf(p.state) < 0) return { error: 'bad_status', field: 'state' };
    if (has(p, 'target_ratio')) { var r = p.target_ratio; if (r !== null && (typeof r !== 'number' || !isFinite(r) || r < 0 || r > 100)) return { error: 'bad_number', field: 'target_ratio' }; }
    if (has(p, 'target_unit') && p.target_unit !== null && p.target_unit !== '월') return { error: 'bad_plan', field: 'target_unit' };
    if (has(p, 'current_amount_krw')) { var c = p.current_amount_krw; if (c !== null && (!isInt(c) || c < 0 || c > MAX_KRW)) return { error: 'bad_number', field: 'current_amount_krw' }; }
    return null;
  }
  function applyExtras(content, p, items) {
    if (has(p, 'item_code')) {
      var ic = isStr(p.item_code) && p.item_code ? p.item_code : null;
      if (ic && items && has(items, ic)) { content.item_code = ic; content.item = items[ic]; } else { delete content.item_code; delete content.item; }
    }
    ['owner', 'memo'].forEach(function (k) { if (has(p, k)) { var v = isStr(p[k]) ? trim(p[k]) : ''; if (v) content[k] = v; else delete content[k]; } });
    ['target_ratio', 'current_amount_krw', 'state', 'target_unit'].forEach(function (k) { if (has(p, k)) { if (p[k] === null) delete content[k]; else content[k] = p[k]; } });
  }
  function targetText(v, unit) { return isInt(v) ? v.toLocaleString('en-US') + '원 / ' + (unit === '월' ? '월' : '분기') : '목표 금액 입력 필요'; }
  function planSchemaOk(p) {
    if (!p || typeof p !== 'object') return false;
    for (var i = 0; i < PLAN_REQ.length; i++) if (!isStr(p[PLAN_REQ[i]])) return false;
    return !has(p, 'target_amount_krw') || p.target_amount_krw === null || isInt(p.target_amount_krw);
  }
  function mgmtError(b, accounts) {
    if (!b || typeof b !== 'object') return { error: 'bad_cost' };
    var ac = b.account_code, per = b.period, amt = b.amount_krw, memo = b.memo;
    if (!isStr(ac) || !trim(ac)) return { error: 'required', field: 'account_code' };
    if (accounts.indexOf(trim(ac)) < 0) return { error: 'bad_account', field: 'account_code' };
    if (!isStr(per) || !trim(per)) return { error: 'required', field: 'period' };
    if (!MGMT_PERIOD.test(trim(per))) return { error: 'bad_period', field: 'period' };
    if (amt === null || amt === undefined) return { error: 'required', field: 'amount_krw' };
    if (!isInt(amt) || amt < 0 || amt > MAX_KRW) return { error: 'bad_number', field: 'amount_krw' };
    if (amt > MGMT_MAX_KRW) return { error: 'too_big', field: 'amount_krw', max: MGMT_MAX_KRW };
    if (memo !== null && memo !== undefined) {
      if (!isStr(memo)) return { error: 'bad_memo', field: 'memo' };
      if (trim(memo).length > MGMT_MEMO_MAX) return { error: 'too_long', field: 'memo', max: MGMT_MEMO_MAX, len: trim(memo).length };
    }
    return null;
  }

  function rowsToObjs(v) { if (!v || !v.length) return []; var h = v[0]; return v.slice(1).map(function (r, i) { var o = { _row: i + 2 }; h.forEach(function (k, j) { o[k] = r[j] === undefined ? '' : r[j]; }); return o; }); }
  var cell = function (v) { return v === null || v === undefined ? '' : v; };

  function create(env) {
    var cfg = env.cfg, sheets = env.sheets, memo = {};
    var once = function (k, f) { return memo[k] || (memo[k] = f()); };
    var DIVS = ['PROD', 'ONLINE', 'MGMT'].filter(function (d) { return cfg.divisions[d]; });
    var sid = function (d) { return cfg.divisions[d].sheetId; };
    var me = function () { return env.user(); };

    // 시트 접근 성공 = 그 본부 허용(권한은 시트 공유가 정한다)
    function allowed() {
      return once('allowed', function () {
        return Promise.all(DIVS.map(function (d) { return sheets.titles(sid(d)).then(function (t) { return { d: d, t: t }; }, function () { return null; }); })).then(function (r) {
          var a = [], titles = {}; r.forEach(function (x) { if (x) { a.push(x.d); titles[x.d] = x.t; } }); memo.titles = titles; return a.sort();
        });
      });
    }
    function titlesOf(d) { return allowed().then(function () { return memo.titles[d] || []; }); }
    function ensureTab(d, title, header) {
      return titlesOf(d).then(function (t) {
        if (t.indexOf(title) >= 0) return null;
        return sheets.ensureTab(sid(d), title, header).then(function () { memo.titles[d] = t.concat([title]); });
      });
    }
    function readTab(d, title) {
      return titlesOf(d).then(function (t) { if (t.indexOf(title) < 0) return []; return sheets.batchGet(sid(d), [title]).then(function (r) { return rowsToObjs(r[title]); }); });
    }
    function itemNames() {
      return once('items', function () {
        return allowed().then(function (a) {
          if (a.indexOf('PROD') < 0) return null;
          return readTab('PROD', 'D_품목').then(function (rows) { if (!rows.length) return null; var m = {}; rows.forEach(function (r) { m[String(r.item_code)] = r.item_name || String(r.item_code); }); return m; });
        });
      });
    }

    // ----- 사용자·데이터 -----
    function getMe() {
      return allowed().then(function (a) {
        if (!a.length) return { status: 403, body: { error: 'not_allowlisted' } };
        var u = me(); return { status: 200, body: { user: { user_id: u.email, name: u.name || u.email, title: '', org_unit: '' }, allowed_divisions: a } };
      });
    }
    function getData() {
      return allowed().then(function (a) {
        if (!a.length) return { status: 403, body: { error: 'not_allowlisted' } };
        return Promise.all(a.map(function (d) {
          var tabs = DATA_TABS[d].filter(function (t) { return memo.titles[d].indexOf(t) >= 0; });
          return sheets.batchGet(sid(d), tabs).then(function (r) { var o = {}; tabs.forEach(function (t) { o[t] = rowsToObjs(r[t]); }); return [d, o]; });
        })).then(function (r) {
          var T = {}; r.forEach(function (x) { T[x[0]] = x[1]; });
          return { status: 200, body: root.R9Bundle.assemble(T, a, { maxYm: cfg.maxYm || '9999', rate: cfg.rate == null ? 0.5 : cfg.rate }) };
        });
      });
    }

    // ----- 계획 -----
    var parse = function (s) { try { return JSON.parse(s || '{}'); } catch (e) { return {}; } };
    function loadPlans(d) { return Promise.all([readTab(d, TAB.plans), readTab(d, TAB.events)]).then(function (r) { return { rows: r[0], events: r[1] }; }); }
    function planObj(r) {
      var c = parse(r.content);
      c.id = Number(r.id); c.division = r.division_id; c.account_code = r.account_code === '' ? null : r.account_code; c.status = r.status; c.savedAt = r.created_at; c.by = r.created_name || r.created_by || null;
      c.page = r.page; c.example = !!Number(r.is_example); c.updatedAt = r.updated_at || null; c.updatedBy = r.updated_name || r.updated_by || null;
      return c;
    }
    function plansList(a) {
      return Promise.all(a.map(function (d) { return loadPlans(d); })).then(function (all) {
        var out = [];
        all.forEach(function (x) {
          var seq = {}; x.events.forEach(function (e) { seq[e.plan_id] = Math.max(seq[e.plan_id] || 0, e._row); });
          x.rows.forEach(function (r) { if (r.deleted_at === '' || r.deleted_at == null) out.push({ r: r, seq: seq[r.id] || 0 }); });
        });
        out.sort(function (p, q) {
          var a1 = String(p.r.updated_at || p.r.created_at), b1 = String(q.r.updated_at || q.r.created_at);
          return a1 < b1 ? 1 : a1 > b1 ? -1 : (q.seq - p.seq) || (Number(q.r.id) - Number(p.r.id));
        });
        return out.map(function (x) { return planObj(x.r); });
      });
    }
    function deletedList(a) {
      var since = (function () { var d = new Date(env.nowMs() - TRASH_DAYS * 86400000); return env.fmt(d); })();
      return Promise.all(a.map(function (d) { return loadPlans(d); })).then(function (all) {
        var items = []; all.forEach(function (x) { x.rows.forEach(function (r) { if (r.deleted_at !== '' && r.deleted_at != null && String(r.deleted_at) >= since) items.push(r); }); });
        items.sort(function (p, q) { return String(p.deleted_at) < String(q.deleted_at) ? 1 : String(p.deleted_at) > String(q.deleted_at) ? -1 : Number(q.id) - Number(p.id); });
        return { deleted: items.slice(0, TRASH_LIMIT).map(function (r) { var c = parse(r.content); return { id: Number(r.id), division: r.division_id, status: r.status, account: c.account, vendor: c.vendor, method: c.method, deletedAt: r.deleted_at, deletedBy: r.deleted_name || r.deleted_by }; }), total: items.length, days: TRASH_DAYS, limit: TRASH_LIMIT };
      });
    }
    function getState() {
      return allowed().then(function (a) {
        if (!a.length) return { status: 403, body: { error: 'not_allowlisted' } };
        return plansList(a).then(function (plans) { return { status: 200, body: { chat: [], plans: plans, moves: [], draft: null, ai: { provider: 'none', example: true, gemini: false, timeoutMs: 30000, planFlow: false }, trash: { days: TRASH_DAYS, limit: TRASH_LIMIT } } }; });
      });
    }
    function rowValues(o) { return PLAN_COLS.map(function (c) { return cell(o[c]); }); }
    function colLetter(i) { return String.fromCharCode(65 + i); }
    function writeRow(d, rowNo, o) { return sheets.update(sid(d), TAB.plans + '!A' + rowNo + ':' + colLetter(PLAN_COLS.length - 1) + rowNo, [rowValues(o)]); }
    var evSeq = 0;
    function logEvent(d, pid, action, before, after) {
      var u = me();
      return ensureTab(d, TAB.events, EVENT_COLS).then(function () { return sheets.append(sid(d), TAB.events, [[env.nowMs() * 10 + (evSeq++ % 10), pid, action, u.email, env.now(), before ? JSON.stringify(before) : '', after ? JSON.stringify(after) : '']]); });
    }
    function findPlan(a, pid) {
      return Promise.all(a.concat(DIVS.filter(function (d) { return a.indexOf(d) < 0; }).slice(0, 0)).map(function (d) { return loadPlans(d).then(function (x) { return { d: d, rows: x.rows }; }); })).then(function (all) {
        for (var i = 0; i < all.length; i++) for (var j = 0; j < all[i].rows.length; j++) if (Number(all[i].rows[j].id) === pid) return { d: all[i].d, row: all[i].rows[j] };
        return null;
      });
    }
    function strip(o) { var c = {}; Object.keys(o).forEach(function (k) { if (k !== '_row') c[k] = o[k]; }); return c; }

    function postPlan(b) {
      return allowed().then(function (a) {
        if (a.indexOf(b.division) < 0) return { status: 403, body: { error: 'division_forbidden', division: b.division } };
        return itemNames().then(function (items) {
          var p = b.plan;
          if (p && typeof p === 'object') p = Object.assign({}, p, { target: targetText(p.target_amount_krw, p.target_unit) });
          var bad = planError(p) || planExtraError(p, items); if (bad) return { status: 400, body: bad };
          var q = {}; Object.keys(p).forEach(function (k) { q[k] = PLAN_REQ.indexOf(k) >= 0 ? trim(p[k]) : p[k]; });
          if (!planSchemaOk(q)) return { status: 400, body: { error: 'bad_plan' } };
          var code = String(b.account_code || ''); code = /^[0-9]{4}$/.test(code) ? code : null;
          var content = {}; ['account', 'vendor', 'method', 'target', 'target_amount_krw', 'due', 'basis', 'turns'].forEach(function (k) { content[k] = q[k] === undefined ? null : q[k]; });
          applyExtras(content, q, items);
          var u = me(), id = env.nowMs() * 10 + (evSeq++ % 10);
          var row = { id: id, division_id: b.division, account_code: code, target_period: '26Q4', content: JSON.stringify(content), status: STATE_STATUS[q.state] || '초안', created_by: u.email, created_at: env.now(), page: String(b.page || '').slice(0, 200), is_example: b.manual === true ? 0 : 1, created_name: u.name || u.email };
          return ensureTab(b.division, TAB.plans, PLAN_COLS).then(function () { return sheets.append(sid(b.division), TAB.plans, [rowValues(row)]); })
            .then(function () { return logEvent(b.division, id, 'create', null, row); }).then(function () { return plansList(a); }).then(function (plans) { return { status: 200, body: { id: id, plans: plans } }; });
        });
      });
    }
    function putDeletePlan(method, pid, body) {
      return allowed().then(function (a) {
        if (!a.length) return { status: 403, body: { error: 'not_allowlisted' } };
        return findPlan(a, pid).then(function (f) {
          if (!f || (f.row.deleted_at !== '' && f.row.deleted_at != null)) return { status: 404, body: { error: 'not_found' } };
          var before = strip(f.row), u = me(), row = strip(f.row);
          if (method === 'DELETE') {
            row.deleted_by = u.email; row.deleted_at = env.now(); row.deleted_name = u.name || u.email;
            return writeRow(f.d, f.row._row, row).then(function () { return logEvent(f.d, pid, 'delete', before, row); }).then(function () { return plansList(a); }).then(function (plans) { return { status: 200, body: { plans: plans } }; });
          }
          return itemNames().then(function (items) {
            var p = (body || {}).plan || {}; if (p && typeof p === 'object') { var t = {}; Object.keys(p).forEach(function (k) { if (k !== 'target') t[k] = p[k]; }); p = t; }
            var bad = planError(p, true) || planExtraError(p, items); if (bad) return { status: 400, body: bad };
            var content = parse(row.content);
            ['method', 'target', 'due', 'vendor', 'basis'].forEach(function (k) { if (has(p, k)) content[k] = trim(p[k]); });
            if (has(p, 'target_amount_krw')) { content.target_amount_krw = p.target_amount_krw; content.target = targetText(p.target_amount_krw, has(p, 'target_unit') ? p.target_unit : content.target_unit); }
            applyExtras(content, p, items);
            var status = (body || {}).status;
            if (status === undefined || status === null) status = has(p, 'state') ? STATE_STATUS[p.state] : row.status;
            if (['초안', '진행', '완료', '보류'].indexOf(status) < 0) return { status: 400, body: { error: 'bad_status' } };
            if (!has(p, 'state') && (body || {}).status !== undefined && (body || {}).status !== null) content.state = status === '초안' ? '계획' : status;
            row.content = JSON.stringify(content); row.status = status; row.updated_by = u.email; row.updated_at = env.now(); row.updated_name = u.name || u.email;
            return writeRow(f.d, f.row._row, row).then(function () { return logEvent(f.d, pid, 'update', before, row); }).then(function () { return plansList(a); }).then(function (plans) { return { status: 200, body: { plans: plans } }; });
          });
        });
      });
    }
    function restorePlan(b) {
      var pid = b && b.id;
      if (typeof pid !== 'number' || !isInt(pid) || pid <= 0) return Promise.resolve({ status: 400, body: { error: 'bad_id' } });
      return allowed().then(function (a) {
        return findPlan(a, pid).then(function (f) {
          if (!f) return { status: 404, body: { error: 'not_found' } };
          if (f.row.deleted_at === '' || f.row.deleted_at == null) return { status: 409, body: { error: 'not_deleted' } };
          var before = strip(f.row), row = strip(f.row); row.deleted_by = ''; row.deleted_at = ''; row.deleted_name = '';
          return writeRow(f.d, f.row._row, row).then(function () { return logEvent(f.d, pid, 'restore', before, row); }).then(function () { return Promise.all([deletedList(a), plansList(a)]); })
            .then(function (r) { return { status: 200, body: Object.assign({}, r[0], { plans: r[1], id: pid }) }; });
        });
      });
    }

    // ----- 경영지원 공통비 -----
    function mgmtAccounts() {
      return readTab('MGMT', 'D_GL').then(function (rows) {
        var m = {}; rows.forEach(function (g) { if (String(g.compare_period) !== '' && String(g.kind) === '판관비') { var k = String(g.account_code); if (!m[k]) m[k] = String(g.account_name).split('(판)').join(''); } });
        return Object.keys(m).sort().map(function (k) { return { code: k, name: m[k] }; });
      });
    }
    function mgmtCosts(limit) {
      limit = limit || 200;
      return Promise.all([readTab('MGMT', TAB.costs), mgmtAccounts()]).then(function (r) {
        var rows = r[0].slice().sort(function (p, q) { return Number(q.id) - Number(p.id); }), seen = {}, items = [], cnt = {};
        rows.forEach(function (x) { var k = x.account_code + '|' + x.period; cnt[k] = (cnt[k] || 0) + 1; });
        rows.forEach(function (x) {
          var k = x.account_code + '|' + x.period; if (seen[k]) return; seen[k] = 1;
          items.push({ id: Number(x.id), account_code: String(x.account_code), period: x.period, amount_krw: Number(x.amount_krw), memo: x.memo || '', by: x.created_name || x.created_by, at: x.created_at, versions: cnt[k], direct: true });
        });
        items.sort(function (p, q) { return p.account_code < q.account_code ? -1 : p.account_code > q.account_code ? 1 : p.period < q.period ? -1 : p.period > q.period ? 1 : 0; });
        var hist = rows.slice(0, limit).map(function (x) { return { id: Number(x.id), account_code: String(x.account_code), period: x.period, amount_krw: Number(x.amount_krw), memo: x.memo || '', by: x.created_name || x.created_by, at: x.created_at }; });
        return { items: items, history: hist, accounts: r[1], memo_max: MGMT_MEMO_MAX };
      });
    }
    function commonCosts(method, b) {
      return allowed().then(function (a) {
        if (a.indexOf('MGMT') < 0) return { status: 403, body: { error: 'division_forbidden', division: 'MGMT' } };
        if (method === 'GET') return mgmtCosts().then(function (r) { return { status: 200, body: r }; });
        return mgmtAccounts().then(function (accs) {
          var bad = mgmtError(b, accs.map(function (x) { return x.code; })); if (bad) return { status: 400, body: bad };
          var memoV = isStr(b.memo) && trim(b.memo) ? trim(b.memo) : '', u = me();
          return ensureTab('MGMT', TAB.costs, COST_COLS).then(function () { return sheets.append(sid('MGMT'), TAB.costs, [[env.nowMs() * 10 + (evSeq++ % 10), trim(b.account_code), trim(b.period), b.amount_krw, memoV, u.email, u.name || u.email, env.now()]]); })
            .then(function () { return mgmtCosts(); }).then(function (r) { return { status: 200, body: r }; });
        });
      });
    }

    function handle(method, path, body) {
      var m;
      if (method === 'GET' && path === '/api/me') return getMe();
      if (method === 'GET' && path === '/api/r6/data') return getData();
      if (method === 'GET' && path === '/api/state') return getState();
      if (method === 'GET' && path === '/api/plans') return allowed().then(plansList).then(function (p) { return { status: 200, body: { plans: p } }; });
      if (method === 'POST' && path === '/api/plans') return postPlan(body || {});
      if (method === 'GET' && path === '/api/plans/deleted') return allowed().then(deletedList).then(function (r) { return { status: 200, body: r }; });
      if (method === 'POST' && path === '/api/plans/restore') return restorePlan(body || {});
      if ((m = /^\/api\/plans\/(\d+)$/.exec(path)) && (method === 'PUT' || method === 'DELETE')) return putDeletePlan(method, Number(m[1]), body);
      if (path === '/api/mgmt/common-costs' && (method === 'GET' || method === 'POST')) return commonCosts(method, body || {});
      if (/^\/api\/(ai|online)\//.test(path)) return Promise.resolve({ status: 404, body: { error: 'not_supported' } });
      return Promise.resolve({ status: 404, body: { error: 'not_found' } });
    }
    return { handle: handle, _internal: { planError: planError, planExtraError: planExtraError, applyExtras: applyExtras, mgmtError: mgmtError, targetText: targetText } };
  }
  var api = { create: create, planError: planError, planExtraError: planExtraError, applyExtras: applyExtras, mgmtError: mgmtError, targetText: targetText, TAB: TAB, PLAN_COLS: PLAN_COLS, EVENT_COLS: EVENT_COLS, COST_COLS: COST_COLS };
  if (typeof module !== 'undefined') { if (typeof root.R9Bundle === 'undefined') root.R9Bundle = require('./bundle.js'); module.exports = api; } else root.R9Api = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
