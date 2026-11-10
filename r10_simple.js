// r10(2026-10-20 본부장님 지시): 단순 화면. 서버가 body 에 r10 을 붙였을 때만(실서버 UI_MODE=simple) 켜져요. 시험 서버(classic)는 예전 화면 그대로.
//  - 왼쪽 메뉴 숨김(r10_simple.css) · AI 대화는 화면을 열 때마다 접힌 채로 시작
//  - 토스증권식 홈: 요약 카드 줄 → '지금 살펴볼 비용 이슈' 순위 목록(추세선·색 숫자, 5개 + 더 보기) → 단가 이슈 → 히트맵 바로가기
//  - 비교·기준·정렬 토글은 작은 드롭다운 알약으로 접고, 1~4단계 표시줄 대신 '‹ 비용 이슈' 뒤로가기
//  app.js(전역 함수 topbar·stepper·step1)를 덮어써요. app.js 의 data-* 버튼 연결(bind)을 그대로 쓰도록 같은 속성으로 그려요.
(function(){
if(!document.body.classList.contains('r10'))return;
try{localStorage.setItem('v6_ai_open','false');}catch(e){}
const UP='#B3261E',DN='#1B6E5A';   // DESIGN 히트맵·워터폴 단계색(크게 오름·크게 내림, R6ND-33)

function sparkSvg(vals,up){const pts=vals.map((v,k)=>[k,v]).filter(p=>p[1]!=null);if(pts.length<2)return '<span class="r10-sp"></span>';
 const W=96,H=32,n=vals.length-1,mn=Math.min(...pts.map(p=>p[1])),mx=Math.max(...pts.map(p=>p[1])),rg=mx-mn||1;
 const xy=pts.map(([k,v])=>[(k/n*(W-4)+2).toFixed(1),(H-3-(v-mn)/rg*(H-6)).toFixed(1)]);const c=up?UP:DN;const last=xy[xy.length-1];
 return `<svg class="r10-sp" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${xy.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="${c}"/></svg>`;}
const series=m=>V5.MONTHS.filter(Boolean).map(y=>m&&m[y]!=null?(Array.isArray(m[y])?m[y][0]:m[y]):null);
const unitSeries=m=>V5.MONTHS.filter(Boolean).map(y=>{const v=m&&m[y];return v&&v[1]>0?v[0]/v[1]:null});

function dd(id,label,items,tip){return `<details class="r10-dd" id="${id}"><summary${tip?` title="${esc(tip)}"`:''}>${label}<span class="cv" aria-hidden="true">⌄</span></summary><div class="r10-menu">${items}</div></details>`;}
function basesNow(){const t=document.createElement('div');t.innerHTML=V5.toggleHtml();return [...t.querySelectorAll('[data-basis]')].map(b=>[b.dataset.basis,b.textContent]);}

function topbar(){const D=[['prod','PROD','생산본부'],['online','ONLINE','온라인본부'],['mgmt','MGMT','경영지원본부']].filter(d=>ALLOWED.has(d[1]));
 const tabs=`<div class="r10-tabs">${D.map(([d,,n])=>`<button class="r10-tab${st.div===d?' on':''}" data-div="${d}" aria-pressed="${st.div===d}">${n}</button>`).join('')}</div>`;
 const m=V5.mode();
 const modeSeg=`<span class="seg r10-mode"><button data-mode="ratio" class="${m==='ratio'?'on':''}">비율</button><button data-mode="amt" class="${m==='amt'?'on':''}">금액</button></span>`;
 const cmp=dd('r10Cmp',esc(CC().s),['q3','q4','h1','mom','qoq','m10'].filter(k=>CMP[k]).map(k=>`<button data-cmp="${k}" class="${st.cmp===k?'on':''}">${CMP[k].l}</button>`).join(''),`${CC().pl} 대비 = ${CC().pl} 월평균과 이번 ${CC().cl} 월평균을 비교해요`);
 const B=basesNow();const bas=m==='ratio'&&B.length>1?dd('r10Bas',esc(V5.basisLabel())+' 기준',B.map(([id,l])=>`<button data-basis="${id}" class="${id===V5.basis()?'on':''}">${esc(l)}</button>`).join(''),`${V5.basisLabel()} 기준 = 비용을 ${V5.basisLabel()}${roOf(V5.basisLabel())} 나눈 비율(%)로 봐요`):'';
 return `<div class="r10-top">${tabs}<div class="r10-ctl">${modeSeg}${cmp}${bas}</div></div>`;}

function stepper(){if(st.s===2||st.s===3)return '';/* 2·3단계는 화면에 '‹ 이슈 목록'·'‹ 원인 보기'가 이미 있어요 */if(st.s===4)return `<button class="r10-back" data-step="1">‹ 비용 이슈</button>`;if(st.hm)return `<button class="r10-back" data-view="list">‹ 비용 이슈</button>`;return '';}

const upOf=i=>amtMode()?i.d>0:(i.pp!=null&&i.pp>0);
// r13 c12(3): 이슈 카드에 상위 거래처(늘어난 폭이 큰 실제 거래처) + '이 거래처 보기'(누르면 바로 그 거래처 상세 = 첫 화면에서 클릭 1번)
function vendLine(i){if(!isP()||!i.drivers)return '';const d=i.drivers.filter(x=>dUp(x)&&x.id!=='BLANK')[0];if(!d||!i.code)return '';
 return `<span class="r10-vl"><span class="r10-vn">상위 거래처 <b>${esc(d.name)}</b></span> <span class="r10-vk" role="link" tabindex="0" data-r10vd="${esc(i.id+'|'+d.id)}" aria-label="${esc(d.name)} 거래처 보기">이 거래처 보기 ›</span></span>`;}
function issueRow(i,k){const up=upOf(i);const big=i.nd?ND:amtMode()?`월 ${manS(i.d)}`:(i.pp==null?V5.NOS:ppS(i.pp));
 const sub=i.nd?'':i.r!=null?`${i.r>=0?'+':''}${i.r.toFixed(1)}%`:'';
 return `<button class="r10-row" data-issue="${esc(i.id)}"><span class="r10-rk">${k+1}</span><span class="r10-nm"><span class="r10-t">${esc(i.title)}</span><span class="r10-s">${esc(reasonTxt(i))}</span>${vendLine(i)}</span>${sparkSvg(series(i.m),up)}<span class="r10-v ${i.nd?'nd':up?'up':'dn'}"><span class="r10-big num">${big}</span><span class="r10-sub num">${sub}</span></span><span class="r10-cv" aria-hidden="true">›</span></button>`;}
function priceRowR(i,k){return `<button class="r10-row" data-r10pm="${esc(i.c)}"><span class="r10-rk">${k+1}</span><span class="r10-nm"><span class="r10-t">${esc(i.n)}</span><span class="r10-s num">${f(i.pu)}원 → ${f(i.cu)}원</span></span>${sparkSvg(unitSeries(i.m),true)}<span class="r10-v up"><span class="r10-big num">${pctS(i.chg)}</span><span class="r10-sub">${CC().s}</span></span><span class="r10-cv" aria-hidden="true">›</span></button>`;}
function kpi(lbl,big,sub,attr,sp){return `<button class="r10-kpi" ${attr}><span class="r10-kl">${lbl}</span><span class="r10-kb num">${big}</span><span class="r10-ks">${sub}</span>${sp||''}</button>`;}

const roOf=w=>{const c=String(w||'').slice(-1).charCodeAt(0);if(!(c>=0xAC00&&c<=0xD7A3))return '로';const j=(c-0xAC00)%28;return j===0||j===8?'로':'으로';};
function introHtml(){const C=CC();const BL=V5.basisLabel()||'매출';return `<section class="r10-intro" id="r10Intro" aria-label="앱 안내"><div class="r10-it">늘어난 비용의 원인을 찾아 절감 계획으로 남기는 앱이에요.</div>
  <div class="r10-is" id="r10Steps"><span><b>1</b> 비용 보기</span><span aria-hidden="true">›</span><span><b>2</b> 거래처·품목 찾기</span><span aria-hidden="true">›</span><span><b>3</b> 계획 쓰기</span></div>
  <details class="r10-help" id="r10Help"><summary>용어 한 줄 설명 · ${esc(C.pl)} 대비 · %p · ${esc(BL)} 기준 · 원장 외 차이 · ${ND}</summary><ul>
  <li><b>${esc(C.pl)} 대비</b> ${esc(C.pl)} 월평균과 이번 ${esc(C.cl)} 월평균을 비교해요(위 비교 단추에서 바꿔요).</li>
  <li><b>%p</b> 비율이 몇 %포인트 달라졌는지예요(예: 3.5% → 4.4% = +0.9%p).</li>
  <li><b>${esc(BL)} 기준</b> 비용을 ${esc(BL)}${roOf(BL)} 나눈 비율(%)로 봐요.</li>
  <li><b>원장 외 차이</b> 계정 마감 금액 중 이카운트 원장 업체 줄로 설명되지 않는 몫이에요.</li>
  <li><b>${ND}</b> 비교할 이전 기간 줄이 없어서 증감을 계산하지 않아요.</li></ul></details></section>`;}
function step1(){const I=issues();const tm=isP()?prodMonthly():oMonthly(view(),'ALL',null,true);const tc=tots(tm);const x=cmpM(tm);
 const NDI=issues(true).filter(i=>i.nd);const N=5;const shown=st.more?I:I.slice(0,N);const pi=st.div==='prod'?priceIssue():null;const plans=V5.ST.plans.length;
 const totUp=amtMode()?x.d>0:(x.pp!=null&&x.pp>0);
 const K=[kpi(`${divName()} 비용${amtMode()?' · 월평균':' · '+esc(V5.basisLabel())+' 대비'}`,amtMode()?man(tc['26Q3']/3):vPb(tc['26Q3'],'26Q3'),`<span class="${x.nd?'':totUp?'up':'dn'}">${dPb(tm)}</span> ${CC().s}`,'data-view="hm"',sparkSvg(series(tm),totUp)),
  kpi('늘어난 비용',`${I.length}개`,I.length?`1위 ${esc(I[0].title)}`:'늘어난 비용이 없어요',I.length?`data-issue="${esc(I[0].id)}"`:'disabled'),
  pi?kpi('원재료 단가',pi.H.its.length?'평균 '+pctS(pi.H.avg):'-',`+15% 이상 ${pi.n15}개`,'data-price="1"'):'',
  kpi('절감 계획',`${plans}건`,plans?'저장한 계획 보기':'줄 없음','data-step="4"')].join('');
 const sortDD=dd('r10Sort',st.sort==='rate'?'증가율 순':'증가폭 순',`<button data-sort="amt" class="${st.sort==='amt'?'on':''}">증가폭 순</button><button data-sort="rate" class="${st.sort==='rate'?'on':''}">증가율 순</button>`);
 const hmBtns=hmKinds().map(([k,l])=>`<button class="r10-hm" data-hm="${k}">${l}<span aria-hidden="true">›</span></button>`).join('');
 const prow=pi?pi.imp.slice(0,N):[];
 return `${introHtml()}${guide(I.length?'늘어난 비용 중 하나를 눌러 원인을 봐요. 1위부터 보면 돼요.':'지금은 늘어난 비용 이슈가 없어요. 히트맵에서 전체 비용을 볼 수 있어요.',I.length?`<button class="btn pri sm" id="nextBtn" data-issue="${esc(I[0].id)}">1위 ${esc(I[0].title)} 보기 →</button>`:'<button class="btn sec sm" data-view="hm">히트맵 보기</button>')}
 <div class="r10-kpis" id="r10Kpis">${K}</div>
 <section class="r10-sec" id="r10Issues"><div class="r10-sh"><div><div class="r10-st">지금 살펴볼 비용 이슈</div><div class="r10-ss" id="divSum">${CC().cl} vs ${CC().pl} 월평균 · 인건비 묶음 제외</div></div>${sortDD}</div>
 <div class="r10-list" id="issueList">${I.length?shown.map(issueRow).join(''):emptyBox('issuesEmpty',`${CC().pl}보다 늘어난 ${isP()?'계정':'항목'}이 없어요`,`위에서 비교 기준을 바꾸면 다른 기간과 비교해 볼 수 있어요.`)}</div>
 ${I.length>N?`<button class="r10-more" id="moreIssues" aria-expanded="${st.more}">${st.more?'접기':`더 보기 ${I.length-N}개`}<span aria-hidden="true">${st.more?' ⌃':' ⌄'}</span></button>`:''}
 ${NDI.length?`<div class="r10-note" id="ndIssues">${CC().pl} 비교 기간 없는 ${NDI.length}개(${esc(NDI.map(i=>i.title).join(', '))})는 ${ND}이라 순위에서 뺐어요.</div>`:''}</section>
 ${pi?`<section class="r10-sec" id="r10Price"><div class="r10-sh"><div><div class="r10-st">단가가 오른 원재료</div><div class="r10-ss">${CC().s} · 영향이 큰 순</div></div><button class="r10-link" data-price="1">전체 보기 ›</button></div><div class="r10-list">${prow.length?prow.map(priceRowR).join(''):'<div class="r10-note">단가가 오른 원재료가 없어요</div>'}</div></section>`:''}
 ${st.div==='mgmt'?`<section class="r10-sec" id="r10Cc"><div class="r10-sh"><div><div class="r10-st">공통비 입력</div><div class="r10-ss">직접 입력 · 실제 비용으로 보고 위 금액에 더해요(원장에 이미 있는 달은 안 더해요)${CCS.loaded?` · 지금 ${CCS.items.length}건`:''}</div></div></div><div class="r10-hms"><button class="r10-hm" id="ccOpen" data-cc="1">공통비 입력하기<span aria-hidden="true">›</span></button></div></section>`:''}
 <section class="r10-sec" id="r10Hm"><div class="r10-sh"><div><div class="r10-st">히트맵으로 한눈에</div><div class="r10-ss">비용 전체를 색으로 봐요</div></div></div><div class="r10-hms">${hmBtns}</div></section>`;}

window.R10HOOK=function(){window.topbar=topbar;window.stepper=stepper;window.step1=step1;
 const M=document.getElementById('main');
 M.addEventListener('click',e=>{const b=e.target.closest('[data-r10pm]');if(b)openPrice(b.dataset.r10pm);});
 document.addEventListener('click',e=>{document.querySelectorAll('details.r10-dd[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;});});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('details.r10-dd[open]').forEach(d=>{d.open=false;d.querySelector('summary').focus();});});
 render();window.R10_READY=true;};
})();
