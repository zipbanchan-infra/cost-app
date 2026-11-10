// r13 c3 (본부장님 2026-10-30 11:43 승인) '절감계획' 탭 - 사람이 직접 입력하는 표.
//  4단계(절감계획 탭, 사이드 메뉴 '절감계획')의 맨 위에 붙어요. 저장은 기존 /api/plans(POST·PUT·DELETE, 이력·최근 삭제·되돌리기)를 그대로 쓰고,
//  새 칸(담당·목표 비율·메모·현재 금액·상태 4종)은 계획 content JSON 에만 들어가요(DB 구조 그대로).
//  표: 본부 > 계정 > 계획 줄. 열 = 항목(거래처/품목) · 현재 금액(월평균, 비교 기간 따라 자동) · 목표 금액(월) · 목표 비율 · 방법 · 담당 · 기한 · 상태 · 메모.
//  목표 금액과 비율은 하나만 적으면 다른 쪽이 자동으로 채워져요(비율 = 현재 월평균 비용 대비 줄일 %, 목표는 월 단위). AI 는 빈 칸 제안만 하고 저장은 사람이 눌러요.
(function(){
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const DIVS=[['PROD','prod','생산본부'],['ONLINE','online','온라인본부'],['MGMT','mgmt','경영지원본부']];
const STATES=['계획','진행','완료','보류'];
const R={drafts:{},add:null,pre:null,msg:{},busy:{},aiBusy:{},addMsg:'',gone:false,view:'acct',q:'',fdiv:'',hl:null};   // drafts[id] = 아직 저장 안 한 고친 값
const F=n=>Math.round(n).toLocaleString('ko-KR');
const stateOf=p=>STATES.includes(p.state)?p.state:(p.status==='초안'||!p.status?'계획':(STATES.includes(p.status)?p.status:'계획'));
// ---------- 현재 금액(월평균, 비교 기간의 이번 기간 달들) ----------
function monthsOf(div,code){   // 계정 월별 금액
 if(div==='ONLINE'){const m={};(DB.online.lines||[]).forEach(l=>{if(l.acct===code)m[l.ym]=(m[l.ym]||0)+l.amt;});return m;}
 const b=div==='MGMT'?DB.mgmt:DB.prod;const a=(b.acc||[]).find(x=>x.code===code);return a?a.m:null;}
function vendMonths(div,code,name){
 const nm=String(name||'').trim();const blank=nm==='거래처 미기재'||nm==='거래처 공란';
 const L=div==='ONLINE'?(((DB.ovend||[]).find(a=>a.code===code)||{}).vend||[]):(((div==='MGMT'?DB.mgmt:DB.prod).vend||{})[code]||[]);
 const v=L.find(x=>blank?x.code==='BLANK':x.name===nm);return v?v.m:null;}
function curAvg(div,code,vendor){
 const ys=CC().cur;const m=(vendor&&vendMonths(div,code,vendor))||monthsOf(div,code);if(!m||!ys.some(y=>m[y]!=null))return null;
 return ys.reduce((a,y)=>a+(m[y]!=null?(typeof m[y]==='number'?m[y]:m[y][0]):0),0)/ys.length;}
function vendNat(div,code,name){const nm=String(name||'').trim();const L=div==='ONLINE'?(((DB.ovend||[]).find(a=>a.code===code)||{}).vend||[]):(((div==='MGMT'?DB.mgmt:DB.prod).vend||{})[code]||[]);const v=L.find(x=>x.name===nm);return v&&DB.vnat&&DB.vnat[v.code]||'';}
const itemKind=(div,code,vendor)=>(vendor&&vendMonths(div,code,vendor)?'거래처':'계정 전체')+(vendNat(div,code,vendor)?' · '+vendNat(div,code,vendor):'');
function basisText(cur){return cur==null?`현재 금액 줄 없음(${CC().cl})`:`현재 ${CC().cl} 월평균 ${F(cur)}원`;}
// ---------- 목표 금액 <-> 비율 ----------
// r13 c5(본부장님 10/30 결정 6): 목표는 월 단위 - 비율 = 목표 금액(월) ÷ 현재 월평균 x 100. 예전 분기 목표(target_unit 없음)는 3으로 나눠 월로 보여요
const ratioOf=(amt,cur)=>amt!=null&&cur>0?Math.round(amt/cur*1000)/10:null;
const amtOf=(ratio,cur)=>ratio!=null&&cur>0?Math.round(cur*ratio/100):null;
const amtM=p=>p.target_amount_krw==null?null:(p.target_unit==='월'?p.target_amount_krw:Math.round(p.target_amount_krw/3));
function parseRatio(s){s=String(s==null?'':s).replace(/[\s%,]/g,'');if(!s)return {v:null};const v=Number(s);return /^[0-9]+(\.[0-9]+)?$/.test(s)&&v<=100?{v:Math.round(v*10)/10}:{err:'목표 비율은 0~100 사이 숫자로 적어 주세요(예 10).'};}
// ---------- 계정 목록(본부별, 인건비 묶음 제외) ----------
function accounts(div){
 if(div==='ONLINE'){const o={};(DB.online.lines||[]).forEach(l=>{if(l.acct)o[l.acct]=l.item;});return Object.entries(o).map(([c,n])=>({code:c,name:n}));}
 const b=div==='MGMT'?DB.mgmt:DB.prod;const lab=div==='MGMT'?LABOR_M:LABOR_P;return (b.acc||[]).filter(a=>!lab[a.code]).map(a=>({code:a.code,name:a.name}));}
function vendList(div,code){
 const L=div==='ONLINE'?(((DB.ovend||[]).find(a=>a.code===code)||{}).vend||[]):(((div==='MGMT'?DB.mgmt:DB.prod).vend||{})[code]||[]);
 const ys=CC().cur;return L.map(v=>({n:v.code==='BLANK'?'거래처 미기재':v.name,a:ys.reduce((s,y)=>s+(v.m[y]||0),0)})).filter(x=>x.n).sort((a,b)=>b.a-a.a).slice(0,60).map(x=>x.n);}
// ---------- 품목(r13 c9): dim_item 에서 고른 코드만. PROD 만 구매현황 품목이 있어서 온라인·경영지원은 비워 둬요 ----------
function itemNames(){const o={};((DB.mat2||{}).items||[]).forEach(x=>{o[x.c]=x.n;});
 Object.values((DB.prod||{}).mat||{}).forEach(L=>(L||[]).forEach(x=>{if(x.item&&x.name)o[x.item]=x.name;}));
 const s=DB.sub5029;if(s&&Array.isArray(s.mat))s.mat.forEach(x=>{if(x.item&&x.name)o[x.item]=x.name;});return o;}
function itemOpts(div,code){if(div!=='PROD'||!code)return [];const N=itemNames(),seen={};
 const add=c=>{if(c&&N[c])seen[c]=N[c];};
 const ia=(DB.mat2||{}).acc||{};Object.keys(ia).forEach(c=>{if(ia[c]&&ia[c][code])add(c);});
 ((DB.prod||{}).mat||{})[code]&&DB.prod.mat[code].forEach(x=>add(x.item));
 if(code==='5028')((DB.mat2||{}).items||[]).forEach(x=>{if(x.g==='ZIP_M')add(x.c);});   /* 원재료비 5028 = 원재료(ZIP_M) 품목 */
 if(code==='5029'&&DB.sub5029&&Array.isArray(DB.sub5029.mat))DB.sub5029.mat.forEach(x=>add(x.item));
 return Object.entries(seen).map(([c,n])=>({c,n})).sort((a,b)=>a.n.localeCompare(b.n,'ko')).slice(0,400);}
const itemName=c=>c?(itemNames()[c]||c):'';
const itemLabel=c=>c?`${itemName(c)}(${c})`:'';   // c13(4): 품목 이름이 숫자뿐인 것(예: 이름 '10103' = 코드 ZIP_S_6108)이 코드로 읽혀서 이름(코드)로 같이 보여요
function itemSel(attr,div,code,val,label){const O=itemOpts(div,code);
 if(div!=='PROD'||!code||(!O.length&&!val))return `<select class="r13-in" ${attr} data-nodev="1" disabled aria-label="${label}"><option value="">${code?'품목 줄 없음':'계정을 먼저'}</option></select>`;
 const has=!val||O.some(o=>o.c===val);const L=has?O:O.concat([{c:val,n:itemName(val)}]);
 return `<select class="r13-in" ${attr} data-nodev="1" aria-label="${label}"><option value="">(비워 둠)</option>${L.map(o=>`<option value="${esc(o.c)}"${o.c===val?' selected':''}>${esc(o.n)}(${esc(o.c)})</option>`).join('')}</select>`;}
const allowedDivs=()=>DIVS.filter(d=>ALLOWED.has(d[0]));
const divName=d=>(DIVS.find(x=>x[0]===d)||[0,0,d])[2];
// ---------- 한 줄 값(초안 우선) ----------
function rowVal(p){const d=R.drafts[p.id]||{};const cur=curAvg(p.division,p.account_code,d.vendor!=null?d.vendor:p.vendor);
 return {vendor:d.vendor!=null?d.vendor:(p.vendor||''),item:d.item!=null?d.item:(p.item_code||''),method:d.method!=null?d.method:(p.method||''),owner:d.owner!=null?d.owner:(p.owner||''),due:d.due!=null?d.due:(p.due||''),
  memo:d.memo!=null?d.memo:(p.memo||''),state:d.state!=null?d.state:stateOf(p),
  amt:d.amt!=null?d.amt:(amtM(p)==null?'':F(amtM(p))),ratio:d.ratio!=null?d.ratio:(p.target_ratio!=null?String(p.target_ratio):(amtM(p)!=null&&cur?String(ratioOf(amtM(p),cur)):'')),cur};}
const dirty=id=>!!R.drafts[id]&&Object.keys(R.drafts[id]).length>0;
const anyDirty=()=>Object.keys(R.drafts).some(dirty)||!!(R.add&&['vendor','item','method','owner','due','memo','amt','ratio'].some(k=>R.add[k]));
// ---------- 그리기 ----------
function ensureAdd(){if(!R.add){const dv=allowedDivs().map(d=>d[0]);const d0=(DIVS.find(x=>x[1]===st.div&&ALLOWED.has(x[0]))||allowedDivs()[0]||DIVS[0])[0];R.add={div:d0,code:'',vendor:'',item:'',method:'',owner:'',due:'',memo:'',state:'계획',amt:'',ratio:''};}
 if(R.pre){const p=R.pre;R.pre=null;R.add=Object.assign(R.add,{div:p.div,code:p.code,vendor:p.vendor||'',item:p.item||'',method:'',amt:'',ratio:''});R.focusAdd=true;}
 const A=R.add;if(!allowedDivs().some(d=>d[0]===A.div))A.div=(allowedDivs()[0]||DIVS[0])[0];
 if(A.code&&!accounts(A.div).some(a=>a.code===A.code))A.code='';
 if(A.item&&(A.div!=='PROD'||!itemNames()[A.item]))A.item='';}
const fld=(label,inner,cls)=>`<label class="r13-f${cls?' '+cls:''}"><span class="r13-l">${label}</span>${inner}</label>`;
const gemOn=()=>!!(V5.ST&&V5.ST.ai&&V5.ST.ai.gemini);
const josaRo=w=>{const c=String(w||'').slice(-1).charCodeAt(0);if(c>=48&&c<=57)return '036'.includes(String.fromCharCode(c))?'으로':'로';   /* 숫자 끝: 영·삼·육 = 받침 있음 */if(!(c>=0xAC00&&c<=0xD7A3))return '로';const j=(c-0xAC00)%28;return j===0||j===8?'로':'으로';};   // 받침 없음·ㄹ 받침 = 로
function sumLine(A){if(!A.code)return '';const ac=(accounts(A.div).find(a=>a.code===A.code)||{}).name||A.code;
 const last=A.item?itemLabel(A.item):(String(A.vendor||'').trim()||'');const path=[ac].concat(last?[last]:[]).join(' > ');
 return `<div class="r13-sum" id="r13Sum" data-nodev="1" role="status">${esc(path)}${josaRo(A.item?itemName(A.item):(last||ac))} 계획을 씁니다.</div>`;}
function addHtml(){ensureAdd();const A=R.add;const acc=accounts(A.div);const cur=A.code?curAvg(A.div,A.code,A.vendor):null;
 const stSel=(id,v)=>`<select id="${id}" class="r13-in" aria-label="상태">${STATES.map(s=>`<option${s===v?' selected':''}>${s}</option>`).join('')}</select>`;
 return `<div class="r13-add" id="r13Add" role="group" aria-label="계획 추가">
  <div class="r13-add-h"><b>+ 계획 추가</b><span class="r13-hint">본부·계정을 고르고 거래처·품목(생산본부만 목록에서 골라요, 비워 둬도 돼요)·방법·기한을 적은 뒤 ‘계획 저장’을 눌러요. 현재 금액·근거는 자동으로 채워져요.</span></div>
  ${sumLine(A)}
  <div class="r13-grid">
   ${fld('본부',`<select id="r13aDiv" class="r13-in">${allowedDivs().map(d=>`<option value="${d[0]}"${d[0]===A.div?' selected':''}>${d[2]}</option>`).join('')}</select>`)}
   ${fld('계정',`<select id="r13aAcc" class="r13-in"><option value="">계정을 골라 주세요</option>${acc.map(a=>`<option value="${esc(a.code)}"${a.code===A.code?' selected':''}>${esc(a.name)} ${esc(a.code)}</option>`).join('')}</select>`)}
   ${fld('거래처',`<input id="r13aVen" class="r13-in" list="r13Vend" value="${esc(A.vendor)}" maxlength="200" autocomplete="off" placeholder="예) 거래처 이름"><datalist id="r13Vend">${A.code?vendList(A.div,A.code).map(n=>`<option value="${esc(n)}">`).join(''):''}</datalist>`)}
   ${fld('품목',itemSel('id="r13aItem"',A.div,A.code,A.item,'품목'))}
   ${fld('현재 금액(월평균)',`<output id="r13aCur" class="r13-cur num">${cur==null?'-':F(cur)+'원'}</output>`)}
   ${fld('목표 금액(월, 원)',`<input id="r13aAmt" class="r13-in num" inputmode="numeric" value="${esc(A.amt)}" autocomplete="off" placeholder="예) 3000000">`)}
   ${fld('목표 비율(%)',`<input id="r13aRat" class="r13-in num" inputmode="decimal" value="${esc(A.ratio)}" autocomplete="off" placeholder="예) 10">`)}
   ${fld('방법',`<input id="r13aMet" class="r13-in" value="${esc(A.method)}" maxlength="500" autocomplete="off" placeholder="예) 거래처를 바꿔 단가 낮추기">`,'r13-w')}
   ${fld('담당',`<input id="r13aOwn" class="r13-in" value="${esc(A.owner)}" maxlength="100" autocomplete="off">`)}
   ${fld('기한',`<input id="r13aDue" class="r13-in num" value="${esc(A.due)}" inputmode="numeric" autocomplete="off" placeholder="2026-12-31">`)}
   ${fld('상태',stSel('r13aSt',A.state))}
   ${fld('메모',`<input id="r13aMemo" class="r13-in" value="${esc(A.memo)}" maxlength="1000" autocomplete="off">`,'r13-w')}
  </div>
  <div class="r13-add-b"><button type="button" class="btn pri sm" id="r13aSave"${R.busy.add?' disabled aria-busy="true"':''}>${R.busy.add?'<span class="ai-spin" aria-hidden="true"></span>저장하는 중이에요':'계획 저장'}</button>
   <button type="button" class="btn sec sm" id="r13aAi"${R.aiBusy.add||!R.add.code?' disabled':''} title="${R.add.code?'빈 칸(방법·목표 금액·기한)에 제안만 채워요. 저장은 ‘계획 저장’을 눌러야 해요':'계정을 고르면 켜져요'}">${R.aiBusy.add?'초안 만드는 중이에요':'AI 초안 채우기'}</button>
   <span class="r13-hint" id="r13aAiHint" data-state="${R.add.code?'on':'off'}">${R.add.code?(gemOn()?'켜짐 · 빈 칸(방법·목표 금액·기한)에 Gemini 제안을 채워요. 저장은 ‘계획 저장’을 눌러야 해요.':'켜짐 · 빈 칸(방법·목표 금액·기한)에 예시 초안을 채워요(Gemini 연결 전). 저장은 ‘계획 저장’을 눌러야 해요.'):'꺼짐 · 계정을 고르면 켜져요.'}</span>
   <span class="r13-err" id="r13aErr" role="alert">${esc(R.addMsg)}</span></div></div>`;}
function rowHtml(p){const v=rowVal(p),id=p.id,dr=dirty(id),m=R.msg[id]||'';
 const inp=(k,val,cls,extra)=>`<input class="r13-in${cls?' '+cls:''}" data-r13="${k}" data-id="${id}" value="${esc(val)}" autocomplete="off"${extra||''}>`;
 return `<tr class="r13-row${dr?' dirty':''}${String(R.hl)===String(id)?' r13-hl':''}" data-r13row="${id}">
  <td data-l="거래처" class="r13-c-item"><div class="r13-iw">${inp('vendor',v.vendor,'',' maxlength="200" aria-label="거래처"')}<span class="r13-kind">${esc(itemKind(p.division,p.account_code,v.vendor))}${p.example?' · AI 초안':''}</span></div></td>
  <td data-l="품목" class="r13-c-it">${itemSel(`data-r13="item" data-id="${id}"`,p.division,p.account_code,v.item,'품목')}</td>
  <td data-l="현재 금액(월평균)" class="num r13-cur">${v.cur==null?'<span class="r13-nd">줄 없음</span>':F(v.cur)+'원'}</td>
  <td data-l="목표 금액(월)">${inp('amt',v.amt,'num',' inputmode="numeric" aria-label="목표 금액(월, 원)"')}</td>
  <td data-l="목표 비율(%)">${inp('ratio',v.ratio,'num r13-rat',' inputmode="decimal" aria-label="목표 비율(%)"')}</td>
  <td data-l="방법">${inp('method',v.method,'',' maxlength="500" aria-label="방법"')}</td>
  <td data-l="담당">${inp('owner',v.owner,'',' maxlength="100" aria-label="담당"')}</td>
  <td data-l="기한">${inp('due',v.due,'num r13-due',' inputmode="numeric" aria-label="기한"')}</td>
  <td data-l="상태"><select class="r13-in" data-r13="state" data-id="${id}" aria-label="상태">${STATES.map(s=>`<option${s===v.state?' selected':''}>${s}</option>`).join('')}</select></td>
  <td data-l="메모">${inp('memo',v.memo,'',' maxlength="1000" aria-label="메모"')}</td>
  <td class="r13-act"><button type="button" class="btn pri sm" data-r13save="${id}"${dr&&!R.busy[id]?'':' disabled'}${R.busy[id]?' aria-busy="true"':''}>${R.busy[id]==='save'?'<span class="ai-spin" aria-hidden="true"></span>저장 중이에요':'저장'}</button>
   <button type="button" class="btn sec sm" data-r13ai="${id}"${R.aiBusy[id]?' disabled':''} title="빈 칸에 제안만 채워요. 저장은 ‘저장’을 눌러야 해요">${R.aiBusy[id]?'만드는 중이에요':'AI 초안 채우기'}</button>
   <button type="button" class="btn sec sm" data-r13del="${id}"${R.busy[id]?' disabled':''}>삭제</button>
   ${dr?'<span class="r13-dirty" role="status">● 저장 안 함</span>':''}<div class="r13-err" role="alert">${esc(m)}</div></td></tr>`;}
const VIEWS=[['acct','계정'],['vend','거래처'],['item','품목']];
const planText=p=>[p.account,p.account_code,p.vendor,p.item,p.item_code,p.method,p.owner,p.memo].join(' ').toLowerCase();
function shownPlans(){const q=R.q.trim().toLowerCase();return V5.ST.plans.filter(p=>ALLOWED.has(p.division)&&(!R.fdiv||p.division===R.fdiv)&&(!q||planText(p).includes(q)));}
const gkey=(p,view)=>view==='vend'?(String(p.vendor||'').trim()||'거래처 미기재'):view==='item'?(p.item||'품목 없음'):(p.account_code||p.account);
function tableHtml(){const plans=shownPlans();let h='';const all=V5.ST.plans.filter(p=>ALLOWED.has(p.division)).length;
 const sort=(a,b)=>String(a.account_code||a.account).localeCompare(String(b.account_code||b.account))||String(a.vendor).localeCompare(String(b.vendor),'ko');
 allowedDivs().forEach(([d])=>{const L=plans.filter(p=>p.division===d);if(!L.length)return;
  h+=`<tr class="r13-g1"><th colspan="11" scope="colgroup">${divName(d)} · ${L.length}건</th></tr>`;
  const by={};L.forEach(p=>{const k=gkey(p,R.view);(by[k]=by[k]||[]).push(p);});
  const keys=Object.keys(by).sort((a,b)=>R.view==='acct'?a.localeCompare(b):(a==='품목 없음'||a==='거래처 미기재')-(b==='품목 없음'||b==='거래처 미기재')||a.localeCompare(b,'ko'));
  keys.forEach(k=>{const P=by[k].slice().sort(sort);
   if(R.view==='acct'){const code=P[0].account_code;const nm=((accounts(d).find(a=>a.code===code)||{}).name)||String(P[0].account||'').replace(/\(\d{4}\)$/,'');
    const cur=code?curAvg(d,code,''):null;
    h+=`<tr class="r13-g2"><th colspan="11" scope="colgroup">${esc(nm)}${code?' '+esc(code):''} · ${P.length}건${cur==null?'':` · 계정 현재 월평균 ${F(cur)}원`}</th></tr>`;}
   else{const ic=R.view==='item'?P[0].item_code:'';   // c11(3): 품목별 보기 묶음 머리글에도 '이 품목으로 계획 쓰기'(계정은 그 품목 줄의 계정)
    const bt=ic&&d==='PROD'&&itemNames()[ic]?` <button type="button" class="btn sec sm r13-vb r13-ib" data-r13ib="${esc(ic)}" data-r13ac="${esc(P[0].account_code||itemAcct(ic))}" aria-label="${esc(itemName(ic))} 품목으로 계획 쓰기">이 품목으로 계획 쓰기</button>`:'';
    h+=`<tr class="r13-g2"><th colspan="11" scope="colgroup">${R.view==='vend'?'거래처':'품목'} ${esc(k)} · ${P.length}건${bt}</th></tr>`;}
   h+=P.map(rowHtml).join('');});});
 if(h)return h;
 return all?`<tr><td colspan="11" class="r13-empty" id="r13Empty">조건에 맞는 계획이 없어요. 검색어나 본부를 바꿔 보세요.</td></tr>`:`<tr><td colspan="11" class="r13-empty" id="r13Empty">아직 적은 계획이 없어요. 위 ‘+ 계획 추가’ 줄에 직접 적고 ‘계획 저장’을 누르면 저장돼서 여기에 모여요.</td></tr>`;}
function viewBar(){const n=shownPlans().length,all=V5.ST.plans.filter(p=>ALLOWED.has(p.division)).length;
 return `<div class="r13-vbar" id="r13Vbar" role="group" aria-label="계획 표 보기 전환과 필터">
  <span class="r13-l">보기</span>${VIEWS.map(([k,t])=>`<button type="button" class="btn ${R.view===k?'pri':'sec'} sm" data-r13view="${k}" aria-pressed="${R.view===k}">${t}별</button>`).join('')}
  <input id="r13Q" class="r13-in" type="search" value="${esc(R.q)}" placeholder="${R.view==='vend'?'거래처':R.view==='item'?'품목':'계정'} 이름으로 찾기" aria-label="계획 찾기" autocomplete="off">
  <select id="r13Fd" class="r13-in" aria-label="본부로 거르기"><option value="">전체 본부</option>${allowedDivs().map(d=>`<option value="${d[0]}"${R.fdiv===d[0]?' selected':''}>${d[2]}</option>`).join('')}</select>
  <span class="r13-hint" id="r13Cnt" role="status" aria-live="polite">${n===all?`${all}건`:`조건에 맞는 ${n}건 / 전체 ${all}건`}</span></div>`;}
function sectionHtml(){const C=CC();
 return `<section class="r13-pl" id="r13Pl" aria-label="절감계획 표">
  <div class="r13-bar"><div><div class="r13-t">절감계획 표</div><div class="r13-sub">직접 적고 고치고 지워요. 현재 금액은 ${esc(C.cl)} 월평균이고 비교 기간을 바꾸면 따라 바뀌어요. 목표는 금액이나 비율 중 하나만 적으면 다른 쪽이 자동으로 채워져요(비율 = 현재 월평균 비용 대비 줄일 %). 같은 본부 누구나 고칠 수 있고 바뀐 내용은 이력에 남아요.</div></div>
   <button type="button" class="btn sec sm" id="r13Csv">CSV 내려받기</button></div>
  ${addHtml()}
  ${viewBar()}
  <div class="r13-tw"><table class="r13-tbl" id="r13Tbl"><thead><tr><th scope="col">거래처</th><th scope="col">품목</th><th scope="col" class="num">현재 금액(월평균)</th><th scope="col" class="num">목표 금액(월)</th><th scope="col" class="num">목표 비율(%)</th><th scope="col">방법</th><th scope="col">담당</th><th scope="col">기한</th><th scope="col">상태</th><th scope="col">메모</th><th scope="col">동작</th></tr></thead><tbody>${tableHtml()}</tbody></table></div>
  <div class="r13-msg" id="r13Msg" role="status" aria-live="polite">${esc(R.top||'')}</div></section>`;}
// ---------- 다시 그리기(입력 칸 초점·글자 위치 유지) ----------
function rerender(){const sec=document.getElementById('r13Pl');if(!sec)return;const a=document.activeElement;let keep=null;
 if(a&&sec.contains(a)&&a.id!=='r13Csv'){keep={id:a.id,r13:a.dataset&&a.dataset.r13,rid:a.dataset&&a.dataset.id,pos:a.selectionStart};}
 const tmp=document.createElement('div');tmp.innerHTML=sectionHtml();sec.replaceWith(tmp.firstElementChild);bind();
 if(keep){const n=keep.id?document.getElementById(keep.id):document.querySelector(`#r13Pl [data-r13="${keep.r13}"][data-id="${keep.rid}"]`);if(n){n.focus();try{n.setSelectionRange(keep.pos,keep.pos);}catch(_){}}}}
// ---------- 입력 처리 ----------
function setDraft(id,k,v){const p=V5.ST.plans.find(x=>String(x.id)===String(id));if(!p)return;const d=R.drafts[id]=R.drafts[id]||{};
 if(k==='ratio'){d.ratio=v;const cur=curAvg(p.division,p.account_code,rowVal(p).vendor);const r=parseRatio(v);if(!r.err){if(r.v!=null&&cur)d.amt=String(F(amtOf(r.v,cur)));}}   /* 비율을 지워도 금액은 그대로 */
 else if(k==='amt'){d.amt=v;const cur=curAvg(p.division,p.account_code,rowVal(p).vendor);const a=V5.amtParse(v);if(!a.err){const rt=a.v==null?null:ratioOf(a.v,cur);d.ratio=rt==null?'':String(rt);}}
 else{d[k]=v;if(k==='vendor'&&d.amt){/* 거래처를 바꾸면 현재 금액이 바뀌므로 비율을 다시 계산 */const cur=curAvg(p.division,p.account_code,v);const a=V5.amtParse(d.amt);if(!a.err&&a.v!=null){const rt=ratioOf(a.v,cur);d.ratio=rt==null?'':String(rt);}}}
 const same=(x,val)=>{if(x==='amt'){const a=V5.amtParse(val);return !a.err&&(a.v==null?amtM(p)==null:a.v===amtM(p));}
  if(x==='ratio'){const r=parseRatio(val);return !r.err&&(r.v==null?!rowValBaseRatio(p):String(r.v)===String(rowValBaseRatio(p)));}
  return val===({vendor:p.vendor||'',item:p.item_code||'',method:p.method||'',owner:p.owner||'',due:p.due||'',memo:p.memo||'',state:stateOf(p)})[x];};
 Object.keys(d).forEach(x=>{if(same(x,d[x]))delete d[x];});
 if(!Object.keys(d).length)delete R.drafts[id];R.msg[id]='';}
function rowValBaseRatio(p){const cur=curAvg(p.division,p.account_code,p.vendor);return p.target_ratio!=null?String(p.target_ratio):(amtM(p)!=null&&cur?String(ratioOf(amtM(p),cur)):'');}
function planPayload(v,cur,existing){   // 서버로 보낼 값(검사 포함). 반환 {plan} 또는 {E}
 const E={};const plan={vendor:v.vendor.trim()||(v.item?'계정 전체':''),item_code:v.item||null,method:v.method.trim(),due:v.due.trim(),owner:v.owner.trim(),memo:v.memo.trim(),state:v.state};
 const c=V5.planCheck({vendor:plan.vendor,method:plan.method,due:plan.due},true);Object.assign(E,c);
 const a=V5.amtParse(v.amt),r=parseRatio(v.ratio);if(a.err)E.target_amount_krw=a.err;
 const big=!a.err&&a.v!=null&&a.v>10**10;   // r13 c11(2): 100억 초과는 금액 문구로(금액이 크면 자동으로 채운 비율이 100을 넘어 '비율' 문구가 먼저 나오던 것을 막음)
 if(big)E.target_amount_krw=typeof CC_BIG!=='undefined'?CC_BIG:'금액은 100억 원 이하로 입력해 주세요. 자릿수가 맞는지 다시 확인해 주세요.';
 if(r.err&&!big)E.target_ratio=r.err;
 if(!E.target_amount_krw&&!E.target_ratio){let amt=a.v,rat=r.v;if(amt==null&&rat!=null){amt=amtOf(rat,cur);if(amt==null)E.target_ratio='현재 금액 줄이 없어 비율로는 금액을 만들 수 없어요. 목표 금액을 직접 적어 주세요.';}
  if(amt!=null&&rat==null)rat=ratioOf(amt,cur);plan.target_amount_krw=amt;plan.target_unit='월';plan.target_ratio=rat==null?null:rat;}
 plan.current_amount_krw=cur==null?null:Math.round(cur);
 return Object.keys(E).length?{E}:{plan};}
const ERRMSG={vendor:'거래처/품목을 적어 주세요.',method:'방법을 적어 주세요.',due:'기한을 2026-12-31처럼 적어 주세요.'};
function errText(E){const keys=Object.keys(E);return keys.map(k=>E[k]&&typeof E[k]==='string'&&E[k].length>3?E[k]:(ERRMSG[k]||'칸을 확인해 주세요.')).join(' ');}
async function saveRow(id){if(R.busy[id])return;const p=V5.ST.plans.find(x=>String(x.id)===String(id));if(!p)return;const v=rowVal(p);const r=planPayload(v,v.cur,true);
 if(r.E){R.msg[id]=errText(r.E);rerender();return;}
 R.busy[id]='save';R.msg[id]='';rerender();
 try{const o=await V5.api('/api/plans/'+id,'PUT',{plan:r.plan});delete R.drafts[id];R.busy[id]=null;R.top='저장했어요.';R.hl=String(id);refresh(o.plans);try{toast('계획을 고쳐 저장했어요',true);}catch(_){}hlScroll();}
 catch(e){R.busy[id]=null;R.msg[id]=V5.errInfo(e,'계획을 저장하지 못했어요',V5.planErrO(e,{403:'이 본부 계획은 바꿀 권한이 없어요. 필요하면 경영지원본부에 권한을 요청해 주세요.',404:'그사이 지워졌거나 없는 계획이에요. 목록을 새로 불러왔어요.'})).h;
  if(e.status===404){V5.api('/api/plans').then(o=>refresh(o.plans)).catch(()=>{});}rerender();}}
function hlScroll(){setTimeout(()=>{const r=document.querySelector('#r13Tbl tr.r13-hl');if(r)r.scrollIntoView({block:'center'});},60);}
function refresh(plans){V5.ST.plans=plans;R.top=R.top||'';if(typeof render==='function')render();else rerender();V5.renderAI&&V5.renderAI();}
async function addRow(){if(R.busy.add)return;const A=R.add;R.addMsg='';R.hl=null;
 const acc=accounts(A.div).find(a=>a.code===A.code);if(!acc){R.addMsg='계정을 골라 주세요.';rerender();return;}
 const cur=curAvg(A.div,A.code,A.vendor);const r=planPayload(A,cur,false);if(r.E){R.addMsg=errText(r.E);rerender();return;}
 R.busy.add=true;rerender();
 try{const plan=Object.assign({account:`${acc.name}(${acc.code})`,target:'',basis:basisText(cur),turns:[]},r.plan);
  const o=await V5.api('/api/plans','POST',{plan,division:A.div,account_code:A.code,page:'절감계획 탭',manual:true});
  R.busy.add=false;R.add=null;R.addMsg='';R.top='계획을 저장했어요.';R.hl=o.id!=null?String(o.id):null;refresh(o.plans);try{toast('계획을 저장했어요',true);}catch(_){}hlScroll();}
 catch(e){R.busy.add=false;R.addMsg=V5.errInfo(e,'계획을 추가하지 못했어요',V5.planErrO(e,{403:'이 본부에는 계획을 쓸 권한이 없어요. 필요하면 경영지원본부에 권한을 요청해 주세요.'})).h;rerender();}}
function confirmDel(id){const p=V5.ST.plans.find(x=>String(x.id)===String(id));if(!p)return;
 document.getElementById('modal').innerHTML=`<div class="mt">절감 계획 삭제</div><div class="sub">${esc(p.vendor)} · ${esc(p.method)}</div><div class="an" id="r13DelNote">${V5.ST.trash?`목록에서 빼요. 삭제해도 ${V5.ST.trash.days}일 동안 최근 삭제에서 되돌릴 수 있어요.`:'목록에서 빼요. 기록은 남아서 되돌릴 수 있어요.'}</div><div class="sub" id="r13DelErr" role="alert"></div><div class="mbtns"><button class="btn sec sm" id="r13DelNo">취소</button><button class="btn pri sm" id="r13DelOk">삭제</button></div>`;
 document.getElementById('mbg').classList.add('show');const close=()=>document.getElementById('mbg').classList.remove('show');
 document.getElementById('r13DelNo').onclick=close;
 document.getElementById('r13DelOk').onclick=async()=>{const b=document.getElementById('r13DelOk');if(b.disabled)return;b.disabled=true;b.textContent='삭제 중이에요';
  try{const o=await V5.api('/api/plans/'+id,'DELETE',{});delete R.drafts[id];close();R.top='삭제했어요. 아래 ‘최근 삭제’에서 되돌릴 수 있어요.';refresh(o.plans);}
  catch(e){b.disabled=false;b.textContent='삭제';document.getElementById('r13DelErr').textContent=V5.errInfo(e,'계획을 삭제하지 못했어요',{403:'이 본부 계획은 바꿀 권한이 없어요.'}).h;if(e.status===404){V5.api('/api/plans').then(o=>{close();refresh(o.plans);}).catch(()=>{});}}};}
// ---------- AI 초안(빈 칸 제안만, 저장 안 함) ----------
async function aiFill(key){   // key = 'add' 또는 계획 id
 const isAdd=key==='add';const p=isAdd?null:V5.ST.plans.find(x=>String(x.id)===String(key));const A=isAdd?R.add:null;
 const div=isAdd?A.div:p.division,code=isAdd?A.code:p.account_code;if(!code||R.aiBusy[key])return;const v=isAdd?A:rowVal(p);
 const nm=((accounts(div).find(a=>a.code===code)||{}).name)||'';const cur=curAvg(div,code,v.vendor);
 R.aiBusy[key]=true;if(isAdd)R.addMsg='';else R.msg[key]='';rerender();
 try{const ctx={title:nm,code,vendor:v.vendor,cmp:st.cmp,mode:'amt',monthly:monthsOf(div,code)||{},breakdownLabel:'계정',chips:[nm]};
  const o=await V5.api('/api/ai/plan','POST',{ctx});const pl=o.plan||{};const fill={};
  if(!String(v.method||'').trim()&&pl.method)fill.method=String(pl.method).slice(0,500);
  if(!String(v.due||'').trim()&&pl.due)fill.due=String(pl.due);
  if(!String(v.amt||'').trim()&&!String(v.ratio||'').trim()&&Number.isSafeInteger(pl.target_amount_krw)&&pl.target_amount_krw>0){const am=Math.round(pl.target_amount_krw/3);fill.amt=F(am);const rt=ratioOf(am,cur);fill.ratio=rt==null?'':String(rt);}
  if(isAdd)Object.assign(R.add,fill);else{const d=R.drafts[key]=R.drafts[key]||{};Object.assign(d,fill);}
  R.aiBusy[key]=false;const n=Object.keys(fill).length;const t=n?`AI 초안을 빈 칸에 채웠어요(${n}칸). 저장은 ${isAdd?'‘계획 저장’':'‘저장’'}을 눌러야 해요.`:'채울 빈 칸이 없어요.';
  if(isAdd)R.addMsg='';R.top=t;rerender();const m=document.getElementById('r13Msg');if(m)m.textContent=t;}
 catch(e){R.aiBusy[key]=false;const h=V5.errInfo(e,'AI 초안을 만들지 못했어요',{}).h;if(isAdd)R.addMsg=h;else R.msg[key]=h;rerender();}}
// ---------- CSV(지금 보이는 표 그대로, UTF-8 BOM) ----------
function csvText(){const q=s=>{s=String(s==null?'':s);return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
 const rows=[['본부','계정','거래처','품목','현재 금액(월평균, 원)','목표 금액(월, 원)','목표 비율(%)','방법','담당','기한','상태','메모']];
 allowedDivs().forEach(([d])=>shownPlans().filter(p=>p.division===d).slice().sort((a,b)=>String(a.account_code||a.account).localeCompare(String(b.account_code||b.account))||String(a.vendor).localeCompare(String(b.vendor),'ko')).forEach(p=>{const v=rowVal(p);const a=V5.amtParse(v.amt);
  rows.push([divName(d),p.account,v.vendor,itemName(v.item),v.cur==null?'':Math.round(v.cur),a.err||a.v==null?'':a.v,v.ratio,v.method,v.owner,v.due,v.state,v.memo]);}));
 return '﻿'+rows.map(r=>r.map(q).join(',')).join('\r\n')+'\r\n';}
function csvDownload(){const b=new Blob([csvText()],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='절감계획_'+new Date().toISOString().slice(0,10)+'.csv';a.id='r13CsvLink';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
 R.top='CSV 로 내려받았어요.';const m=document.getElementById('r13Msg');if(m)m.textContent=R.top;}
// ---------- 연결 ----------
function bind(){const sec=document.getElementById('r13Pl');if(!sec)return;
 sec.querySelectorAll('[data-r13]').forEach(i=>{const k=i.dataset.r13,id=i.dataset.id;const on=()=>{setDraft(id,k,i.value);
   // 금액·비율은 서로 값을 채우니 그 줄만 값 갱신(초점 유지)
   const p=V5.ST.plans.find(x=>String(x.id)===String(id));const v=rowVal(p);const tr=i.closest('tr');
   [['amt',v.amt],['ratio',v.ratio]].forEach(([kk,val])=>{if(kk!==k){const o=tr.querySelector(`[data-r13="${kk}"]`);if(o)o.value=val;}});
   tr.classList.toggle('dirty',dirty(id));const sb=tr.querySelector('[data-r13save]');if(sb)sb.disabled=!dirty(id)||!!R.busy[id];
   let d=tr.querySelector('.r13-dirty');if(dirty(id)&&!d){d=document.createElement('span');d.className='r13-dirty';d.setAttribute('role','status');d.textContent='● 저장 안 함';tr.querySelector('.r13-act').insertBefore(d,tr.querySelector('.r13-err'));}else if(!dirty(id)&&d)d.remove();
   const cu=tr.querySelector('.r13-cur');if(cu&&k==='vendor'){cu.innerHTML=v.cur==null?'<span class="r13-nd">줄 없음</span>':F(v.cur)+'원';}
   const kd=tr.querySelector('.r13-kind');if(kd&&k==='vendor')kd.textContent=itemKind(p.division,p.account_code,v.vendor)+(p.example?' · AI 초안':'');};
  i.addEventListener(i.tagName==='SELECT'?'change':'input',on);});
 sec.querySelectorAll('[data-r13view]').forEach(b=>b.onclick=()=>{R.view=b.dataset.r13view;rerender();});
 const fq=document.getElementById('r13Q');if(fq){let comp=false;fq.addEventListener('compositionstart',()=>{comp=true;});fq.addEventListener('compositionend',()=>{comp=false;R.q=fq.value;rerender();});fq.addEventListener('input',e=>{if(comp||e.isComposing)return;R.q=fq.value;rerender();});}   /* 한글 조합 중에는 다시 그리지 않아요 */
 const ff=document.getElementById('r13Fd');if(ff)ff.onchange=()=>{R.fdiv=ff.value;rerender();};
 sec.querySelectorAll('[data-r13save]').forEach(b=>b.onclick=()=>saveRow(b.dataset.r13save));
 sec.querySelectorAll('[data-r13del]').forEach(b=>b.onclick=()=>confirmDel(b.dataset.r13del));
 sec.querySelectorAll('[data-r13ai]').forEach(b=>b.onclick=()=>aiFill(b.dataset.r13ai));
 const A=document.getElementById('r13Add');if(A&&R.add){const g=id=>document.getElementById(id);
  const sync=()=>{const cur=R.add.code?curAvg(R.add.div,R.add.code,R.add.vendor):null;g('r13aCur').textContent=cur==null?'-':F(cur)+'원';};
  g('r13aDiv').onchange=e=>{R.add.div=e.target.value;R.add.code='';rerender();};
  g('r13aAcc').onchange=e=>{R.add.code=e.target.value;rerender();};
  g('r13aVen').oninput=e=>{R.add.vendor=e.target.value;const a=V5.amtParse(R.add.amt);if(!a.err&&a.v!=null){const rt=ratioOf(a.v,curAvg(R.add.div,R.add.code,R.add.vendor));R.add.ratio=rt==null?'':String(rt);g('r13aRat').value=R.add.ratio;}sync();};
  g('r13aAmt').oninput=e=>{R.add.amt=e.target.value;const a=V5.amtParse(e.target.value),cur=R.add.code?curAvg(R.add.div,R.add.code,R.add.vendor):null;if(!a.err){const rt=a.v==null?null:ratioOf(a.v,cur);R.add.ratio=rt==null?'':String(rt);g('r13aRat').value=R.add.ratio;}};
  g('r13aRat').oninput=e=>{R.add.ratio=e.target.value;const r=parseRatio(e.target.value),cur=R.add.code?curAvg(R.add.div,R.add.code,R.add.vendor):null;if(!r.err){const am=r.v==null?null:amtOf(r.v,cur);if(am!=null){R.add.amt=F(am);g('r13aAmt').value=R.add.amt;}}};   /* 비율을 지워도 적어 둔 금액은 그대로 */
  [['r13aMet','method'],['r13aOwn','owner'],['r13aDue','due'],['r13aMemo','memo']].forEach(([id,k])=>{g(id).oninput=e=>{R.add[k]=e.target.value;};});
  g('r13aSt').onchange=e=>{R.add.state=e.target.value;};
  g('r13aItem').onchange=e=>{R.add.item=e.target.value;};
  g('r13aSave').onclick=addRow;g('r13aAi').onclick=()=>aiFill('add');
  [...A.querySelectorAll('input,select')].forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter'&&i.tagName==='INPUT'&&i.id!=='r13aVen'){e.preventDefault();addRow();}}));}
 const c=document.getElementById('r13Csv');if(c)c.onclick=csvDownload;
 if(R.focusAdd){R.focusAdd=false;const f=document.getElementById('r13aMet');if(f)f.focus();}}
// ---------- 4단계(절감계획 탭)에 붙이기 ----------
function mount(){if(typeof st==='undefined'||st.s!==4||st.cc)return;const pg=document.getElementById('page');if(!pg||document.getElementById('r13Pl'))return;
 const L=document.getElementById('planList');if(!L)return;L.insertAdjacentHTML('beforebegin',sectionHtml()+`<div class="r13-cardsh" id="r13CardSh">저장한 계획 카드 <span class="sub">(같은 데이터 · 카드로 보기)</span></div>`);bind();}
function wrap(){const r=window.render;if(typeof r!=='function'||r.r13)return false;
 const w=function(){const out=r.apply(this,arguments);try{mount();vendBtns();}catch(e){console.warn('r13_plan',e);}return out;};w.r13=true;window.render=w;return true;}
// ---------- '자세히 봐요' 거래처 줄의 '이 거래처로 계획 쓰기' ----------
// c10: 품목 코드 -> 계획을 쓸 생산본부 계정(구매현황에서 그 품목 금액이 가장 큰 계정, 인건비 묶음 제외. 원재료는 5028)
function itemAcct(code){const ia=((DB.mat2||{}).acc||{})[code]||{};const ok=new Set(accounts('PROD').map(a=>a.code));
 const L=Object.entries(ia).filter(([c])=>ok.has(c)).sort((a,b)=>(b[1][1]||0)-(a[1][1]||0));if(L.length)return L[0][0];
 const it=((DB.mat2||{}).items||[]).find(x=>x.c===code);return it&&it.g==='ZIP_M'&&ok.has('5028')?'5028':'';}   /* 원재료(ZIP_M)는 구매현황에 원장 줄 연결이 없어서 원재료비 5028 로 */
function priceBtn(){if(typeof st==='undefined'||st.s!==3||st.a!=='price'||st.div!=='prod')return;   // 자재 단가 상세(단가 히트맵에서 누른 품목)
 const pt=document.getElementById('priceTitle');if(!pt||pt.dataset.r13)return;pt.dataset.r13='1';const code=st.pm,ac=itemAcct(code);
 if(!code||!ac||!itemNames()[code])return;
 pt.insertAdjacentHTML('afterend',`<div class="r13-ibw"><button type="button" class="btn sec sm r13-vb r13-ib" data-r13ib="${esc(code)}" data-r13ac="${esc(ac)}" aria-label="${esc(itemName(code))} 품목으로 계획 쓰기">이 품목으로 계획 쓰기</button></div>`);}
function vendBtns(){priceBtn();if(typeof st==='undefined'||st.s!==3||typeof cur!=='function')return;const i=cur();if(!i||!i.code)return;
 const btn=nm=>`<button type="button" class="btn sec sm r13-vb" data-r13vb="${esc(nm)}" aria-label="${esc(nm)} 거래처로 계획 쓰기">이 거래처로 계획 쓰기</button>`;
 const T=document.getElementById('vendTbl');   // 예전 화면 표
 if(T&&!T.dataset.r13){T.dataset.r13='1';   // 칸을 늘리면 AI 창을 열었을 때 가로로 넘쳐서, 업체 이름 칸 아래에 붙여요
  T.querySelectorAll('tbody tr[data-v]').forEach(tr=>{const c0=tr.firstElementChild;const nm=(c0.childNodes[0]?c0.childNodes[0].textContent:c0.textContent).trim();c0.insertAdjacentHTML('beforeend',`<button type="button" class="linkbtn r13-vb r13-vbc" data-r13vb="${esc(nm)}" aria-label="${esc(nm)} 거래처로 계획 쓰기" title="이 거래처로 계획 쓰기"></button>`);});}
 const P=document.getElementById('r10Plot');   // 단순 화면 거래처별 막대
 if(P&&!P.dataset.r13&&/거래처별/.test(P.getAttribute('aria-label')||'')){P.dataset.r13='1';
  P.querySelectorAll('.r10-pr[data-key]').forEach(r=>{const k=r.dataset.key;if(k==='__rest'||k==='__resid')return;r.insertAdjacentHTML('beforeend',btn(r.dataset.name));});}
 if(P&&!P.dataset.r13i&&/품목별/.test(P.getAttribute('aria-label')||'')){P.dataset.r13i='1';if(!document.getElementById('r13ItemHint'))P.insertAdjacentHTML('beforebegin','<div class="r10-note" id="r13ItemHint">막대 아래 ‘이 품목으로 계획 쓰기’를 누르면 절감계획 표의 추가 줄에 계정과 품목이 채워져요.</div>');   // c9: 품목 막대의 '이 품목으로 계획 쓰기'(품목 코드는 dim_item 코드)
  P.querySelectorAll('.r10-pr[data-key]').forEach(r=>{const k=r.dataset.key;if(k==='__rest'||k==='__resid'||!itemNames()[k])return;r.insertAdjacentHTML('beforeend',`<button type="button" class="btn sec sm r13-vb r13-ib" data-r13ib="${esc(k)}" aria-label="${esc(itemName(k))} 품목으로 계획 쓰기">이 품목으로 계획 쓰기</button>`);});}
 const mt=document.getElementById('matTitle');   // 예전 화면: 고른 자재(품목) 상세
 if(mt&&!mt.dataset.r13){mt.dataset.r13='1';const m=((DB.prod.mat||{})[i.code]||[]).find(x=>x.key===st.m)||null;const sel=document.querySelector('#matList .mi.on');const mk=sel?sel.dataset.m:(m&&m.key);const mm=((DB.prod.mat||{})[i.code]||[]).find(x=>x.key===mk);
  if(mm&&mm.item&&itemNames()[mm.item])mt.insertAdjacentHTML('beforeend',` <button type="button" class="btn sec sm r13-vb r13-ib" data-r13ib="${esc(mm.item)}" aria-label="${esc(itemName(mm.item))} 품목으로 계획 쓰기">이 품목으로 계획 쓰기</button>`);}}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-r13vb]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 const i=typeof cur==='function'?cur():null;if(!i)return;R.pre={div:{prod:'PROD',online:'ONLINE',mgmt:'MGMT'}[st.div],code:i.code||'',vendor:b.dataset.r13vb};R.add=R.add||null;R.top='';go({s:4,a:null,n:null,ch:null,pm:null,va:null,vv:null,hm:null});},true);
// c12(3): 이슈 카드의 '이 거래처 보기' = 그 거래처 상세(3단계)로 바로
function openVd(el){const [acc,vc]=String(el.dataset.r10vd||'').split('|');if(!acc||!vc)return;st.pendOpen=['vmonth'];go({s:3,a:'vd',va:acc,vv:vc,hm:null});}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-r10vd]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openVd(b);},true);
document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const b=e.target.closest&&e.target.closest('[data-r10vd]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openVd(b);},true);
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-r13ib]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 const i=typeof cur==='function'?cur():null;if(!i&&!b.dataset.r13ac)return;R.pre={div:{prod:'PROD',online:'ONLINE',mgmt:'MGMT'}[st.div],code:b.dataset.r13ac||(i&&i.code)||'',vendor:'',item:b.dataset.r13ib};R.add=R.add||null;R.top='';if(st.s===4&&b.closest('#r13Pl')){rerender();const ad=document.getElementById('r13Add');if(ad)ad.scrollIntoView({block:'center'});return;}   /* 이미 계획 표 화면이면 이동 없이 추가 줄만 채워요 */
 go({s:4,a:null,n:null,ch:null,pm:null,va:null,vv:null,hm:null});},true);
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest&&e.target.closest('[data-r13vb],[data-r13ib]')){e.stopPropagation();}},true);
(function(){let q=false;const run=()=>{q=false;try{vendBtns();}catch(x){}};const M=document.getElementById('main');if(M)new MutationObserver(()=>{if(!q){q=true;requestAnimationFrame(run);}}).observe(M,{childList:true,subtree:true});})();
// ---------- 저장 안 한 줄이 있으면 떠날 때 알려요 ----------
function leaveGuard(e){if(!anyDirty())return;e.preventDefault();e.returnValue='저장하지 않은 줄이 있어요.';return e.returnValue;}
window.addEventListener('beforeunload',leaveGuard);
document.addEventListener('click',e=>{if(!anyDirty()||typeof st==='undefined'||st.s!==4)return;
 const t=e.target.closest('#side a[data-nav], :is(button,a,.r10-kpi,.r10-tab)[data-div], :is(button,a,.r10-kpi,[role=button])[data-step], :is(button,a)[data-view], .r10-back, #restart');if(!t||t.closest('#r13Pl')||t.closest('#modal'))return;
 e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 document.getElementById('modal').innerHTML=`<div class="mt">저장하지 않은 줄이 있어요</div><div class="sub" id="r13LeaveNote">저장하지 않은 줄(또는 추가하다 만 줄)이 있어요. 지금 떠나면 적은 내용이 사라져요.</div><div class="mbtns"><button class="btn sec sm" id="r13Stay">계속 적기</button><button class="btn pri sm" id="r13Leave">저장 안 하고 떠나기</button></div>`;
 document.getElementById('mbg').classList.add('show');const close=()=>document.getElementById('mbg').classList.remove('show');
 document.getElementById('r13Stay').onclick=close;
 document.getElementById('r13Leave').onclick=()=>{R.drafts={};R.add=null;R.addMsg='';close();t.click();};},true);
window.R13PL={R,itemOpts,itemNames,shownPlans,csvText,curAvg,ratioOf,amtOf,anyDirty,mount,STATES};
const base=window.R10HOOK;
window.R10HOOK=function(){wrap();try{mount();}catch(e){console.warn('r13_plan',e);}window.R13_PLAN=true;return base&&base.apply(this,arguments);};
if(typeof window.render==='function'&&window.R10_READY){wrap();try{mount();}catch(e){}}
})();
