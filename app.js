(function () {
  'use strict';
  var CFG, TOKEN = null, EMAIL = '', S = {}, ST = { div: null, cur: '26Q3', prev: '25Q3', mode: '금액', acct: null, view: 'list', edit: null, pre: null };
  var STATES = ['계획', '진행', '완료', '보류'];
  var PH = ['id', '본부', '계정/채널 코드', '대상', '현재 월평균(원)', '목표 월 금액(원)', '목표 비율(%)', '방법', '담당', '기한', '상태', '메모', '작성일시', '작성자', '삭제일시'];
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var f0 = function (n) { return n == null || isNaN(n) ? '-' : Math.round(n).toLocaleString('ko-KR'); };
  var f2 = function (n) { return n == null || isNaN(n) ? '-' : (Math.round(n * 100) / 100).toFixed(2); };
  var sgn = function (n, t) { return '<span class="' + (n > 0 ? 'up' : n < 0 ? 'dn' : '') + '">' + (n > 0 ? '+' : '') + t + '</span>'; };
  var SH = 'https://sheets.googleapis.com/v4/spreadsheets/';
  var JSONH = { 'Content-Type': 'application/json' };

  function api(url, opt) {
    opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + TOKEN }, opt.headers || {});
    return fetch(url, opt).then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error((j.error && j.error.message) || r.status); e.status = r.status; throw e; } return j; }); });
  }
  function rowsToObjs(v) { if (!v || !v.length) return []; var h = v[0]; return v.slice(1).map(function (r, i) { var o = { _row: i + 2 }; h.forEach(function (k, j) { o[k] = r[j] === undefined ? '' : r[j]; }); return o; }); }
  function allPeriods() { return CFG.periods.concat(Object.keys(CFG.extraPeriods || {})); }
  function cfgFor(k) { return Object.assign({ extraPeriods: CFG.extraPeriods }, CFG.divisions[k]); }
  function baseTabs(d) { return (d.mode === 'gl' ? ['D_GL'] : ['D_채널비용']).concat(['D_원장', 'D_매출', 'D_기간', 'P_계획', '안내'], d.extraTabs || []); }

  function loadDiv(k) {
    var d = CFG.divisions[k], id = d.sheetId, tabs = baseTabs(d);
    return api(SH + id + '?fields=sheets.properties.title').then(function (m) {
      var have = m.sheets.map(function (s) { return s.properties.title; }), want = tabs.filter(function (t) { return have.indexOf(t) >= 0; });
      if (!want.length) return { empty: true };
      return api(SH + id + '/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&' + want.map(function (t) { return 'ranges=' + encodeURIComponent(t); }).join('&')).then(function (r) {
        var data = {}; r.valueRanges.forEach(function (vr, i) { data[want[i]] = want[i] === 'P_계획' || want[i] === '안내' ? (vr.values || []) : rowsToObjs(vr.values); });
        tabs.forEach(function (t) { if (!data[t]) data[t] = []; });
        return { data: data };
      });
    });
  }
  function reload(k) { return loadDiv(k).then(function (r) { S[k] = r; render(); }); }

  function signedIn() {
    $('#login').textContent = '다시 로그인';
    api('https://www.googleapis.com/oauth2/v3/userinfo').then(function (u) { EMAIL = (u.email || '').toLowerCase(); $('#who').textContent = EMAIL; if (CFG.adminEmails.indexOf(EMAIL) >= 0) render(); }).catch(function () {});
    $('#main').innerHTML = '<div class="card mut">불러오는 중이에요...</div>';
    var keys = Object.keys(CFG.divisions);
    Promise.all(keys.map(function (k) { return loadDiv(k).then(function (r) { S[k] = r; }).catch(function (e) { S[k] = { err: e }; }); })).then(function () {
      ST.div = keys.filter(function (k) { return S[k].data; })[0] || null; render();
    });
  }

  function render() {
    var keys = Object.keys(CFG.divisions), ok = keys.filter(function (k) { return S[k] && S[k].data; }), h = '<div class="row" style="margin-bottom:12px">';
    ok.forEach(function (k) { h += '<button class="tab' + (k === ST.div ? ' on' : '') + '" data-d="' + k + '">' + esc(CFG.divisions[k].label) + '</button>'; });
    h += '</div>';
    if (!ok.length) h += '<div class="card">이 계정으로 볼 수 있는 본부가 없어요. 권한이 필요하면 관리자에게 시트 공유를 요청해 주세요.</div>';
    else h += body(ST.div);
    if (CFG.adminEmails.indexOf(EMAIL) >= 0) h += adminPanel();
    $('#main').innerHTML = h;
    document.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { ST.div = b.dataset.d; ST.acct = null; ST.edit = null; ST.pre = null; render(); }; });
    bind();
  }

  function body(k) {
    var d = S[k].data, cfg = cfgFor(k);
    if (!d.D_기간 || !d.D_기간.length) return '<div class="card">이 본부 시트에 데이터가 아직 없어요. 관리자가 데이터 적재를 해야 해요.</div>';
    var s = CostCalc.summary(d, cfg, ST.cur, ST.prev, ST.mode), opt = function (v) { return allPeriods().map(function (p) { return '<option' + (p === v ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join(''); };
    var h = '<div class="card row"><label>비교 방식 <select id="preset"><option value="">직접 고르기</option>' + CFG.presets.map(function (p, i) { return '<option value="' + i + '">' + esc(p.label) + '</option>'; }).join('') + '</select></label>' +
      '<label>이번 <select id="cur">' + opt(ST.cur) + '</select></label><label>비교 <select id="prev">' + opt(ST.prev) + '</select></label>' +
      '<label>보기 <select id="mode"><option' + (ST.mode === '금액' ? ' selected' : '') + '>금액</option><option' + (ST.mode === '비율' ? ' selected' : '') + '>비율</option></select></label>' +
      '<span class="mut">월평균 비교 (이번 ' + s.nCur + '개월 / 비교 ' + s.nPrev + '개월)</span></div>';
    if (ST.cur === CFG.provisional || ST.prev === CFG.provisional) h += '<div class="card warn"><b>26.10 가마감</b> 회계파트 마감 확정 전 값이에요. 확정되면 바뀔 수 있어요.</div>';
    var t = s.totals, dm = t.cur / s.nCur - t.prev / s.nPrev, dn = t.curNoLabor / s.nCur - t.prevNoLabor / s.nPrev;
    h += '<div class="card k"><div>비용 합(이번)<b>' + f0(t.cur) + '원</b></div><div>비용 합(비교)<b>' + f0(t.prev) + '원</b></div>' +
      '<div>매출 대비(이번)<b>' + f2(t.curRatio) + '%</b></div><div>매출 대비(비교)<b>' + f2(t.prevRatio) + '%</b></div>' +
      '<div>월평균 증감<b>' + sgn(dm, f0(dm) + '원') + '</b><span class="mut">인건비 제외 ' + sgn(dn, f0(dn) + '원') + '</span></div></div>';
    var mx = Math.max.apply(null, s.top.map(function (r) { return Math.abs(r.dAvg); }).concat([1]));
    h += '<div class="card scroll"><b>이슈 TOP ' + s.top.length + '</b> <span class="mut">(' + (ST.mode === '비율' ? '매출 대비 %p 증감' : '월평균 금액 증감') + ' 큰 순 · 인건비 계정 제외, 누르면 상세)</span><table><tr><th>' + (cfg.mode === 'gl' ? '계정' : '채널') + '</th><th>이번 월평균</th><th>비교 월평균</th><th>증감(월평균)</th><th class="l">증감 막대</th><th>증감(%p)</th></tr>';
    s.top.forEach(function (r) { var w = Math.round(Math.abs(r.dAvg) / mx * 100); h += '<tr class="click" data-a="' + esc(r.code) + '"><td>' + esc(r.code + ' ' + r.name) + '</td><td>' + f0(r.curAvg) + '</td><td>' + f0(r.prevAvg) + '</td><td>' + sgn(r.dAvg, f0(r.dAvg)) + '</td><td class="l"><span class="bar ' + (r.dAvg >= 0 ? 'bu' : 'bd') + '" style="width:' + w + 'px"></span></td><td>' + (r.dPP == null ? '-' : sgn(r.dPP, f2(r.dPP))) + '</td></tr>'; });
    h += '</table></div>';
    h += '<div class="card row"><button class="tab' + (ST.view === 'list' ? ' on' : '') + '" data-v="list">목록</button><button class="tab' + (ST.view === 'heat' ? ' on' : '') + '" data-v="heat">히트맵(월별)</button></div>';
    h += ST.view === 'heat' ? heatHtml(d, cfg) : listHtml(s, cfg);
    if (ST.acct) h += detail(k, s, cfg);
    if (k === 'PROD') h += itemsHtml(d, cfg);
    if (k === 'MGMT') h += commonHtml(k, d, s);
    h += planHtml(k, s);
    h += '<div class="foot mut">' + (k === 'PROD' ? '금액: 회계집계표 마감 · 업체: 이카운트 원장·회계집계표 거래처 줄 · 자재: 구매현황' : k === 'MGMT' ? '금액: 회계집계표 마감(부서 SN_01 판관비) · 공통비 입력은 이 시트의 P_공통비에 저장' : '금액: 독립채산제 월 탭 채널 직접비') + ' · 분모: ' + (cfg.mode === 'gl' ? '생산매출(권장판매매출 x 이전가율 50%)' : '온라인 매출') + ' · 비교: 월평균 · 25년 거래처·품목은 이카운트 원장이 오면 보여요 · 숫자는 3294bcb(2609 마감) 기준값과 대조했어요</div>';
    return h;
  }

  function listHtml(s, cfg) {
    var h = '<div class="card scroll"><b>전체 ' + (cfg.mode === 'gl' ? '계정' : '채널') + '</b><table><tr><th>' + (cfg.mode === 'gl' ? '계정' : '채널') + '</th><th>이번 합</th><th>비교 합</th><th>이번 %</th><th>비교 %</th></tr>';
    s.rows.forEach(function (r) { h += '<tr class="click" data-a="' + esc(r.code) + '"><td>' + esc(r.code + ' ' + r.name) + (r.labor ? '<span class="tag">인건비</span>' : '') + '</td><td>' + f0(r.cur) + '</td><td>' + f0(r.prev) + '</td><td>' + f2(r.curRatio) + '</td><td>' + f2(r.prevRatio) + '</td></tr>'; });
    return h + '</table></div>';
  }
  function heatHtml(d, cfg) {
    var H = CostCalc.heat(d, cfg, ST.mode), mx = 0;
    H.rows.forEach(function (r) { r.cells.forEach(function (c) { if (c != null && !r.labor && Math.abs(c) > mx) mx = Math.abs(c); }); });
    var h = '<div class="card scroll"><b>월별 히트맵(' + ST.mode + ')</b> <span class="mut">색이 진할수록 큰 값이에요. 칸이나 줄을 누르면 상세.</span><table class="heat"><tr><th>' + (cfg.mode === 'gl' ? '계정' : '채널') + '</th>' + H.yms.map(function (y) { return '<th>' + esc(y) + (y === '2610' ? '<br><span class="tag">가마감</span>' : '') + '</th>'; }).join('') + '</tr>';
    H.rows.forEach(function (r) {
      h += '<tr class="click" data-a="' + esc(r.code) + '"><td>' + esc(r.code + ' ' + r.name) + '</td>' + r.cells.map(function (c) { var a = c == null || !mx ? 0 : Math.min(1, Math.abs(c) / mx); return '<td class="hc" style="background:rgba(201,42,42,' + (a * 0.65).toFixed(2) + ')">' + (c == null ? '' : ST.mode === '비율' ? f2(c) : f0(c / 1000)) + '</td>'; }).join('') + '</tr>';
    });
    return h + '</table>' + (ST.mode === '금액' ? '<div class="mut">금액은 천원 단위예요.</div>' : '') + '</div>';
  }
  function spark(ser) {
    if (!ser.length) return '';
    var w = 260, h = 40, v = ser.map(function (x) { return x.amt; }), mn = Math.min.apply(null, v), mx = Math.max.apply(null, v), sp = mx - mn || 1;
    var pts = ser.map(function (x, i) { return (ser.length < 2 ? w / 2 : i * (w - 4) / (ser.length - 1) + 2).toFixed(1) + ',' + (h - 4 - (x.amt - mn) / sp * (h - 8)).toFixed(1); }).join(' ');
    return '<svg class="spark" width="' + w + '" height="' + h + '" aria-label="월별 추이"><polyline fill="none" stroke="currentColor" stroke-width="2" points="' + pts + '"/></svg>';
  }
  function detail(k, s, cfg) {
    var d = S[k].data, code = ST.acct, row = s.rows.filter(function (r) { return r.code === code; })[0], ser = CostCalc.series(d, cfg, code);
    var h = '<div class="card scroll"><b>상세 ' + esc(code + ' ' + (row ? row.name : '')) + '</b> <button data-plan="' + esc(code) + '" data-target="">이 계정으로 계획 쓰기</button> <button data-close="1">닫기</button><div class="row" style="margin:8px 0">' + spark(ser) + '<span class="mut">월별 추이</span></div>';
    h += '<table><tr>' + ser.map(function (x) { return '<th>' + esc(x.ym) + '</th>'; }).join('') + '</tr><tr>' + ser.map(function (x) { return '<td>' + (ST.mode === '비율' ? f2(x.ratio) : f0(x.amt / 1000)) + '</td>'; }).join('') + '</tr></table><div class="mut">' + (ST.mode === '비율' ? '월 매출 대비 %' : '천원 단위') + '</div>';
    if (cfg.mode === 'gl' || true) {
      var v = CostCalc.vendors(d, code, ST.cur, ST.prev, cfg);
      h += '<b style="display:block;margin-top:12px">업체</b>';
      if (!v.length) h += '<div class="mut">이 계정은 거래처 자료가 없어요. 25년 거래처는 이카운트 원장이 오면 보여요.</div>';
      else {
        var gap = row ? CostCalc.vendorGap(row, v) : { cur: 0, prev: 0 };
        h += '<table><tr><th>업체</th><th>이번 합</th><th>비교 합</th><th>증감</th><th class="l">출처</th><th class="l">성격</th><th></th></tr>';
        v.slice(0, 100).forEach(function (r, i) { h += '<tr><td>' + esc(r.name) + '</td><td>' + f0(r.cur) + '</td><td>' + f0(r.prev) + '</td><td>' + sgn(r.diff, f0(r.diff)) + '</td><td class="l">' + esc(r.src) + '</td><td class="l">' + esc(r.nature) + '</td><td><button data-plan="' + esc(code) + '" data-target="' + esc(r.name) + '">이 거래처로 계획 쓰기</button></td></tr>'; });
        h += '<tr class="mut"><td>원장 외 차이(마감 - 업체 합)</td><td>' + f0(gap.cur) + '</td><td>' + f0(gap.prev) + '</td><td>' + sgn(gap.cur - gap.prev, f0(gap.cur - gap.prev)) + '</td><td colspan="3"></td></tr></table>';
      }
    }
    return h + '</div>';
  }
  function itemsHtml(d, cfg) {
    var it = CostCalc.items(d, ST.cur, cfg).filter(function (r) { return r.amt > 0 || r.saving > 0; }).slice(0, 30);
    var h = '<div class="card scroll"><b>자재 단가(생산)</b> <span class="mut">이번 기간 구매 기준, 마지막 단가 변동과 절감 여력(오른 폭 x 이번 수량) 큰 순. 2025년 이후 자료예요.</span>';
    if (!it.length) return h + '<div class="mut">이번 기간에 구매 자료가 없어요.</div></div>';
    h += '<table><tr><th>품목</th><th class="l">구분</th><th>이번 수량</th><th>이번 금액</th><th>현재 단가</th><th class="l">마지막 변동</th><th>절감 여력</th></tr>';
    it.forEach(function (r) { h += '<tr><td>' + esc(r.name) + '</td><td class="l">' + esc(r.group) + '</td><td>' + f0(r.qty) + '</td><td>' + f0(r.amt) + '</td><td>' + f0(r.last) + '</td><td class="l">' + (r.rise ? esc(r.rise.ym) + ' ' + f0(r.rise.from) + ' -> ' + f0(r.rise.to) : '-') + '</td><td>' + (r.saving ? sgn(1, f0(r.saving) + '원') : '-') + '</td></tr>'; });
    return h + '</table></div>';
  }
  function commonHtml(k, d, s) {
    var rows = (d.P_공통비 || []).filter(function (c) { return c.account_code && !c.deleted_at; });
    var yms = d.D_기간.map(function (p) { return String(p.ym); }).sort();
    var h = '<div class="card scroll"><b>공통비 입력</b> <span class="mut">원장에 그 달 금액이 이미 있는 계정은 원장이 우선이라 더해지지 않아요. 입력한 금액은 위 금액·비율에 실제 비용으로 더해져요.</span>';
    if (rows.length) { h += '<table><tr><th>계정</th><th>연월</th><th>금액(원)</th><th class="l">메모</th><th></th></tr>'; rows.forEach(function (c) { h += '<tr><td>' + esc(c.account_code) + '</td><td>' + esc(c.ym) + '</td><td>' + f0(c.amount) + '</td><td class="l">' + esc(c.memo) + '</td><td><button data-cdel="' + c._row + '">삭제</button></td></tr>'; }); h += '</table>'; }
    h += '<div class="row" style="margin-top:8px"><select id="ca">' + s.rows.map(function (r) { return '<option value="' + esc(r.code) + '">' + esc(r.code + ' ' + r.name) + '</option>'; }).join('') + '</select><select id="cy">' + yms.map(function (y) { return '<option>' + esc(y) + '</option>'; }).join('') + '</select><input id="cm" type="number" min="0" placeholder="금액(원)"><input id="cn" placeholder="메모"><button class="pri" id="cadd">공통비 추가</button></div><div id="cerr" class="err"></div></div>';
    return h;
  }

  function planRows(k) { return (S[k].data.P_계획 || []).slice(1).map(function (r, i) { return { row: i + 2, v: r }; }).filter(function (x) { return x.v[0] !== '' && x.v[0] != null && !x.v[14]; }); }
  function planHtml(k, s) {
    var rows = planRows(k), pre = ST.pre || {}, opts = s.rows.map(function (r) { return '<option value="' + esc(r.code) + '"' + (r.code === pre.code ? ' selected' : '') + '>' + esc(r.code + ' ' + r.name) + '</option>'; }).join('');
    var h = '<div class="card scroll" id="plan"><b>절감계획</b> <span class="mut">목표는 월 단위예요. 금액을 넣으면 비율이, 비율을 넣으면 금액이 채워져요.</span><table><tr><th>코드</th><th class="l">대상</th><th>현재 월평균</th><th>목표 월 금액</th><th>목표 %</th><th class="l">방법</th><th class="l">담당</th><th class="l">기한</th><th class="l">상태</th><th></th></tr>';
    rows.forEach(function (x) {
      var v = x.v;
      if (ST.edit === x.row) { h += '<tr><td>' + esc(v[2]) + '</td><td class="l"><input id="et" value="' + esc(v[3]) + '"></td><td>' + f0(v[4]) + '</td><td><input id="em" type="number" min="0" value="' + esc(v[5]) + '"></td><td><input id="er" type="number" min="0" max="100" step="0.01" value="' + esc(v[6] === '' ? '' : f2(v[6])) + '"></td><td class="l"><input id="ew" value="' + esc(v[7]) + '"></td><td class="l"><input id="eo" value="' + esc(v[8]) + '"></td><td class="l"><input id="ed" type="date" value="' + esc(v[9]) + '"></td><td class="l">' + esc(v[10]) + '</td><td><button class="pri" data-esave="' + x.row + '">저장</button> <button data-ecancel="1">취소</button></td></tr>'; return; }
      h += '<tr><td>' + esc(v[2]) + '</td><td class="l">' + esc(v[3]) + '</td><td>' + f0(v[4]) + '</td><td>' + f0(v[5]) + '</td><td>' + (v[6] === '' ? '-' : f2(v[6])) + '</td><td class="l">' + esc(v[7]) + '</td><td class="l">' + esc(v[8]) + '</td><td class="l">' + esc(v[9]) + '</td><td class="l"><select data-st="' + x.row + '">' + STATES.map(function (z) { return '<option' + (z === v[10] ? ' selected' : '') + '>' + z + '</option>'; }).join('') + '</select></td><td><button data-edit="' + x.row + '">수정</button> <button data-del="' + x.row + '">삭제</button></td></tr>';
    });
    if (!rows.length) h += '<tr><td colspan="10" class="l mut">아직 계획이 없어요. 아래에서 직접 추가해 주세요.</td></tr>';
    h += '</table><div class="row" style="margin-top:12px"><select id="pa">' + opts + '</select><input id="pt" placeholder="대상(거래처·품목, 비우면 전체)" value="' + esc(pre.target || '') + '"><input id="pm" type="number" min="0" placeholder="목표 월 금액(원)"><input id="pr" type="number" min="0" max="100" step="0.01" placeholder="목표 비율(%)"><input id="pw" placeholder="방법(500자 이하)" size="30"><input id="po" placeholder="담당"><input id="pd" type="date"><select id="ps">' + STATES.map(function (z) { return '<option>' + z + '</option>'; }).join('') + '</select><button class="pri" id="padd">계획 추가</button></div><div id="perr" class="err"></div></div>';
    return h;
  }
  function adminPanel() { return '<div class="card"><b>관리자: 데이터 적재</b> <span class="mut">본부별 번들 파일(.json)을 고르면 해당 본부 시트의 D_ 탭을 덮어써요. P_계획·P_공통비·P_이력은 건드리지 않아요.</span><div class="row" style="margin-top:8px"><input type="file" id="bf" accept=".json" multiple><button id="bgo" class="pri">적재</button><span id="bmsg" class="mut"></span></div></div>'; }

  function curAvgOf(code) { var r = CostCalc.summary(S[ST.div].data, cfgFor(ST.div), ST.cur, ST.prev, ST.mode).rows.filter(function (x) { return x.code === code; })[0]; return r ? r.curAvg : 0; }
  function bind() {
    var rr = function () { render(); };
    var c = $('#cur'); if (c) {
      c.onchange = function () { ST.cur = c.value; rr(); }; $('#prev').onchange = function (e) { ST.prev = e.target.value; rr(); }; $('#mode').onchange = function (e) { ST.mode = e.target.value; rr(); };
      $('#preset').onchange = function (e) { if (e.target.value === '') return; var p = CFG.presets[+e.target.value]; ST.cur = p.cur; ST.prev = p.prev; rr(); };
    }
    document.querySelectorAll('[data-a]').forEach(function (r) { r.onclick = function () { ST.acct = r.dataset.a; rr(); }; });
    document.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function () { ST.view = b.dataset.v; rr(); }; });
    document.querySelectorAll('[data-close]').forEach(function (b) { b.onclick = function () { ST.acct = null; rr(); }; });
    document.querySelectorAll('[data-plan]').forEach(function (b) { b.onclick = function () { ST.pre = { code: b.dataset.plan, target: b.dataset.target }; rr(); var p = $('#plan'); if (p && p.scrollIntoView) p.scrollIntoView(); }; });
    var add = $('#padd'); if (add) add.onclick = addPlan;
    document.querySelectorAll('[data-st]').forEach(function (s) { s.onchange = function () { setState(+s.dataset.st, s.value); }; });
    document.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { softDelete(+b.dataset.del); }; });
    document.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { ST.edit = +b.dataset.edit; rr(); var m = $('#em'), p = $('#er'); if (m) { var cur = Number(((S[ST.div].data.P_계획[ST.edit - 1]) || [])[4]) || 0; m.oninput = function () { p.value = m.value === '' ? '' : round(CostCalc.planFromAmount(cur, Number(m.value)), 2); }; p.oninput = function () { m.value = p.value === '' ? '' : CostCalc.planFromRatio(cur, Number(p.value)); }; } }; });
    document.querySelectorAll('[data-ecancel]').forEach(function (b) { b.onclick = function () { ST.edit = null; rr(); }; });
    document.querySelectorAll('[data-esave]').forEach(function (b) { b.onclick = function () { saveEdit(+b.dataset.esave); }; });
    var ca = $('#cadd'); if (ca) ca.onclick = addCommon;
    document.querySelectorAll('[data-cdel]').forEach(function (b) { b.onclick = function () { delCommon(+b.dataset.cdel); }; });
    var m = $('#pm'), p = $('#pr');
    if (m) { m.oninput = function () { p.value = m.value === '' ? '' : round(CostCalc.planFromAmount(curAvgOf($('#pa').value), Number(m.value)), 2); }; p.oninput = function () { m.value = p.value === '' ? '' : CostCalc.planFromRatio(curAvgOf($('#pa').value), Number(p.value)); }; }
    var go = $('#bgo'); if (go) go.onclick = adminLoad;
  }
  function round(v, n) { return v === '' ? '' : Math.round(v * Math.pow(10, n)) / Math.pow(10, n); }

  function validatePlan(code, amt, pct, way, st, due) {
    if (!code) return '계정을 골라 주세요.';
    if (way.length > 500) return '방법은 500자 이하로 적어 주세요.';
    if (amt === '' && pct === '') return '목표 월 금액이나 목표 비율 중 하나를 넣어 주세요.';
    if (pct !== '' && (pct < 0 || pct > 100)) return '목표 비율은 0~100 사이로 넣어 주세요.';
    if (amt !== '' && amt < 0) return '목표 월 금액은 0 이상이어야 해요.';
    if (STATES.indexOf(st) < 0) return '상태는 계획·진행·완료·보류 중 하나예요.';
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return '기한은 날짜 형식으로 넣어 주세요.';
    return '';
  }
  function logHist(k, action, id, detail) {
    var v = [new Date().toISOString(), EMAIL, action, id, detail];
    return api(SH + CFG.divisions[k].sheetId + '/values/' + encodeURIComponent('P_이력!A:E') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', headers: JSONH, body: JSON.stringify({ values: [v] }) }).catch(function () {});
  }
  function addPlan() {
    var k = ST.div, d = S[k].data, code = $('#pa').value, cur = curAvgOf(code);
    var amt = $('#pm').value === '' ? '' : Number($('#pm').value), pct = $('#pr').value === '' ? '' : Number($('#pr').value), way = $('#pw').value, st = $('#ps').value, due = $('#pd').value;
    var err = validatePlan(code, amt, pct, way, st, due);
    if (err) { $('#perr').textContent = err; return; }
    if (amt === '') amt = CostCalc.planFromRatio(cur, pct); if (pct === '') pct = CostCalc.planFromAmount(cur, amt);
    var id = d.P_계획.length ? d.P_계획.length : 1;
    var v = [id, CFG.divisions[k].label, code, $('#pt').value, Math.round(cur), amt, pct, way, $('#po').value, due, st, '', new Date().toISOString(), EMAIL, ''];
    api(SH + CFG.divisions[k].sheetId + '/values/' + encodeURIComponent('P_계획!A:O') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', headers: JSONH, body: JSON.stringify({ values: [v] }) })
      .then(function () { ST.pre = null; return logHist(k, '추가', id, code + ' ' + $('#pt').value + ' 목표 ' + amt); }).then(function () { return reload(k); }).catch(function (e) { $('#perr').textContent = '저장하지 못했어요: ' + e.message; });
  }
  function patchCell(k, tab, row, col, val) { var L = String.fromCharCode(65 + col); return api(SH + CFG.divisions[k].sheetId + '/values/' + encodeURIComponent(tab + '!' + L + row) + '?valueInputOption=RAW', { method: 'PUT', headers: JSONH, body: JSON.stringify({ values: [[val]] }) }); }
  function setState(row, st) { if (STATES.indexOf(st) < 0) return; var k = ST.div, id = S[k].data.P_계획[row - 1][0]; patchCell(k, 'P_계획', row, 10, st).then(function () { return logHist(k, '상태', id, st); }).then(function () { return reload(k); }).catch(function (e) { alert('저장하지 못했어요: ' + e.message); }); }
  function softDelete(row) { var k = ST.div, id = S[k].data.P_계획[row - 1][0]; patchCell(k, 'P_계획', row, 14, new Date().toISOString()).then(function () { return logHist(k, '삭제', id, ''); }).then(function () { return reload(k); }).catch(function (e) { alert('삭제하지 못했어요: ' + e.message); }); }
  function saveEdit(row) {
    var k = ST.div, old = S[k].data.P_계획[row - 1].slice(), cur = Number(old[4]) || 0;
    var amt = $('#em').value === '' ? '' : Number($('#em').value), pct = $('#er').value === '' ? '' : Number($('#er').value), way = $('#ew').value, due = $('#ed').value;
    var err = validatePlan(old[2], amt, pct, way, old[10], due); if (err) { $('#perr').textContent = err; return; }
    if (amt === '') amt = CostCalc.planFromRatio(cur, pct); if (pct === '') pct = CostCalc.planFromAmount(cur, amt);
    old[3] = $('#et').value; old[5] = amt; old[6] = pct; old[7] = way; old[8] = $('#eo').value; old[9] = due;
    api(SH + CFG.divisions[k].sheetId + '/values/' + encodeURIComponent('P_계획!A' + row + ':O' + row) + '?valueInputOption=RAW', { method: 'PUT', headers: JSONH, body: JSON.stringify({ values: [old] }) })
      .then(function () { ST.edit = null; return logHist(k, '수정', old[0], '목표 ' + amt); }).then(function () { return reload(k); }).catch(function (e) { $('#perr').textContent = '저장하지 못했어요: ' + e.message; });
  }
  function addCommon() {
    var k = 'MGMT', d = S[k].data, code = $('#ca').value, ym = $('#cy').value, amt = $('#cm').value === '' ? '' : Number($('#cm').value), memo = $('#cn').value;
    if (amt === '' || amt <= 0) { $('#cerr').textContent = '금액(원)을 0보다 크게 넣어 주세요.'; return; }
    if (memo.length > 500) { $('#cerr').textContent = '메모는 500자 이하로 적어 주세요.'; return; }
    var id = (d.P_공통비 || []).length + 1, v = [id, code, ym, amt, memo, new Date().toISOString(), EMAIL, ''];
    api(SH + CFG.divisions[k].sheetId + '/values/' + encodeURIComponent('P_공통비!A:H') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', headers: JSONH, body: JSON.stringify({ values: [v] }) })
      .then(function () { return logHist(k, '공통비 추가', id, code + ' ' + ym + ' ' + amt); }).then(function () { return reload(k); }).catch(function (e) { $('#cerr').textContent = '저장하지 못했어요: ' + e.message; });
  }
  function delCommon(row) { patchCell('MGMT', 'P_공통비', row, 7, new Date().toISOString()).then(function () { return logHist('MGMT', '공통비 삭제', row - 1, ''); }).then(function () { return reload('MGMT'); }).catch(function (e) { alert('삭제하지 못했어요: ' + e.message); }); }

  function adminLoad() {
    var files = $('#bf').files, msg = $('#bmsg'); if (!files.length) { msg.textContent = '파일을 먼저 골라 주세요.'; return; }
    Array.prototype.reduce.call(files, function (p, file) { return p.then(function () { return file.text().then(function (t) { return putBundle(JSON.parse(t), msg); }); }); }, Promise.resolve())
      .then(function () { msg.textContent += ' 완료. 새로 불러와요...'; signedIn(); }).catch(function (e) { msg.textContent = '실패: ' + e.message; });
  }
  var HEADS = { 'P_계획': PH, 'P_이력': ['시각', '사용자', '작업', 'id', '내용'], 'P_공통비': ['id', 'account_code', 'ym', 'amount', 'memo', 'created_at', 'created_by', 'deleted_at'] };
  function putBundle(b, msg) {
    var d = CFG.divisions[b.div]; if (!d) throw new Error('알 수 없는 본부 ' + b.div);
    var id = d.sheetId, keep = ['P_계획', 'P_이력'].concat(b.div === 'MGMT' ? ['P_공통비'] : []), names = Object.keys(b.tabs).concat(keep);
    return api(SH + id + '?fields=sheets.properties.title').then(function (m) {
      var have = m.sheets.map(function (s) { return s.properties.title; });
      var add = names.filter(function (n) { return have.indexOf(n) < 0; }).map(function (n) { return { addSheet: { properties: { title: n } } }; });
      return add.length ? api(SH + id + ':batchUpdate', { method: 'POST', headers: JSONH, body: JSON.stringify({ requests: add }) }) : null;
    }).then(function () {
      return Object.keys(b.tabs).reduce(function (p, n) { return p.then(function () {
        var t = b.tabs[n]; msg.textContent = d.label + ' ' + n + ' 적재 중...';
        return api(SH + id + '/values/' + encodeURIComponent(n) + ':clear', { method: 'POST' }).then(function () { return api(SH + id + '/values/' + encodeURIComponent(n + '!A1') + '?valueInputOption=RAW', { method: 'PUT', headers: JSONH, body: JSON.stringify({ values: [t.header].concat(t.rows) }) }); });
      }); }, Promise.resolve());
    }).then(function () {
      return keep.reduce(function (p, n) { return p.then(function () {
        return api(SH + id + '/values/' + encodeURIComponent(n + '!A1:O1')).then(function (r) { if (r.values && r.values.length) return null; return api(SH + id + '/values/' + encodeURIComponent(n + '!A1') + '?valueInputOption=RAW', { method: 'PUT', headers: JSONH, body: JSON.stringify({ values: [HEADS[n]] }) }); });
      }); }, Promise.resolve());
    });
  }

  fetch('config.json').then(function (r) { return r.json(); }).then(function (c) {
    CFG = c;
    $('#login').onclick = function () {
      if (!CFG.clientId) { $('#main').innerHTML = '<div class="card err">로그인 설정(클라이언트 ID)이 아직 없어요.</div>'; return; }
      if (!(window.google && google.accounts)) { $('#main').innerHTML = '<div class="card err">구글 로그인 스크립트를 불러오지 못했어요.</div>'; return; }
      google.accounts.oauth2.initTokenClient({ client_id: CFG.clientId, scope: 'openid email https://www.googleapis.com/auth/spreadsheets', hd: 'sannamchon.co.kr', callback: function (r) { if (r.access_token) { TOKEN = r.access_token; signedIn(); } else $('#main').innerHTML = '<div class="card err">로그인하지 못했어요.</div>'; } }).requestAccessToken();
    };
  });
})();
