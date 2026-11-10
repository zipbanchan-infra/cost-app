// GS9 M3: A(3294bcb) 프론트의 /api 호출을 시트 어댑터(r9_api.js)로 바꾸는 fetch 가로채기 + 구글 로그인.
// - 토큰은 sessionStorage(탭 단위, 만료 시각 포함)에만 두고, 만료되면 조용히 다시 받는다(실패하면 로그인 창). 파일·로그에는 남기지 않는다.
// - 이메일만 localStorage 'r9_hint' 에 둔다(재로그인 힌트, 토큰 아님).
(function () {
  'use strict';
  var _fetch = window.fetch.bind(window);
  var SKEY = 'r9_session', HINT = 'r9_hint', cfgP = null, sess = null, pendingTok = null, tokenClient = null;
  var SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets/';
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var fmt = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  var loadCfg = function () { return cfgP || (cfgP = _fetch('config.json').then(function (r) { return r.json(); })); };
  function readSess() { try { return JSON.parse(sessionStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function writeSess(s) { sess = s; try { sessionStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* 저장소 막힘: 메모리만 */ } }
  function clearSess() { sess = null; try { sessionStorage.removeItem(SKEY); } catch (e) { /* 무시 */ } }
  function valid(s) { return s && s.token && s.exp - Date.now() > 60000; }

  function gisReady() { return new Promise(function (res) { var t = 0; (function w() { if (window.google && google.accounts && google.accounts.oauth2) return res(true); if (++t > 100) return res(false); setTimeout(w, 100); })(); }); }
  function requestToken(prompt, hint) {   // GIS 토큰 요청 -> {token, exp}
    return loadCfg().then(function (cfg) { return gisReady().then(function (ok) {
      if (!ok) throw new Error('gis_unavailable');
      return new Promise(function (resolve, reject) {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: cfg.clientId, scope: 'openid email https://www.googleapis.com/auth/spreadsheets', hd: 'sannamchon.co.kr',
          callback: function (r) { if (r && r.access_token) resolve({ token: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 }); else reject(new Error('no_token')); },
          error_callback: function (e) { reject(new Error((e && e.type) || 'token_error')); }
        });
        tokenClient.requestAccessToken({ prompt: prompt, hint: hint || undefined });
      });
    }); });
  }
  function userinfo(tok) {
    return _fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + tok } }).then(function (r) { return r.ok ? r.json() : {}; }).then(function (u) { return { email: String(u.email || '').toLowerCase(), name: u.name || '' }; }, function () { return { email: '', name: '' }; });
  }
  function finish(t) { return userinfo(t.token).then(function (u) { var s = { token: t.token, exp: t.exp, email: u.email || (sess && sess.email) || '', name: u.name || (sess && sess.name) || '' }; writeSess(s); try { if (s.email) localStorage.setItem(HINT, s.email); } catch (e) { /* 무시 */ } badge(s); return s; }); }
  function badge(s) {
    if (!s.email || document.getElementById('r9who')) return;
    var b = document.createElement('div'); b.id = 'r9who'; b.textContent = s.email;
    b.style.cssText = 'position:absolute;top:4px;left:50%;transform:translateX(-50%);z-index:2147483000;pointer-events:none;padding:2px 8px;border-radius:8px;background:#E8EEF5;color:#2B3A4A;font-size:12px;line-height:18px;font-weight:550;white-space:nowrap';
    (document.body || document.documentElement).appendChild(b);
  }
  function overlay() {   // 조용한 재발급이 안 될 때만: 사용자 클릭(팝업 허용)으로 로그인
    return new Promise(function (resolve) {
      var hint = ''; try { hint = localStorage.getItem(HINT) || ''; } catch (e) { /* 무시 */ }
      var o = document.createElement('div'); o.id = 'r9login';
      o.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:rgba(244,245,248,.96);display:flex;align-items:center;justify-content:center;font:15px sans-serif';
      o.innerHTML = '<div style="text-align:center;max-width:360px;padding:24px"><div style="font-size:20px;font-weight:700;margin-bottom:8px">비용관리</div><div style="color:#4e5968;margin-bottom:20px">회사 구글 계정(sannamchon.co.kr)으로 로그인해 주세요. 볼 수 있는 본부는 시트 공유 권한을 따라요.</div><button id="r9loginBtn" style="min-height:48px;width:100%;border-radius:12px;border:0;background:#1b4332;color:#fff;font-size:16px;font-weight:600;cursor:pointer">구글로 로그인</button><div id="r9loginMsg" style="color:#c92a2a;margin-top:12px;min-height:20px"></div></div>';
      (document.body || document.documentElement).appendChild(o);
      document.getElementById('r9loginBtn').onclick = function () {
        requestToken(hint ? '' : 'select_account', hint).then(finish).then(function (s) { o.remove(); resolve(s); }, function (e) { document.getElementById('r9loginMsg').textContent = '로그인하지 못했어요. 팝업을 허용했는지 확인하고 다시 눌러 주세요.'; });
      };
    });
  }
  function ensureToken(force) {
    if (!force) { var s0 = sess || readSess(); if (valid(s0)) { sess = s0; badge(s0); return Promise.resolve(s0); } }
    if (pendingTok) return pendingTok;
    var old = sess || readSess(), hint = (old && old.email) || ''; try { hint = hint || localStorage.getItem(HINT) || ''; } catch (e) { /* 무시 */ }
    var silent = hint ? Promise.race([requestToken('', hint), new Promise(function (_, rej) { setTimeout(function () { rej(new Error('silent_timeout')); }, 8000); })]).then(finish) : Promise.reject(new Error('no_hint'));
    pendingTok = silent.catch(function () { return overlay(); }).then(function (s) { pendingTok = null; return s; }, function (e) { pendingTok = null; throw e; });
    return pendingTok;
  }

  // ---------- 시트 REST ----------
  function sfetch(url, opt, tries) {
    tries = tries || 0;
    return ensureToken(false).then(function (s) {
      opt = opt || {}; opt.headers = Object.assign({ Authorization: 'Bearer ' + s.token }, opt.headers || {});
      return _fetch(url, opt).then(function (r) {
        if (r.status === 401 && tries < 1) { clearSess(); return ensureToken(true).then(function () { return sfetch(url, { method: opt.method, body: opt.body, headers: { 'Content-Type': (opt.headers || {})['Content-Type'] } }, tries + 1); }); }
        if (r.status === 429 && tries < 4) return new Promise(function (res) { setTimeout(res, 2000 * (tries + 1)); }).then(function () { return sfetch(url, opt, tries + 1); });
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error((j.error && j.error.message) || String(r.status)); e.status = r.status; throw e; } return j; });
      });
    });
  }
  var J = { 'Content-Type': 'application/json' };
  var sheets = {
    titles: function (sid) { return sfetch(SHEETS + sid + '?fields=sheets.properties.title').then(function (m) { return m.sheets.map(function (s) { return s.properties.title; }); }); },
    batchGet: function (sid, tabs) {
      if (!tabs.length) return Promise.resolve({});
      return sfetch(SHEETS + sid + '/values:batchGet?valueRenderOption=UNFORMATTED_VALUE&' + tabs.map(function (t) { return 'ranges=' + encodeURIComponent(t); }).join('&')).then(function (r) { var o = {}; r.valueRanges.forEach(function (v, i) { o[tabs[i]] = v.values || []; }); return o; });
    },
    append: function (sid, tab, rows) { return sfetch(SHEETS + sid + '/values/' + encodeURIComponent(tab + '!A:A') + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', { method: 'POST', headers: J, body: JSON.stringify({ values: rows }) }); },
    update: function (sid, a1, rows) { return sfetch(SHEETS + sid + '/values/' + encodeURIComponent(a1) + '?valueInputOption=RAW', { method: 'PUT', headers: J, body: JSON.stringify({ values: rows }) }); },
    ensureTab: function (sid, title, header) {
      return sfetch(SHEETS + sid + ':batchUpdate', { method: 'POST', headers: J, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: title } } }] }) }).catch(function (e) { if (!/already exists/i.test(e.message)) throw e; })
        .then(function () { return sfetch(SHEETS + sid + '/values/' + encodeURIComponent(title + '!A1') + '?valueInputOption=RAW', { method: 'PUT', headers: J, body: JSON.stringify({ values: [header] }) }); });
    }
  };

  var apiP = null;
  function getApi() {
    return apiP || (apiP = loadCfg().then(function (cfg) {
      return R9Api.create({ cfg: cfg, sheets: sheets, user: function () { var s = sess || readSess() || {}; return { email: s.email || '', name: s.name || '' }; }, now: function () { return fmt(new Date()); }, nowMs: function () { return Date.now(); }, fmt: fmt });
    }));
  }
  function respond(status, body) { return new Response(JSON.stringify(body), { status: status, headers: { 'Content-Type': 'application/json' } }); }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var u; try { u = new URL(url, location.href); } catch (e) { return _fetch(input, init); }
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (u.pathname === '/auth/logout' && method === 'POST') { clearSess(); try { localStorage.removeItem(HINT); } catch (e) { /* 무시 */ } return Promise.resolve(respond(200, { ok: true })); }
    if (u.origin !== location.origin || u.pathname.indexOf('/api/') !== 0) return _fetch(input, init);
    (window.__r9calls = window.__r9calls || []).push(method + ' ' + u.pathname);   // 시험용 호출 기록(토큰·내용 없음)
    var body = null; if (init && init.body) { try { body = JSON.parse(init.body); } catch (e) { body = null; } }
    return ensureToken(false).then(getApi).then(function (api) { return api.handle(method, u.pathname, body); }).then(function (r) { return respond(r.status, r.body); }, function (e) {
      var st = e && e.status; return respond(st === 401 ? 401 : st === 403 ? 403 : 500, { error: st === 403 ? 'division_forbidden' : st === 401 ? 'unauthorized' : 'sheet_failed' });
    });
  };
})();
