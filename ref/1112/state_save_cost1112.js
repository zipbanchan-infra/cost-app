// COST1112 사이드바 상태 유지 + 저장(탭 자동 생성 2개만) + 다시 읽기 + 테스트 행 삭제 시험. 가짜 시트(번들 복사본)에서만 돈다.
const fs = require('fs'), path = require('path');
const { open } = require('./lib.js');
const rows = []; const T = (id, name, ok, d) => { rows.push({ id, name, ok: !!ok, d }); console.log(ok ? 'PASS' : 'FAIL', id, name, ok ? '' : JSON.stringify(d)); };
(async () => {
  const t = await open(); const p = t.p; const S = t.m.state, PROD = t.m.idOf.PROD;
  const tabsBefore = Object.keys(S[PROD]);
  // ---- 상태 유지 ----
  await p.evaluate(() => { location.hash = '#div=prod&s=3&a=5029&ax=item'; }); await p.waitForTimeout(600);
  await p.locator('#r10HmMap [data-r10hc]:not([data-chg=""])').first().click(); await p.waitForTimeout(300);
  await p.check('input[name=psMethod][value="단가절감"]'); await p.fill('#psTgt', '100000'); await p.fill('#psPlan', '[COST1112 테스트] 삭제 예정 - 단가 재협상'); await p.fill('#psReason', '[COST1112 테스트] 사유: 최근 3분기 단가 상승');
  const want = { m: '단가절감', t: '100000', p: '[COST1112 테스트] 삭제 예정 - 단가 재협상', r: '[COST1112 테스트] 사유: 최근 3분기 단가 상승' };
  const read = () => p.evaluate(() => ({ m: (document.querySelector('input[name=psMethod]:checked') || {}).value, t: (document.getElementById('psTgt') || {}).value, p: document.getElementById('psPlan').value, r: document.getElementById('psReason').value }));
  const same = x => JSON.stringify(x) === JSON.stringify(want);
  const hops = ['#div=prod&s=1', '#div=prod&s=2&a=5029', '#div=prod&s=4', '#div=prod&s=1&hm=acc', '#div=online', '#div=mgmt', '#div=prod&s=3&a=5029&ax=vend'];
  const res = [];
  for (const h of hops) { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(500); res.push([h, same(await read())]); }
  T('S1', '입력 -> 7개 다른 단계/해시로 이동 후에도 사이드바 값(방법·목표·계획·사유)이 그대로', res.every(x => x[1]), res);
  await p.click('[data-r10ax="item"]').catch(() => {});
  const ls = await p.evaluate(() => localStorage.getItem('cost1112_plan_draft'));
  T('S2', "localStorage 키 'cost1112_plan_draft' 에 입력값 저장", ls && ls.includes('단가 재협상'), ls && ls.slice(0, 80));
  await p.reload(); await p.waitForSelector('button[data-div]', { timeout: 15000 }); await p.waitForFunction(() => window.R10_READY === true); await p.waitForTimeout(500);
  T('S3', '새로 고침 후에도 사이드바 값이 그대로', same(await read()), await read());
  // ---- 결함 1·2 재현 시험(수정 1회차): 화면·계정·본부가 바뀌면 자동 값이 현재 화면 기준, 사용자가 쓴 글은 유지 ----
  const ctxOf = () => p.evaluate(() => { const c = window.COST1112_SIDE.ctx(); return { account: c.account, vendor: c.vendor, item: c.item, itemCode: c.itemCode, cu: c.cu, where: c.where }; });
  await p.evaluate(() => { location.hash = '#div=prod&s=3&a=5029&ax=item'; }); await p.waitForTimeout(600);
  await p.locator('#r10HmMap [data-r10hc]:not([data-chg=""])').first().click(); await p.waitForTimeout(300);
  const c1 = await ctxOf();
  T('F1a', '결함1 준비: 5029 품목 칸을 누르면 사이드바 맥락에 그 품목이 잡힘', !!c1.item && c1.cu != null && /5029/.test(c1.account), c1);
  await p.evaluate(() => { location.hash = '#div=prod'; }); await p.waitForTimeout(500);
  const k1 = await p.evaluate(() => [...document.querySelectorAll('.r10-row[data-issue] .r10-t')].map(x => x.textContent.trim()));
  const sj = k1.findIndex(x => x.includes('수선비')); const oth = sj >= 0 ? sj : k1.findIndex(x => !x.includes('부재료비'));
  await p.locator('.r10-row[data-issue]').nth(oth).click(); await p.waitForTimeout(500);
  const c2 = await ctxOf();
  T('F1b', '결함1: 홈 -> 다른 계정 클릭 후 이전 품목·거래처·현재단가가 남지 않음', !c2.item && !c2.itemCode && !c2.vendor && c2.cu == null && c2.account && c2.account !== c1.account, { c1, c2 });
  await p.check('input[name=psMethod][value="단가절감"]'); await p.fill('#psPlan', 'F1 계획 글'); await p.fill('#psReason', 'F1 사유 글'); await p.waitForTimeout(200);
  const f1v = await p.evaluate(() => ({ cur: document.getElementById('psCur').dataset.v, tgt: document.getElementById('psTgt').value }));
  T('F1c', '결함1: 다른 계정 화면에서 현재 단가 칸이 이전 값 없이 비어 있음(안내 문구)', f1v.cur === '', f1v);
  const ps = await p.evaluate(() => { const c = window.COST1112_SIDE.ctx(); return c.account; });
  await p.evaluate(() => { location.hash = '#div=online'; }); await p.waitForTimeout(500);
  const c3 = await ctxOf();
  T('F1d', '결함1: 본부 전환(온라인) 후에도 이전 품목·거래처 없음 + 사용자 글(계획·사유) 유지', !c3.item && !c3.vendor && c3.cu == null && (await p.inputValue('#psPlan')) === 'F1 계획 글' && (await p.inputValue('#psReason')) === 'F1 사유 글', c3);
  await p.evaluate(() => { location.hash = '#div=prod&s=3&a=5029&ax=item'; }); await p.waitForTimeout(600);
  await p.evaluate(() => { location.hash = '#div=prod&s=3&a=5029&ax=vend'; }); await p.waitForTimeout(600);
  const c4 = await ctxOf();
  T('F1e', '결함1: 같은 계정 안 보기(품목별->거래처별) 전환 시 선택 칸이 없으면 품목·단가 없음', !c4.item && c4.cu == null && /5029/.test(c4.account), c4);
  // 결함1 저장 payload: 다른 계정에서 저장하면 이전 품목이 안 실림
  await p.evaluate(() => { location.hash = '#div=prod&s=3&a=5029&ax=item'; }); await p.waitForTimeout(600);
  await p.locator('#r10HmMap [data-r10hc]:not([data-chg=""])').first().click(); await p.waitForTimeout(300);
  const oldItem = (await ctxOf()).itemCode;
  await p.evaluate(() => { location.hash = '#div=prod'; }); await p.waitForTimeout(400);
  await p.locator('.r10-row[data-issue]').nth(oth).click(); await p.waitForTimeout(500);
  const calls0 = t.m.ctl.calls.length;
  await p.check('input[name=psMethod][value="사용량 절감"]'); await p.fill('#psTgt', '2'); await p.waitForTimeout(150);
  const pl = await p.evaluate(() => { const c = window.COST1112_SIDE.ctx(); return { acc: c.account, code: c.code }; });
  T('F1f', '결함1: 다른 계정에서 저장될 맥락(계정·코드)은 현재 화면 것, 이전 품목코드 아님', pl.acc !== c1.account && !!oldItem && (await ctxOf()).itemCode !== oldItem, { pl, oldItem });
  // ---- 결함 2: 업체 상세 ----
  await p.evaluate(() => { location.hash = '#div=prod&s=3&a=5029&ax=vend'; }); await p.waitForTimeout(500);
  const vd = await p.evaluate(() => { const L = (typeof vendAccounts === 'function') ? vendAccounts() : []; const a = L[0]; return a ? { va: a.code, vv: a.vend[0].code, an: a.name, vn: a.vend[0].name } : null; });
  await p.evaluate(h => { location.hash = h; }, `#div=prod&s=3&a=vd&va=${vd.va}&vv=${vd.vv}`); await p.waitForTimeout(700);
  const c5 = await ctxOf();
  T('F2a', '결함2: 업체 상세에서 계정 자리 = 계정(코드), 거래처 = 그 업체 이름', c5.account === `${vd.an}(${vd.va})` && c5.vendor === vd.vn && c5.vendor !== '전체', { c5, vd });
  await p.check('input[name=psMethod][value="기타"]'); await p.fill('#psPlan', 'F2 계획'); await p.fill('#psReason', 'F2 사유');
  const pay = await p.evaluate(async () => { const o = []; const orig = V5.api; V5.api = function (u, m, b) { if (m === 'POST') o.push(b); return Promise.reject(Object.assign(new Error('stop'), { kind: 'x' })); }; document.getElementById('psSave').click(); await new Promise(r => setTimeout(r, 400)); V5.api = orig; return o[0]; });
  T('F2b', '결함2: 업체 상세 저장 payload = account 계정(코드), vendor 그 업체, account_code 계정코드', pay && pay.plan.account === `${vd.an}(${vd.va})` && pay.plan.vendor === vd.vn && pay.account_code === vd.va, pay && { a: pay.plan.account, v: pay.plan.vendor, c: pay.account_code });
  // ---- N1(회귀): 업체 상세 품목 히트맵 칸 -> 현재 단가·품목코드 자동 ----
  const cand = await p.evaluate(() => { const o = []; (vendAccounts() || []).forEach(a => a.vend.forEach(v => o.push({ va: a.code, vv: v.code }))); return o.slice(0, 80); });
  let n1 = null;
  for (const c of cand) {
    await p.evaluate(h => { location.hash = h; }, `#div=prod&s=3&a=vd&va=${c.va}&vv=${c.vv}&ax=item`); await p.waitForTimeout(350);
    const n = await p.locator('#r10HmMap [data-r10hc]:not([data-chg=""])').count();
    if (n > 0) { n1 = c; break; }
  }
  T('N1a', 'N1 준비: 품목 히트맵이 있는 업체 상세를 찾음', !!n1, cand.length);
  if (n1) {
    const key = await p.locator('#r10HmMap [data-r10hc]:not([data-chg=""])').first().getAttribute('data-r10hc');
    await p.locator('#r10HmMap [data-r10hc]:not([data-chg=""])').first().click(); await p.waitForTimeout(300);
    const cn = await ctxOf();
    T('N1b', 'N1: 업체 상세 품목 칸 클릭 -> 품목코드=그 칸, 현재 단가 자동, 거래처=그 업체, 계정 유지', cn.itemCode === key && !!cn.item && cn.cu != null && cn.vendor === (await p.evaluate(() => vdData().v.name)) && /\(/.test(cn.account), { cn, key });
    await p.check('input[name=psMethod][value="단가절감"]'); await p.waitForTimeout(200);
    const pc2 = await p.evaluate(() => ({ cur: document.getElementById('psCur').textContent, v: document.getElementById('psCur').dataset.v }));
    T('N1c', 'N1: 단가절감 선택 시 현재 단가 칸에 값이 들어감', !!pc2.v && /원/.test(pc2.cur), pc2);
    await p.evaluate(h => { location.hash = h; }, '#div=prod&s=3&a=5029&ax=vend'); await p.waitForTimeout(500);
    const cx = await ctxOf();
    T('N1d', 'N1: 다른 화면으로 가면 그 칸 맥락이 안 남음', !cx.item && !cx.itemCode && cx.cu == null, cx);
    await p.evaluate(h => { location.hash = h; }, `#div=prod&s=3&a=vd&va=${n1.va}&vv=${n1.vv}&ax=item`); await p.waitForTimeout(450);
    const cy = await ctxOf();
    T('N1e', 'N1: 업체 상세에 다시 와도 칸을 안 눌렀으면 품목 맥락 없음', !cy.item && cy.cu == null, cy);
  }
  await p.evaluate(() => { document.getElementById('psPlan').value = ''; }); 
  await p.evaluate(() => { location.hash = '#div=prod'; }); await p.waitForTimeout(300);
  await p.evaluate(() => { localStorage.removeItem('cost1112_plan_draft'); }); await p.reload(); await p.waitForSelector('button[data-div]', { timeout: 15000 }); await p.waitForFunction(() => window.R10_READY === true); await p.waitForTimeout(500);
  // 이후 기존 시험을 위해 입력값을 다시 채움
  await p.evaluate(() => { location.hash = '#div=prod&s=3&a=5029&ax=item'; }); await p.waitForTimeout(600);
  await p.locator('#r10HmMap [data-r10hc]:not([data-chg=""])').first().click(); await p.waitForTimeout(300);
  await p.check('input[name=psMethod][value="단가절감"]'); await p.fill('#psTgt', '100000'); await p.fill('#psPlan', '[COST1112 테스트] 삭제 예정 - 단가 재협상'); await p.fill('#psReason', '[COST1112 테스트] 사유: 최근 3분기 단가 상승');
  // ---- 저장 ----
  await p.evaluate(() => { location.hash = '#div=prod&s=3&a=5029&ax=item'; }); await p.waitForTimeout(600);
  await p.locator('#r10HmMap [data-r10hc]:not([data-chg=""])').first().click(); await p.waitForTimeout(300);
  T('P0', '저장 전 시트에 P_계획_A·P_이력_A 없음', !S[PROD]['P_계획_A'] && !S[PROD]['P_이력_A'], Object.keys(S[PROD]));
  await p.click('#psSave'); await p.waitForFunction(() => /저장했어요|못했어요|못했|확인/.test(document.getElementById('psMsg').textContent), null, { timeout: 15000 });
  const msg = await p.textContent('#psMsg');
  const added = Object.keys(S[PROD]).filter(k => !tabsBefore.includes(k));
  T('P1', '저장 성공 문구', /저장했어요/.test(msg), msg);
  T('P2', '새로 생긴 탭은 P_계획_A·P_이력_A 둘뿐(P_공통비_A 없음, 다른 시트 변화 없음)', JSON.stringify(added.sort()) === JSON.stringify(['P_계획_A', 'P_이력_A']) && ![S[t.m.idOf.ONLINE], S[t.m.idOf.MGMT]].some(x => Object.keys(x).some(k => /^P_/.test(k))), added);
  const hd = S[PROD]['P_계획_A'][0], row = S[PROD]['P_계획_A'][1];
  const o = {}; hd.forEach((h, i) => o[h] = row[i]); const c = JSON.parse(o.content);
  T('P3', '시트에서 다시 읽은 행: vendor=품목 거래처(또는 전체), due=2026-12-31, 방법=단가절감, 사유 일치, 계정 5029',
    S[PROD]['P_계획_A'].length === 2 && c.vendor && c.due === '2026-12-31' && c.method === '단가절감' && c.basis === want.r && o.account_code === '5029', { vendor: c.vendor, due: c.due, method: c.method, basis: c.basis, acc: o.account_code, memo: c.memo });
  const tIdx = hd.indexOf('target'); const cu0 = c.target;
  T('X3', 'FIX3: 목표 단가 100000 입력 -> 시트 target 칸에 "목표 단가 100,000원..." 이 들어감(금액 입력 필요 아님)', /^목표 단가 100,000원/.test(String(o.target || cu0 || '')), { target: o.target, ctarget: c.target, tIdx });
  T('X3b', 'FIX3: target_note 자체는 content에 저장되지 않음', !('target_note' in c), Object.keys(c));
  T('P4', 'P_이력_A 에 create 이력 1건', S[PROD]['P_이력_A'].length === 2 && S[PROD]['P_이력_A'][1].includes('create'), S[PROD]['P_이력_A']);
  const back = await p.evaluate(async () => (await V5.api('/api/plans')).plans.filter(x => /COST1112 테스트/.test(JSON.stringify(x))).map(x => ({ id: x.id, vendor: x.vendor, due: x.due, method: x.method, basis: x.basis })));
  T('P5', 'API로 다시 읽어도 같은 행 1개', back.length === 1 && back[0].due === '2026-12-31' && back[0].method === '단가절감', back);
  T('P6', '저장 뒤 사이드바 입력 칸 비워짐', (await read()).p === '' && (await read()).r === '', await read());
  await p.screenshot({ path: path.join(__dirname, 'shots', '09_sidebar_saved.png') });
  // ---- 테스트 행만 삭제(소프트 삭제 = 기존 DELETE 경로) ----
  const id = back[0].id; const nBefore = S[PROD]['P_계획_A'].length;
  const del = await p.evaluate(async id => { try { await V5.api('/api/plans/' + id, 'DELETE'); return (await V5.api('/api/plans')).plans.some(x => x.id === id); } catch (e) { return 'ERR ' + e.status; } }, id);
  const delRow = S[PROD]['P_계획_A'][1]; const di = hd.indexOf('deleted_at');
  T('P7', '그 테스트 행만 삭제(목록에서 사라짐, 행의 deleted_at 기록, 다른 행 변화 없음)', del === false && delRow[di] && S[PROD]['P_계획_A'].length === nBefore, { del, deleted_at: delRow[di] });
  T('R7', '화면 오류 0건', t.errs.length === 0, t.errs);
  fs.writeFileSync(path.join(__dirname, 'state_save_result.json'), JSON.stringify(rows, null, 1));
  const f = rows.filter(r => !r.ok).length; console.log(`\n합계 PASS ${rows.length - f} / FAIL ${f}`);
  await t.close(); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
