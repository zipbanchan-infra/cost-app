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
