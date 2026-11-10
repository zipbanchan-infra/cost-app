// dev_r6 1차 개발: 화면 숫자는 서버 /api/r6/data(cost_v5.sqlite 읽기 전용 직접 계산)에서 받음. 목업 data.json 사용 안 함.
// r6nd U1(오버레이 static_app/app.js = static/app.js 복사본 + 수정): 비교 기간에 줄이 하나도 없으면 '자료 없음' → 0으로 계산하지 않고 '입력 필요'로 보이며 증감·순위·색·합계 증감에서 뺀다. 줄이 있고 값이 0이면 진짜 0.
const ND='비교 기간 없음';
const DB=window.R6_DATA;const ALLOWED=new Set(DB.allowed||[]);
const {f,sg,man,esc,per,PMN}=V5;
const P=['25Q3','26H1','26Q3'],PL={'25Q3':'2025 Q3','26H1':'2026 H1','26Q3':'2026 Q3'};
const STEPS=['이슈 고르기','원인 보기','자세히 보기','계획 확인'];
const ym2=y=>y.slice(0,2)+'.'+y.slice(2);
const pTot=(m,p)=>Object.entries(m||{}).filter(([y])=>per(y)===p).reduce((a,[,v])=>a+(Array.isArray(v)?v[0]:v),0);
const tots=m=>Object.fromEntries(P.map(p=>[p,pTot(m,p)]));
// 13:11 확정: 기본 비교 = 작년 3분기(25Q3) 대비, 상반기(26H1) 대비는 선택 · 길이가 다른 기간은 월평균으로 비교
const CMP={h1:{l:'상반기(26H1) 대비',s:'26H1 대비',cur:['2607','2608','2609'],prev:['2601','2602','2603','2604','2605','2606'],cl:'2026 Q3',pl:'2026 H1',main:1},
 q3:{l:'작년 3분기(25Q3) 대비',s:'25Q3 대비',cur:['2607','2608','2609'],prev:['2507','2508','2509'],cl:'2026 Q3',pl:'2025 Q3',main:1},
 q4:{l:'작년 4분기(25Q4) 대비',s:'25Q4 대비',cur:['2607','2608','2609'],prev:['2510','2511','2512'],cl:'2026 Q3',pl:'2025 Q4'},   // r13 c2: 25Q4 는 보조(비교 월평균 cmpAvg)로 계산, 표의 25Q3·26H1·26Q3 세 열은 그대로
 mom:{l:'전월',s:'전월 대비',cur:['2609'],prev:['2608'],cl:'2026-09',pl:'2026-08'},
 qoq:{l:'전분기',s:'전분기 대비',cur:['2607','2608','2609'],prev:['2604','2605','2606'],cl:'2026 Q3',pl:'2026 Q2'}};
const CK='r6dev_cmp';const CC=()=>CMP[st.cmp]||CMP.q3;
const mval=v=>Array.isArray(v)?v[0]:v;
const sumY=(m,ys)=>ys.reduce((a,y)=>a+(m&&m[y]!=null?mval(m[y]):0),0);
const hasY=(m,ys)=>!!m&&ys.some(y=>m[y]!=null);
function cmpM(m,b,smap){const C=CC();const ca=sumY(m,C.cur),pa=sumY(m,C.prev),ac=ca/C.cur.length,nd=!hasY(m,C.prev),ap=nd?null:pa/C.prev.length;
 const sc=smap?(sumY(smap,C.cur)||null):salesSum(C.cur,b),sp=smap?(sumY(smap,C.prev)||null):salesSum(C.prev,b);const rc=sc?ca/sc*100:null,rp=sp&&!nd?pa/sp*100:null;
 return {ca,pa,ac,ap,nd,d:nd?null:ac-ap,r:ap>0&&ac>0?(ac/ap-1)*100:null,rc,rp,pp:rc!=null&&rp!=null?rc-rp:null,sc,sp};}
// 기간 월평균: 그 기간에 줄이 없으면 null(0 아님)
function pAvg(m,p){return hasY(m,PMON3[p])?pTot(m,p)/PMN[p]:null}
const ppS=v=>v==null?'-':Math.abs(v)<0.005?'0.00%p':(v>=0?'+':'')+(Math.abs(v)<0.1?v.toFixed(2):v.toFixed(1))+'%p';
const manS=n=>(n>=0?'+':'-')+man(Math.abs(n));
const josa=(w,a,b)=>{const c=w.charCodeAt(w.length-1);return w+((c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28)?a:b)};
const amtMode=()=>V5.mode()==='amt';
// U5: 목록·표가 비었을 때 빈 칸 대신 해요체 안내(제목 한 줄 + 할 일 한 줄 + 버튼 하나까지)
const emptyBox=(id,t,h,btn)=>`<div class="empty-st" id="${id}" role="status"><div class="es-t">${t}</div>${h?`<div class="es-h">${h}</div>`:''}${btn||''}</div>`;
// ---------- 생산 ----------
// hq3: 경영지원본부(mgmt)는 생산과 같은 모양의 자료(DB.mgmt)를 써요. PD·LABOR·ACCM 은 본부를 바꿀 때(parseHash → useDiv) 같이 바뀌어요
const PD_P=DB.prod,PD_M=DB.mgmt||{acc:[],vend:{},mat:{},salesM:{prod:{},net:{}},labor:[]};
let PD=PD_P;
const LABOR_P={'5039':1,'5079':1,'5100':1,'5109':1}; // 인건비 묶음: 이슈 목록·AI 제외
const LABOR_M=Object.fromEntries((PD_M.labor||[]).map(c=>[c,1])); // 경영지원 인건비 묶음 = 직원급여·퇴직연금·복리후생비(·잡급) 계정(서버가 이름으로 골라 줘요)
let LABOR=LABOR_P;
let ACCM=Object.fromEntries(PD.acc.map(a=>[a.code,a]));
const isP=()=>st.div==='prod'||st.div==='mgmt'; // 생산과 같은 계정 → 업체 흐름
function useDiv(){const m=st.div==='mgmt';PD=m?PD_M:PD_P;LABOR=m?LABOR_M:LABOR_P;ACCM=Object.fromEntries(PD.acc.map(a=>[a.code,a]));}
const prodMonthly=()=>{const o={};PD.acc.filter(a=>!LABOR[a.code]).forEach(a=>Object.entries(a.m).forEach(([y,v])=>o[y]=(o[y]||0)+v));return o;};
const prodAllMonthly=()=>{const o={};PD.acc.forEach(a=>Object.entries(a.m).forEach(([y,v])=>o[y]=(o[y]||0)+v));return o;};
function priceRise(m){return V5.priceRise(m)}
// ---------- 온라인 ----------
const OL=DB.online;
const CH=[['D2C','자사몰'],['COUPANG','쿠팡(윙 포함)'],['KURLY','컬리'],['BULK_ETC','대량/기타(네이버 포함)'],['ONLINE_COMMON','온라인 공통(미배부)']];
const CHN=Object.fromEntries(CH);
const BUNDLE='인건비 + 기타 직접비';
const GROUP={'직원급여':BUNDLE,'퇴직연금':BUNDLE,'세금과공과금':BUNDLE,'무형자산상각':BUNDLE,'기타':BUNDLE};
const OITEMS=['광고선전비','판매촉진비','판매수수료','운반비','외주용역비'];
const OACC={'광고선전비':'8338','판매촉진비':'8349','판매수수료':'8399','운반비':'8379','외주용역비':'8339'};
OL.lines.forEach(l=>{l.key=l.ym+'|'+l.ch+'|'+l.item;l.g=GROUP[l.item]||l.item;});
const loadMoves=()=>V5.ST.moves;
function view(){const mv=loadMoves().filter(m=>m.status==='이동됨');return OL.lines.map(l=>{let e=l.ch;mv.forEach(m=>{if(m.key===l.key)e=m.to});return {...l,eff:e,moved:e!==l.ch}});}
function ocost(V,ch,p,item){return V.filter(l=>(ch==='ALL'||l.eff===ch)&&(!p||per(l.ym)===p)&&(item?l.item===item:l.g!==BUNDLE||true)).reduce((a,l)=>a+l.amt,0);}
function oMonthly(V,ch,item,noBundle){const o={};V.filter(l=>(ch==='ALL'||l.eff===ch)&&(item?l.item===item:(!noBundle||l.g!==BUNDLE))).forEach(l=>o[l.ym]=(o[l.ym]||0)+l.amt);return o;}
const OSALES={online:{},ch:{}};OL.sales.forEach(x=>{if(x.ch==='ONLINE_COMMON')OSALES.online[x.ym]=x.s;else (OSALES.ch[x.ch]=OSALES.ch[x.ch]||{})[x.ym]=x.s;});
// ---------- 상태 ----------
let st={div:'prod',cc:false,s:1,a:null,n:null,ch:null,pm:null,hm:null,va:null,vv:null,pendOpen:null,pendV:null,scope:'raw',cmp:(k=>CMP[k]?k:'q3')(V5.J(CK,'q3')),pendM:null,v:null,m:null,more:false,allNodes:false,sort:'amt',open:new Set(),sel:new Set()};
function parseHash(){const q=new URLSearchParams(location.hash.slice(1));const prev=st.div+'|'+st.a;
 st.div=['online','mgmt'].includes(q.get('div'))?q.get('div'):'prod';const okD=d=>ALLOWED.has({prod:'PROD',online:'ONLINE',mgmt:'MGMT'}[d]);if(!okD(st.div))st.div=['prod','online','mgmt'].find(okD)||'prod';useDiv();st.cc=st.div==='mgmt'&&q.get('cc')==='1';st.s=Math.min(4,Math.max(1,+(q.get('s')||1)));st.a=q.get('a');st.n=q.get('n');st.ch=q.get('ch');st.pm=q.get('pm');st.hm=q.get('hm');st.va=q.get('va');st.vv=q.get('vv');if(st.a==='price'&&st.s===2){st.s=1;st.hm='price';}
 // U4: 그 본부에 없는 히트맵 종류(온라인의 원재료·포장재 단가)·자재 단가 상세로 오면 빈 화면 대신 계정 비용 히트맵·이슈 목록으로
 const fix0=st.hm+'|'+st.a;if(st.hm&&!hmKinds().some(k=>k[0]===st.hm))st.hm='acc';if(st.div!=='prod'&&st.a==='price'){st.a=null;st.pm=null;if(st.s>1)st.s=1;}
 if(fix0!==st.hm+'|'+st.a){const q2=new URLSearchParams();['div','s','a','n','ch','pm','hm','va','vv'].forEach(k=>{if(st[k]!=null&&st[k]!=='')q2.set(k,st[k])});if(st.cc)q2.set('cc','1');history.replaceState(null,'','#'+q2.toString());}// 주소도 고친 화면에 맞춤(hashchange 없음)
 if(prev!==st.div+'|'+st.a){st.open=new Set();st.sel.clear();st.v=null;st.m=null;st.allNodes=false;}
 if(st.pendOpen){st.pendOpen.forEach(x=>st.open.add(x));st.pendOpen=null;}if(st.pendV){st.v=st.pendV;st.pendV=null;}if(q.get('sv')){st.v=q.get('sv');if(st.s===3){st.open.add('vend');st.open.add('mat');}}// r12 c1: 고른 거래처 강조는 주소 sv 에 남아 새로 고침·뒤로가기 뒤에도 유지if(st.pendM){st.m=st.pendM;st.pendM=null;}
 if(st.s>1&&!st.a){if(isP())setBasesFor();else V5.setBases('online',[['online','온라인 매출']],{online:OSALES.online});const I=issues();st.a=I.length?I[0].id:null;}}// 2단계 기본 이슈 = 1단계 목록 1위: 비율 분모(기준)를 먼저 맞춘 뒤 고름(예전엔 분모가 비어 순위가 어긋나 '14위 원재료비'가 열렸어요)
function go(o){const cur={div:st.div,s:st.s,a:st.a,n:st.n,ch:st.ch,pm:st.pm,hm:st.hm,va:st.va,vv:st.vv};const nx=Object.assign(cur,o);const q=new URLSearchParams();Object.entries(nx).forEach(([k,v])=>{if(v!=null&&v!=='')q.set(k,v)});const h=q.toString();if(h===location.hash.slice(1)){parseHash();render();}else location.hash=h;}
// ---------- 기준(분모) ----------
function setBasesFor(){if(isP()){V5.setBases('prod',[['prod','생산매출'],['net','출고매출 합계']],PD.salesM);return;}
 const ch=st.s===3?curCh():null;const withCh=ch&&ch!=='ONLINE_COMMON';
 V5.setBases('online',st.s===3&&ch?[['online','온라인 매출'],['channel','채널 매출']]:[['online','온라인 매출']],{online:OSALES.online,channel:withCh?(OSALES.ch[ch]||{}):{}});}
function vPb(cost,p,b){if(amtMode())return f(cost/PMN[p]);const s=V5.salesP(p,b);return V5.pct(cost,s);}
function dPb(m,b){const x=cmpM(m,b);if(x.nd)return ND;if(amtMode())return manS(x.d);return x.pp==null?V5.NOS:ppS(x.pp);}
// ---------- 이슈 모델 ----------
function issues(all){let L;
 if(isP()){L=PD.acc.filter(a=>!LABOR[a.code]).map(a=>{const vs=(PD.vend[a.code]||[]).map(v=>({id:v.code,name:v.name,c:tots(v.m),m:v.m}));return {id:a.code,title:a.name,code:a.code,c:tots(a.m),m:a.m,drivers:vs,dl:'업체'}});}
 else{const V=view();L=OITEMS.map(it=>({id:it,title:it,code:OACC[it],c:Object.fromEntries(P.map(p=>[p,ocost(V,'ALL',p,it)])),m:oMonthly(V,'ALL',it),drivers:CH.map(([id,n])=>({id,name:n,c:Object.fromEntries(P.map(p=>[p,ocost(V,id,p,it)])),m:oMonthly(V,id,it)})).filter(d=>P.some(p=>d.c[p])),dl:'채널'}));}
 const dk=d=>d.nd?-1e18:onR()?(d.pp==null?-1e9:d.pp):d.d;// 자료 없음은 증감 순위 맨 뒤 · U2: 온라인 비율 모드는 온라인 매출 대비 %p 순(워터폴·시그널과 같은 기준)
 L.forEach(i=>{i.x=cmpM(i.m);i.d=i.x.d;i.r=i.x.r;i.pp=i.x.pp;i.nd=i.x.nd;i.drivers.forEach(d=>{d.x=cmpM(d.m);d.d=d.x.d;d.pp=d.x.pp;d.nd=d.x.nd});i.drivers.sort((x,y)=>dk(y)-dk(x));});
 const key=i=>i.nd?-1e18:st.sort==='rate'?(i.r==null?-1e9:i.r):(amtMode()?i.d:(i.pp==null?-1e9:i.pp));
 return (all?L:L.filter(i=>!i.nd&&(onR()?i.pp!=null&&i.pp>0:i.d>0))).sort((x,y)=>key(y)-key(x));}// R6ND-7: 온라인 비율 모드는 온라인 매출 대비 %p 가 오른 항목만(순서와 같은 기준)
function cur(){if(st.a==='price'&&st.div==='prod')return priceIssue();if(st.a==='vd'){const {a,v}=vdData();// U4: 업체 상세의 2단계(이전·단계 버튼) = 그 업체 하나의 증감. 예전엔 비교값 없이 d:0 이라 비율 모드 핵심 수치가 '매출 데이터 없음'으로 보였어요
  const x=cmpM(v.m),me={id:v.code,name:v.name,c:tots(v.m),m:v.m,x,d:x.d,pp:x.pp,nd:x.nd};
  return {id:'vd',title:v.name,code:a.code,acct:a.name,vd:v.code,c:tots(v.m),m:v.m,x,d:x.d,r:x.r,pp:x.pp,nd:x.nd,drivers:[me],dl:'업체'};}const A=issues(true);return A.find(x=>x.id===st.a)||issues()[0];}
function rankOf(id){return issues().findIndex(x=>x.id===id)+1}
function keyTxt(i){if(i.nd)return `<span title="${CC().pl} 비교 기간 없음 · 증감 계산 안 해요">${ND}</span>`;return amtMode()?`월 ${manS(i.d)}${i.r!=null?` (${i.r>=0?'+':''}${i.r.toFixed(1)}%)`:''}`:(i.pp==null?V5.NOS:ppS(i.pp));}
function dTxt(d){if(d.nd)return ND;return amtMode()?manS(d.d):(d.pp==null?V5.NOS:ppS(d.pp));}
function reasonTxt(i){const t=i.drivers.filter(dUp)[0];const nn=i.drivers.filter(d=>d.nd).length;
 if(isP()){if(!i.drivers.length)return `월평균 ${CC().pl}보다 ${i.r!=null?pctS(i.r):''} · 거래처 줄 없음`;
   return t?`${t.name} 매입이 월 ${manS(t.d)} 늘었어요`:nn?`늘어난 업체를 찾으려면 ${CC().pl} 비교 기간 없는 업체 ${nn}곳이 ${ND}이라 알 수 없어요`:'업체별로는 늘어난 곳이 없어요';}
 if(onR())return t?`${t.name} 비율이 ${ppS(t.pp)} 올랐어요 · ${OBL} 기준`:nn?`비율이 오른 채널을 찾으려면 ${CC().pl} 비교 기간 없는 채널 ${nn}곳이 ${ND}이라 알 수 없어요`:`채널별로는 ${OBL} 대비 비율이 오른 곳이 없어요`;
 return t?`${josa(t.name,'에서','에서')} 월 ${manS(t.d)} 늘었어요`:nn?`늘어난 채널을 찾으려면 ${CC().pl} 비교 기간 없는 채널 ${nn}곳이 ${ND}이라 알 수 없어요`:'채널별로는 늘어난 곳이 없어요';}
// U2: 온라인 비율 기준 = 온라인 매출(비묶음 채널 net_sales 합). 온라인 비율 모드에서 '늘어난 채널'은 이 기준 %p 로 고른다
const OBL='온라인 매출';
const onR=()=>st.div==='online'&&!amtMode();
const dUp=d=>!d.nd&&(onR()?d.pp!=null&&d.pp>0:d.d>0);
// ---------- 공통 화면 조각 ----------
const divName=()=>st.div==='prod'?'생산본부':st.div==='mgmt'?'경영지원본부':'온라인본부';
function topbar(){const tb=(d,id,n)=>ALLOWED.has(id)?`<button class="tab${st.div===d?' on':''}" data-div="${d}">${n}</button>`:`<span class="tab dis" title="권한 없음" aria-disabled="true">${n}</span>`;return `<div class="topbar"><div class="tabs">${tb('prod','PROD','생산본부')}${tb('online','ONLINE','온라인본부')}${tb('mgmt','MGMT','경영지원본부')}</div></div><div class="cbar" id="cbar">${V5.toggleHtml()}<span class="cbar-r"><span class="vtl">비교</span>${baseSeg()}</span></div>`;}
function baseSeg(){return `<span class="seg" id="baseSeg">${['q3','q4','h1'].map(k=>`<button data-cmp="${k}" class="${st.cmp===k?'on':''}">${CMP[k].l}</button>`).join('')}</span>`;}
function auxSeg(){return `<span class="seg aux" id="auxSeg">${['mom','qoq'].map(k=>`<button data-cmp="${k}" class="${st.cmp===k?'on':''}" title="보조 비교">${CMP[k].l}</button>`).join('')}</span>`;}
function stepper(){return `<div class="stepper" id="stepper">${STEPS.map((t,k)=>{const n=k+1;return `<button class="stp${n===st.s?' on':''}${n<st.s?' done':''}" data-step="${n}" ${n===st.s?'aria-current="step" ':''}${n>1&&!st.a&&n!==st.s?'disabled':''}><span class="no">${n}</span>${t}</button>`}).join('')}</div>`;}
function viewSeg(){return `<span class="seg" id="viewSeg"><button data-view="list" class="${st.hm?'':'on'}">목록</button><button data-view="hm" class="${st.hm?'on':''}">히트맵</button></span>`;}
function guide(txt,btns){return `<div class="guide" id="guide"><div class="gx"><div class="gk">지금 할 일 · ${st.s}/4</div><div class="gt" id="guideText">${txt}</div></div><div class="gb">${btns}</div></div>`;}
const prevBtn=()=>st.s>1?`<button class="btn sec sm" id="prevBtn">‹ 이전</button>`:'';
const nextBtn=t=>`<button class="btn pri sm" id="nextBtn">${t} →</button>`;
function fold(id,label,body){const o=st.open.has(id);return `<button class="fold" data-fold="${id}" aria-expanded="${o}">${label} <span class="cv">⌄</span></button>${o?`<div class="foldb" id="fb-${id}">${body}</div>`:''}`;}
function acc(id,title,sum,body){const o=st.open.has(id);return `<section class="acc-i" id="acc-${id}"><button class="acc-h" data-acc="${id}" aria-expanded="${o}"><span><div class="at">${title}</div><div class="as">${sum}</div></span><span class="ax">${o?'접기 ⌃':'펼치기 ⌄'}</span></button>${o?`<div class="acc-b">${body}</div>`:''}</section>`;}
const FOOT=()=>`<div class="foot">${st.div==='prod'?'금액: Z-IPS 회계집계표 마감(fact_gl_monthly) · 업체: 이카운트 원장(fact_ledger_line) · 자재: 구매현황(fact_purchase_line)':st.div==='mgmt'?'금액: Z-IPS 회계집계표 마감 · 부서 SN_01 판관비(fact_gl_monthly) · 업체: 이카운트 원장(fact_ledger_line) · 공통비 입력은 앱 상태 DB에 직접 입력으로 저장하고 실제 비용으로 보고 위 금액·비율에 더해요(원장에 이미 있는 달은 원장이 우선)':'금액: 독립채산제 월 탭 채널 직접비(fact_channel_cost_monthly) · 채널 이동은 앱 상태 DB에 이력으로 저장, 원본 DB는 바꾸지 않아요'} · 비율 분모: ${isP()?'v_prod_sales.prod_sales / fact_sales_channel_monthly.net_sales 합':'온라인 매출 = fact_sales_channel_monthly.net_sales 합(묶음 아닌 채널) · 이슈·워터폴·시그널·히트맵·채널 표·AI 모두 이 기준 · 3단계에서 ‘채널 매출’을 고르면 월별 그래프·표만 채널 net_sales_tab'} · 비교: 월평균 · 기본 작년 3분기(25Q3) 대비 · 숫자는 서버가 cost_v5.sqlite에서 바로 계산(읽기 전용) · ${V5.ST.ai&&V5.ST.ai.gemini?`AI는 ${V5.aiBadge()}(안 되면 서버 예시 답)`:'AI는 서버 예시 답변, Gemini 연결 없음'} · 1차 개발판 r6-dev(로컬 127.0.0.1) · 데스크톱 전용</div>`;

// ---------- 히트맵(r5): 단가(원재료 · 부재료=포장재/소모품 세부) · 계정 비용 · 채널×비용 · 업체 ----------
const M2=DB.mat2;const M2I=Object.fromEntries(M2.items.map(i=>[i.c,i]));
const SCOPE={raw:{l:'원재료',g:['ZIP_M'],secs:['농산물','가공','장류·양념','축산물','수산물','기타']},pack:{l:'부재료',g:['ZIP_S','ZIP_E'],secs:['포장재','소모품']}};
const BK=[['u2','+15% 이상'],['u1','+5~15%'],['z','±5%'],['d1','-5~-15%'],['d2','-15% 이하'],['n','비교 기간 없음']];
// r6: 비율 모드 색 = 매출 대비 비율 변화(%p) [추정 기준]
const PPB_HI=0.3,PPB_LO=0.05;
const BKP=[['u2','+'+PPB_HI+'%p 이상'],['u1','+'+PPB_LO+'~'+PPB_HI+'%p'],['z','±'+PPB_LO+'%p'],['d1','-'+PPB_LO+'~-'+PPB_HI+'%p'],['d2','-'+PPB_HI+'%p 이하'],['n','비교 기간 없음']];
const bucketP=c=>c==null?'n':c>=PPB_HI?'u2':c>=PPB_LO?'u1':c>-PPB_LO?'z':c>-PPB_HI?'d1':'d2';
const BKC={u2:'#B3261E',u1:'#E5746A',z:'#B0B4B9',d1:'#4FA383',d2:'#1B6E5A',n:'#E3E3E3'};
const bucket=c=>c==null?'n':c>=15?'u2':c>=5?'u1':c>-5?'z':c>-15?'d1':'d2';
const fg=k=>k==='z'||k==='n'?'#303030':'#fff';
const TOPMIN=500000; // TOP 목록은 이번 기간 50만원 이상만 [추정 기준]
const sumM=(m,ys)=>ys.reduce((a,y)=>{const v=m[y];if(v){a[0]+=v[0];a[1]+=v[1]}return a},[0,0]);
const sumA=(m,ys)=>ys.reduce((a,y)=>a+(m[y]||0),0);
// 단가: 수량이 있으면 금액 0도 진짜 0원(샘플 등). 비교 기간에 구매 수량이 없으면(줄 없음·취소로 0) 단가 자료 없음 = isNew(입력 필요)
function pchg(it,cmp){const C=CMP[cmp];const [ca,cq]=sumM(it.m,C.cur),[pa,pq]=sumM(it.m,C.prev);const cu=cq>0?ca/cq:null,pu=pq>0?pa/pq:null;return {ca,cq,pa,pq,cu,pu,chg:cu!=null&&pu>0?(cu/pu-1)*100:null,isNew:!(pq>0)};}
function heat(scope,cmp){const S=SCOPE[scope];const its=M2.items.filter(i=>S.g.includes(i.g)).map(i=>({...i,...pchg(i,cmp)})).filter(i=>i.ca>0);
 const avgOf=L=>{const c=L.filter(i=>i.chg!=null);const num=c.reduce((a,i)=>a+i.ca,0),den=c.reduce((a,i)=>a+i.cq*i.pu,0);return den?(num/den-1)*100:null};
 const secs=S.secs.map(s=>{const L=its.filter(i=>i.sec===s).sort((a,b)=>b.ca-a.ca);return {s,items:L,tot:L.reduce((a,i)=>a+i.ca,0),avg:avgOf(L)}}).filter(x=>x.items.length).sort((a,b)=>b.tot-a.tot);
 return {its,secs,tot:secs.reduce((a,x)=>a+x.tot,0),avg:avgOf(its)};}
const pctS=c=>c==null?'신규·비교불가':(c>0?'+':'')+c.toFixed(1)+'%';
const chgLbl=i=>i.chg!=null?pctS(i.chg):(i.isNew?ND:'비교불가');
function salesSum(ys,b){let t=0;for(const y of ys){const v=V5.salesM(y,b);if(v==null)return null;t+=v}return t;}
const amtOrPct=(a,ys)=>amtMode()?man(a):V5.pct(a,salesSum(ys));
// 계정 묶음 [추정]: DB에 묶음 기준 없음
// hq3: 경영지원 판관비 계정 묶음 [추정] - 인건비 묶음 코드는 서버(DB.mgmt.labor), 나머지는 계정 성격으로 나눴고 못 나눈 계정은 '경비'
const MGRP=()=>[['인건비',Object.keys(LABOR_M)],['업무·접대',['8111','8119','8128','8129','8289']],['시설·차량·에너지',['8239','8269','8279','8309','8310','8369','8409']],['외부 용역·수수료',['8139','8149','8159','8319','8329','8339']],['판촉·물류',['8338','8349','8379','8429']]];
const PGRP=[['재료비',['5028','5029']],['포장·물류',['5299','5369']],['설비·에너지',['5349','5209','5229','5230','5249','5390']],['인건비',['5039','5079','5100','5109']]];
const OGRP=[['광고·판촉',['광고선전비','판매촉진비']],['판매수수료',['판매수수료']],['물류',['운반비']],['외주·경비',['외주용역비']],['인건비 묶음',[BUNDLE]]];
function costItem(id,n,m,cmp,click,extra,smap){const x=cmpM(m,undefined,smap);return Object.assign({id,n,m,ca:x.ca,pa:x.pa,chg:x.r,pp:x.pp,rc:x.rc,rp:x.rp,isNew:x.nd,click},extra||{});}
function secOf(s,items){const C=CC();items=items.filter(i=>i.ca>0).sort((a,b)=>b.ca-a.ca);const c=items.filter(i=>i.chg!=null);const pa=c.reduce((a,i)=>a+i.pa,0)/C.prev.length,ca=c.reduce((a,i)=>a+i.ca,0)/C.cur.length;const pq=items.filter(i=>i.pp!=null);return {s,items,tot:items.reduce((a,i)=>a+i.ca,0),avg:pa?(ca/pa-1)*100:null,pp:pq.length?pq.reduce((a,i)=>a+i.pp,0):null,nd:items.length>0&&items.every(i=>i.isNew)};}
const chSales=ch=>ch==='ONLINE_COMMON'?OSALES.online:(OSALES.ch[ch]||{});
function vendAccounts(){if(isP())return Object.entries(PD.vend).map(([code,vs])=>({code,name:(ACCM[code]||{name:code}).name,vend:vs}));return DB.ovend;}
function hmKinds(){return st.div==='mgmt'?[['acc','계정 비용'],['vend','업체']]:st.div==='prod'?[['acc','계정 비용'],['price','원재료 단가'],['pack','부재료 단가'],['vend','업체']]:[['acc','계정 비용'],['ch','채널×비용'],['vend','업체']];}
function hmModel(){const k=st.hm,cmp=st.cmp,C=CC();let secs,title,note,kind='cost';
 if(k==='price'||k==='pack'){const H=heat(k==='price'?'raw':'pack',cmp);kind='price';title=(k==='price'?'원재료':'부재료')+' 단가';
  secs=H.secs.map(x=>({s:x.s,tot:x.tot,avg:x.avg,nd:x.items.every(i=>i.isNew),items:x.items.map(i=>({id:i.c,n:i.n,ca:i.ca,chg:i.chg,isNew:i.isNew,click:true,tip:`${i.n} · 단가 ${i.cu?f(i.cu):'-'}원 · ${chgLbl(i)} · 구매 ${f(i.ca)}원`}))}));
  note=(k==='price'?'분류: item_group ZIP_M + 이름 키워드 세부 분류 [추정]':'분류: 재고수불부 시트 기준 부재료(포장재·소모성 자재 전부) · 아래 포장재·소모품 묶음은 세부(참고)')+' · 색 = 단가 등락(%) · 단가는 매출과 무관해 비율 모드에서도 %로 칠해요 · 비교 기간에 구매가 없으면 비교 기간 없음';}
 else if(k==='acc'&&isP()){const GR=st.div==='mgmt'?MGRP():PGRP;title=st.div==='mgmt'?'경영지원 계정 비용':'생산 계정 비용';const used=new Set(GR.flatMap(g=>g[1]));
  secs=GR.concat([['경비',PD.acc.map(a=>a.code).filter(c=>!used.has(c))]]).map(([g,codes])=>{if(g==='인건비'){const m={};codes.forEach(c=>Object.entries((ACCM[c]||{m:{}}).m).forEach(([y,v])=>m[y]=(m[y]||0)+v));return secOf(g,codes.some(c=>ACCM[c])?[costItem('LABOR',`인건비 묶음(${codes.filter(c=>ACCM[c]).length}개 계정)`,m,cmp,false)]:[]);}
   return secOf(g,codes.filter(c=>ACCM[c]).map(c=>costItem(c,ACCM[c].name,ACCM[c].m,cmp,true)));});
  note='계정 묶음은 DB에 기준이 없어 계정 성격으로 나눴어요 [추정] · 인건비는 한 칸(상세·AI 제외)';}
 else if(k==='acc'){title='온라인 계정 비용';const V=view();
  secs=OGRP.map(([g,its])=>secOf(g,its.map(it=>it===BUNDLE?costItem(BUNDLE,BUNDLE,(()=>{const o={};V.filter(l=>l.g===BUNDLE).forEach(l=>o[l.ym]=(o[l.ym]||0)+l.amt);return o})(),cmp,false):costItem(it,it,oMonthly(V,'ALL',it),cmp,true))));
  note=`항목 묶음은 DB에 기준이 없어 성격으로 나눴어요 [추정] · 인건비 묶음은 한 칸(상세·AI 제외) · 비율은 ${OBL} 대비`;}
 else if(k==='ch'){title='채널×비용';const V=view();
  // U2: 칸·분류·TOP 모두 온라인 매출 대비(합계·워터폴·시그널과 같은 분모). 예전엔 칸마다 그 채널 매출(net_sales_tab)이라 합계와 기준이 달랐어요
  const OS=OSALES.online;secs=CH.map(([id,n])=>secOf(n,OITEMS.map(it=>costItem(id+'|'+it,it,oMonthly(V,id,it),cmp,true,{ch:id,item:it},OS)).concat([costItem(id+'|B',BUNDLE,(()=>{const o={};V.filter(l=>l.eff===id&&l.g===BUNDLE).forEach(l=>o[l.ym]=(o[l.ym]||0)+l.amt);return o})(),cmp,false,null,OS)])));
  note=`채널 = 분류 박스, 칸 = 비용 항목 · 채널 이동이 반영돼요 · 비율은 모두 ${OBL} 대비(워터폴·시그널과 같은 기준)라 분류 비율 변화를 더하면 합계와 같아요`;}
 else {title=({prod:'생산',mgmt:'경영지원'}[st.div]||'온라인')+' 업체';
  secs=vendAccounts().map(a=>secOf(a.name,a.vend.map(v=>costItem(a.code+'|'+v.code,v.name,v.m,cmp,true,{acc:a.code,vc:v.code}))));
  note='업체 원장(fact_ledger_line)이 있는 계정만 · 분류 박스 = 계정'+(st.div==='online'?` · 비율은 ${OBL} 대비`:'');}
 secs=secs.filter(x=>x.items.length).sort((a,b)=>b.tot-a.tot);
 if(secs.some(x=>x.items.some(i=>i.isNew)))note+=` · ${C.pl} 비교 기간 없는 칸은 회색(비교 기간 없음)이고 분류·합계 증감과 TOP 순위에서 빼요`;
 const pm=kind==='cost'&&!amtMode();
 secs.forEach(x=>{x.cv=pm?x.pp:x.avg;x.items.forEach(i=>{i.cv=pm?i.pp:i.chg;if(!i.tip)i.tip=`${i.n} · ${C.cl} 월평균 ${f(i.ca/C.cur.length)}원 · ${i.isNew?`${C.pl} 비교 기간 없음 · 증감·색에서 빼요`:`${C.pl} 월평균 ${f((i.pa||0)/C.prev.length)}원 · ${chgLbl(i)}`}${i.pp!=null?` · ${st.div==='online'?OBL:'매출'} 대비 ${i.rp.toFixed(2)}% → ${i.rc.toFixed(2)}% (${ppS(i.pp)})`:''}`})});
 const all=secs.flatMap(x=>x.items);const tot=secs.reduce((a,x)=>a+x.tot,0);
 let avg,pp=null;if(kind==='price'){avg=heat(k==='price'?'raw':'pack',cmp).avg}else{const c=all.filter(i=>i.chg!=null);const pa=c.reduce((a,i)=>a+i.pa,0)/C.prev.length,ca=c.reduce((a,i)=>a+i.ca,0)/C.cur.length;avg=pa?(ca/pa-1)*100:null;
  const cm=all.filter(i=>!i.isNew);// 합계 비율 변화도 비교 자료 있는 칸만(금액 등락과 같은 기준)
  const sc=salesSum(C.cur),sp=salesSum(C.prev),ta=cm.reduce((a,i)=>a+i.ca,0),tp=cm.reduce((a,i)=>a+(i.pa||0),0);pp=sc&&sp&&cm.length?ta/sc*100-tp/sp*100:null;}
 return {k,kind,title,note,secs,all,tot,avg,pp,pm,bf:pm?bucketP:bucket,lab:pm?(i=>i.isNew?ND:i.pp==null?'줄 없음':ppS(i.pp)):chgLbl,cvS:pm?ppS:pctS};}
function squarify(items,x,y,w,h){const out=[];const total=items.reduce((a,b)=>a+b.v,0);if(!total||w<=0||h<=0)return out;const sc=w*h/total;let r=items.map(it=>({it,a:it.v*sc}));
 while(r.length){const sh=Math.min(w,h);const worst=row=>{const s=row.reduce((a,b)=>a+b.a,0);const mx=Math.max(...row.map(q=>q.a)),mn=Math.min(...row.map(q=>q.a));return Math.max(sh*sh*mx/(s*s),(s*s)/(sh*sh*mn))};
  let row=[r[0]],i=1;while(i<r.length&&worst(row.concat([r[i]]))<=worst(row)){row.push(r[i]);i++}const s=row.reduce((a,b)=>a+b.a,0);
  if(w>=h){const cw=s/h;let cy=y;row.forEach(q=>{const ch=q.a/cw;out.push({it:q.it,x,y:cy,w:cw,h:ch});cy+=ch});x+=cw;w-=cw;}
  else{const rh=s/w;let cx=x;row.forEach(q=>{const cw2=q.a/rh;out.push({it:q.it,x:cx,y,w:cw2,h:rh});cx+=cw2});y+=rh;h-=rh;}
  r=r.slice(i);}return out;}
function drawTM(){const el=document.getElementById('tm');if(!el)return;const H=hmModel();const W=el.clientWidth,HH=el.clientHeight;const C=CC();
 const S=squarify(H.secs.map(x=>({v:x.tot,sec:x})),0,0,W,HH);let html='';
 S.forEach(b=>{const x=b.it.sec;const ix=squarify(x.items.map(i=>({v:i.ca,i})),0,28,b.w-4,b.h-32);const bk=H.bf(x.cv);
  html+=`<div class="tm-s" data-sec="${esc(x.s)}" data-cv="${x.cv==null?'':x.cv.toFixed(4)}" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px" title="${esc(x.s)} · ${f(x.tot)}원 · 금액 ${x.avg==null?'-':pctS(x.avg)}${x.pp!=null?' · 비율 '+ppS(x.pp):''}${x.cv==null&&x.nd?' · '+ND:''}"><div class="tm-sh"><span class="sn">${esc(x.s)}</span> <span class="sa num">${amtOrPct(x.tot,C.cur)}</span><span class="pp" style="background:${BKC[bk]};color:${fg(bk)}">${x.cv==null?(x.nd&&b.w>=130?ND:'-'):H.cvS(x.cv)}</span></div>`+
  ix.map(r=>{const i=r.it.i;const k=H.bf(i.cv);const big=r.w>=130&&r.h>=64,lab=r.w>=60&&r.h>=34;return `<button class="tm-r bk-${k}${big?' lg':''}${i.click?'':' nock'}" data-tm="${esc(i.id)}" data-bk="${k}" data-u="${H.pm?'pp':'pct'}" data-cv="${i.cv==null?'':i.cv.toFixed(4)}" data-chg="${i.chg==null?'':i.chg.toFixed(3)}" data-amt="${i.ca}" data-area="${(r.w*r.h).toFixed(1)}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px" title="${esc(i.tip)}${i.click?'':' · 상세 없음(인건비 묶음)'}" aria-label="${esc(x.s)} · ${esc(i.n)} · ${esc(H.lab(i))}${i.click?'':' · 상세 없음'}"${i.click?'':' aria-disabled="true"'}>${lab?`<span class="tn">${esc(i.n)}</span><span class="tc num">${H.lab(i)}</span>`:''}</button>`}).join('')+`</div>`;});
 el.innerHTML=html;el.querySelectorAll('[data-tm]').forEach(b=>{if(!b.classList.contains('nock'))b.onclick=()=>hmClick(b.dataset.tm)});}
function hmClick(id){const k=st.hm;
 if(k==='price'||k==='pack')return openPrice(id);
 if(k==='acc')return go({s:2,a:id,n:null,ch:null,hm:null});
 if(k==='ch'){const [ch,it]=id.split('|');st.pendOpen=['lines','month'];return go({s:3,a:it,ch,hm:null});}
 const [acc,vc]=id.split('|');st.pendOpen=['vmonth'];return go({s:3,a:'vd',va:acc,vv:vc,hm:null});}
function openPrice(code){st.pendOpen=['pmonth'];go({s:3,a:'price',pm:code,hm:null});}
function hmSide(H){const ok=H.all.filter(i=>i.cv!=null&&i.ca>=TOPMIN&&i.click);const up=ok.filter(i=>i.cv>0).sort((a,b)=>b.cv-a.cv).slice(0,5),dn=ok.filter(i=>i.cv<0).sort((a,b)=>a.cv-b.cv).slice(0,5);
 const pill=(c,nd)=>{const k=H.bf(c);return `<span class="pp" style="background:${BKC[k]};color:${fg(k)}">${c==null?(nd?ND:'-'):H.cvS(c)}</span>`};
 const nds=H.all.filter(i=>i.isNew&&i.ca>=TOPMIN&&i.click).length;
 const lst=(L,none)=>L.length?L.map(i=>`<button class="tm-row" data-tm2="${esc(i.id)}" title="${esc(i.tip)}"><span class="rn">${esc(i.n)}</span>${pill(i.cv)}</button>`).join(''):`<div class="empty">${none}</div>`;
 const w=H.pm?'비율':'';return `<div class="tm-side3" id="tmSide"><div class="tm-card"><div class="ct">분류별 ${H.pm?'비율 변화':'등락률'}</div>${H.secs.map(x=>`<div class="tm-row" title="${esc(x.s)} ${f(x.tot)}원"><span class="rn">${esc(x.s)}</span>${pill(x.cv,x.nd)}</div>`).join('')||'<div class="empty">분류가 없어요</div>'}</div>
 <div class="tm-card" id="topUp"><div class="ct">${w||'상승률'} ${w?'상승 ':''}TOP</div>${lst(up,`${CC().pl}보다 오른 칸이 없어요`)}</div><div class="tm-card" id="topDn"><div class="ct">${w||'하락률'} ${w?'하락 ':''}TOP</div>${lst(dn,`${CC().pl}보다 내린 칸이 없어요`)}${nds?`<div class="sub" id="topNd" style="margin-top:8px">${CC().pl} 비교 기간 없는 ${nds}칸은 ${ND}이라 순위에서 뺐어요</div>`:''}</div></div>`;}
function hmView(){const H=hmModel();const C=CC();
 return `${guide(!H.secs.length?`이 히트맵은 그릴 칸이 없어요. 위에서 다른 종류를 골라 보세요.`:H.pm?`칸 색이 진한 빨강일수록 ${st.div==='online'?OBL:'매출'} 대비 비율이 많이 올랐어요. 칸을 누르면 다음 단계로 가요.`:`칸 색이 진한 빨강일수록 많이 늘었어요. 칸을 누르면 다음 단계로 가요.`,'')}
 <div class="vhead"><div><div class="pg-eyebrow">${divName()} · 히트맵 · ${C.s}</div><div class="pg-h">${esc(H.title)} <span class="pg-n num" id="heatSum" title="${C.cl} 합계 ${f(H.tot)}원 · 금액 ${pctS(H.avg)}">${amtMode()?man(H.tot)+' · '+pctS(H.avg):V5.pct(H.tot,salesSum(C.cur))+' · '+(H.kind==='cost'?ppS(H.pp):'단가 '+pctS(H.avg))}</span></div></div>${viewSeg()}</div>
 <div class="hmkinds" id="hmKinds">${hmKinds().map(([k,l])=>`<button class="chipb${st.hm===k?' on':''}" data-hm="${k}">${l}</button>`).join('')}</div>
 <div class="tm-ctrl"><span class="vtl">보조</span>${auxSeg()}
 <span class="tm-leg" id="tmLeg">${(H.pm?BKP:BK).map(([k,l])=>`<span><i style="background:${BKC[k]}"></i>${l}</span>`).join('')}</span><span class="tm-size" id="tmSize">크기 = ${C.cl} ${H.kind==='price'?'구매금액':'금액'} · 색 = ${H.pm?`${st.div==='online'?OBL:'매출'} 대비 비율 변화(%p)`:H.kind==='price'?'단가 등락':'금액 등락(월평균)'}</span></div>
 ${H.secs.length?'<div id="tm"></div>':emptyBox('tmEmpty','이 히트맵에 그릴 칸이 없어요',`${C.cl} 금액이 있는 항목이 없어요. 다른 히트맵 종류나 비교 기준을 골라 보세요.`)}${hmSide(H)}<div class="exnote">${esc(H.note)}</div>`;}
function priceIssue(){const H=heat('raw',st.cmp);const imp=H.its.filter(i=>i.chg!=null&&i.cu>i.pu).map(i=>({...i,imp:i.cq*(i.cu-i.pu)})).sort((a,b)=>b.imp-a.imp);
 const m={};M2.items.filter(i=>i.g==='ZIP_M').forEach(i=>Object.entries(i.m).forEach(([y,v])=>m[y]=(m[y]||0)+v[0]));
 return {id:'price',title:'원재료 단가',code:'ZIP_M',H,imp,n15:H.its.filter(i=>i.chg!=null&&i.chg>=15).length,m,c:tots(m),drivers:[],dl:'자재'};}
function priceRow(){const pi=priceIssue();const po=st.open.has('im-price');const top=po?pi.imp:pi.imp.slice(0,2);
 return `<div class="issue" id="priceIssue"><button class="icard" data-price="1"><span class="rank">·</span><span class="ibody"><span class="ititle">원재료 단가</span><div class="ireason">${pi.H.its.length?`${pi.n15}개 자재 +15% 이상 · ${CC().s}`:`${CC().cl} 원재료 구매 줄 없음`}</div><div class="ikey num">${pi.H.its.length?'평균 '+pctS(pi.H.avg):'-'}</div></span><span class="chev">›</span></button>
 <div class="arw"></div><div class="imp">${top.map(i=>`<div class="ir" title="${esc(i.n)} ${f(i.pu)}→${f(i.cu)}원"><span class="nm2">${esc(i.n)}</span><span class="dv num">${pctS(i.chg)}</span></div>`).join('')||'<div class="ir" id="priceNone"><span class="dv">단가가 오른 원재료가 없어요</span></div>'}${pi.imp.length>2?`<button class="im" data-imore="price" aria-expanded="${po}">${po?'접기':(pi.imp.length-2)+'개 더보기'}</button>`:''}</div></div>`;}
function pItem(){return M2I[st.pm]||heat(st.scope,st.cmp).its[0];}
const PMON3={'25Q3':['2507','2508','2509'],'26H1':['2601','2602','2603','2604','2605','2606'],'26Q3':['2607','2608','2609']};
function uOf(m,ys){const [a,q]=sumM(m,ys);return q>0?a/q:null;}
function priceTiles(it){const u={};Object.keys(PMON3).forEach(p=>u[p]=uOf(it.m,PMON3[p]));const cu=u['26Q3'];
 const tile=(p,k)=>{const v=u[p];const ch=v>0&&cu!=null?(cu/v-1)*100:null;return `<button class="pt3${st.cmp===k?' on':''}" data-cmp="${k}" id="pt-${k}" title="${PL[p]} 가중 단가(공급가액 합÷수량 합)${v!=null?'':' · 이 기간 구매 없음'}"><span class="k">${PL[p]} 단가</span><span class="v num">${v!=null?f(v)+'원':'줄 없음'}</span><span class="d num" id="pchg-${k}">${ch!=null?'2026 Q3 '+pctS(ch):v===0?'0원이라 등락률 계산 안 해요':'비교 기간 없음'}</span></button>`};
 return `<div class="ptiles" id="pTiles">${tile('25Q3','q3')}${tile('26H1','h1')}<div class="pt3 cur"><span class="k">2026 Q3 단가</span><span class="v num">${cu!=null?f(cu)+'원':'줄 없음'}</span><span class="d">${it.u?esc(it.u)+'당':'단위 없음'}</span></div></div>`;}
function stepPriceDrill(){const it=pItem();const c=pchg(it,st.cmp);const C=CC();
 const ms=V5.MONTHS.filter(Boolean);const up={};ms.forEach(y=>{const v=it.m[y];if(v&&v[1]>0)up[y]=v[0]/v[1]});
 const mxY=Object.keys(up).sort((a,b)=>up[b]-up[a])[0];
 const mrows=ms.map((y,k)=>{const v=it.m[y];const pv=k&&y!=='2601'?up[ms[k-1]]:null;const u=up[y];return `<tr><td class="num l">${ym2(y)}</td><td class="num">${v?f(v[1]):'-'}</td><td class="num strong">${u!=null?f(u):'-'}</td><td class="num">${v?V5.vYm(v[0],y):'-'}</td><td class="num">${u!=null&&pv>0?pctS((u/pv-1)*100):'-'}</td></tr>`}).join('');
 const pm=acc('pmonth','월별 단가·수량',`12개월 · 가장 비싼 달 ${mxY?ym2(mxY)+' '+f(up[mxY])+'원':'-'}`,V5.chart('월별 단가','원 / '+(it.u||'단위 없음')+' · 공급가액 ÷ 수량',up)+`<table class="tbl sm" id="pmTbl"><thead><tr><th>월</th><th class="num">수량</th><th class="num">단가(원)</th><th class="num">${amtMode()?'금액(원)':'비율 · '+V5.basisLabel()}</th><th class="num">전월 대비</th></tr></thead><tbody>${mrows}</tbody></table>`);
 const vs=Object.entries(it.v).map(([vc,m])=>{const x=pchg({m},st.cmp);return {vc,n:M2.vn[vc]||vc,...x}}).filter(x=>x.ca>0||x.pa>0).sort((a,b)=>b.ca-a.ca);
 const pv=acc('pvend','업체별 단가',`${vs.length}곳`,`<table class="tbl sm" id="pvTbl"><thead><tr><th>업체</th><th class="num">${C.pl} 단가</th><th class="num">${C.cl} 단가</th><th class="num">등락</th><th class="num">${C.cl} ${amtMode()?'금액':'비율'}</th></tr></thead><tbody>${vs.length?'':`<tr><td colspan="5" class="sub" id="pvNone">${C.pl}·${C.cl}에 이 자재를 산 업체가 없어요</td></tr>`}${vs.map(x=>`<tr${x.isNew?` class="ndrow" title="${C.pl} 구매 줄 없음 · 등락 계산에서 빼요"`:''}><td>${esc(x.n)}</td><td class="num">${x.pu!=null?f(x.pu):x.isNew?ND:'-'}</td><td class="num strong">${x.cu!=null?f(x.cu):'-'}</td><td class="num">${x.chg!=null?pctS(x.chg):(x.isNew?ND:'비교불가')}</td><td class="num">${x.ca?amtOrPct(x.ca,C.cur):'-'}</td></tr>`).join('')}</tbody></table>`);
 const H=heat(SCOPE.raw.g.includes(it.g)?'raw':'pack',st.cmp);const sec=H.secs.find(x=>x.s===it.sec);
 const ps=acc('psame','같은 분류 다른 자재',sec?`${esc(sec.s)} ${sec.items.length}개 · 평균 ${pctS(sec.avg)}`:'-',sec?sec.items.slice(0,12).map(i=>`<button class="tm-row" data-tm2="${i.c}"><span class="rn">${esc(i.n)} <span class="sub">${amtOrPct(i.ca,C.cur)}</span></span><span class="pp" style="background:${BKC[bucket(i.chg)]};color:${['z','n'].includes(bucket(i.chg))?'#303030':'#fff'}">${chgLbl(i)}</span></button>`).join(''):'<div class="empty">같은 분류 다른 자재가 없어요</div>');
 return `${guide(`필요한 표만 펼쳐 봐요. 오른쪽 AI 창에서 바로 절감 계획을 만들 수 있어요.`,prevBtn()+nextBtn('계획 확인'))}
 <div><button class="linkbtn" id="backHeat" style="font-size:14px;color:#616161">‹ 단가 히트맵</button></div>
 <div><div class="pg-eyebrow">생산본부 · 자재 단가 · ${esc(it.sec)} [${SCOPE.raw.g.includes(it.g)&&it.sec!=='기타'?'추정 분류':'item_group'}]</div><div class="pg-h" id="priceTitle">${esc(it.n)}</div>
 <div class="s2key num" id="priceSum" title="${C.cl} ${f(c.cq)} ${esc(it.u||'개')} · ${f(c.ca)}원">${chgLbl(c)} <span class="sub">${C.s}</span></div></div>
 ${priceTiles(it)}
 <div class="tm-ctrl"><span class="vtl">보조</span>${auxSeg()}</div>
 ${sigBlock([matSig(it)],'자재 단가 → 영향')}
 <div class="accs">${pm}${pv}${ps}</div>`;}
// ---------- 1단계 ----------
function step1(){const I=issues();const top=I.slice(0,3),rest=I.slice(3);
 const tm=isP()?prodMonthly():oMonthly(view(),'ALL',null,true);const tc=tots(tm);
 const NDI=issues(true).filter(i=>i.nd);// 비교 기간 비교 기간 없는 계정·항목: 순위에서 빼고 따로 알림
 const dec=(isP()?PD.acc.filter(a=>!LABOR[a.code]).length:OITEMS.length)-I.length-NDI.length;
 const row=(i,k)=>{const top2=i.drivers.filter(dUp).slice(0,2);const nod=i.drivers.filter(d=>d.nd&&(d.x.ca||0)!==0);const restN=i.drivers.length-top2.length-nod.length;
  const io=st.open.has('im-'+i.id);const shown=io?top2.concat(i.drivers.filter(d=>!top2.includes(d)&&!nod.includes(d))):top2;// R6ND-14: 'n개 더보기'를 누르면 나머지도 펼쳐요(시그널과 같은 동작)
  const ndRow=nod.length?`<div class="ir ndr" title="${esc(nod.map(d=>d.name).join(', '))} · ${CC().pl}에 줄이 없어 증감·순위에서 빼요"><span class="nm2">${CC().pl} 비교 기간 없는 ${i.dl} ${nod.length}곳</span><span class="dv">${ND}</span></div>`:'';
  return `<div class="issue"><button class="icard" data-issue="${esc(i.id)}"><span class="rank">${k+1}</span><span class="ibody"><span class="ititle">${esc(i.title)} <span class="code">${i.code}</span></span><div class="ireason">${esc(reasonTxt(i))}</div><div class="ikey num">${keyTxt(i)}</div></span><span class="chev">›</span></button>
  <div class="arw"></div><div class="imp">${i.drivers.length?shown.map(d=>`<div class="ir"><span class="nm2">${esc(d.name)}</span><span class="dv num">${dTxt(d)}</span></div>`).join('')+ndRow+(restN>0?`<button class="im" data-imore="${esc(i.id)}" aria-expanded="${io}">${io?'접기':restN+'개 더보기'}</button>`:''):(i.code==='5028'?`<button class="linkbtn" data-price="1" style="font-size:14px;text-align:left">원재료 단가 히트맵에서 자재별로 봐요 ›</button><div class="im">원장 업체 줄은 없고 구매현황은 있어요</div>`:`<div class="ir"><span class="dv">${i.dl} 비교 기간 없음</span></div>`)}</div></div>`;};
 return `${guide(I.length?`늘어난 비용 중 먼저 볼 하나를 눌러요. 1위부터 보면 돼요.`:`지금은 늘어난 비용 이슈가 없어요. 히트맵에서 전체 비용을 볼 수 있어요.`,I.length?`<button class="btn pri sm" id="nextBtn" data-issue="${esc(I[0].id)}">1위 ${esc(I[0].title)} 보기 →</button>`:'<button class="btn sec sm" data-view="hm">히트맵 보기</button>')}
 <div class="vhead"><div><div class="pg-eyebrow">비용관리가 찾았어요 · Z-IPS 2609 마감</div><div class="pg-h">지금 살펴볼 비용 이슈</div>
 <div class="pg-s" id="divSum" title="인건비 묶음 제외 · ${CC().cl} vs ${CC().pl} 월평균">${divName()} ${amtMode()?'월평균 '+man(tc['26Q3']/3):V5.basisLabel()+' 대비 '+vPb(tc['26Q3'],'26Q3')} · ${dPb(tm)} <span class="sub">${CC().s}</span></div></div>${viewSeg()}</div>
 <div class="sortseg"><span class="seg" id="sortSeg"><button data-sort="amt" class="${st.sort==='amt'?'on':''}">증가폭 순</button><button data-sort="rate" class="${st.sort==='rate'?'on':''}">증가율 순</button></span><span class="sub" id="sortSub">${CC().cl} vs ${CC().pl} 월평균 · 오른쪽 ${I[0]?I[0].dl:''}별 영향${onR()?` · 비율은 모두 ${OBL} 기준`:''}</span></div>
 <div class="issues" id="issueList">${I.length?'':emptyBox('issuesEmpty',`${CC().pl}보다 늘어난 ${isP()?'계정':'항목'}이 없어요`,`${CC().cl} 월평균이 모두 그대로이거나 줄었어요. 위에서 비교 기준을 바꾸면 다른 기간과 비교해 볼 수 있어요.`)}${top.map(row).join('')}${st.more?rest.map((i,k)=>row(i,k+3)).join(''):''}
 ${rest.length?`<button class="morebtn" id="moreIssues" aria-expanded="${st.more}">${st.more?'접기':`다른 이슈 ${rest.length}개 더보기`}</button>`:''}</div>
 ${st.div==='prod'?'<div class="sect-h" style="font-size:17px">단가 이슈</div>'+priceRow():''}${st.div==='mgmt'?ccEntry():''}
 <div class="exnote">${st.div==='prod'?'인건비 묶음(급여·잡급·퇴직연금·복리후생비)은 이 목록과 AI에서 빼요.':st.div==='mgmt'?'인건비 묶음(직원급여·퇴직연금·복리후생비)은 이 목록과 AI에서 빼요.':'‘인건비 + 기타 직접비’ 묶음은 이 목록과 AI에서 빼요.'} 줄었거나 그대로인 ${isP()?'계정':'항목'} ${dec}개는 목록에 없어요.${NDI.length?` <span id="ndIssues">${CC().pl} 비교 기간 없는 ${isP()?'계정':'항목'} ${NDI.length}개(${esc(NDI.map(i=>i.title).join(', '))})는 ${ND}이라 순위에서 뺐어요.</span>`:''}</div>`;}
// ---------- 2단계(r5): 제목 + 핵심 수치 1개 + 스파크라인 + 워터폴(클릭 → 3단계) ----------
const manK=n=>{const a=Math.abs(n);const s=n<0?'-':'+';return a>=1e8?s+(a/1e8).toFixed(1)+'억':a>=1e4?s+f(a/1e4)+'만':s+f(a)};
function spark(m,id){const ys=V5.MONTHS;const vals=ys.filter(Boolean).map(y=>m[y]||0);const mx=Math.max(...vals)||1;
 // U8: 글자 없는 작은 막대 그래프 → 그림 하나 + 달별 값 이름(막대 툴팁과 같은 값)
 const al='월별 흐름 작은 그래프 · '+ys.filter(Boolean).map(y=>`${ym2(y)} ${amtMode()?f(m[y]||0)+'원':V5.vYm(m[y]||0,y).replace(/<[^>]*>/g,'')}`).join(', ');
 return `<div class="spark" id="${id||'spark'}" role="img" aria-label="${esc(al)}">${ys.map(y=>{if(!y)return '<span class="sp gap" title="25.10~12 비교 기간 없음"></span>';const v=m[y]||0;const r=per(y);return `<span class="sp ${r==='26Q3'?'cur':r==='26H1'?'h1':'q3'}" style="height:${Math.max(2,Math.round(v/mx*40))}px" title="${ym2(y)} ${amtMode()?f(v)+'원':V5.vYm(v,y)}"></span>`}).join('')}</div>`;}
function wfData(i){// 금액: 월평균 / 비율: %p · r6: 비교 기간 선택 반영
 const amt=amtMode();const x=i.x||cmpM(i.m);
 const start=amt?x.ap:x.rp,end=amt?x.ac:x.rc;
 if(start==null||end==null)return null;
 const ds=i.drivers.filter(d=>!d.x.nd).map(d=>({id:d.id,n:d.name,v:amt?d.x.d:d.x.pp,c:d.c})).filter(d=>d.v!=null&&Math.abs(d.v)>(amt?1:0.0005)).sort((a,b)=>Math.abs(b.v)-Math.abs(a.v));
 const top=ds.slice(0,5),rest=ds.slice(5);const cols=top.slice();
 if(rest.length)cols.push({id:'__rest',n:`기타 ${rest.length}곳`,v:rest.reduce((a,d)=>a+d.v,0),rest});
 // 비교 기간 비교 기간 없는 업체·채널: 증감이 아니라 이번 기간 값만 있어 한 칸(입력 필요)으로 모아 끝을 맞춘다
 const nod=i.drivers.filter(d=>d.x.nd&&(d.x.ca||0)!==0);const nv=nod.reduce((a,d)=>a+(amt?d.x.ac:(d.x.rc||0)),0);
 if(nod.length&&Math.abs(nv)>(amt?1:0.0005))cols.push({id:'__nod',n:`${CC().pl} 비교 기간 없음 ${nod.length}곳`,v:nv,resid:true,nd:true,tip:`${nod.map(d=>d.name).join(', ')} · ${CC().pl}에 줄이 없어 증감으로 세지 않아요 · ${CC().cl} ${amt?'월평균 '+f(nv)+'원':nv.toFixed(2)+'%'} (${ND})`});
 const resid=(end-start)-ds.reduce((a,d)=>a+d.v,0)-(cols.some(c=>c.nd)?nv:0);if(Math.abs(resid)>(amt?1:0.0005))cols.push({id:'__resid',n:i.drivers.length?'원장 외 차이':`${i.dl} 비교 기간 없음`,v:resid,resid:true});
 return {amt,start,end,cols,rest};}
function waterfall(i){const W=wfData(i);if(!W)return `<div class="empty">${(i.x||cmpM(i.m)).nd?`${CC().pl} 비교 기간이 없어 증감을 그릴 수 없어요(${ND})`:V5.NOS}</div>`;
 let run=W.start;const pts=[W.start,W.end];W.cols.forEach(c=>{run+=c.v;pts.push(run)});const mn=Math.min(...pts),mx=Math.max(...pts);const lo=Math.max(0,mn-(mx-mn)*0.6),hi=mx+(mx-mn)*0.1||1;const Hh=160;const y=v=>Math.round((v-lo)/(hi-lo)*Hh);
 const lab=v=>W.amt?(Math.abs(v)>=1e4?man(Math.abs(v)).replace('원',''):f(v)):v.toFixed(1)+'%';const dl=v=>W.amt?manK(v):ppS(v);const C=CC();
 const col=(cls,b,t,txt,name,attrs,tip)=>`<button class="wf-c ${cls}" ${attrs||''} title="${esc(tip)}"><span class="wf-v num">${txt}</span><span class="wf-a"><span class="wf-b" style="bottom:${b}px;height:${Math.max(2,t)}px"></span></span><span class="wf-n">${esc(name)}</span></button>`;
 let h=col('tot',0,y(W.start),lab(W.start),C.pl,'disabled',`${C.pl} ${W.amt?'월평균 '+f(W.start)+'원':W.start.toFixed(2)+'%'}`);run=W.start;
 W.cols.forEach(c=>{const a=run,b=run+c.v;run=b;const up=c.v>=0;h+=col((up?'up':'dn')+(c.resid?' resid':'')+(c.nd?' nod':''),y(Math.min(a,b)),Math.abs(y(b)-y(a)),c.nd?ND:dl(c.v),c.n,c.resid?(c.nd?'disabled data-nod="1"':'disabled'):`data-wf="${esc(c.id)}"`,c.tip||`${c.n} ${dl(c.v)}${c.resid?'':c.rest?' · 누르면 펼쳐져요':' · 누르면 3단계 상세'}`)});// r7 P3: 누를 수 없는 차이 막대(원장 외 차이·○○ 자료 없음)는 '누르면 3단계 상세'라고 하지 않아요
 h+=col('tot end',0,y(W.end),lab(W.end),C.cl,'disabled',`${C.cl} ${W.amt?'월평균 '+f(W.end)+'원':W.end.toFixed(2)+'%'}`);
 const restList=W.rest.length&&st.open.has('rest')?`<div class="wf-rest" id="wfRest">${W.rest.map(d=>`<button class="tm-row" data-wf="${esc(d.id)}" title="${esc(d.n)}"><span class="rn">${esc(d.n)}</span><span class="num">${dl(d.v)}</span></button>`).join('')}</div>`:'';
 return `<div class="wf" id="waterfall">${h}</div>${lo>0?'<div class="wf-ax">세로축은 0부터가 아니에요</div>':''}${restList}${wfCheck(W)}`;}
// r13 c7: 막대 합계 검산 한 줄(운반비처럼 '자료 없음' 칸이 끼면 막대 숫자를 더해도 끝 값과 달라 보였어요)
function wfCheck(W){const S=v=>W.amt?f(Math.abs(v))+'원':Math.abs(v).toFixed(2)+(W.amt?'':'%p'),T=v=>W.amt?f(v)+'원':v.toFixed(2)+'%';const sg2=v=>(v<0?'−':'+')+S(v);
 const mv=W.cols.filter(c=>!c.nd&&!c.resid),nd=W.cols.find(c=>c.nd),rs=W.cols.find(c=>c.resid&&!c.nd);
 const sum=mv.reduce((a,c)=>a+c.v,0);
 return `<div class="wf-chk num" id="wfChk">검산 · ${CC().pl} ${T(W.start)} ${sg2(sum)}(막대 ${mv.length}개 합)${nd?` + ${nd.n.replace(CC().pl+' ','')}의 ${CC().cl} 몫 ${T(nd.v)}`:''}${rs?` ${sg2(rs.v)}(${rs.n})`:''} = ${CC().cl} ${T(W.end)}${nd?' · 비교 기간 없는 칸은 비교 기간 값이 없어 증감 대신 이번 기간 값을 그대로 더해요':''} · 소수 반올림으로 ±0.1 어긋날 수 있어요</div>`;}
function microChips(i){const mv=i.m;const mx=Object.keys(mv).sort((a,b)=>mv[b]-mv[a])[0];const ch=[];
 ch.push(['▲',`최대 ${ym2(mx)}`,`가장 큰 달 ${ym2(mx)} ${f(mv[mx])}원`]);
 const op=st.cmp==='q3'?'26H1':'25Q3';if(hasY(i.m,PMON3[op])){const dOp=i.c['26Q3']/3-i.c[op]/PMN[op];ch.push(['↔',`${op} ${manK(dOp)}`,`${PL[op]} 월평균 ${f(i.c[op]/PMN[op])}원 대비 ${sg(dOp)}원(다른 비교 기준)`]);}
 else ch.push(['↔',`${op} ${ND}`,`${PL[op]} 비교 기간 없음 · 다른 비교 기준으로는 증감을 계산하지 않아요`]);
 const b=V5.salesP('26Q3',isP()?'prod':'online');if(b)ch.push(['%',`${st.div==='online'?OBL:'매출'} 대비 ${(i.c['26Q3']/b*100).toFixed(1)}%`,`${isP()?'생산매출':OBL} 대비 2026 Q3`]);
 if(isP()&&i.drivers.length){const lg=i.drivers.reduce((a,d)=>a+d.c['26Q3'],0);const df=Math.round(lg-i.c['26Q3']);if(df)ch.push(['!',`원장≠마감 ${manK(df)}`,`2026 Q3 원장 ${f(lg)}원 / 마감 ${f(i.c['26Q3'])}원 · 확인 필요`]);
  const rs=(PD.mat[i.code]||[]).filter(m=>{const r=priceRise(m);return (!i.vd||m.vendor===i.vd)&&r&&r.to>r.from});/* U4: 업체 상세 2단계면 그 업체 자재만 */if(rs.length)ch.push(['₩',`단가↑ ${rs.length}개`,rs.slice(0,5).map(m=>{const r=priceRise(m);return `${m.name} ${f(r.from)}→${f(r.to)}`}).join(', ')]);}
 if(st.div==='online'){const mc=view().filter(l=>l.item===i.title&&l.moved).length;if(mc)ch.push(['⇄',`이동 ${mc}줄`,'채널 이동 반영']);}
 return `<div class="mchips" id="mchips">${ch.map(([ic,t,tip])=>`<span class="mchip" title="${esc(tip)}"><b>${ic}</b>${esc(t)}</span>`).join('')}</div>`;}
function step2(){const i=cur();if(!i)return step1();const rk=rankOf(i.id);
 return `${guide(`막대를 누르면 그 ${i.dl}의 상세로 가요.`,prevBtn()+nextBtn('자세히 보기'))}
 <div><button class="linkbtn" id="backList" style="font-size:14px;color:#616161">‹ 이슈 목록</button></div>
 <div class="s2head"><div><div class="pg-eyebrow">${i.id==='vd'?`${divName()} · ${esc(i.acct)} ${i.code} · 업체`:rk?divName()+' 이슈 '+rk+'위':divName()}</div><div class="pg-h" id="detailTitle">${i.nd?`${josa(i.title,'은','는')} ${CC().pl} 비교 기간이 없어요`:`${josa(i.title,'이','가')} ${i.d>=0?'늘었어요':'줄었어요'}`}</div><div class="s2key num"><span id="keyNum">${keyTxt(i)}</span> <span class="sub">${CC().s}</span></div></div>${spark(i.m)}</div>
 ${microChips(i)}
 <section class="card"><div class="ct">${i.d>=0?'왜 늘었을까?':'어디서 바뀌었을까?'} <span class="ctsub" id="wfBasis" title="${CC().pl} → ${i.dl}별 증감 → ${CC().cl}">${amtMode()?'월평균':'%p · '+V5.basisLabel()+(st.div==='online'?' 기준':'')}</span></div>${waterfall(i)}
 ${i.code==='5028'?'<button class="btn sec sm" data-price="1" style="margin-top:12px">원재료 단가 히트맵 ›</button>':''}</section>
 ${sigBlock(sigs2(i),st.div==='online'?'채널 → 비율(온라인 매출 대비)':'원인 → 영향')}`;}
function wfClick(id){if(id==='__rest'){toggleSet('rest');return;}
 if(isP()){st.pendOpen=['vend','mat'];st.pendV=id;return go({s:3});}
 st.pendOpen=['lines','month'];return go({s:3,ch:id});}
// ---------- 업체 드릴다운(3단계, 업체 히트맵에서) ----------
function vdData(){const accs=vendAccounts();const a=accs.find(x=>x.code===st.va)||accs[0];const v=a.vend.find(x=>x.code===st.vv)||a.vend[0];return {a,v};}
function stepVendDrill(){const {a,v}=vdData();const c=tots(v.m);const C=CC();const x=cmpM(v.m);const ca=x.ca,pa=x.pa,chg=x.r;
 const mrows=V5.MONTHS.map(y=>y?`<tr><td class="num l">${ym2(y)}</td><td class="num">${v.m[y]!=null?V5.vYm(v.m[y],y):x.nd&&C.prev.includes(y)?ND:'-'}</td></tr>`:'<tr><td colspan="2" class="sub">25.10~12 비교 기간 없음</td></tr>').join('');
 const mats=st.div==='prod'?(PD.mat[a.code]||[]).filter(m=>m.vendor===v.code).sort((x,y)=>V5.periodAmt(y,'26Q3')-V5.periodAmt(x,'26Q3')):[];
 return `${guide('필요한 표만 펼쳐 봐요.',prevBtn()+nextBtn('계획 확인'))}
 <div><button class="linkbtn" id="backHm" style="font-size:14px;color:#616161">‹ 업체 히트맵</button></div>
 <div class="s2head"><div><div class="pg-eyebrow">${divName()} · ${esc(a.name)} ${a.code} · 업체</div><div class="pg-h" id="vdTitle">${esc(v.name)}</div><div class="s2key num" id="vdKey" title="${C.cl} 월평균 ${f(x.ac)}원 · ${x.nd?`${C.pl} 비교 기간 없음 · 증감 계산 안 해요`:`${C.pl} 월평균 ${f(x.ap)}원 · 금액 ${pctS(chg)}`}">${x.nd?ND:amtMode()?pctS(chg):ppS(x.pp)} <span class="sub">${x.nd?`${C.pl} 비교 기간 없음 · `:''}${C.s}</span></div></div>${spark(v.m,'vdSpark')}</div>
 ${st.div==='prod'?sigBlock([vendSig(a.code,{id:v.code,name:v.name})],'업체 단가 → 영향'):''}
 <div class="accs">${acc('vmonth','월별 금액',`12개월 · ${C.cl} ${amtOrPct(ca,C.cur)}`,V5.chartM('월별 금액',`${v.name} · 이카운트 원장`,v.m)+`<table class="tbl sm" id="vdTbl"><thead><tr><th>월</th><th class="num">${amtMode()?'금액(원)':'비율'}</th></tr></thead><tbody>${mrows}</tbody></table>`)}
 ${st.div==='prod'?acc('vmat','연관된 자재',mats.length?`${mats.length}개`:'구매현황 연결 자재 줄 없음',mats.length?mats.map(m=>{const r=priceRise(m);return `<div class="rrow" title="${r?`단가 ${f(r.from)}→${f(r.to)}원(${ym2(r.ym)}부터)`:'단가 그대로'}"><span><b>${esc(m.name)}</b> <span class="rs">${esc(m.spec)}</span></span><span class="num">${vPb(V5.periodAmt(m,'26Q3'),'26Q3')}</span></div>`}).join(''):'<div class="empty">이 업체와 연결된 자재가 없어요</div>'):''}</div>`;}
// ---------- 4단계(r5): 계획 확인 ----------
// r7 P1(R6ND-17): 목표는 한 줄(V5.planTgt). 예전 '목표 문구 + 목표 금액' 두 줄 겹침 정리, 예전 문구는 title 에만
// U6: 계획 카드 = 최근 수정 순(V5.plansSorted, 사이드바와 같은 순서) · 카드마다 data-pid(수정·삭제 버튼은 plan_edit.js 가 이 id 로 붙임) · 작성/수정 줄 V5.planMeta
function step4(){const plans=V5.ST.plans;
 return `${guide(`절감계획을 표에 직접 적고 확인해요. AI 대화는 오른쪽 창에서 어느 화면에서나 이어져요(꼭 쓰지 않아도 돼요).`,prevBtn()+`<button class="btn sec sm" id="restart">처음으로</button>`)}
 <div><div class="pg-eyebrow">${divName()}</div><div class="pg-h">절감 계획 <span class="pg-n num" id="planN">${plans.length}건</span></div></div>
 <div class="plist" id="planList">${plans.length?V5.plansSorted().map(p=>`<section class="card pcard" data-pid="${esc(String(p.id))}" title="근거: ${esc(p.basis||'')}"><div class="pt">${esc(p.vendor)} <span class="b b-g">${esc(p.status||'초안')}</span></div><div class="pk2">${esc(p.account)} · ${esc(p.method)}</div>${(T=>`<div class="pv num ptgt"${T.o?` title="예전 목표 문구: ${esc(T.o)}"`:''}>${T.t===V5.targetText(null)?'':`<span class="sub">${T.amt?'목표 금액':'목표'}</span> `}${esc(T.t)}</div>`)(V5.planTgt(p))}<div class="sub">기한 ${esc(p.due)}${p.example?' · 예시 AI 초안':''}</div>${V5.planMeta(p)}</section>`).join(''):emptyBox('planEmpty','아직 저장한 절감 계획이 없어요',`위 표의 ‘+ 계획 추가’ 줄에 직접 적고 ‘추가’를 누르면 저장돼서 여기에 모여요. AI 도움이 필요하면 줄의 ‘AI 초안 채우기’를 쓰거나 오른쪽 AI 창에서 ‘${V5.PLAN_LABEL}’를 눌러도 돼요.`)}</div>`;}
// ---------- 3단계 ----------
function curCh(){if(st.div!=='online'||st.a==='vd')return null;/* U4: 업체 상세에는 채널이 없어요(예전엔 자사몰 채널 매출이 기준 선택지로 보였어요) */if(st.ch)return st.ch;const i=cur();const d=i&&i.drivers.filter(x=>x.d>0)[0]||i&&i.drivers[0];return d?d.id:'D2C';}
function monthTable(vals,label){return `<table class="tbl sm" id="monthTbl"><thead><tr><th>월</th><th class="num">${amtMode()?'금액(원)':'비율 · '+V5.basisLabel()+' 대비'}</th></tr></thead><tbody>${V5.MONTHS.map(y=>y?`<tr><td class="num l">${ym2(y)}</td><td class="num">${vals[y]!=null?V5.vYm(vals[y],y):'-'}</td></tr>`:`<tr><td colspan="2" class="sub">25.10~12 비교 기간 없음</td></tr>`).join('')}</tbody></table>`;}
function step3(){const i=cur();if(!i)return step1();
 const nx=guide(`필요한 표만 펼쳐 봐요. 오른쪽 AI 창에서 바로 절감 계획을 만들 수 있어요.`,prevBtn()+nextBtn('계획 확인'));
 const head=`<div><button class="linkbtn" id="backDetail" style="font-size:14px;color:#616161">‹ ${esc(i.title)} 원인 보기</button></div><div><div class="pg-eyebrow">${divName()} · ${esc(i.title)} ${i.code}</div><div class="pg-h">${josa(i.title,'을','를')} 자세히 봐요</div><div class="pg-s">표는 접혀 있어요. 제목을 누르면 펼쳐져요.</div>${st.div==='online'&&!amtMode()&&curCh()?'<div class="pg-s" id="basisHint">‘채널 매출’ 기준은 월별 흐름·월별 줄 표에만 써요.</div>':''}</div>`;// r7 P1(R6ND-6): 기준 선택지는 그대로, 짧은 안내 1줄
 if(isP())return nx+head+sigBlock(sigs3(i),'원인 → 영향')+`<div class="accs">${prodAccs(i)}</div>`;
 return nx+head+sigBlock(sigs3(i),'채널 → 비율(온라인 매출 대비)')+`<div class="accs">${onlineAccs(i)}</div>`;}
// ---------- r6: 토스 시그널(원인 카드 → 영향 대상 2개 + n개 더보기) ----------
let SIG={};
function impTxt(imp){const C=CC();if(amtMode())return `월 ${manK(imp/C.cur.length)} 영향`;const sc=salesSum(C.cur);return sc?`${ppS(imp/sc*100)} 영향`:V5.NOS;}
function sigRow(S){SIG[S.id]=S;const o=st.open.has('sg-'+S.id);const sh=o?S.targets:S.targets.slice(0,2);const rest=S.targets.length-2;
 return `<div class="sig" data-sig="${esc(S.id)}"><button class="icard" data-sgc="${esc(S.id)}" title="${esc(S.tip||'')}"><span class="ibody"><span class="sigk">${esc(S.kind)}</span><span class="ititle">${esc(S.title)}</span><div class="ireason">${esc(S.reason)}</div><div class="ikey num">${S.val}</div></span><span class="chev">›</span></button><div class="arw"></div>
 <div class="imp">${sh.map((t,k)=>`<button class="ir" data-sgt="${esc(S.id)}|${k}" ${t.act?'':'disabled'} title="${esc(t.tip||'')}"><span class="nm2">${esc(t.n)}</span><span class="dv num">${t.v}</span></button>`).join('')}${rest>0?`<button class="im" data-sgm="${esc(S.id)}" aria-expanded="${o}">${o?'접기':rest+'개 더보기'}</button>`:''}</div></div>`;}
function sigBlock(L,title){L=(L||[]).filter(Boolean);if(!L.length)return '';return `<section class="card sigc"><div class="ct">${title} <span class="ctsub" title="이유 문장은 DB 숫자로만 만들어요">${CC().s}</span></div><div class="sigs" id="sigs">${L.map(sigRow).join('')}</div></section>`;}
function vendSig(acode,v){const C=CC();const ms=(PD.mat[acode]||[]).filter(m=>m.vendor===v.id).map(m=>({m,...pchg(m,st.cmp)})).filter(x=>x.chg!=null);if(!ms.length)return null;
 ms.forEach(x=>x.imp=x.cq*(x.cu-x.pu));ms.sort((a,b)=>b.imp-a.imp);const imp=ms.reduce((a,x)=>a+x.imp,0),den=ms.reduce((a,x)=>a+x.cq*x.pu,0),avg=den?imp/den*100:null;const up=ms.filter(x=>x.chg>=0.05).length;
 const to=key=>()=>{st.pendOpen=['vend','mat'];st.pendV=v.id;st.pendM=key||null;go({s:3,a:acode,va:null,vv:null,hm:null,pm:null});};
 return {id:'v-'+acode+'-'+v.id,kind:'업체 단가',title:v.name,reason:`오른 자재 ${up}개 · ${impTxt(imp)}`,val:`평균 ${pctS(avg)}`,imp,
  tip:`같은 자재 ${C.pl}→${C.cl} 가중 단가 · 영향 = ${C.cl} 수량 × 단가 차이 · 구매현황(fact_purchase_line)`,go:to(null),
  targets:ms.map(x=>({n:x.m.name,v:pctS(x.chg),tip:`${f(x.pu)}→${f(x.cu)}원 · ${C.cl} ${f(x.cq)} ${x.m.spec||''}`,act:to(x.m.key)}))};}
function itemAccs(it){const L=(M2.acc||{})[it.c];if(L&&Object.keys(L).length)return Object.entries(L).sort((a,b)=>b[1][1]-a[1][1]).map(([code,[n]])=>({code,est:false,n}));return [{code:it.g==='ZIP_M'?'5028':'5299',est:true}];}
function matSig(it){const C=CC();const x=pchg(it,st.cmp);if(x.chg==null)return null;const imp=x.cq*(x.cu-x.pu);
 const accT=itemAccs(it).map(a=>({n:`${(ACCM[a.code]||{name:a.code}).name} ${a.code}${a.est?' [추정 연결]':''}`,v:impTxt(imp),tip:a.est?'구매현황에 원장 연결이 없어 item_group으로 붙였어요 [추정]':`원장 연결 ${a.n}줄`,act:()=>go({s:2,a:a.code,pm:null,hm:null})}));
 const vs=Object.entries(it.v).map(([vc,m])=>({vc,n:M2.vn[vc]||vc,...pchg({m},st.cmp)})).filter(y=>y.chg!=null).sort((a,b)=>b.cq*(b.cu-b.pu)-a.cq*(a.cu-a.pu));
 const vT=vs.map(y=>({n:y.n,v:pctS(y.chg),tip:`업체 단가 ${f(y.pu)}→${f(y.cu)}원`,act:()=>{st.pendOpen=['pvend'];go({s:3,a:'price',pm:it.c,hm:null})}}));
 return {id:'m-'+it.c,kind:'자재 단가',title:it.n,reason:`${f(x.pu)}→${f(x.cu)}원${it.u?' / '+it.u:''}`,val:pctS(x.chg),tip:`${C.pl}→${C.cl} 가중 단가(공급가액÷수량)`,go:()=>openPrice(it.c),
  targets:accT.concat(vT).concat([{n:'제품',v:'BOM 줄 없음',tip:'DB에 제품별 자재 사용량(BOM)이 없어요'}])};}
function salesSig(i){const C=CC();const sc=salesSum(C.cur),sp=salesSum(C.prev);if(!sc||!sp||i.pp==null)return null;const sr=(sc/C.cur.length)/(sp/C.prev.length)*100-100;
 const accs=PD.acc.filter(a=>!LABOR[a.code]).map(a=>({a,x:cmpM(a.m)})).filter(y=>y.x.pp!=null&&(y.x.ca||y.x.pa));
 const me=accs.find(y=>y.a.code===i.code);const others=accs.filter(y=>y!==me).sort((p,q)=>Math.abs(q.x.pp)-Math.abs(p.x.pp));
 return {id:'s-'+i.code,kind:'매출 변화',title:V5.basisLabel(),reason:`${i.title} 비용 ${pctS(i.r)}`,val:`월 매출 ${pctS(sr)}`,tip:`${V5.basisLabel()} 월평균 ${C.pl} ${f(sp/C.prev.length)}원 → ${C.cl} ${f(sc/C.cur.length)}원`,go:()=>toggleSet('sg-s-'+i.code),
  targets:(me?[me]:[]).concat(others).map(y=>({n:`${y.a.name} 비율`,v:ppS(y.x.pp),tip:`${C.pl} ${y.x.rp.toFixed(2)}% → ${C.cl} ${y.x.rc.toFixed(2)}% · 금액 ${pctS(y.x.r)}`,act:y===me?()=>go({s:3}):()=>go({s:2,a:y.a.code,n:null})}))};}
function chanSig(item,ch){const C=CC();const V=view();
 // U2: 카드 값·대상·문구 모두 온라인 매출 대비(워터폴과 같은 분모). 채널 매출(net_sales_tab)은 툴팁 참고로만 보여 주고 계산에 안 써요
 const OS=OSALES.online;if(!sumY(OS,C.cur)||!sumY(OS,C.prev))return null;
 const its=OITEMS.map(it=>({it,x:cmpM(oMonthly(V,ch,it),null,OS)})).filter(y=>y.x.ca||y.x.pa);const me=its.find(y=>y.it===item);if(!me)return null;
 const ak=y=>y.x.nd?-1:Math.abs(y.x.pp||0);// 자료 없음은 맨 뒤
 const others=its.filter(y=>y!==me).sort((p,q)=>ak(q)-ak(p));
 const sm=chSales(ch),sc=sumY(sm,C.cur),sp=sumY(sm,C.prev);
 const ref=ch!=='ONLINE_COMMON'&&sc&&sp?` · 참고: ${CHN[ch]} 채널 매출 월평균 ${f(sp/C.prev.length)}원 → ${f(sc/C.cur.length)}원(${pctS((sc/C.cur.length)/(sp/C.prev.length)*100-100)}), 비율 계산에는 안 써요`:'';
 return {id:'c-'+ch+'-'+item,kind:'채널 → 비용 비율',title:CHN[ch],reason:`${item} 비용 ${me.x.nd?`${C.pl} 비교 기간 없음`:`월 ${manS(me.x.d)}(${pctS(me.x.r)})`}`,val:me.x.nd||me.x.pp==null?ND:`${OBL} 대비 ${ppS(me.x.pp)}`,
  tip:`${CHN[ch]} ${item} · ${OBL} 대비 ${C.pl} ${me.x.rp==null?ND:me.x.rp.toFixed(2)+'%'} → ${C.cl} ${me.x.rc==null?'-':me.x.rc.toFixed(2)+'%'} · 카드·아래 비율·워터폴 모두 ${OBL} 기준${ref}`,
  go:()=>{st.pendOpen=['lines','month'];go({s:3,a:item,ch})},
  targets:[me].concat(others).map(y=>({n:`${y.it} 비율`,v:y.x.nd?ND:ppS(y.x.pp),tip:y.x.nd?`${C.pl} 비교 기간 없음 · ${C.cl} ${OBL} 대비 ${y.x.rc==null?'-':y.x.rc.toFixed(2)+'%'} · 증감 계산 안 해요`:`${OBL} 대비 ${C.pl} ${y.x.rp==null?'-':y.x.rp.toFixed(2)+'%'} → ${C.cl} ${y.x.rc==null?'-':y.x.rc.toFixed(2)+'%'} · 금액 월 ${manS(y.x.d)}`,act:()=>{st.pendOpen=['month'];go({s:3,a:y.it,ch})}}))};}
function sigs2(i){const L=[];
 if(isP()){if(i.code==='5028'){heat('raw',st.cmp).its.filter(x=>x.chg!=null&&x.ca>=TOPMIN).map(x=>({x,imp:x.cq*(x.cu-x.pu)})).sort((a,b)=>b.imp-a.imp).slice(0,2).forEach(y=>L.push(matSig(y.x)));}
  else i.drivers.map(d=>vendSig(i.code,d)).filter(Boolean).sort((a,b)=>b.imp-a.imp).slice(0,2).forEach(x=>L.push(x));
  L.push(salesSig(i));}
 else i.drivers.map(d=>({d,x:cmpM(d.m,null,OSALES.online)})).filter(y=>y.x.pp!=null).sort((a,b)=>Math.abs(b.x.pp)-Math.abs(a.x.pp)).slice(0,2).forEach(y=>L.push(chanSig(i.title,y.d.id)));
 return L.filter(Boolean);}
function sigs3(i){if(st.div==='online')return [chanSig(i.title,curCh())];
 if(i.code==='5028'){const t=heat('raw',st.cmp).its.filter(x=>x.chg!=null&&x.ca>=TOPMIN).sort((a,b)=>b.cq*(b.cu-b.pu)-a.cq*(a.cu-a.pu))[0];return t?[matSig(t)]:[];}
 const V=i.drivers.map(d=>vendSig(i.code,d)).filter(Boolean);if(!V.length)return [];const sel=st.v&&V.find(x=>x.id==='v-'+i.code+'-'+st.v);return [sel||V.sort((a,b)=>b.imp-a.imp)[0]];}
function prodAccs(i){const mv=i.m;const mx=Object.keys(mv).sort((a,b)=>mv[b]-mv[a])[0];
 const vs=i.drivers.slice().sort((a,b)=>b.c['26Q3']-a.c['26Q3']);const vt=vs.reduce((a,v)=>a+v.c['26Q3'],0);
 const selV=vs.find(v=>v.id===st.v);
 const month=acc('month','월별 흐름',`12개월 · 가장 큰 달 ${ym2(mx)}`,V5.chartM('월별 흐름',`${i.title} · Z-IPS 마감값`,mv)+monthTable(mv));
 const vend=acc('vend','업체별 금액',vs.length?`${vs.length}곳 · 2026 Q3 1위 ${esc(vs[0].id==='BLANK'?'거래처 미기재':vs[0].name)} ${vt?(vs[0].c['26Q3']/vt*100).toFixed(1):0}%`:'원장 업체 비교 기간 없음',
  vs.length?`<table class="tbl sm" id="vendTbl"><thead><tr><th>업체</th>${P.map(p=>`<th class="num">${PL[p]}</th>`).join('')}<th class="num">vs ${CC().pl}</th><th class="num">구성비</th></tr></thead><tbody>${vs.slice(0,12).map(v=>`<tr class="click${st.v===v.id?' selrow':''}" data-v="${v.id}" tabindex="0"><td>${esc(v.id==='BLANK'?'거래처 미기재':v.name)}${vNatOf(v.id)?` <span class="b b-g">${vNatOf(v.id)}</span>`:''}</td>${P.map(p=>`<td class="num${p==='26Q3'?' strong':''}">${hasY(v.m,PMON3[p])?vPb(v.c[p],p):p==='26Q3'?'-':ND}</td>`).join('')}<td class="num">${dPb(v.m)}</td><td class="num">${vt?(v.c['26Q3']/vt*100).toFixed(1)+'%':'-'}</td></tr>`).join('')}</tbody></table><div class="sub" style="margin-top:8px">${amtMode()?'월평균 원':'비율 · '+V5.basisLabel()+' 대비'} · 업체를 누르면 ‘자재 단가·수량’이 그 업체로 좁혀져요${vs.length>12?` · 외 ${vs.length-12}곳`:''}${[vSrcNote(i.code),q4VendNote()].filter(Boolean).map(x=>'<br>'+esc(x)).join('')}</div>`:'<div class="empty">이 계정은 이카운트 원장에 업체 줄이 없어요.</div>');
 let ms=(PD.mat[i.code]||[]);if(selV)ms=ms.filter(m=>m.vendor===selV.id);ms=ms.slice().sort((a,b)=>V5.periodAmt(b,'26Q3')-V5.periodAmt(a,'26Q3'));
 const rs=ms.filter(m=>{const r=priceRise(m);return r&&r.to>r.from});
 let selM=ms.find(m=>m.key===st.m)||rs[0]||ms[0];
 const VN=Object.fromEntries(i.drivers.map(v=>[v.id,v.name]));
 const mat=acc('mat','자재 단가·수량',ms.length?`${ms.length}개 자재${selV?' · '+esc(selV.name):''} · 단가 오른 자재 ${rs.length}개`:'구매현황 연결 자재 줄 없음',
  ms.length?`<input class="search" id="matQ" placeholder="자재 이름으로 찾기" aria-label="자재 이름으로 찾기" aria-controls="matList"><div class="empty" id="matNone" hidden role="status">찾는 자재가 없어요. 다른 이름으로 찾아보세요.</div><div class="mlist" id="matList">${ms.map(m=>`<div class="mi${selM&&m.key===selM.key?' on':''}" data-m="${esc(m.key)}" role="button" tabindex="0" aria-pressed="${!!(selM&&m.key===selM.key)}"><span>${esc(m.name)} <span class="sub">${esc(VN[m.vendor]||'')}</span></span><span class="num">${vPb(V5.periodAmt(m,'26Q3'),'26Q3')}</span></div>`).join('')}</div>
  ${selM?`<div class="ct" style="margin-top:16px" id="matTitle">${esc(selM.name)} <span class="ctsub">${esc(VN[selM.vendor]||'')} · 월별 수량 · 단가 · ${amtMode()?'금액':'비율'}</span></div><table class="tbl sm" id="matTbl"><thead><tr><th>월</th><th class="num">수량</th><th class="num">단가(원)</th><th class="num">${amtMode()?'금액(원)':'비율'}</th></tr></thead><tbody>${V5.MONTHS.filter(Boolean).map(y=>{const v=selM.m[y];return `<tr><td class="num l">${ym2(y)}</td><td class="num">${v?f(v[1]):'-'}</td><td class="num">${v&&v[1]?f(v[0]/v[1]):'-'}</td><td class="num">${v?V5.vYm(v[0],y):'-'}</td></tr>`}).join('')}</tbody></table>`:''}`:'<div class="empty">이 계정은 구매현황에 연결된 자재 줄이 없어요.</div>');
 return month+vend+(st.div==='mgmt'?'':mat);}// 경영지원은 구매현황 자재가 없어 ‘자재 단가·수량’을 숨겨요
function onlineAccs(i){const V=view();const ch=curCh();
 const chs=i.drivers.slice().sort((a,b)=>b.c['26Q3']-a.c['26Q3']);
 const mvals=oMonthly(V,ch,i.title);const mx=Object.keys(mvals).sort((a,b)=>mvals[b]-mvals[a])[0];
 const chips=`<div class="chips" id="chips">${CH.map(([id,n])=>`<button class="chipb${id===ch?' on':''}" data-ch="${id}">${n}</button>`).join('')}</div>`;
 // U2: 3단계 기준을 '채널 매출'로 바꾸면 월별 그래프·표·줄 표만 그 채널 매출 대비가 돼요(시그널·채널별 금액 표는 온라인 매출 고정) → 섞여 보이지 않게 알림
 const bnote=!amtMode()&&V5.basis()==='channel'?`<div class="sub basisnote" style="margin-top:8px">이 그래프·표는 ${CHN[ch]} 채널 매출 대비예요. 시그널·채널별 금액 표·워터폴은 ${OBL} 기준이에요.</div>`:'';
 const month=acc('month','월별 흐름',`${CHN[ch]} · ${esc(i.title)} · 가장 큰 달 ${mx?ym2(mx):'-'}`,chips+'<div style="height:12px"></div>'+V5.chartM('월별 흐름',`${CHN[ch]} · ${i.title}`,mvals)+monthTable(mvals)+bnote);
 const chan=acc('chan','채널별 금액',`${chs.length}개 채널 · 2026 Q3 1위 ${esc(chs[0]?chs[0].name:'-')}`,`<table class="tbl sm" id="chanTbl"><thead><tr><th>채널</th>${P.map(p=>`<th class="num">${PL[p]}</th>`).join('')}<th class="num">vs ${CC().pl}</th></tr></thead><tbody>${chs.length?'':`<tr><td colspan="5" class="sub" id="chanNone">이 항목은 채널 줄 없음(채널별 비용 줄이 없어요)</td></tr>`}${chs.map(d=>`<tr class="click${d.id===ch?' selrow':''}" data-ch="${d.id}" tabindex="0"><td>${esc(d.name)}${V.some(l=>l.moved&&l.item===i.title&&(l.eff===d.id||l.ch===d.id))?' <span class="b moved">이동 반영</span>':''}</td>${P.map(p=>`<td class="num${p==='26Q3'?' strong':''}">${hasY(d.m,PMON3[p])?vPb(d.c[p],p,'online'):p==='26Q3'?'-':ND}</td>`).join('')}<td class="num">${dPb(d.m,'online')}</td></tr>`).join('')}</tbody></table><div class="sub" style="margin-top:8px">${amtMode()?'월평균 원':'비율 · 온라인 매출 대비(채널끼리 비교하려고 고정)'} · 채널을 누르면 아래 표가 그 채널로 바뀌어요</div>`);
 const L=V.filter(l=>l.eff===ch&&l.item===i.title).sort((a,b)=>a.ym.localeCompare(b.ym));const moves=loadMoves();
 const lines=acc('lines','월별 줄 · 채널 이동',`${CHN[ch]} · ${L.length}줄${st.sel.size?' · '+st.sel.size+'줄 선택':''}`,
  `${chips}<div class="lines-h" style="margin-top:12px"><span class="sub" id="selInfo">${st.sel.size?st.sel.size+'줄 선택':'옮길 줄을 골라요'}</span><button class="btn pri sm" id="moveBtn" ${st.sel.size?'':'disabled'}>채널 이동</button></div>
  <table class="tbl sm" id="lineTbl"><thead><tr><th></th><th>월</th><th>항목</th><th class="num">${amtMode()?'금액(원)':'비율'}</th><th>상태</th><th></th></tr></thead><tbody>${L.map(l=>{const m=moves.filter(x=>x.key===l.key&&x.status==='이동됨').slice(-1)[0];return `<tr><td><input type="checkbox" class="lc" data-key="${l.key}" aria-label="${ym2(l.ym)} ${esc(l.item)} 줄 고르기" ${st.sel.has(l.key)?'checked':''}></td><td class="num l">${ym2(l.ym)}</td><td>${esc(l.item)} <span class="code">${l.acct||''}</span></td><td class="num strong">${V5.vYm(l.amt,l.ym)}</td><td>${l.moved?`<span class="b moved">이동됨 · 원래 ${CHN[l.ch]}</span>`:'<span class="sub">원래 채널</span>'}</td><td>${m?`<button class="linkbtn" data-undo="${m.id}">되돌리기</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="6" class="sub">이 채널에 이 항목 줄이 없어요</td></tr>'}</tbody></table>${bnote}<div class="note">이동은 앱 상태 DB에 이력으로 저장돼요. 원본 비용 DB는 바꾸지 않아요.</div>`);
 const hs=moves;const hist=acc('hist','채널 이동 이력',hs.length?`${hs.length}건 · 마지막 ${V5.dt(hs[hs.length-1].at)}`:'줄 없음',hs.length?`<table class="tbl sm hist" id="histTbl"><thead><tr><th>시각</th><th>누가</th><th>줄</th><th>원래 → 이동</th><th>상태</th></tr></thead><tbody>${hs.slice().reverse().map(m=>`<tr><td class="nw num">${V5.dt(m.at)}</td><td class="nw">${esc(m.by||'-')}</td><td class="nw">${ym2(m.ym)} ${esc(m.item)}</td><td>${CHN[m.orig]} → ${CHN[m.to]}</td><td>${m.status}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">아직 이동한 줄이 없어요.</div>');
 return month+chan+lines+hist;}
// ---------- AI 맥락 ----------
// U3: 모든 AI 진입점(빠른 질문·자유 입력·절감 계획 초안·히트맵·업체 상세·자재 단가)이 보기(mode)와 분모(sales·basisLabel)를 같이 보내요.
//   비율이면 서버 예시 AI가 %·%p 로, 금액이면 원으로 답해요. 분모: 생산 = 고른 기준(생산매출/출고매출 합계), 온라인 = 늘 온라인 매출(U2)
const _setCtx=V5.setCtx;V5.setCtx=c=>{const md=amtMode()?'amt':'ratio';const B=isP()?{sales:PD.salesM[V5.basis()]||{},basisLabel:V5.basisLabel()}:{sales:OSALES.online,basisLabel:OBL};
 const o=Object.assign({division:{prod:'PROD',mgmt:'MGMT'}[st.div]||'ONLINE',cmp:st.cmp,code:isP()?(/^\d{4}$/.test(st.a||'')?st.a:(st.a==='vd'?st.va:null)):(OACC[st.a]||(st.a==='vd'?st.va:null)),mode:md},B,c);
 o.chips=(c.chips||[]).filter(x=>x!==o.basisLabel+' 기준').concat([md==='amt'?'금액(원) 기준':o.basisLabel+' 기준']);_setCtx(o);};
function setAI(){if(st.s===1&&st.hm){const H=hmModel();const C=CC();const mOf=it=>it.m||(M2I[it.id]||{}).m||{};const add=(o,it)=>Object.entries(mOf(it)).forEach(([y,v])=>o[y]=(o[y]||0)+mval(v));
  const mm={},cm={};H.all.forEach(it=>{add(mm,it);if(!it.isNew)add(cm,it)});
  // U3: 화면 합계·분류 증감처럼 비교 기간 비교 기간 없는 칸(입력 필요)은 비교에서 빼요. r7 P3: 보조 비교(전월·전분기)도 같은 칸 맥락을 보내요(AI 가 화면 비교 기준으로 답함)
  const nd=H.secs.flatMap(x=>x.items.filter(i=>i.isNew).map(i=>[x.s+' · '+i.n,i.ca])).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  const cav=its=>{const L=its.filter(i=>!i.isNew);return L.length?{prev:L.reduce((a,i)=>a+sumY(mOf(i),C.prev),0)/C.prev.length,cur:L.reduce((a,i)=>a+sumY(mOf(i),C.cur),0)/C.cur.length}:null};
  const prices=H.kind==='price'?H.all.filter(x=>x.chg!=null&&x.ca>=TOPMIN).sort((a,b)=>Math.abs(b.chg)-Math.abs(a.chg)).slice(0,10).map(x=>({name:x.n,m:M2I[x.id].m})):[];
  V5.setCtx(Object.assign({title:H.title+' 히트맵',account:H.title,focus:'(업체 입력 필요)',chips:[divName(),'히트맵 · '+H.title,C.l],monthly:mm,prices,breakdown:H.secs.map(x=>Object.assign(bdOf(x.s,x.items.map(mOf)),{cmpAvg:cav(x.items)})),breakdownLabel:'분류'},nd.length?{cmpMonthly:cm,ndItems:nd}:{}));return;}
 if(st.a==='vd'&&st.s>1){const {a,v}=vdData();const prices=st.div==='prod'?(PD.mat[a.code]||[]).filter(m=>m.vendor===v.code):[];V5.setCtx({title:v.name,account:`${a.name}(${a.code})`,focus:v.name,chips:[divName(),`${a.name} ${a.code}`,v.name],monthly:v.m,prices,breakdown:[],breakdownLabel:'업체'});return;}
 const i=st.s>1?cur():null;
 if(st.div==='prod'&&i&&i.id==='price'){const it=st.pm?M2I[st.pm]:null;const H=heat(st.scope,st.cmp);const fmt=x=>({name:x.n,m:x.m});
  const prices=it&&st.s>=3?[fmt(it)]:H.its.filter(x=>x.chg!=null&&x.ca>=TOPMIN).sort((a,b)=>Math.abs(b.chg)-Math.abs(a.chg)).slice(0,10).map(fmt);
  const mm={};(it&&st.s>=3?[it]:H.its).forEach(x=>Object.entries(x.m).forEach(([y,v])=>mm[y]=(mm[y]||0)+v[0]));
  V5.setCtx({title:it&&st.s>=3?it.n:SCOPE[st.scope].l+' 단가',account:'자재 단가 · '+(it&&st.s>=3?it.n:SCOPE[st.scope].l),focus:it&&st.s>=3?(Object.entries(it.v).map(([vc,m])=>[M2.vn[vc],sumM(m,CC().cur)[0]]).sort((a,b)=>b[1]-a[1])[0]||[null])[0]:null,
   chips:['생산본부','자재 단가',CC().s].concat(it&&st.s>=3?[it.n]:[]),monthly:mm,prices,breakdown:H.secs.map(x=>bdOf(x.s,x.items.map(i=>i.m))),breakdownLabel:'분류'});return;}
 if(isP()){if(!i){const accs=PD.acc.filter(a=>!LABOR[a.code]).map(a=>bdOf(a.name,[a.m]));V5.setCtx({title:divName(),account:divName()+' 전체',chips:[divName(),'인건비 묶음 제외'],monthly:prodMonthly(),breakdown:accs,breakdownLabel:'계정',prices:[]});return;}
  const sv=i.drivers.find(d=>d.id===(st.s===3?st.v:st.n));let prices=PD.mat[i.code]||[];if(sv)prices=prices.filter(m=>m.vendor===sv.id);
  V5.setCtx({title:i.title+(sv?' · '+sv.name:''),account:`${i.title}(${i.code})`,focus:sv?sv.name:null,chips:[divName(),`${i.title} ${i.code}`].concat(sv?[sv.name]:[]).concat([CC().s,'인건비 묶음 제외']),monthly:sv?sv.m:i.m,prices,breakdown:i.drivers.map(d=>bdOf(d.name,[d.m])),breakdownLabel:'업체'});return;}
 // U2: 온라인 이슈 흐름은 AI 에도 비율 분모(온라인 매출 월별)를 같이 보내 카드·워터폴과 같은 %·%p 로 답하게 해요
 const OB={sales:OSALES.online,basisLabel:OBL};
 const V=view();if(!i){V5.setCtx(Object.assign({title:'온라인본부',account:'온라인 전체',chips:['온라인본부','인건비 묶음 제외',OBL+' 기준'],monthly:oMonthly(V,'ALL',null,true),breakdown:OITEMS.map(it=>bdOf(it,[oMonthly(V,'ALL',it)])),breakdownLabel:'항목',prices:[]},OB));return;}
 const ch=st.s===3?curCh():null;V5.setCtx(Object.assign({title:'온라인 '+i.title+(ch?' · '+CHN[ch]:''),account:'온라인 '+i.title+(ch?' · '+CHN[ch]:''),focus:ch?CHN[ch]:null,chips:['온라인본부',i.title].concat(ch?[CHN[ch]]:[]).concat([CC().s,'인건비 묶음 제외',OBL+' 기준']),monthly:ch?oMonthly(V,ch,i.title):i.m,prices:[],breakdown:i.drivers.map(d=>bdOf(d.name,[d.m])),breakdownLabel:'채널'},OB));}
// AI 구성 맥락: 기간에 줄이 없으면 그 기간 값은 null(서버 예시 AI가 '입력 필요'로 답함)
// r7 P3: 보조 비교(전월·전분기)면 화면과 같은 달의 월평균 cmpAvg{prev,cur}도 보내요(옛 서버는 이 칸을 그냥 써도 오류 없음)
function bdOf(name,ms){const av=p=>{const L=ms.filter(m=>hasY(m,PMON3[p]));return L.length?L.reduce((a,m)=>a+pTot(m,p),0)/PMN[p]:null};const o={name,m25:av('25Q3'),mH1:av('26H1'),m26:av('26Q3')};
 const C=CC();if(!C.main){const ay=ys=>{const L=ms.filter(m=>hasY(m,ys));return L.length?L.reduce((a,m)=>a+sumY(m,ys),0)/ys.length:null};o.cmpAvg={prev:ay(C.prev),cur:ay(C.cur)};}return o;}
// U4: 권한 없는 본부 전용 메뉴(자재 단가 = 생산, 온라인 이슈 = 온라인)는 누를 수 없게(예전엔 온라인 사용자가 자재 단가를 누르면 빈 단가 히트맵). 본부 탭 비활성과 같은 규칙
const _setSide=V5.setSide;V5.setSide=a=>{_setSide(a);const need={price:['PROD','생산본부'],online:['ONLINE','온라인본부']};
 document.querySelectorAll('#side [data-nav]').forEach(n=>{const d=need[n.dataset.nav];if(d&&!ALLOWED.has(d[0])){n.removeAttribute('href');n.classList.add('dis');n.setAttribute('aria-disabled','true');n.title=`${d[1]} 권한이 있어야 볼 수 있어요`;n.style.color='#8A8A8A';n.style.cursor='default';}});};
// ---------- 그리기 ----------
function render(){SIG={};setBasesFor();if((st.s===2||st.s===3)&&!st.hm&&!(st.div==='prod'&&st.a==='price')&&st.a!=='vd'&&!cur())st.s=1;// r7 P3: 볼 이슈가 하나도 없으면(2·3단계 주소) 단계 표시도 1단계(예전: 단계 3 + 1단계 목록이 함께 보임)
 V5.setSide(st.s===4?'plan':st.hm?'hm':isP()?(st.div==='prod'&&st.a==='price'?'price':'flow'):'online');
 const pr=st.div==='prod'&&st.a==='price';if(st.div==='mgmt')ccLoad();const body=st.cc&&st.s===1?ccView():st.s===1?(st.hm?hmView():step1()):st.s===2?step2():st.s===3?(pr?stepPriceDrill():st.a==='vd'?stepVendDrill():step3()):step4();
 document.getElementById('main').innerHTML=`<div class="col" data-step="${st.s}" id="page">${topbar()}${stepper()}${body}${FOOT()}</div>`;bind();setAI();drawTM();}
function toggleSet(id){st.open.has(id)?st.open.delete(id):st.open.add(id);render();}
function bind(){const M=document.getElementById('main');const $=id=>document.getElementById(id);
 M.querySelectorAll('[data-div]').forEach(b=>b.onclick=()=>go({div:b.dataset.div,s:1,a:null,n:null,ch:null}));
 M.querySelectorAll('[data-step]').forEach(b=>{if(b.tagName==='BUTTON')b.onclick=()=>go({s:+b.dataset.step})});
 M.querySelectorAll('[data-issue]').forEach(b=>b.onclick=()=>go({s:2,a:b.dataset.issue,n:null,ch:null}));
 M.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{st.sort=b.dataset.sort;render()});
 M.querySelectorAll('[data-fold]').forEach(b=>b.onclick=()=>toggleSet(b.dataset.fold));
 M.querySelectorAll('[data-acc]').forEach(b=>b.onclick=()=>toggleSet(b.dataset.acc));
 M.querySelectorAll('[data-node]').forEach(b=>b.onclick=()=>{st.open.delete('rel');go({n:b.dataset.node})});
 M.querySelectorAll('[data-v]').forEach(r=>r.onclick=()=>{st.v=st.v===r.dataset.v?null:r.dataset.v;st.m=null;{const q=new URLSearchParams(location.hash.slice(1));if(st.v)q.set('sv',st.v);else q.delete('sv');history.replaceState(null,'','#'+q.toString());}render()});
 M.querySelectorAll('[data-m]').forEach(r=>r.onclick=()=>{st.m=r.dataset.m;render()});
 M.querySelectorAll('[data-ch]').forEach(b=>b.onclick=()=>{st.sel.clear();go({ch:b.dataset.ch})});
 M.querySelectorAll('.lc').forEach(c=>c.onchange=()=>{c.checked?st.sel.add(c.dataset.key):st.sel.delete(c.dataset.key);render()});
 M.querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>undo([b.dataset.undo],b));
 M.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{V5.S(V5.K.open,true);V5.send(b.dataset.q)});
 V5.bindToggle(render);
 const mi=$('moreIssues');if(mi)mi.onclick=()=>{st.more=!st.more;render()};
 const mn=$('moreNodes');if(mn)mn.onclick=()=>{st.allNodes=!st.allNodes;render()};
 const nb=$('nextBtn');if(nb&&nb.dataset.pm)nb.onclick=()=>openPrice(nb.dataset.pm);else if(nb&&!nb.dataset.issue)nb.onclick=()=>go({s:st.s+1});
 M.querySelectorAll('[data-price]').forEach(b=>b.onclick=()=>go({s:1,hm:'price',a:null,n:null,pm:null}));
 M.querySelectorAll('[data-hm]').forEach(b=>b.onclick=()=>go({s:1,hm:b.dataset.hm}));
 M.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>go({s:1,hm:b.dataset.view==='hm'?(st.hm||'acc'):null}));
 M.querySelectorAll('[data-wf]').forEach(b=>b.onclick=()=>wfClick(b.dataset.wf));
 M.querySelectorAll('[data-cc]').forEach(b=>b.onclick=()=>{CCS.f=ccBlank();CCS.fe={};CCS.err=null;CCS.ok='';go({cc:1,s:1,a:null,n:null,hm:null});});ccBind();
 const bhm=$('backHm');if(bhm)bhm.onclick=()=>go({s:1,hm:'vend',a:null});
 // U4: 히트맵 TOP 줄 = 그 칸을 누른 것과 같은 곳으로(목업은 늘 자재 단가 상세로 가서 계정·채널·업체 TOP 이 엉뚱한 자재를 열었어요). 단가 상세의 '같은 분류 다른 자재'는 그대로 자재 단가
 M.querySelectorAll('[data-tm2]').forEach(b=>b.onclick=()=>st.hm?hmClick(b.dataset.tm2):openPrice(b.dataset.tm2));
 M.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{st.scope=b.dataset.scope;render()});
 M.querySelectorAll('[data-cmp]').forEach(b=>b.onclick=()=>{st.cmp=b.dataset.cmp;V5.S(CK,st.cmp);render()});
 M.querySelectorAll('[data-sgc]').forEach(b=>b.onclick=()=>{const S=SIG[b.dataset.sgc];if(S&&S.go)S.go()});
 M.querySelectorAll('[data-sgt]').forEach(b=>b.onclick=()=>{const [id,k]=b.dataset.sgt.split('|');const t=SIG[id]&&SIG[id].targets[+k];if(t&&t.act)t.act()});
 M.querySelectorAll('[data-sgm]').forEach(b=>b.onclick=()=>toggleSet('sg-'+b.dataset.sgm));
 M.querySelectorAll('[data-imore]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleSet('im-'+b.dataset.imore);});
 const bh=$('backHeat');if(bh)bh.onclick=()=>go({s:1,a:null,hm:SCOPE.raw.g.includes(pItem().g)?'price':'pack'});
 const pb=$('prevBtn');if(pb)pb.onclick=()=>go({s:st.s-1});
 const bl=$('backList');if(bl)bl.onclick=()=>go({s:1});
 const bd=$('backDetail');if(bd)bd.onclick=()=>go({s:2});
 const rs=$('restart');if(rs)rs.onclick=()=>go({s:1,a:null,n:null,ch:null});
 const mb=$('moveBtn');if(mb)mb.onclick=openDialog;
 const q=$('matQ');if(q)q.oninput=()=>{const t=q.value.trim();let n=0;document.querySelectorAll('#matList .mi').forEach(x=>{const on=!t||x.textContent.includes(t);x.style.display=on?'':'none';n+=on});$('matNone').hidden=n>0;};}
// r13: 회계집계표(거래처 단위)에서 온 계정은 출처·빠진 달·적요 없음을 알리고, 금융성·보험성 거래처는 표시만 해요(합계에서 빼지 않음)
const vNatOf=c=>(DB.vnat&&DB.vnat[c])||'';
const vDivId=()=>({prod:'PROD',online:'ONLINE',mgmt:'MGMT'}[st.div]);
const ymTxt=y=>`${y.slice(0,2)}.${y.slice(2)}`;
const q4VendNote=()=>st.cmp==='q4'?'25Q4 거래처별은 25년 거래처(이카운트 원장)가 오면 보여요. 금액은 ‘전체’에서 봐요.':'';
function vSrcNote(code){const e=DB.vsrc&&DB.vsrc[vDivId()]&&DB.vsrc[vDivId()][code];if(!e||e.k==='LEDGER')return '';
 const ms=e.months||[];const gap=['2601','2602','2603','2604','2605','2606','2607','2608','2609'].filter(y=>!ms.includes(y));
 return `출처: ${e.k==='GL'?'회계집계표(거래처 단위)':'이카운트 원장 + 회계집계표(거래처 단위)'}${(e.ec||[]).length?` · ${(e.ec).map(ymTxt).join('·')}은 이카운트에서 직접 받은 회계집계표`:''} · 적요는 원장이 오면 보여요 · 25년 거래처는 이카운트 원장이 오면 보여요${gap.length?` · 거래처 자료가 아직 없는 달 ${gap.map(ymTxt).join('·')}(파일 금액이 달라 보류)`:''}.`;}
// ---------- 경영지원 공통비 입력(hq3) ----------
// 직접 입력한 값은 앱 상태 DB(mgmt_common_cost)에 새 줄로 쌓이고(수정도 새 줄 = 이력) 화면에는 늘 ‘직접 입력’ 표시.
// r12 c6(본부장님 2026-10-30 결정, 10-26 '예산·합계 제외'를 뒤집음): 공통비 입력 = 실제 비용 -> 해당 달 합계·차이·히트맵에 더함(ccMerge).
//   중복 막기: (1) 같은 계정·달에 원장(ERP) 값이 있으면 원장이 우선이라 입력은 안 더함 (2) 입력끼리 같은 달이 겹치면 늦게 저장한 줄만 더함 (3) 분기 입력은 3달로 똑같이 나눔(남는 원은 마지막 달)
const CCS={items:[],hist:[],acc:[],memoMax:500,loaded:false,tried:false,loading:false,busy:false,err:null,ok:'',fe:{},f:{account:'',period:'',amount:'',memo:''}};
const CC_MAX=10000000000;   // r13 c7: 한 건 상한 100억 원(서버 MGMT_MAX_KRW 와 같음)
const CC_BIG='금액은 100억 원 이하로 입력해 주세요. 자릿수가 맞는지 다시 확인해 주세요.';
const ccBlank=()=>({account:'',period:'',amount:'',memo:''});
const ccFmt=s=>{const d=String(s||'').replace(/[^0-9]/g,'');return d?Number(d).toLocaleString('ko-KR'):'';};
const ccRead=s=>{const a=V5.amtParse(s);return a.v==null||a.err?'':`= ${V5.f(a.v)}원${a.v>=10000?' (약 '+V5.manS(a.v)+'원)':''}`;};
const CC_PER=/^([0-9]{2}Q[1-4]|[0-9]{2}(0[1-9]|1[0-2]))$/;
const CC_ERR={403:'경영지원본부 권한이 있어야 공통비를 입력할 수 있어요. 필요하면 경영지원본부에 권한을 요청해 주세요.',503:'공통비 입력 기능이 아직 준비되지 않았어요. 관리자에게 알려 주세요.',too_big:CC_BIG,
 required:'빈 칸이 있어요. 계정·기간·금액을 채워 주세요.',bad_account:'고른 계정을 찾지 못했어요. 목록에서 다시 골라 주세요.',bad_period:'기간은 26Q4 또는 2610처럼 적어 주세요.',bad_number:'금액은 0 이상 정수(원)로 적어 주세요.',too_long:'메모가 너무 길어요. 500자 안으로 줄여 주세요.'};
const CC_STAT={add:'합계에 더함',ledger:'원장에 이미 있어 안 더함',part:'일부 달이 원장에 있어 안 더함',dup:'같은 달 다른 입력이 있어 안 더함',none:'이 계정은 합계에 없어 안 더함'};
function ccMonths(p){let m=/^(\d\d)Q([1-4])$/.exec(p||'');if(m){const q=+m[2];return [1,2,3].map(k=>m[1]+String((q-1)*3+k).padStart(2,'0'));}return /^\d{4}$/.test(p||'')?[p]:[];}
function ccMerge(){const done=PD_M.acc;done.forEach(a=>{if(a._cc){Object.keys(a._cc).forEach(y=>delete a.m[y]);}a._cc={};});CCS.stat={};const claimed={};
 [...CCS.items].sort((x,y)=>y.id-x.id).forEach(it=>{const a=done.find(x=>x.code===it.account_code),ms=ccMonths(it.period);if(!a||!ms.length){CCS.stat[it.id]='none';return;}
  const have=ms.filter(y=>a.m[y]!=null&&!(y in a._cc)).length;;if(have){CCS.stat[it.id]=have===ms.length?'ledger':'part';return;}
  const cl=claimed[a.code]||(claimed[a.code]=new Set());if(ms.some(y=>cl.has(y))){CCS.stat[it.id]='dup';return;}
  const per=Math.floor(it.amount_krw/ms.length);ms.forEach((y,i)=>{const v=i===ms.length-1?it.amount_krw-per*(ms.length-1):per;a.m[y]=v;a._cc[y]=v;cl.add(y);});CCS.stat[it.id]='add';});}
function ccApply(r){CCS.items=r.items||[];CCS.hist=r.history||[];CCS.acc=r.accounts||CCS.acc;CCS.memoMax=r.memo_max||500;CCS.loaded=true;ccMerge();}
function ccLoad(force){if(CCS.loading||(!force&&(CCS.loaded||CCS.tried)))return;CCS.tried=true;CCS.loading=true;CCS.err=null;
 V5.api('/api/mgmt/common-costs').then(ccApply).catch(e=>{CCS.err=V5.errInfo(e,'공통비 입력 내용을 불러오지 못했어요',CC_ERR);}).finally(()=>{CCS.loading=false;if(st.div==='mgmt')render();});}   // r12 c6: 더한 금액이 모든 단계의 숫자에 보이도록 어디서든 다시 그림
const ccAcc=c=>{const a=CCS.acc.find(x=>x.code===c);return a?`${a.name} ${a.code}`:c;};
function ccEntry(){const n=CCS.loaded?CCS.items.length:null;
 return `<section class="card" id="ccEntry"><div class="ct">공통비 입력 <span class="b b-g">직접 입력</span></div><div class="sub">회사 공통비의 실제 비용을 계정·기간별로 직접 적어요. 적은 금액은 그 기간 비용 합계에 더해요(원장에 이미 있는 달은 원장이 우선이라 안 더해요).${n==null?'':` · 지금 ${n}건 입력됨`}</div><button class="btn pri sm" id="ccOpen" data-cc="1" style="margin-top:12px">공통비 입력하기 →</button></section>`;}
function ccView(){
 const F=CCS.f,E=CCS.fe;const fld=(id,inId,label,inner,help)=>`<div class="fld"><label class="an" for="${inId}">${label}</label>${inner}${help?`<div class="fhelp">${help}</div>`:''}<div class="ferr" id="${id}Err" role="alert">${esc(E[id]||'')}</div></div>`;
 const opts=`<option value="">계정을 골라 주세요</option>`+CCS.acc.map(a=>`<option value="${esc(a.code)}"${F.account===a.code?' selected':''}>${esc(a.name)} ${esc(a.code)}</option>`).join('');
 const form=`<section class="card" id="ccForm"><div class="ct">공통비 입력 <span class="b b-g">직접 입력</span></div>
  <div class="sub">같은 계정·기간을 다시 저장하면 새 값으로 바뀌어 보이고, 이전 값은 이력에 남아요.</div>
  <div style="display:grid;gap:12px;margin-top:12px;max-width:520px">
  ${fld('ccAcc','ccAccSel','공통비 계정',`<select class="search" id="ccAccSel" aria-describedby="ccAccErr"${E.ccAcc?' aria-invalid="true"':''}>${opts}</select>`)}
  ${fld('ccPer','ccPerIn','기간',`<input class="search" id="ccPerIn" value="${esc(F.period)}" maxlength="4" autocomplete="off" aria-describedby="ccPerErr" placeholder="26Q4"${E.ccPer?' aria-invalid="true"':''}>`,'26Q4처럼 분기, 또는 2610처럼 연월로 적어요.')}
  ${fld('ccAmt','ccAmtIn','금액(원)',`<input class="search num" id="ccAmtIn" value="${esc(F.amount)}" inputmode="numeric" autocomplete="off" aria-describedby="ccAmtRead ccAmtErr" placeholder="예) 1,500,000"${E.ccAmt?' aria-invalid="true"':''}><output class="fhelp num" id="ccAmtRead" for="ccAmtIn">${esc(ccRead(F.amount))}</output>`,'0 이상 정수만 적어요(한 건 100억 원까지). 쉼표는 자동으로 넣어 줘요.')}
  ${fld('ccMemo','ccMemoIn','메모(선택)',`<textarea class="reason" id="ccMemoIn" rows="2" aria-describedby="ccMemoErr"${E.ccMemo?' aria-invalid="true"':''}>${esc(F.memo)}</textarea>`,`${CCS.memoMax}자까지 적을 수 있어요.`)}
  </div>
  <div id="ccMsg" style="margin-top:12px" aria-live="polite">${CCS.err?V5.errHtml(CCS.err):CCS.vmsg?`<div class="sub" id="ccVErr" role="alert"><b>${esc(CCS.vmsg)}</b></div>`:CCS.ok?`<div class="sub" id="ccOk" role="status"><b>${esc(CCS.ok)}</b></div>`:''}</div>
  <div style="margin-top:12px"><button class="btn pri sm" id="ccSave"${CCS.busy||!CCS.loaded?' disabled':''}${CCS.busy?' aria-busy="true"':''}>${CCS.busy?'저장 중이에요':'저장'}</button></div></section>`;
 const rows=CCS.items.map(it=>`<tr data-ccrow="${it.id}"><td>${esc(ccAcc(it.account_code))}</td><td class="num l">${esc(it.period)}</td><td class="num strong">${f(it.amount_krw)}</td><td class="nw" data-ccst="${(CCS.stat||{})[it.id]||''}">${esc(CC_STAT[(CCS.stat||{})[it.id]]||'-')}</td><td>${esc(it.memo||'-')}</td><td class="nw">${esc(it.by||'-')} · ${esc(V5.dt(it.at))}${it.versions>1?` · 수정 ${it.versions-1}회`:''}</td><td><button class="linkbtn" data-ccedit="${it.id}">고치기</button></td></tr>`).join('');
 const list=`<section class="card" id="ccList"><div class="ct">입력한 공통비 <span class="b b-g">직접 입력</span> <span class="ctsub num" id="ccN">${CCS.loaded?CCS.items.length+'건':''}</span></div>
  ${CCS.loading?'<div class="sub">불러오는 중이에요…</div>':!CCS.loaded?`<div class="sub">입력한 목록을 아직 불러오지 못했어요.</div><button class="btn sec sm" id="ccRetry" style="margin-top:8px">다시 불러오기</button>`:CCS.items.length?`<div style="overflow-x:auto"><table class="tbl sm" id="ccTbl"><thead><tr><th>계정</th><th>기간</th><th class="num">금액(원)</th><th>합계 반영</th><th>메모</th><th>입력</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`:emptyBox('ccEmpty','아직 입력한 공통비가 없어요','위 칸을 채우고 저장하면 여기에 보여요.')}</section>`;
 const hist=CCS.hist.length>CCS.items.length?acc('cchist','입력 이력',`${CCS.hist.length}건 · 새 줄이 쌓인 순서(최신 위)`,`<div style="overflow-x:auto"><table class="tbl sm hist" id="ccHistTbl"><thead><tr><th>시각</th><th>누가</th><th>계정</th><th>기간</th><th class="num">금액(원)</th><th>메모</th></tr></thead><tbody>${CCS.hist.map(h=>`<tr><td class="nw num">${esc(V5.dt(h.at))}</td><td class="nw">${esc(h.by||'-')}</td><td>${esc(ccAcc(h.account_code))}</td><td class="num l">${esc(h.period)}</td><td class="num">${f(h.amount_krw)}</td><td>${esc(h.memo||'-')}</td></tr>`).join('')}</tbody></table></div>`):'';
 return `<div><button class="linkbtn" id="ccBack" style="font-size:14px;color:#616161">‹ 비용 이슈</button></div>
 <div><div class="pg-eyebrow">경영지원본부 · 직접 입력</div><div class="pg-h">공통비 입력</div><div class="pg-s">여기서 적은 값은 실제 비용으로 보고 그 기간 합계에 더해요. 같은 계정·달에 ERP 원장(Z-IPS 마감) 값이 이미 있으면 원장만 쓰고 중복으로 합치지 않아요.</div></div>${form}${list}${hist?`<div class="accs">${hist}</div>`:''}`;}
function ccCheck(){const F=CCS.f,E={};if(!F.account)E.ccAcc='공통비 계정을 골라 주세요.';
 const per=F.period.trim();if(!per)E.ccPer='기간을 적어 주세요.';else if(!CC_PER.test(per))E.ccPer='기간은 26Q4 또는 2610처럼 적어 주세요.';
 const a=V5.amtParse(F.amount);if(a.v==null&&!a.err)E.ccAmt='금액을 적어 주세요.';else if(a.err)E.ccAmt='금액은 0 이상 정수(원)로 적어 주세요.';else if(a.v>CC_MAX)E.ccAmt=CC_BIG;
 if(F.memo.trim().length>CCS.memoMax)E.ccMemo=`메모는 ${CCS.memoMax}자까지 적을 수 있어요(지금 ${F.memo.trim().length}자). 줄여 주세요.`;
 return {E,v:a.v};}
function ccBind(){const q=id=>document.getElementById(id);if(!q('ccForm'))return;
 q('ccBack').onclick=()=>go({s:1,cc:null});
 q('ccAccSel').onchange=e=>{CCS.f.account=e.target.value;CCS.ok='';};
 q('ccPerIn').oninput=e=>{CCS.f.period=e.target.value;CCS.ok='';};
 q('ccAmtIn').onchange=q('ccAmtIn').oninput=e=>{const el=e.target,end=el.value.length-(el.selectionStart==null?el.value.length:el.selectionStart);const bad=/[^0-9,\s]/.test(el.value);   // 글자는 그대로 두고 오류만 알려요(지우면 입력이 사라져 놀라요)
  if(!bad){const t=ccFmt(el.value);if(t!==el.value){el.value=t;const p=Math.max(0,t.length-end);try{el.setSelectionRange(p,p)}catch(_){}}}
  CCS.f.amount=el.value;CCS.ok='';CCS.vmsg='';const ve=q('ccVErr');if(ve)ve.remove();const a=V5.amtParse(el.value);const m=a.err?'금액은 0 이상 정수(원)로 적어 주세요.':a.v>CC_MAX?CC_BIG:'';CCS.fe.ccAmt=m;
  q('ccAmtErr').textContent=m;q('ccAmtRead').textContent=m?'':ccRead(el.value);if(m)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');};
 q('ccMemoIn').oninput=e=>{CCS.f.memo=e.target.value;CCS.ok='';};
 const rt=q('ccRetry');if(rt)rt.onclick=()=>{ccLoad(true);render();};
 document.querySelectorAll('[data-ccedit]').forEach(b=>b.onclick=()=>{const it=CCS.items.find(x=>String(x.id)===b.dataset.ccedit);if(!it)return;CCS.f={account:it.account_code,period:it.period,amount:f(it.amount_krw),memo:it.memo||''};CCS.fe={};CCS.err=null;CCS.ok='';render();q('ccAmtIn').focus();});
 q('ccSave').onclick=async()=>{if(CCS.busy)return;const {E,v}=ccCheck();CCS.fe=E;CCS.err=null;CCS.ok='';CCS.vmsg='';
  const bad=['ccAcc','ccPer','ccAmt','ccMemo'].find(k=>E[k]);if(bad){CCS.vmsg=Object.values(E).join(' ');render();q({ccAcc:'ccAccSel',ccPer:'ccPerIn',ccAmt:'ccAmtIn',ccMemo:'ccMemoIn'}[bad]).focus();return;}// 저장 요청을 보내지 않아요
  CCS.busy=true;render();
  try{const r=await V5.api('/api/mgmt/common-costs','POST',{division:'MGMT',account_code:CCS.f.account,period:CCS.f.period.trim(),amount_krw:v,memo:CCS.f.memo.trim()||null});
   ccApply(r);CCS.ok=`저장했어요 · ${ccAcc(CCS.f.account)} ${CCS.f.period.trim()} ${f(v)}원 (직접 입력)`;CCS.f=ccBlank();}
  catch(e){CCS.err=V5.errInfo(e,'공통비를 저장하지 못했어요',CC_ERR);}
  CCS.busy=false;render();};}
// ---------- 채널 이동 ----------
let target=null,lastBatch=[],movBusy=false;
function openDialog(){const V=view();const L=V.filter(l=>st.sel.has(l.key));const ch=curCh();target=null;
 document.getElementById('modal').innerHTML=`<div class="mt">채널 이동</div><div class="sub">${L.length}줄 · ${esc(cur().title)} · 지금 채널 <b>${CHN[ch]}</b></div><div class="sub">${L.map(l=>`${ym2(l.ym)} ${amtMode()?f(l.amt)+'원':V5.vYm(l.amt,l.ym)}`).join(' · ')}</div><div class="an">어느 채널로 옮길까요?</div>
 ${CH.filter(([id])=>id!==ch).map(([id,n])=>`<label class="opt" data-t="${id}"><input type="radio" name="tg" value="${id}"><span class="an">${n}</span></label>`).join('')}
 <textarea class="reason" id="reason" rows="2" aria-label="이동 이유(선택)" placeholder="이유(선택) · 예: 월 탭 열 범위가 달라 잘못 붙었어요(#10)"></textarea><div class="sub">확인하면 합계가 바로 다시 계산되고, 이력에 누가 · 언제 · 원래 채널이 남아요.</div>
 <div id="mErr"></div><div class="mbtns"><button class="btn sec sm" id="mCancel">취소</button><button class="btn pri sm" id="mOk" disabled>이동</button></div>`;
 document.getElementById('mbg').classList.add('show');
 document.querySelectorAll('.opt').forEach(o=>o.onclick=()=>{if(movBusy)return;target=o.dataset.t;document.querySelectorAll('.opt').forEach(x=>x.classList.toggle('on',x===o));o.querySelector('input').checked=true;document.getElementById('mOk').disabled=false;});
 document.getElementById('mCancel').onclick=()=>{if(!movBusy)document.getElementById('mbg').classList.remove('show')};
 // U5: 옮기는 중에는 이동·취소·채널 고르기를 잠그고 '옮기는 중이에요', 실패하면 모달 안에 해요체 안내를 두고 다시 누를 수 있게 풀어요(예전: 토스트에 '이동 저장 실패: no_line' 같은 서버 코드)
 document.getElementById('mOk').onclick=async()=>{if(movBusy||!target)return;const reason=document.getElementById('reason').value.trim();const ok=document.getElementById('mOk'),cc=document.getElementById('mCancel');
  movBusy=true;ok.disabled=cc.disabled=true;ok.setAttribute('aria-busy','true');ok.textContent='옮기는 중이에요';document.getElementById('mErr').innerHTML='';
  try{const r=await V5.api('/api/online/moves','POST',{keys:L.map(l=>l.key),to:target,reason,division:'ONLINE'});V5.ST.moves=r.moves||V5.ST.moves;lastBatch=r.ids||[];}
  catch(e){movBusy=false;ok.disabled=cc.disabled=false;ok.removeAttribute('aria-busy');ok.textContent='이동';document.getElementById('mErr').innerHTML=V5.errHtml(V5.errInfo(e,'줄을 옮기지 못했어요',MOVE_O));return;}
  movBusy=false;document.getElementById('mbg').classList.remove('show');st.sel.clear();render();toast(`${lastBatch.length}줄을 ${CHN[target]}(으)로 옮겼어요`);};}
const MOVE_O={403:'온라인본부 권한이 있어야 채널을 옮길 수 있어요. 필요하면 경영지원본부에 권한을 요청해 주세요.',404:'이동 기능을 찾지 못했어요. 화면을 새로 고친 뒤 다시 해 주세요.',
 bad_move:'옮길 채널이나 줄이 비었어요. 줄과 채널을 다시 골라 주세요.',no_line:'고른 줄을 원본에서 찾지 못했어요. 화면을 새로 고친 뒤 다시 골라 주세요.',bad_key:'고른 줄을 읽지 못했어요. 화면을 새로 고친 뒤 다시 골라 주세요.'};
// U5: 되돌리는 중에는 누른 버튼(표의 '되돌리기'·토스트 '되돌리기')을 잠그고, 실패하면 빨간 토스트로 해요체 안내
let undoBusy=false;
async function undo(ids,btn){if(undoBusy)return;undoBusy=true;const t0=btn&&btn.textContent;if(btn){btn.disabled=true;btn.setAttribute('aria-busy','true');btn.textContent='되돌리는 중이에요';}
 try{const r=await V5.api('/api/online/moves/undo','POST',{ids,division:'ONLINE'});V5.ST.moves=r.moves||V5.ST.moves;undoBusy=false;render();toast('되돌렸어요',true);}
 catch(e){undoBusy=false;if(btn&&btn.isConnected){btn.disabled=false;btn.removeAttribute('aria-busy');btn.textContent=t0;}const x=V5.errInfo(e,'되돌리지 못했어요',{403:MOVE_O[403],404:MOVE_O[404]});toast(x.t+' · '+x.h,true,x.d);if(btn&&btn.id==='tundo')btn.style.display='';}}// 토스트에서 누른 경우 그 자리에서 다시 누를 수 있게
let tt;function toast(msg,noUndo,errCode){const T=document.getElementById('toast');document.getElementById('tmsg').textContent=(noUndo?'':'이동됨 · ')+msg;T.classList.toggle('bad',!!errCode);T.setAttribute('role',errCode?'alert':'status');T.title=errCode||'';
 const U=document.getElementById('tundo');U.style.display=noUndo?'none':'';U.disabled=false;U.textContent='되돌리기';U.onclick=()=>undo(lastBatch,U);T.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>T.classList.remove('show'),errCode?12000:8000);}
window.addEventListener('hashchange',()=>{parseHash();render();window.scrollTo(0,0)});
window.addEventListener('v5:ai',()=>{if(!document.getElementById('page'))return;if(st.s===4)render();else drawTM();});
V5.mount('flow');parseHash();render();window.R6_READY=true;
