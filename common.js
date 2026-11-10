// dev_r6(1차 개발): r6 공용 부품 → 서버 API 연결. 대화·임시 저장·절감 계획은 서버(dev_state.sqlite)에 저장, 화면 설정(보기·기준·사이드바 열림)만 브라우저에.
// r6: r5 공용 부품 복사본(기본 보기 = 매출 대비 비율 · 저장 키 v6_*)
// r5: r4 공용 부품 복사본(AI 사이드바 기본 열림 · 상시)
// r2 공용 부품: 사이드바, 본부 탭, 월별 막대, AI 대화 사이드바(로컬 스크립트 답변, Gemini 연결 없음)
(function(){
const PLAN_LABEL='절감 계획 작성하기'; // 본부장님 음성 '계산 계획/계산 제외간 작성하기' → [추정] 절감 계획
const K={draft:'v6_ai_draft',chat:'v6_ai_chat',open:'v6_ai_open',plans:'v6_saving_plans',pending:'v6_ai_pending_plan',flow:'v6_ai_plan_flow'};
const f=n=>Math.round(n).toLocaleString('ko-KR');
const sg=n=>{n=Math.round(n)||0;return (n>0?'+':'')+n.toLocaleString('ko-KR')};
const man=n=>{n=Math.round(n/10000);const e=Math.floor(Math.abs(n)/10000)*Math.sign(n),r=Math.abs(n)%10000;return e?(r?`${e}억 ${r.toLocaleString('ko-KR')}만원`:`${e}억원`):`${(n<0?'-':'')+r.toLocaleString('ko-KR')}만원`};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const kstParts=()=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).map(x=>[x.type,x.value]));
const kst=()=>{const p=kstParts();return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`};
const hm=()=>{const p=kstParts();return `${p.hour}:${p.minute}`};
const J=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
const S=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
// ---------- 서버 API(로그인 대역: X-User-Email · 개발용) ----------
const DEV_USER_KEY='r6_dev_user',DEFAULT_USER='jang_hoyeon@sannamchon.co.kr';
const devUser=()=>localStorage.getItem(DEV_USER_KEY)||DEFAULT_USER;
// r6nd U5(오버레이 static_app/common.js = static/common.js 복사본 + 수정): 오류를 종류별로 나눠(e.status·e.kind·e.code) 해요체 안내, 시간 초과, 응답이 JSON 이 아니면 오류로.
//   서버 원문(e.message·스택)은 화면에 안 쓰고, 개발 확인용으로 'HTTP 403 · division_forbidden' 같은 코드만 작게.
async function api(path,method,body){const o={method:method||'GET',headers:{'X-User-Email':devUser()}};if(body!==undefined){o.headers['Content-Type']='application/json';o.body=JSON.stringify(body);}
  const ac=typeof AbortController==='function'?new AbortController():null;let tm=null;if(ac){o.signal=ac.signal;tm=setTimeout(()=>ac.abort(),apiTimeout(path));}// 기본 30초(시험은 window.R6_API_TIMEOUT 로 줄여 확인)
  const fail=(kind,status,j)=>{const e=new Error(kind);e.kind=kind;e.status=status;e.code=j&&typeof j.error==='string'?j.error:'';e.body=j;return e;};
  let r;try{r=await fetch(path,o)}catch(x){clearTimeout(tm);throw fail(ac&&ac.signal.aborted?'timeout':'network',0,null);}
  let j=null,bad=false;try{j=await r.json()}catch(x){bad=true}clearTimeout(tm);
  if(bad&&ac&&ac.signal.aborted)throw fail('timeout',0,null);
  if(!r.ok)throw fail('http',r.status,j);
  if(bad||!j||typeof j!=='object')throw fail('bad',r.status,null);// 200 인데 JSON 이 아니면 성공으로 보지 않아요
  return j;}
// r8 P2: AI 경로(/api/ai/chat·/api/ai/plan)만 서버가 알려 준 시간 제한(state.ai.timeoutMs, 실측으로 정함), 나머지는 30초. 옛 서버(값 없음)는 30초
const AI_PATH=/^\/api\/ai\/(chat|plan)$/;
const apiTimeout=path=>window.R6_API_TIMEOUT||(AI_PATH.test(path)&&ST.ai&&ST.ai.timeoutMs>0?ST.ai.timeoutMs:30000);
const ERRC=/^[a-z_]{1,40}$/;
// 오류 안내: t = 무엇이 안 됐는지(제목), h = 원인·할 일 한 줄, d = 개발 확인용 코드. o 로 화면마다 403·404·400(코드별) 문구를 바꿔요
function errInfo(e,title,o){o=o||{};e=e||{};const s=e.status||0,c=e.code||'';let h;
  if(e.kind==='timeout')h='서버 응답이 너무 늦어요. 잠시 뒤 다시 눌러 주세요.';
  else if(e.kind==='network'||!s)h='서버에 연결하지 못했어요. 서버가 켜져 있는지 확인하고 잠시 뒤 다시 눌러 주세요.';
  else if(e.kind==='bad')h='서버 응답을 읽지 못했어요. 잠시 뒤 다시 눌러 주세요.';
  else if(s===403)h=c==='not_allowlisted'?'이 계정은 비용관리 권한이 없어요. 경영지원본부에 권한을 요청해 주세요.':(o[403]||'이 본부 자료는 바꿀 권한이 없어요. 필요하면 경영지원본부에 권한을 요청해 주세요.');
  else if(s===404)h=o[404]||'찾는 자료가 없어요. 화면을 새로 고친 뒤 다시 해 주세요.';
  else if(s===400)h=o[c]||o[400]||'서버가 이 내용을 받지 않았어요. 내용을 확인하고 다시 눌러 주세요.';
  else if(s===413)h='내용이 너무 길어요. 줄여서 다시 보내 주세요.';
  else h='서버에서 처리하지 못했어요. 잠시 뒤 다시 눌러 주세요. 계속되면 관리자에게 알려 주세요.';
  const d=(s?'HTTP '+s:e.kind==='timeout'?'시간 초과':'연결 안 됨')+(ERRC.test(c)?' · '+c:'');
  return {t:title,h,d,status:s,kind:e.kind||'',code:c};}
function errHtml(x,id){return x?`<div class="uerr" role="alert"${id?` id="${id}"`:''}><div class="uerr-t">${esc(x.t)}</div><div class="uerr-h">${esc(x.h)}</div><div class="uerr-d">${esc(x.d)}</div></div>`:'';}
// r6nd U6: 시각은 어디서나 24시간제 'YYYY. MM. DD. HH:MM'(서버 저장값 'YYYY-MM-DD HH:MM'). 모양이 다르면 받은 글 그대로
const dt=s=>{const m=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s||'');return m?`${m[1]}. ${m[2]}. ${m[3]}. ${m[4]}:${m[5]}`:(s||'-');};
// U6: 계획 칸 검사 = 서버 server_r6_app.plan_error 와 같은 규칙(필수 글 칸 빈 글 안 됨 · 기한 YYYY-MM-DD + 달력에 있는 날짜 · 목표 금액 비움 또는 0 이상 정수)
const PLAN_REQ=['account','vendor','method','target','due','basis'];
const PLAN_OBJ={account:'계정을',vendor:'업체를',method:'방법을',target:'목표를',due:'기한을',basis:'근거 숫자를',target_amount_krw:'목표 금액을'};
const PLAN_LBL={account:'계정',vendor:'업체',method:'방법',target:'목표',due:'기한',basis:'근거 숫자',target_amount_krw:'목표 금액'};
const AMT_MSG='목표 금액은 0 이상 정수(원)로 적어 주세요.';
// R6ND-19: 글 칸 길이 상한(서버 PLAN_MAX 와 같음) · 넘으면 칸 안내(말없이 자르지 않아요)
const PLAN_MAX={account:200,vendor:200,method:500,target:500,basis:2000};
const tooLong=(k,n)=>`${PLAN_LBL[k]||k} 칸은 ${PLAN_MAX[k]}자까지 적을 수 있어요(지금 ${n}자). 줄여 주세요.`;
// R6ND-17: 계획 목표 문구는 금액에서 자동(서버 target_text 와 같음)
const targetText=v=>Number.isSafeInteger(v)?`${f(v)}원 / 분기`:'목표 금액 입력 필요';
// r7 P1(R6ND-17): 계획 목표는 화면에 한 줄. 금액이 있으면 금액 문구, 없으면 예전 문구(없으면 '목표 금액 입력 필요'). 초안(draft)은 저장될 문구 = 금액 문구.
//   예전 AI 목표 문구가 그 줄과 다르면 o 로 돌려줘서 title 에만 둬요(DB 문구는 지우지 않아요)
const planTgt=(p,draft)=>{p=p||{};const a=p.target_amount_krw,s=typeof p.target==='string'?p.target.trim():'';const t=draft||Number.isSafeInteger(a)?targetText(a):(s||targetText(null));return {t,o:s&&s!==t?s:'',amt:Number.isSafeInteger(a)};};
function dueErr(s){s=String(s==null?'':s).trim();if(!s)return PLAN_OBJ.due+' 적어 주세요.';const m=/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);if(!m)return '기한은 2026-12-31처럼 연-월-일 숫자로 적어 주세요.';
  const y=+m[1],mo=+m[2],d=+m[3],t=new Date(0);t.setUTCFullYear(y,mo-1,d);// setUTCFullYear: 0~99년도 1900년대로 바꾸지 않음(서버 datetime.date 와 같게)
  return y<1||t.getUTCFullYear()!==y||t.getUTCMonth()!==mo-1||t.getUTCDate()!==d?`달력에 없는 날짜예요(${s}). 날짜를 다시 확인해 주세요.`:'';}
function amtParse(s){s=String(s==null?'':s).replace(/[\s,]/g,'');if(!s)return {v:null};const v=Number(s);return /^[0-9]+$/.test(s)&&Number.isSafeInteger(v)?{v}:{err:AMT_MSG};}
function planCheck(p,partial){const E={};if(!p||typeof p!=='object')return {plan:'계획 내용을 읽지 못했어요.'};
  PLAN_REQ.forEach(k=>{if(!(k in p)){if(!partial)E[k]=PLAN_OBJ[k]+' 적어 주세요.';return;}const v=p[k];if(typeof v!=='string'||!v.trim()){E[k]=PLAN_OBJ[k]+' 적어 주세요.';return;}if(k==='due'){const d=dueErr(v);if(d)E.due=d;}});
  if('target_amount_krw' in p){const v=p.target_amount_krw;if(v!=null&&!(Number.isSafeInteger(v)&&v>=0))E.target_amount_krw=AMT_MSG;}
  Object.keys(PLAN_MAX).forEach(k=>{if(!E[k]&&typeof p[k]==='string'&&p[k].trim().length>PLAN_MAX[k])E[k]=tooLong(k,p[k].trim().length);});
  return E;}
// 서버 400(칸 검사) 코드별 안내: 어느 칸인지(e.body.field)까지 말해요
function planErrO(e,o){const fl=e&&e.body&&e.body.field;return Object.assign({required:(PLAN_OBJ[fl]||'빈 칸을')+' 적어 주세요. 빈 칸이 있으면 저장하지 않아요.',bad_date:'기한이 없는 날짜이거나 형식이 달라요. 2026-12-31처럼 적어 주세요.',bad_number:AMT_MSG,too_long:fl&&PLAN_MAX[fl]?tooLong(fl,e.body.len||0):'글이 너무 길어요. 줄여서 다시 저장해 주세요.'},o||{});}
// 계획 목록 순서 = 최근 수정 순(수정 없으면 작성 시각). 서버도 같은 순서로 주고(같은 분이면 마지막 이력 먼저), 화면은 시각만 다시 맞춰요(같으면 서버 순서 그대로)
const plansSorted=()=>ST.plans.slice().sort((a,b)=>String(b.updatedAt||b.savedAt||'').localeCompare(String(a.updatedAt||a.savedAt||'')));
// 작성자·수정자 줄: 계획 카드(4단계)·사이드바 목록 같은 모양. 이름은 서버가 준 그대로(app_user 이름, 없으면 서버 기존 대체값)
const planMeta=p=>`<div class="pmeta"><span class="pm-c">작성 ${esc(p.by||'-')} · ${esc(dt(p.savedAt))}</span>${p.updatedAt?`<span class="pm-u">수정 ${esc(p.updatedBy||'-')} · ${esc(dt(p.updatedAt))}</span>`:''}</div>`;
const ST={chat:[],plans:[],moves:[],draft:null,pending:null,flow:null,fixOpen:false,me:null,allowed:[],busy:false,busyKind:'',err:'',ai:null,aiNote:'',trash:null};
function initState(state,me){ST.ai=state.ai||null;ST.trash=state.trash&&state.trash.days>0?state.trash:null;/* r8 P3: 최근 삭제·되돌리기(옛 서버면 null = 숨김) */ST.chat=state.chat||[];ST.plans=state.plans||[];ST.moves=state.moves||[];ST.draft=state.draft||null;ST.me=me.user;ST.allowed=me.allowed_divisions||[];ST.pending=J(K.pending,null);
  /* r10 계획 대화: 진행 상태는 대화와 함께 이어져요. 서버 대화가 비었으면(대화 지우기) 그 대화의 진행 상태도 버려요 */ST.flow=ST.chat.length?J(K.flow,null):null;if(!ST.flow)try{localStorage.removeItem(K.flow)}catch(e){}
  restoreDraft();}
// r13 c6(본부장님 보완 2): 임시 저장 실패 - 원인(로그인 풀림·연결 안 됨·글 길이 등)을 말하고, 다시 시도 버튼을 주고, 쓴 글은 이 브라우저에도 보관해요(새로고침·다시 로그인 뒤 되살림).
//  예전에는 로그인이 풀려 401 이 와도 항상 같은 안내만 나와서 다시 적어도 저장되지 않았어요.
const DLK=()=>'r13_draft_'+String((ST.me&&ST.me.email)||ST.me||'');
const dlGet=()=>{try{return JSON.parse(localStorage.getItem(DLK())||'null')}catch(e){return null}};
const dlSet=o=>{try{if(o)localStorage.setItem(DLK(),JSON.stringify(o));else localStorage.removeItem(DLK())}catch(e){}};
function draftCause(e){const x=errInfo(e,''),c=x.code;const r=draftCause0(x,c);r.h=x.h;return r;}
function draftCause0(x,c){
  if(x.status===401)return {m:'로그인이 풀렸어요(서버를 다시 켰거나 12시간이 지났어요)',login:true,d:x.d};
  if(x.status===403&&c==='csrf')return {m:'주소가 달라요 · 127.0.0.1:8781 주소로 열어 주세요',d:x.d};
  if(x.status===403)return {m:'이 계정은 임시 저장 권한이 없어요',d:x.d};
  if(x.status===413)return {m:'글이 너무 길어요(줄이면 다시 저장돼요)',d:x.d,long:true};   // r7 P3: 413 은 기다려도 저장되지 않아서 줄이라고 안내
  if(x.kind==='timeout')return {m:'서버 응답이 늦어요',d:x.d};
  if(x.kind==='network'||!x.status)return {m:'서버에 연결하지 못했어요',d:x.d};
  return {m:'서버에서 처리하지 못했어요',d:x.d};}
function showDraft(){const s=document.getElementById('aiSaved');const f=ST.draftErr;if(!s||!f)return;
  s.classList.add('bad');s.title=f.h+' ('+f.d+')';
  if(f.long){s.textContent='임시 저장하지 못했어요 · 글은 그대로 있어요 · '+f.m;return;}   // 글이 너무 길면 다시 시도·보관은 소용없어요(줄여야 해요)
  s.innerHTML='임시 저장하지 못했어요 · 글은 그대로 있어요 · '+esc(f.m)+' · 이 브라우저에도 보관했어요 <button type="button" class="linkbtn" id="aiSaveRetry">'+(f.login?'다시 로그인':'다시 시도')+'</button>';
  document.getElementById('aiSaveRetry').onclick=()=>{if(f.login)location.reload();else retryDraft();};}
const draftFail=e=>{ST.draftErr=draftCause(e);if(ST.draftErr.long)dlSet(null);showDraft();};
let draftT=null;
function saveDraft(text,now){ST.draft=text?{text,at:hm()}:null;dlSet(text?{text,at:hm(),pending:true}:null);clearTimeout(draftT);
  const run=()=>api('/api/ai/draft','PUT',{text}).then(()=>{ST.draftErr=null;const l=dlGet();if(l&&l.text===text)dlSet({text:l.text,at:l.at,pending:false});
    const s=document.getElementById('aiSaved');if(s&&text){s.classList.remove('bad');s.title='';s.textContent='임시 저장됨 '+hm();}}).catch(draftFail);
  if(now)run();else draftT=setTimeout(run,300);}
const retryDraft=()=>{const ta=document.getElementById('aiText');saveDraft(ta?ta.value:((ST.draft&&ST.draft.text)||''),true);};
function restoreDraft(){const l=dlGet();if(l&&l.pending&&l.text&&(!ST.draft||ST.draft.text!==l.text)){ST.draft={text:l.text,at:l.at};setTimeout(()=>saveDraft(l.text,true),0);}}   // 저장 못 한 글이 브라우저에 남아 있으면 되살리고 다시 저장해 봐요
window.addEventListener('online',()=>{if(ST.draftErr&&!ST.draftErr.login)retryDraft();});
const MONTHS=['2507','2508','2509','','2601','2602','2603','2604','2605','2606','2607','2608','2609','2610'];
const per=ym=>ym.startsWith('25')?(+ym.slice(2)>=10?'25Q4':'25Q3'):(+ym.slice(2)<=6?'26H1':+ym.slice(2)>=10?'26M10':'26Q3');   // r13 c2: 25.10~12 는 25Q4
// r8 P3(D7-8): 좁은 본문(u7.css 와 같은 @container main (max-width:720px), r8_p3.css)에서만 보이는 막대 위 짧은 값(1만 이상).
//  숫자는 소수 1자리까지 · 끝 '.0' 은 빼요('1만'). 막대 칸(1280 + AI 열림 38px)에 한 줄로 들어가게 숫자 3자리까지:
//  1.6만 · 16.2만 → 100만부터 162만 → 1,000만부터 0.16억 → 1억부터 1.2억 · 12.3억 → 100억부터 123억. 정확한 원 값은 title·아래 표·그림 이름(aria-label)
const nS=x=>x.toLocaleString('ko-KR',{maximumFractionDigits:2});
function manS(v){let x=Math.round(v/1e3)/10;if(x<100)return nS(x)+'만';x=Math.round(v/1e4);if(x<1000)return nS(x)+'만';
  x=Math.round(v/1e6)/100;if(x<1)return nS(x)+'억';x=Math.round(v/1e7)/10;if(x<100)return nS(x)+'억';return nS(Math.round(v/1e8))+'억';}
function chart(title,sub,vals,isPct){ // vals: {ym:amt}
  const arr=MONTHS.filter(Boolean).map(y=>vals[y]||0);const mx=Math.max(...arr)||1;
  // r6nd U8: 막대 그래프 = 그림 하나 + 달별 값 이름(화면 막대와 같은 값). 막대 칸은 글자 없는 요소라 따로 읽지 않아요
  const al=`${title} 막대 그래프 · `+MONTHS.filter(Boolean).map(y=>{const v=vals[y]||0;return `${y.slice(0,2)}.${y.slice(2)} ${isPct?v.toFixed(1)+'%':f(v)+'원'}`}).join(', ')+' · 25.10~12 비교 기간 없음';
  return `<section class="card"><div class="ct">${title} <span class="ctsub">${sub}</span></div><div class="chart" role="img" aria-label="${esc(al)}">${MONTHS.map(ym=>{if(!ym)return '<div class="bar gap"><div class="bb"></div><div class="bl">25.10~12<br>비교 기간 없음</div></div>';const v=vals[ym]||0;const cls=per(ym)==='25Q3'?'q3':per(ym)==='26H1'?'h1':'cur';
  return `<div class="bar"><div class="bb">${cls==='cur'?`<div class="bt num"${!isPct&&v>=1e4?` title="${f(v)}원"`:''}>${isPct?v.toFixed(1)+'%':!isPct&&v>=1e4?`<span class="bt-w">${v>=1e6?f(v/1e4)+'만':f(v)}</span><span class="bt-n">${manS(v)}</span>`:f(v)}</div>`:''}<div class="bf ${cls}" style="height:${Math.round(v/mx*150)}px"></div></div><div class="bl">${ym.slice(0,2)}.${ym.slice(2)}</div></div>`}).join('')}</div>
  <div class="legend"><span><i class="q3"></i>2025 Q3</span><span><i class="h1"></i>2026 H1</span><span><i class="cur"></i>2026 Q3</span></div></section>`;}
function sidebar(active){const n=ST.plans.length;const it=[['flow','비용 이슈','flow.html#div=prod&s=1'],['hm','히트맵','flow.html#div=prod&s=1&hm=acc'],['price','자재 단가','flow.html#div=prod&s=1&hm=price'],['online','온라인 이슈','flow.html#div=online&s=1'],['plan','절감계획','flow.html#div=prod&s=4']];
  return `<div class="brand">비용관리 v5</div><div class="brand-s">Z-IPS 2609 마감 기준</div>${it.map(([k,t,h])=>`<a class="nav${k===active?' on':''}" href="${h}" data-nav="${k}">${t}${k==='plan'?`<span class="cnt" id="planCnt">${n}건</span>`:''}</a>`).join('')}
  <div class="side-b"><div class="cap">보기 권한 · 로그인 대역(개발)</div><div class="sel" id="whoami">${esc(ST.me?(ST.me.name+(ST.me.title?' '+ST.me.title:'')):'-')} · ${ST.allowed.length>=3?'전체(ALL)':esc(ST.allowed.map(d=>({PROD:'생산',ONLINE:'온라인',MGMT:'경영지원'}[d]||d)).join('·'))}</div></div>`;}
function tabs(active){return `<div class="tabs"><a class="tab${active==='prod'?' on':''}" href="production_home.html">생산본부</a><a class="tab${active==='online'?' on':''}" href="online.html">온라인본부</a>${ST.allowed.includes('MGMT')?`<a class="tab${active==='mgmt'?' on':''}" href="flow.html#div=mgmt&s=1">경영지원본부</a>`:'<span class="tab dis">경영지원본부</span>'}</div>`;}

// ---------- 금액 | 비율 토글(공용) ----------
const PMON={'25Q4':['2510','2511','2512'],'25Q3':['2507','2508','2509'],'26H1':['2601','2602','2603','2604','2605','2606'],'26Q3':['2607','2608','2609']};
const PMN={'25Q4':3,'25Q3':3,'26H1':6,'26Q3':3};
const NOS='<span class="nos">매출 줄 없음</span>';
let SALES={},BASES=[],KIND='prod';
const mode=()=>J('v6_view_mode','ratio'); // r6: 처음 열면 비율
const basis=()=>{if(!BASES.length)return null;const b=J('v6_ratio_basis_'+KIND,null);return BASES.some(x=>x[0]===b)?b:BASES[0][0]};
const basisLabel=()=>(BASES.find(x=>x[0]===basis())||['',''])[1];
function setBases(kind,bases,sales){KIND=kind;BASES=bases;SALES=sales;}
function salesP(p,b){const m=SALES[b||basis()];if(!m)return null;let t=0;for(const y of PMON[p]){if(m[y]==null)return null;t+=m[y];}return t;}
function salesM(ym,b){const m=SALES[b||basis()];return m&&m[ym]!=null?m[ym]:null;}
const pct=(v,base)=>base?(v/base*100).toFixed(1)+'%':NOS;
const ratioP=(cost,p)=>{const s=salesP(p);return s?cost/s*100:null};
function vP(cost,p){return mode()==='amt'?f(cost/PMN[p]):pct(cost,salesP(p));} // cost = 기간 합계
function vYm(cost,ym){return mode()==='amt'?f(cost):pct(cost,salesM(ym));}
function dP(costA,pA,costB,pB){if(mode()==='amt')return sg(costA/PMN[pA]-costB/PMN[pB]);const a=ratioP(costA,pA),b=ratioP(costB,pB);if(a==null||b==null)return NOS;const d=a-b;return (d>0?'+':'')+d.toFixed(1)+'%p';}
function bigP(cost,p){if(mode()==='amt')return man(cost/PMN[p]);const r=ratioP(cost,p);return r==null?NOS:r.toFixed(1)+'%';}
function leadP(cost26,costH1){if(mode()==='amt')return `2026 H1보다 월 ${sg(cost26/3-costH1/6)}원${cost26/3-costH1/6>=0?' 많아요':'적어요'}.`;const a=ratioP(cost26,'26Q3'),b=ratioP(costH1,'26H1');if(a==null)return `${basisLabel()} 기준 · `+NOS;return `${basisLabel()} 대비예요. 2026 H1(${b==null?'-':b.toFixed(1)+'%'})보다 ${b==null?'-':((a-b>=0?'+':'')+(a-b).toFixed(1)+'%p')}.`;}
const unitTxt=()=>mode()==='amt'?'원(월평균)':`비율 · ${basisLabel()} 대비`;
function toggleHtml(){const m=mode();return `<div class="vt" id="viewToggle"><span class="seg vseg"><button data-mode="ratio" class="${m==='ratio'?'on':''}">비율</button><button data-mode="amt" class="${m==='amt'?'on':''}">금액</button></span>${m==='ratio'?`<span class="vtl">기준</span><span class="seg bseg" id="basisSeg">${BASES.map(([id,l])=>`<button data-basis="${id}" class="${id===basis()?'on':''}">${l}</button>`).join('')}</span>`:''}</div>`;}
function bindToggle(rerender){document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{S('v6_view_mode',b.dataset.mode);rerender()});document.querySelectorAll('[data-basis]').forEach(b=>b.onclick=()=>{S('v6_ratio_basis_'+KIND,b.dataset.basis);rerender()});}
function chartM(title,sub,vals){ // 금액 또는 비율 월별 막대
  if(mode()==='amt')return chart(title,sub+' · 원',vals);
  const rv={};let miss=[];for(const y of MONTHS){if(!y)continue;const s=salesM(y);if(vals[y]!=null&&s)rv[y]=vals[y]/s*100;else if(vals[y])miss.push(y);}
  return chart(title,sub+` · 비율(${basisLabel()} 대비)`,rv,true)+(miss.length?`<div class="sub">${miss.join(', ')}: ${NOS}</div>`:'');}
// ---------- 로컬 답변 엔진(예시) ----------
function pctTxt(a,b){return b?`${((a-b)/b*100).toFixed(1)}%`:'-'}
function priceRise(p){ // 월별 단가에서 마지막 변동
  const ms=Object.keys(p.m).sort();let prev=null,rise=null;for(const ym of ms){const [s,q]=p.m[ym];if(!q)continue;const u=Math.round(s/q);if(prev&&u!==prev.u)rise={ym,from:prev.u,to:u};prev={ym,u};}return rise;}
function periodQty(p,pp){return Object.entries(p.m).filter(([y])=>per(y)===pp).reduce((a,[,v])=>a+v[1],0)}
function periodAmt(p,pp){return Object.entries(p.m).filter(([y])=>per(y)===pp).reduce((a,[,v])=>a+v[0],0)}
function saving(p){const r=priceRise(p);if(!r||r.to<=r.from)return 0;return (r.to-r.from)*periodQty(p,'26Q3');}
function answer(q,ctx){const T=[];const has=(...w)=>w.some(x=>q.includes(x));
  const mv=ctx.monthly||{};const avg=pp=>{const ks=Object.keys(mv).filter(y=>per(y)===pp);return ks.length?ks.reduce((a,y)=>a+mv[y],0)/({'25Q3':3,'26H1':6,'26Q3':3}[pp]):0};
  const prices=ctx.prices||[];const bd=(ctx.breakdown||[]).slice();
  if(has('단가','올랐','가격')){const rs=prices.map(p=>[p,priceRise(p)]).filter(x=>x[1]);
    T.push(rs.length?`단가가 바뀐 자재예요.\n`+rs.map(([p,r])=>`· ${p.name}: ${f(r.from)}원 → ${f(r.to)}원(${r.ym.slice(0,2)}.${r.ym.slice(2)}부터, ${pctTxt(r.to,r.from)})`).join('\n'):(prices.length?'고른 자재들은 기간 중 단가가 그대로예요.':'이 화면에는 단가 줄이 없어요. 업체를 고르면 자재 단가로 볼 수 있어요.'));}
  if(has('수량','몇 개','사용량')){T.push(prices.length?'2026 Q3 수량이에요.\n'+prices.slice(0,5).map(p=>`· ${p.name}: ${f(periodQty(p,'26Q3'))}개 (26H1 ${f(periodQty(p,'26H1'))}개)`).join('\n'):'이 화면에는 수량 줄이 없어요.');}
  if(has('업체','어디','거래처','채널','항목')){bd.sort((a,b)=>b.m26-a.m26);const tot=bd.reduce((a,b)=>a+b.m26,0);
    T.push(`${ctx.breakdownLabel||'구성'}별 2026 Q3 월평균 상위예요.\n`+bd.slice(0,3).map(b=>`· ${b.name}: ${f(b.m26)}원(${tot?(b.m26/tot*100).toFixed(1):0}%, 26H1 대비 ${sg(b.m26-b.mH1)}원)`).join('\n'));}
  if(has('늘','증가','왜','많')){const a=avg('26Q3'),b=avg('26H1');const top=bd.slice().sort((x,y)=>(y.m26-y.mH1)-(x.m26-x.mH1))[0];const mxm=Object.keys(mv).sort((x,y)=>mv[y]-mv[x])[0];
    T.push(`${ctx.title} 2026 Q3 월평균은 ${f(a)}원으로 26H1(${f(b)}원)보다 ${sg(a-b)}원(${pctTxt(a,b)})이에요. 가장 큰 달은 ${mxm?mxm.slice(0,2)+'.'+mxm.slice(2):'-'}(${f(mv[mxm]||0)}원)이에요.`+(top?`\n가장 많이 늘어난 ${ctx.breakdownLabel||'구성'}은 ${top.name}(${sg(top.m26-top.mH1)}원/월)이에요.`:''));}
  if(has('절감','줄일','아이디어','방법','계획')){const s=prices.map(p=>[p,saving(p)]).filter(x=>x[1]>0);const tot=s.reduce((a,x)=>a+x[1],0);
    T.push(s.length?`단가를 오르기 전으로 되돌리면 2026 Q3 수량 기준 ${f(tot)}원이 줄어요(추정 계산).\n`+s.map(([p,v])=>`· ${p.name}: ${f(v)}원`).join('\n')+`\n방법: 단가 재협상, 대체 업체 견적 비교, 분기 물량 묶음 발주.`:`단가 자료로 계산할 수 있는 절감액이 없어요. 상위 ${ctx.breakdownLabel||'구성'}부터 계약 조건을 보는 걸 권해요.`);}
  if(!T.length){const a=avg('26Q3'),b=avg('26H1');T.push(`${ctx.title}의 2026 Q3 월평균은 ${f(a)}원, 26H1보다 ${sg(a-b)}원이에요. ‘단가’, ‘업체’, ‘수량’, ‘왜 늘었나’, ‘절감 방법’으로 물어보면 이 화면 숫자로 답해요.`);}
  return T.join('\n\n');}
function makePlan(ctx,chat){const us=chat.filter(m=>m.role==='u').map(m=>m.text).join(' ');
  const meth=[];if(/단가|가격|협상/.test(us))meth.push('단가 재협상');if(/견적|다른 업체|대체/.test(us))meth.push('대체 업체 견적 비교');if(/묶|물량|분기/.test(us))meth.push('분기 물량 묶음 발주');if(/사용|줄이|아끼/.test(us))meth.push('사용량 절감');if(!meth.length)meth.push('단가 재협상');
  const prices=ctx.prices||[];const s=prices.map(p=>[p,saving(p),priceRise(p)]).filter(x=>x[1]>0);const tgt=s.reduce((a,x)=>a+x[1],0);
  const vendor=ctx.focus||((ctx.breakdown||[]).slice().sort((a,b)=>b.m26-a.m26)[0]||{}).name||'(입력 필요)';
  const basis=s.length?s.map(([p,,r])=>`${p.name} ${f(r.from)}→${f(r.to)}원 × 26Q3 ${f(periodQty(p,'26Q3'))}개`).join(' · '):`${ctx.title} 26Q3 월평균 ${f(Object.keys(ctx.monthly||{}).filter(y=>per(y)==='26Q3').reduce((a,y)=>a+ctx.monthly[y],0)/3)}원`;
  return {account:ctx.account||ctx.title,vendor,method:meth.join(' · '),target:tgt?`${f(tgt)}원 / 분기(추정 계산)`:'(입력 필요)',due:'2026-12-31',basis,turns:chat.length};}
// ---------- r10 AI 절감 계획 대화(2026-10-21 본부장님: 내가 쓴 내용 그대로 · 목표 금액·기한은 대화로 묻고 다 차면 '등록할까요') ----------
// 계획 문장 알아보기 = 서버 plan_r10.looks_plan 과 같은 규칙(질문이 아니고, 줄이는 말 + 다짐 말끝·금액·날짜)
const PQ=/[?？]|(까요|나요|는지|어때|어떻게|뭐야|알려|보여)\s*[.!]*\s*$/,PV=/(줄이|줄여|줄일|낮추|낮출|낮춰|절감|아끼|아껴|바꾸|바꿔|바꿀|변경|교체|협상|견적|비교|묶|통합|전환|없애|끊|중단)/,
 PE=/(자|하자|보자|겠어요|겠습니다|겠다|게요|할게|할래요|할래|하려고 해요|하려고|기로 해요|기로|합시다|하기|할 거예요|목표|계획)\s*[.!~]*\s*$/,
 PA=/(?<![\d.])((?:\d[\d,]*(?:\.\d+)?\s*(?:억|천만|백만|십만|만|천)\s*)+(?:\d[\d,]*\s*)?원?|\d[\d,]*\s*원)/,PD1=/(?<!\d)(\d{4})\s*(?:[.\-/]|년)\s*(\d{1,2})\s*(?:[.\-/]|월)\s*(\d{1,2})(?!\d)/,PD2=/(?<![\d.])(\d{1,2})\s*월\s*(\d{1,2})\s*일/,PD3=/(?:(\d{4})\s*년\s*)?(?<!\d)(\d{1,2})\s*월\s*(?:말|까지|안에|중|이내)/;
function looksPlan(t){t=String(t||'').trim();if(!t||PQ.test(t)||!PV.test(t))return false;return PE.test(t)||PA.test(t)||PD1.test(t)||PD2.test(t)||PD3.test(t);}
const FLOW_LBL={account:'계정',vendor:'대상',method:'방법',target_amount_krw:'목표 금액',due:'기한'};
const FLOW_FIX=['vendor','method','target_amount_krw','due'];
function setFlow(f){ST.flow=f||null;ST.fixOpen=false;try{f?S(K.flow,f):localStorage.removeItem(K.flow)}catch(e){}}
const flowAsk=()=>!!(ST.flow&&ST.flow.step==='ask');
const planFlowOn=()=>!!(ST.ai&&ST.ai.planFlow);// 서버가 계획 대화를 받을 때만(/api/state ai.planFlow). 다시 시작 전 옛 서버면 예전처럼 바로 초안
// r13 c7(본부장님 보완): 본부 탭을 바꾸면 이전 본부의 계획 초안·작성 중 상태·대화가 남아 보였어요. 이제 본부마다 따로 둬요.
//  계획 작성 상태(flow)·확인 카드(pending)는 본부별 보관함(r13_pf_<본부>)으로 옮기고, 대화 글은 본부 꼬리표(r13_cd_<사용자>, 글 순서대로)를 붙여 그 본부에서만 보여요(꼬리표 없는 예전 글은 처음 연 본부의 글로 쳐요).
const PFK=d=>'r13_pf_'+d,PFC='r13_pf_cur',CDK=()=>'r13_cd_'+String((ST.me&&ST.me.email)||ST.me||'');
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
const lsSet=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
function pfSwitch(d){if(!d)return false;let cur=null;try{cur=localStorage.getItem(PFC)}catch(e){}
  if(!cur)cur=(ST.flow&&ST.flow.division)||d;
  try{localStorage.setItem(PFC,d)}catch(e){}
  if(cur===d)return false;
  lsSet(PFK(cur),(ST.flow||ST.pending)?{flow:ST.flow||null,pending:ST.pending||null}:null);
  const n=lsGet(PFK(d))||{};ST.flow=n.flow||null;ST.pending=n.pending||null;ST.fixOpen=false;ST.err='';ST.retry=null;lsSet(K.flow,ST.flow);lsSet(K.pending,ST.pending);return true;}
const cdGet=()=>{const a=lsGet(CDK());return Array.isArray(a)?a:[]};
function cdTag(from,d){const a=cdGet();while(a.length<from)a.push(d||null);a.length=from;for(let i=from;i<ST.chat.length;i++)a.push(d||null);lsSet(CDK(),a);}
function cdFill(d){if(!d||!ST.chat.length)return;const a=cdGet();if(a.length>=ST.chat.length)return;while(a.length<ST.chat.length)a.push(d);lsSet(CDK(),a);}   // 꼬리표 없는 예전 글은 처음 연 본부의 글로 쳐요
function visChat(){const d=CTX&&CTX.division;if(!d)return ST.chat;const a=cdGet();return ST.chat.filter((m,i)=>!a[i]||a[i]===d);}
// act: start(버튼·계획 문장) · answer(물은 칸에 답) · fix(고칠 칸). 저장은 하지 않아요(등록 버튼만 /api/plans)
async function planTurn(act,text,o){o=o||{};text=(text||'').trim();if(ST.busy)return;const before=ST.chat,dv=CTX.division;
  if(text)ST.chat=ST.chat.concat([{role:'u',text,page:CTX.title,at:kst()}]);if(o.fromInput&&text){ST.draft=null;ST.draftErr=null;dlSet(null);clearTimeout(draftT);}
  const bk=act==='answer'?'send':'plan';busyOn(bk);live(WAIT[bk]);
  try{const r=await api('/api/ai/plan','POST',{flow:ST.flow||{},act,text,field:o.field||null,ctx:CTX,page:CTX.title,division:CTX.division,clearDraft:!!(o.fromInput&&text)});
    ST.chat=r.chat||ST.chat;cdTag(before.length,dv);setFlow(r.flow||null);ST.pending=r.plan||null;try{ST.pending?S(K.pending,ST.pending):localStorage.removeItem(K.pending)}catch(e){}
    ST.err='';ST.retry=null;live(r.plan?'초안이 왔어요':r.flow?'질문이 왔어요':'답이 왔어요');}
  catch(e){ST.chat=before;live(act==='answer'?'답을 받지 못했어요':'초안을 받지 못했어요');
    ST.retry=e.kind==='timeout'||e.kind==='network'||e.status===429||e.status>=500?{text,fromInput:!!o.fromInput,plan:act==='answer'?'':act,field:o.field||null}:null;
    ST.err=act==='answer'?errInfo(e,'AI 답을 받지 못했어요',{403:'이 본부 화면은 물어볼 권한이 없어요. 필요하면 경영지원본부에 권한을 요청해 주세요.'}):errInfo(e,'절감 계획 초안을 만들지 못했어요',{403:'이 본부 화면은 계획을 만들 권한이 없어요. 필요하면 경영지원본부에 권한을 요청해 주세요.'});
    if(o.fromInput&&text){saveDraft(text);ST.err.h+=' 보내지 못한 글은 입력칸에 그대로 두었어요.';}}
  busyOff();renderAI();const pc=document.getElementById('planCard');if(pc)pc.scrollIntoView({block:'nearest'});}
// ---------- AI 사이드바 ----------
let CTX={title:'',chips:[]};
// U5: 저장·전송 중에는 AI 창 버튼을 모두 잠그고(누른 버튼에 '…중이에요'), 끝나면(성공·실패 모두) 풀어요. 실패는 해요체 안내(ST.err = errInfo 결과)
const BUSY={send:'답 만드는 중이에요',plan:'초안 만드는 중이에요',save:'저장 중이에요',clear:'지우는 중이에요'};
// r10: 답·초안을 기다리는 동안 AI 자리에 '답을 만드는 중이에요' + 움직이는 점 세 개 + 경과 초(1초마다 글만 바꿈, 다시 그리지 않음). 움직임 줄이기 설정이면 점·스피너 없이 글만(r10_ai.css)
const WAIT={send:'답을 만드는 중이에요',plan:'초안을 만드는 중이에요'};let waitT=null;
const waitTick=()=>{const e=document.getElementById('aiWaitSec');if(e&&ST.busyAt)e.textContent=Math.floor((Date.now()-ST.busyAt)/1000)+'초';};
const busyOn=k=>{ST.busy=true;ST.busyKind=k;ST.busyAt=Date.now();clearInterval(waitT);if(WAIT[k])waitT=setInterval(waitTick,1000);renderAI();},busyOff=()=>{ST.busy=false;ST.busyKind='';ST.busyAt=0;clearInterval(waitT);waitT=null;};
// r10: Gemini 가 늦음·한도·붐빔·오류로 예시 답을 줬거나 답을 받지 못했으면 '다시 묻기'(같은 질문을 한 번 더). 서버 gemini_r8.RETRY 와 같음
const AI_RETRY=['timeout','rate','busy','error'];
function renderAI(){const el=document.getElementById('aiSide');const open=J(K.open,true);el.classList.toggle('closed',!open);document.getElementById('aiOpen').classList.toggle('show',!open);
  const chat=visChat();const d=ST.draft;const pend=ST.pending;const plans=ST.plans;const B=ST.busy,BK=ST.busyKind,dis=B?' disabled aria-busy="true"':'';
  // r8 P2: 예시 답(키 없음·오류·시간 초과·한도)은 답 위에 작은 '예시 답' 배지 + 마지막 답에만 짧은 이유. Gemini 답(example:false)은 배지 없음
  const lastA=chat.map(m=>m.role).lastIndexOf('a');
  const msgs=chat.map((m,i)=>`<div class="msg ${m.role}"><span class="mt2">${m.role==='u'?'나':m.model==='plan-rule'?'AI · 계획 작성':m.example===false?'AI · Gemini':`AI · <span class="b b-x exm">예시 답</span>${i===lastA?` <span class="exr">${esc(exNote())}</span>`:''}`} · ${esc(m.page||'')} · <span class="tm">${esc(dt(m.at))}</span></span>${esc(m.text)}</div>`).join('');
  // U6: 초안 저장 전 검사(서버와 같은 규칙). 기한은 칸 아래 안내, 고칠 수 없는 칸(업체 등)이 비면 초안을 다시 만들라고 안내
  const pE=pend?planCheck(pend):{},pFix=Object.keys(pE).filter(k=>k!=='due');
  // r10 계획 대화: 다 차면 확인 카드 '이 내용으로 등록할까요?' + 등록·고치기·취소. 기한은 카드에서도 고칠 수 있어요(U6 검사 그대로)
  const pp=pend||{},fa=flowAsk();
  const planHtml=pend?`<div class="planc" id="planCard" role="group" aria-labelledby="planQ"><div class="pt" id="planQ">이 내용으로 등록할까요? <span class="b b-g">초안</span></div>
   <div class="pr"><span class="pk">대상</span><span>${esc(pp.account||'')} · ${esc(pp.vendor||'')}</span></div>
   <div class="pr"><span class="pk">방법</span><span>${esc(pp.method||'')}</span></div>${(T=>`<div class="pr"><span class="pk">목표</span><span class="num ptgt"${T.o?` title="AI 초안 문구: ${esc(T.o)}"`:''}><b>${esc(T.t)}</b></span></div>`)(planTgt(pend,true))}
   <div class="pr"><span class="pk"><label for="planDue">기한</label></span><span><input id="planDue" value="${esc(pend.due==null?'':pend.due)}" placeholder="2026-12-31" inputmode="numeric" aria-describedby="planDueErr"${pE.due?' aria-invalid="true"':''}> <span class="sub">고칠 수 있어요</span><span class="ferr" id="planDueErr" role="alert">${pE.due?esc(pE.due):''}</span></span></div>
   <div class="pr"><span class="pk">근거 숫자</span><span class="pbs" title="${esc(pp.basis||'')}">${esc(pp.basis||'')}</span></div>${pFix.length?`<div class="ferr" id="planErr" role="alert">${pFix.filter(k=>!/자까지/.test(pE[k])).length?`초안의 ${pFix.filter(k=>!/자까지/.test(pE[k])).map(k=>PLAN_LBL[k]||k).join('·')} 칸이 비어 있어요. ‘${PLAN_LABEL}’로 초안을 다시 만들어 주세요.`:''}${pFix.filter(k=>/자까지/.test(pE[k])).map(k=>esc(pE[k])).join(' ')}</div>`:''}
   ${ST.fixOpen?`<div class="pf-fix" id="planFixList" role="group" aria-label="고칠 칸 고르기"><span class="sub">고칠 칸을 골라요</span>${FLOW_FIX.map(k=>`<button class="btn sec sm" data-fix="${k}"${dis}>${FLOW_LBL[k]}</button>`).join('')}</div>`:''}
   <div class="ai-row"><button class="btn pri sm" id="planSave"${dis}>${BK==='save'?BUSY.save:'등록'}</button>${planFlowOn()?`<button class="btn sec sm" id="planFix"${dis} aria-expanded="${ST.fixOpen?'true':'false'}">고치기</button>`:''}<button class="btn sec sm" id="planCancel"${dis}>취소</button></div></div>`
   :fa?`<div class="plan-flow" id="planFlow" role="group" aria-label="절감 계획 작성 중"><div class="pf-t"><b>절감 계획 작성 중</b><span class="sub">빈 칸 ${['account','method','target_amount_krw','due'].filter(k=>ST.flow.slots[k]==null||ST.flow.slots[k]==='').length}개 남았어요 · 그만두려면 취소</span></div>
   <div class="pf-s">${Object.keys(FLOW_LBL).map(k=>{const v=ST.flow.slots[k],has=v!=null&&v!=='',now=ST.flow.ask===k;return `<span class="chip pf-c${has?' done':''}${now?' now':''}" data-slot="${k}">${FLOW_LBL[k]} · ${now?'묻는 중':has?'채움':'빈 칸'}</span>`}).join('')}</div>
   <div class="ai-row"><button class="btn sec sm" id="planCancel"${dis}>취소</button></div></div>`:'';
  const err=ST.err?(typeof ST.err==='string'?`<div class="ai-err" id="aiErr" role="alert">${esc(ST.err)}</div>`:`<div class="ai-err uerr" id="aiErr" role="alert"><button class="uerr-x" id="aiErrX" aria-label="안내 닫기">닫기</button><div class="uerr-t">${esc(ST.err.t)}</div><div class="uerr-h">${esc(ST.err.h)}</div><div class="uerr-d">${esc(ST.err.d)}</div></div>`):'';
  const wait=B&&WAIT[BK]?`<div class="ai-wait" id="aiWait"><span class="ai-wait-t">${WAIT[BK]}</span><span class="ai-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="ai-wait-s" id="aiWaitSec">${ST.busyAt?Math.floor((Date.now()-ST.busyAt)/1000):0}초</span></div>`:'';
  const retry=ST.retry&&!B?`<div class="ai-retry" id="aiRetryRow"><button class="btn sec sm" id="aiRetry">다시 묻기</button></div>`:'';
  el.innerHTML=`<div class="ai-h"><span class="t">AI 대화</span><span class="b b-x">${aiBadge()}</span><button class="x" id="aiClose" aria-label="AI 대화 창 접기" aria-expanded="true" aria-controls="aiSide">접기</button></div>${err}
  <div class="ai-ctx" id="aiCtx">${CTX.chips.map(c=>`<span class="chip">${esc(c)}</span>`).join('')}</div>
  <div class="ai-body" id="aiBody">${msgs||wait?msgs+wait+retry:retry+`<div class="ai-empty" id="aiEmpty"><b>아직 나눈 대화가 없어요</b><br>아래 질문을 누르거나 직접 적으면 지금 화면 숫자(월별 비용·${esc(CTX.breakdownLabel||'구성')}·단가·수량)로 답해요.</div>`}
   <div class="sugg">${fa?'':['왜 늘었어요?','업체별로 보여 줘','단가 오른 자재는?','절감 방법은?'].map(s=>`<button data-s="${s}"${dis}>${s}</button>`).join('')}</div>${planHtml}</div>
  <div class="ai-in"><textarea id="aiText" aria-label="AI에게 물어볼 내용" placeholder="숫자를 보며 생각한 걸 적어요">${esc(d?d.text:'')}</textarea>
   <div class="ai-row"><span class="sv" id="aiSaved">${d&&d.text?`임시 저장됨 ${d.at}`:''}</span>${chat.length?`<button class="linkbtn" id="aiClear"${dis}>${BK==='clear'?BUSY.clear:'대화 지우기'}</button>`:''}</div>
   <div class="ai-row"><button class="btn sec sm" id="planMake" style="flex:1" ${(chat.length||(d&&d.text||'').trim())&&!B&&!fa?'':'disabled'}${fa?' title="계획을 적는 중이에요. 그만두려면 취소를 눌러요."':chat.length?'':' title="먼저 AI에게 한 번 물어보거나 계획 내용을 적으면 만들 수 있어요"'}${BK==='plan'?' aria-busy="true"':''}>${BK==='plan'?BUSY.plan:PLAN_LABEL}</button><button class="btn pri sm" id="aiSend"${dis}>${BK==='send'?'<span class="ai-spin" aria-hidden="true"></span>'+BUSY.send:'보내기'}</button></div></div>
  <div class="saved" id="savedList"><div class="sh">저장된 절감 계획 ${plans.length}건</div>${plansSorted().map(p=>`<div class="si" data-pid="${esc(p.id)}"><b>${esc(p.vendor)}</b> · ${esc(p.method)}<br><span class="sub">${esc(p.account)} · ${(T=>`<span class="ptgt"${T.o?` title="예전 목표 문구: ${esc(T.o)}"`:''}>${esc(T.t)}</span>`)(planTgt(p))} · 기한 ${esc(p.due)} · ${esc(p.status||'초안')}</span>${planMeta(p)}</div>`).join('')||'<div class="sub" id="savedEmpty">아직 저장한 절감 계획이 없어요</div>'}</div>`;
  const pc=document.getElementById('planCnt');if(pc)pc.textContent=plans.length+'건';
  const ta=document.getElementById('aiText');
  ta.oninput=()=>{saveDraft(ta.value);const pm=document.getElementById('planMake');if(pm&&!ST.busy&&!flowAsk())pm.disabled=!(visChat().length||ta.value.trim());const s=document.getElementById('aiSaved');if(ST.draftErr){showDraft();return;}s.classList.remove('bad');s.title='';s.textContent=ta.value?`임시 저장됨 ${hm()}`:'';};
  showDraft();
  document.getElementById('aiSend').onclick=()=>send(ta.value,true);
  ta.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send(ta.value,true)}};
  el.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>send(b.dataset.s));
  const rt=document.getElementById('aiRetry');if(rt)rt.onclick=()=>{const x=ST.retry;if(!x)return;if(x.plan)planTurn(x.plan,x.text,{fromInput:x.fromInput,field:x.field});else send(x.text,x.fromInput);};
  document.getElementById('aiClose').onclick=()=>{S(K.open,false);renderAI()};
  const ex=document.getElementById('aiErrX');if(ex)ex.onclick=()=>{ST.err='';renderAI()};
  const cl=document.getElementById('aiClear');if(cl)cl.onclick=async()=>{if(ST.busy)return;busyOn('clear');try{await api('/api/ai/chat/reset','POST',{});ST.chat=[];lsSet(CDK(),null);ST.pending=null;ST.retry=null;localStorage.removeItem(K.pending);setFlow(null);ST.err='';}catch(e){ST.err=errInfo(e,'대화를 지우지 못했어요')}busyOff();renderAI()};
  document.getElementById('planMake').onclick=async()=>{if(ST.busy||flowAsk())return;const t=ta.value.trim();if(planFlowOn())return planTurn('start',t,{fromInput:!!t});
    busyOn('plan');live('초안을 만드는 중이에요');try{const r=await api('/api/ai/plan','POST',{ctx:CTX,page:CTX.title});ST.pending=r.plan?(r.example===false?Object.assign({},r.plan,{gemini:true}):r.plan):null;S(K.pending,ST.pending);ST.err='';live('초안이 왔어요');}catch(e){live('초안을 받지 못했어요');ST.err=errInfo(e,'절감 계획 초안을 만들지 못했어요',{403:'이 본부 화면은 계획을 만들 권한이 없어요. 필요하면 경영지원본부에 권한을 요청해 주세요.'})}busyOff();renderAI();const pc2=document.getElementById('planCard');if(pc2)pc2.scrollIntoView({block:'nearest'})};// 옛 서버(다시 시작 전): 예전 바로 초안// r10: 바로 초안 대신 계획 대화 시작(입력칸 글 = 내가 쓴 계획)
  const pd=document.getElementById('planDue');if(pd)pd.oninput=()=>{const m=dueErr(pd.value);ST.pending=Object.assign({},ST.pending,{due:pd.value});S(K.pending,ST.pending);if(ST.flow&&ST.flow.slots){ST.flow.slots.due=pd.value.trim();S(K.flow,ST.flow);}// 고친 기한은 다시 그려도 남게
    const x=document.getElementById('planDueErr');if(x)x.textContent=m;if(m)pd.setAttribute('aria-invalid','true');else pd.removeAttribute('aria-invalid');};
  const ps=document.getElementById('planSave');if(ps)ps.onclick=async()=>{if(ST.busy)return;const p={};['account','vendor','method','target','target_amount_krw','due','basis','turns'].forEach(k=>{if(k in ST.pending)p[k]=ST.pending[k]});p.due=document.getElementById('planDue').value.trim();ST.pending=Object.assign({},ST.pending,{due:p.due});S(K.pending,ST.pending);
    if(Object.keys(planCheck(p)).length){renderAI();const d=document.getElementById('planDue');if(d&&d.getAttribute('aria-invalid'))d.focus();return;}// U6: 칸 안내를 보이고 저장 요청은 보내지 않아요
    busyOn('save');
    try{const F=ST.flow||{};const r=await api('/api/plans','POST',{plan:p,division:F.division||CTX.division||(ST.allowed.includes('PROD')?'PROD':ST.allowed[0]),account_code:F.code||CTX.code||null,page:F.page||CTX.title});ST.plans=r.plans||ST.plans;ST.pending=null;localStorage.removeItem(K.pending);setFlow(null);ST.err='';live('계획을 등록했어요');}
    catch(e){ST.err=errInfo(e,'절감 계획을 저장하지 못했어요',planErrO(e,{403:'이 본부 계획은 저장할 권한이 없어요. 필요하면 경영지원본부에 권한을 요청해 주세요.',bad_plan:'초안 내용이 비었거나 형식이 맞지 않아요. ‘'+PLAN_LABEL+'’로 초안을 다시 만들어 주세요.'}))}busyOff();renderAI()};
  const pcn=document.getElementById('planCancel');if(pcn)pcn.onclick=()=>{if(ST.busy)return;const was=!!(ST.flow||ST.pending);ST.pending=null;localStorage.removeItem(K.pending);setFlow(null);if(was)live('계획 작성을 그만뒀어요');renderAI()};
  const pfx=document.getElementById('planFix');if(pfx)pfx.onclick=()=>{if(ST.busy)return;ST.fixOpen=!ST.fixOpen;renderAI();const b=document.querySelector('#planFixList [data-fix]');if(b)b.focus();};
  el.querySelectorAll('[data-fix]').forEach(b=>b.onclick=()=>{if(ST.busy)return;if(!ST.flow&&ST.pending){const P=ST.pending;setFlow({v:1,step:'confirm',ask:null,slots:{account:P.account,vendor:P.vendor,method:P.method,target_amount_krw:P.target_amount_krw,due:P.due,basis:P.basis},from:{}});}planTurn('fix','',{field:b.dataset.fix});});
  const body=document.getElementById('aiBody');body.scrollTop=body.scrollHeight;window.dispatchEvent(new Event('v5:ai'));}
async function send(text,fromInput){text=(text||'').trim();if(!text||ST.busy)return;
  if(flowAsk()&&planFlowOn())return planTurn('answer',text,{fromInput});// r10: 계획 작성 중이면 물은 칸의 답(‘취소’면 그만둬요)
  if(planFlowOn()&&looksPlan(text))return planTurn('start',text,{fromInput});// 계획 문장이면 계획 작성 시작. r13 c8: 확인 카드가 이미 떠 있어도 새 계획 문장은 새 초안으로(예전엔 보통 질문으로 가서 옛 카드가 그대로 남았어요)
  const before=ST.chat,dv=CTX.division;ST.chat=ST.chat.concat([{role:'u',text,page:CTX.title,at:kst()}]);if(fromInput){ST.draft=null;ST.draftErr=null;dlSet(null);clearTimeout(draftT);}busyOn('send');live('답을 만드는 중이에요');
  try{const r=await api('/api/ai/chat','POST',{text,page:CTX.title,ctx:CTX,clearDraft:!!fromInput,division:CTX.division});ST.chat=r.chat||ST.chat;cdTag(before.length,dv);ST.aiNote=r.fallback&&typeof r.fallback.note==='string'?r.fallback.note:'';ST.err='';live('답이 왔어요');
    ST.retry=r.fallback&&AI_RETRY.includes(r.fallback.reason)?{text,fromInput:!!fromInput}:null;}
  catch(e){live('답을 받지 못했어요');ST.chat=before;ST.retry=e.kind==='timeout'||e.kind==='network'||e.status===429||e.status>=500?{text,fromInput:!!fromInput}:null;ST.err=errInfo(e,'AI 답을 받지 못했어요',{empty:'보낼 글이 비어 있어요. 질문을 적고 다시 보내 주세요.',403:'이 본부 화면은 물어볼 권한이 없어요. 필요하면 경영지원본부에 권한을 요청해 주세요.'});
    if(fromInput){saveDraft(text);ST.err.h+=' 보내지 못한 글은 입력칸에 그대로 두었어요.';}}// 실패하면 보낸 글을 입력칸으로 되돌려요(예전엔 화면에서 사라졌어요)
  busyOff();renderAI();}
function setSide(active){document.getElementById('side').innerHTML=sidebar(active);}
// r10 그래프 토글 때 함께(2026-10-20): 머리 배지 = 서버가 준 모델 이름(state.ai.model)에서 'Flash'·'Flash-Lite'·'Pro' 같은 등급만 골라 보여요. 모델 이름이 없으면 예전처럼 'Gemini Flash'
const aiBadge=()=>{if(!(ST.ai&&ST.ai.gemini))return '예시 · Gemini 연결 없음';const w=String(ST.ai.model||'').toLowerCase().split(/[-_\s]+/).filter(x=>/^(flash|lite|pro|ultra|nano)$/.test(x));return 'Gemini '+(w.length?w.map(x=>x[0].toUpperCase()+x.slice(1)).join('-'):'Flash');};
// r8 P2: AI 진행·완료 짧은 알림(화면에 안 보이는 polite 영역, 답 본문은 읽지 않음). AI 창은 다시 그려지므로 body 에 한 번만 만들어요
const exNote=()=>ST.aiNote||(ST.ai&&ST.ai.gemini?'':'Gemini 연결 전이라 예시로 답했어요');
function live(t){let e=document.getElementById('aiLive');if(!e){e=document.createElement('div');e.id='aiLive';e.className='sr-only';e.setAttribute('role','status');e.setAttribute('aria-live','polite');e.setAttribute('aria-atomic','true');
  e.style.cssText='position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap';document.body.appendChild(e);}
  if(t!=null)e.textContent=t;return e;}
function mount(active){setSide(active);live();
  if(!document.getElementById('aiOpen')){const b=document.createElement('button');b.id='aiOpen';b.className='ai-open';b.textContent='AI 열기';document.body.appendChild(b);}
  document.getElementById('aiOpen').onclick=()=>{S(K.open,true);renderAI()};renderAI();}
let CTX_DIV=null;
function setCtx(ctx){CTX=ctx;cdFill(ctx.division);const sw=pfSwitch(ctx.division),dvc=CTX_DIV!==ctx.division;CTX_DIV=ctx.division;const c=document.getElementById('aiCtx');if(c)c.innerHTML=ctx.chips.map(x=>`<span class="chip">${esc(x)}</span>`).join('');if((sw||dvc)&&document.getElementById('aiSide')&&!ST.busy)renderAI();}
window.V5={looksPlan,planTurn,setFlow,api,apiTimeout,live,ST,initState,devUser,send,setSide,setBases,salesP,salesM,pct,ratioP,vP,vYm,dP,bigP,leadP,unitTxt,toggleHtml,bindToggle,chartM,mode,basis,basisLabel,NOS,PMN,PLAN_LABEL,K,f,sg,man,esc,kst,hm,per,MONTHS,chart,tabs,mount,setCtx,renderAI,answer,makePlan,priceRise,periodQty,periodAmt,J,S,errInfo,errHtml,dt,planCheck,dueErr,amtParse,planErrO,plansSorted,planMeta,PLAN_LBL,PLAN_MAX,targetText,planTgt,manS};
window.V5.aiBadge=aiBadge;   // r12 c1: 바닥 글(app.js FOOT)도 머리 배지와 같은 모델 등급 이름을 써요
})();
