(function () {
  'use strict';
  var CFG, TOKEN = null, EMAIL = '', S = {}, ST = { div: null, cur: '26Q3', prev: '25Q3', mode: '금액', acct: null };
  var STATES = ['계획', '진행', '완료', '보류'];
  var PH = ['id', '본부', '계정/채널 코드', '대상', '현재 월평균(원)', '목표 월 금액(원)', '목표 비율(%)', '방법', '담당', '기한', '상태', '메모', '작성일시', '작성자', '삭제일시'];
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var f0 = function (n) { return n == null ? '-' : Math.round(n).toLocaleString('ko-KR'); };
  var f2 = function (n) { return n == null ? '-' : (Math.round(n * 100) / 100).toFixed(2); };
  var sgn = function (n, t) { return '<span class="' + (n > 0 ? 'up' : n < 0 ? 'dn' : '') + '">' + (n > 0 ? '+' : '') + t + '</span>'; };

  function api(url, opt) {
    opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + TOKEN }, opt.headers || {});
    return fetch(url, opt).then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error((j.error && j.error.message) || r.status); e.status = r.status; throw e; } return j; }); });
  }
  var SH = 'https://sheets.googleapis.com/v4/spreadsheets/';
  function rowsToObjs(v) { if (!v || !v.length) return []; var h = v[0]; return v.slice(1).map(function (r) { var o = {}; h.forEach(function (k, i) { o[k] = r[i] === undefined ? '' : r[i]; }); return o; }); }

  function loadDiv(k) {
    var d = CFG.divisions[k], id = d.sheetId;
    var tabs = d.mode === 'gl' ? ['D_GL', 'D_원장', 'D_매출', 'D_기간', 'P_계획'] : ['D_채널비용', 'D_원장', 'D_매출', 'D_기간', 'P_계획'];
    return api(SH + id + '?fields=sheets.properties.title').then(function (m) {
      var have = m.sheets.map(function (s) { return s.properties.title; });
      var want = tabs.filter(function (t) { return have.indexOf(t) >= 0; });
      if (!want.length) return { empty: true };
      var q = want.map(function (t) { return 'ranges=' + encodeURIComponent(t); }).join('&');
      return api(SH + id + '/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&' + q).then(function (r) {
        var data = {}; r.valueRanges.forEach(function (vr, i) { data[want[i]] = want[i] === 'P_계획' ? (vr.values || []) : rowsToObjs(vr.values); });
        tabs.forEach(function (t) { if (!data[t]) data[t] = []; });
        return { data: data };
      });
    });
  }

  function signedIn() {
    $('#login').textContent = '다시 로그인';
    api('https://www.googleapis.com/oauth2/v3/userinfo').then(function (u) { EMAIL = (u.email || '').toLowerCase(); $('#who').textContent = EMAIL; }).catch(function () {});
    $('#main').innerHTML = '<div class="card mut">불러오는 중이에요...</div>';
    var keys = Object.keys(CFG.divisions);
    Promise.all(keys.map(function (k) { return loadDiv(k).then(function (r) { S[k] = r; }).catch(function (e) { S[k] = { err: e }; }); })).then(function () {
      var ok = keys.filter(function (k) { return S[k].data; });
      ST.div = ok[0] || null; render();
    });
  }

  function cfgFor(k) { var d = CFG.divisions[k]; return Object.assign({}, d); }
  function render() {
    var keys = Object.keys(CFG.divisions), ok = keys.filter(function (k) { return S[k] && S[k].data; });
    var h = '<div class="row" style="margin-bottom:12px">';
    ok.forEach(function (k) { h += '<button class="tab' + (k === ST.div ? ' on' : '') + '" data-d="' + k + '">' + esc(CFG.divisions[k].label) + '</button>'; });
    h += '</div>';
    var isAdmin = CFG.adminEmails.indexOf(EMAIL) >= 0;
    if (!ok.length) h += '<div class="card">이 계정으로 볼 수 있는 본부가 없어요. 권한이 필요하면 관리자에게 시트 공유를 요청해 주세요.</div>';
    else h += body(ST.div);
    if (isAdmin) h += adminPanel();
    $('#main').innerHTML = h;
    document.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { ST.div = b.dataset.d; ST.acct = null; render(); }; });
    bind();
  }

  function body(k) {
    var d = S[k].data, cfg = cfgFor(k);
    if (!d.D_기간 || !d.D_기간.length) return '<div class="card">이 본부 시트에 데이터가 아직 없어요. 관리자가 데이터 적재를 해야 해요.</div>';
    var s = CostCalc.summary(d, cfg, ST.cur, ST.prev, ST.mode), mo = CostCalc.months(d.D_기간);
    var h = '<div class="card row"><label>이번 <select id="cur">' + CFG.periods.map(function (p) { return '<option' + (p === ST.cur ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></label>' +
      '<label>비교 <select id="prev">' + CFG.periods.map(function (p) { return '<option' + (p === ST.prev ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></label>' +
      '<label>보기 <select id="mode"><option' + (ST.mode === '금액' ? ' selected' : '') + '>금액</option><option' + (ST.mode === '비율' ? ' selected' : '') + '>비율</option></select></label>' +
      '<span class="mut">월평균 비교(이번 ' + (mo[ST.cur] || 0) + '개월 / 비교 ' + (mo[ST.prev] || 0) + '개월)</span></div>';
    var t = s.totals, dm = t.cur / (mo[ST.cur] || 1) - t.prev / (mo[ST.prev] || 1);
    h += '<div class="card k"><div>비용 합(이번)<b>' + f0(t.cur) + '원</b></div><div>비용 합(비교)<b>' + f0(t.prev) + '원</b></div>' +
      '<div>매출 대비(이번)<b>' + f2(t.curRatio) + '%</b></div><div>매출 대비(비교)<b>' + f2(t.prevRatio) + '%</b></div>' +
      '<div>월평균 증감<b>' + sgn(dm, f0(dm) + '원') + '</b></div></div>';
    h += '<div class="card scroll"><b>이슈 TOP ' + s.top.length + '</b> <span class="mut">(' + (ST.mode === '비율' ? '매출 대비 %p 증감' : '월평균 금액 증감') + ' 큰 순 · 인건비 계정 제외)</span><table><tr><th>' + (cfg.mode === 'gl' ? '계정' : '채널') + '</th><th>이번 월평균</th><th>비교 월평균</th><th>증감(월평균)</th><th>증감(%p)</th></tr>';
    s.top.forEach(function (r) { h += '<tr class="click" data-a="' + esc(r.code) + '"><td>' + esc(r.code + ' ' + r.name) + '</td><td>' + f0(r.curAvg) + '</td><td>' + f0(r.prevAvg) + '</td><td>' + sgn(r.dAvg, f0(r.dAvg)) + '</td><td>' + (r.dPP == null ? '-' : sgn(r.dPP, f2(r.dPP))) + '</td></tr>'; });
    h += '</table></div>';
    h += '<div class="card scroll"><b>전체 ' + (cfg.mode === 'gl' ? '계정' : '채널') + '</b><table><tr><th>' + (cfg.mode === 'gl' ? '계정' : '채널') + '</th><th>이번 합</th><th>비교 합</th><th>이번 %</th><th>비교 %</th></tr>';
    s.rows.forEach(function (r) { h += '<tr class="click" data-a="' + esc(r.code) + '"><td>' + esc(r.code + ' ' + r.name) + (r.labor ? '<span class="tag">인건비</span>' : '') + '</td><td>' + f0(r.cur) + '</td><td>' + f0(r.prev) + '</td><td>' + f2(r.curRatio) + '</td><td>' + f2(r.prevRatio) + '</td></tr>'; });
    h += '</table></div>';
    if (ST.acct) h += detail(k, ST.acct);
    h += planHtml(k, s);
    return h;
  }

  function detail(k, code) {
    var v = CostCalc.vendors(S[k].data, code, ST.cur, ST.prev);
    var h = '<div class="card scroll"><b>업체 상세 ' + esc(code) + '</b> <span class="mut">(원장·회계집계표 거래처 줄 기준 / 25년 거래처는 이카운트 원장이 오면 보여요)</span>';
    if (!v.length) return h + '<div class="mut">이 계정은 거래처 자료가 없어요.</div></div>';
    h += '<table><tr><th>업체</th><th>이번 합</th><th>비교 합</th><th>증감</th><th class="l">성격</th></tr>';
    v.slice(0, 100).forEach(function (r) { h += '<tr><td>' + esc(r.name) + '</td><td>' + f0(r.cur) + '</td><td>' + f0(r.prev) + '</td><td>' + sgn(r.diff, f0(r.diff)) + '</td><td class="l">' + esc(r.nature) + '</td></tr>'; });
    return h + '</table></div>';
  }

  function planRows(k) { return (S[k].data.P_계획 || []).slice(1).map(function (r, i) { return { row: i + 2, v: r }; }).filter(function (x) { return x.v[0] !== '' && x.v[0] != null && !x.v[14]; }); }
  function planHtml(k, s) {
    var rows = planRows(k), opts = s.rows.map(function (r) { return '<option value="' + esc(r.code) + '">' + esc(r.code + ' ' + r.name) + '</option>'; }).join('');
    var h = '<div class="card scroll"><b>절감계획</b> <span class="mut">목표는 월 단위예요. 금액을 넣으면 비율이, 비율을 넣으면 금액이 채워져요.</span><table><tr><th>코드</th><th class="l">대상</th><th>현재 월평균</th><th>목표 월 금액</th><th>목표 %</th><th class="l">방법</th><th class="l">담당</th><th class="l">기한</th><th class="l">상태</th><th></th></tr>';
    rows.forEach(function (x) { var v = x.v; h += '<tr><td>' + esc(v[2]) + '</td><td class="l">' + esc(v[3]) + '</td><td>' + f0(v[4]) + '</td><td>' + f0(v[5]) + '</td><td>' + (v[6] === '' ? '-' : f2(v[6])) + '</td><td class="l">' + esc(v[7]) + '</td><td class="l">' + esc(v[8]) + '</td><td class="l">' + esc(v[9]) + '</td><td class="l"><select data-st="' + x.row + '">' + STATES.map(function (z) { return '<option' + (z === v[10] ? ' selected' : '') + '>' + z + '</option>'; }).join('') + '</select></td><td><button data-del="' + x.row + '">삭제</button></td></tr>'; });
    h += '</table><div class="row" style="margin-top:12px"><select id="pa">' + opts + '</select><input id="pt" placeholder="대상(거래처·품목, 비우면 전체)"><input id="pm" type="number" min="0" placeholder="목표 월 금액(원)"><input id="pr" type="number" min="0" max="100" step="0.01" placeholder="목표 비율(%)"><input id="pw" placeholder="방법(500자 이하)" size="30"><input id="po" placeholder="담당"><input id="pd" type="date"><select id="ps">' + STATES.map(function (z) { return '<option>' + z + '</option>'; }).join('') + '</select><button class="pri" id="padd">계획 추가</button></div><div id="perr" class="err"></div></div>';
    return h;
  }

  function adminPanel() {
    return '<div class="card"><b>관리자: 데이터 적재</b> <span class="mut">본부별 번들 파일(.json)을 고르면 해당 본부 시트의 D_ 탭을 덮어써요. P_계획은 건드리지 않아요.</span><div class="row" style="margin-top:8px"><input type="file" id="bf" accept=".json" multiple><button id="bgo" class="pri">적재</button><span id="bmsg" class="mut"></span></div></div>';
  }

  function bind() {
    var rr = function () { render(); };
    var c = $('#cur'); if (c) { c.onchange = function () { ST.cur = c.value; rr(); }; $('#prev').onchange = function (e) { ST.prev = e.target.value; rr(); }; $('#mode').onchange = function (e) { ST.mode = e.target.value; rr(); }; }
    document.querySelectorAll('[data-a]').forEach(function (r) { r.onclick = function () { ST.acct = r.dataset.a; rr(); }; });
    var add = $('#padd'); if (add) add.onclick = addPlan;
    document.querySelectorAll('[data-st]').forEach(function (s) { s.onchange = function () { setState(+s.dataset.st, s.value); }; });
    document.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { softDelete(+b.dataset.del); }; });
    var m = $('#pm'), p = $('#pr');
    if (m) {
      var cur = function () { var r = CostCalc.summary(S[ST.div].data, cfgFor(ST.div), ST.cur, ST.prev, ST.mode).rows.filter(function (x) { return x.code === $('#pa').value; })[0]; return r ? r.curAvg : 0; };
      m.oninput = function () { p.value = m.value === '' ? '' : round(CostCalc.planFromAmount(cur(), Number(m.value)), 2); };
      p.oninput = function () { m.value = p.value === '' ? '' : CostCalc.planFromRatio(cur(), Number(p.value)); };
    }
    var go = $('#bgo'); if (go) go.onclick = adminLoad;
  }
  function round(v, n) { return v === '' ? '' : Math.round(v * Math.pow(10, n)) / Math.pow(10, n); }

  function addPlan() {
    var k = ST.div, d = S[k].data, s = CostCalc.summary(d, cfgFor(k), ST.cur, ST.prev, ST.mode);
    var code = $('#pa').value, row = s.rows.filter(function (x) { return x.code === code; })[0], cur = row ? row.curAvg : 0;
    var amt = $('#pm').value === '' ? '' : Number($('#pm').value), pct = $('#pr').value === '' ? '' : Number($('#pr').value), way = $('#pw').value, st = $('#ps').value, due = $('#pd').value;
    var err = '';
    if (!code) err = '계정을 골라 주세요.'; else if (way.length > 500) err = '방법은 500자 이하로 적어 주세요.';
    else if (amt === '' && pct === '') err = '목표 월 금액이나 목표 비율 중 하나를 넣어 주세요.';
    else if (pct !== '' && (pct < 0 || pct > 100)) err = '목표 비율은 0~100 사이로 넣어 주세요.';
    else if (amt !== '' && amt < 0) err = '목표 월 금액은 0 이상이어야 해요.';
    else if (STATES.indexOf(st) < 0) err = '상태는 계획·진행·완료·보류 중 하나예요.';
    else if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) err = '기한은 날짜 형식으로 넣어 주세요.';
    if (err) { $('#perr').textContent = err; return; }
    if (amt === '') amt = CostCalc.planFromRatio(cur, pct); if (pct === '') pct = CostCalc.planFromAmount(cur, amt);
    var next = (d.P_계획.length ? d.P_계획.length : 1);
    var v = [next, CFG.divisions[k].label, code, $('#pt').value, Math.round(cur), amt, pct, way, $('#po').value, due, st, '', new Date().toISOString(), EMAIL, ''];
    var id = CFG.divisions[k].sheetId;
    api(SH + id + '/values/' + encodeURIComponent('P_계획!A:O') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [v] }) })
      .then(function () { return loadDiv(k); }).then(function (r) { S[k] = r; render(); }).catch(function (e) { $('#perr').textContent = '저장하지 못했어요: ' + e.message; });
  }
  function patchRow(k, row, col, val) {
    var id = CFG.divisions[k].sheetId, L = String.fromCharCode(65 + col);
    return api(SH + id + '/values/' + encodeURIComponent('P_계획!' + L + row) + '?valueInputOption=RAW', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [[val]] }) }).then(function () { return loadDiv(k); }).then(function (r) { S[k] = r; render(); });
  }
  function setState(row, st) { if (STATES.indexOf(st) >= 0) patchRow(ST.div, row, 10, st).catch(function (e) { alert('저장하지 못했어요: ' + e.message); }); }
  function softDelete(row) { patchRow(ST.div, row, 14, new Date().toISOString()).catch(function (e) { alert('삭제하지 못했어요: ' + e.message); }); }

  function adminLoad() {
    var files = $('#bf').files, msg = $('#bmsg'); if (!files.length) { msg.textContent = '파일을 먼저 골라 주세요.'; return; }
    Array.prototype.reduce.call(files, function (p, file) {
      return p.then(function () { return file.text().then(function (t) { return putBundle(JSON.parse(t), msg); }); });
    }, Promise.resolve()).then(function () { msg.textContent += ' 완료. 새로 불러와요...'; signedIn(); }).catch(function (e) { msg.textContent = '실패: ' + e.message; });
  }
  function putBundle(b, msg) {
    var d = CFG.divisions[b.div]; if (!d) throw new Error('알 수 없는 본부 ' + b.div);
    var id = d.sheetId, names = Object.keys(b.tabs).concat(['P_계획']);
    return api(SH + id + '?fields=sheets.properties.title').then(function (m) {
      var have = m.sheets.map(function (s) { return s.properties.title; });
      var add = names.filter(function (n) { return have.indexOf(n) < 0; }).map(function (n) { return { addSheet: { properties: { title: n } } }; });
      return add.length ? api(SH + id + ':batchUpdate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requests: add }) }) : null;
    }).then(function () {
      return Object.keys(b.tabs).reduce(function (p, n) {
        return p.then(function () {
          var t = b.tabs[n], vals = [t.header].concat(t.rows); msg.textContent = d.label + ' ' + n + ' 적재 중...';
          return api(SH + id + '/values/' + encodeURIComponent(n) + ':clear', { method: 'POST' }).then(function () {
            return api(SH + id + '/values/' + encodeURIComponent(n + '!A1') + '?valueInputOption=RAW', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: vals }) });
          });
        });
      }, Promise.resolve());
    }).then(function () {
      return api(SH + id + '/values/' + encodeURIComponent('P_계획!A1:O1')).then(function (r) {
        if (r.values && r.values.length) return null;
        return api(SH + id + '/values/' + encodeURIComponent('P_계획!A1') + '?valueInputOption=RAW', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values: [PH] }) });
      });
    });
  }

  fetch('config.json').then(function (r) { return r.json(); }).then(function (c) {
    CFG = c;
    $('#login').onclick = function () {
      if (!CFG.clientId) { $('#main').innerHTML = '<div class="card err">로그인 설정(클라이언트 ID)이 아직 없어요.</div>'; return; }
      var go = function () {
        google.accounts.oauth2.initTokenClient({ client_id: CFG.clientId, scope: 'openid email https://www.googleapis.com/auth/spreadsheets', hd: 'sannamchon.co.kr', callback: function (r) { if (r.access_token) { TOKEN = r.access_token; signedIn(); } else $('#main').innerHTML = '<div class="card err">로그인하지 못했어요.</div>'; } }).requestAccessToken();
      };
      if (window.google && google.accounts) go(); else $('#main').innerHTML = '<div class="card err">구글 로그인 스크립트를 불러오지 못했어요.</div>';
    };
  });
})();
