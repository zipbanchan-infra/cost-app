// r10 그래프 토글(2026-10-20 본부장님 지시: "섹션을 나누어 펼쳐 보는 게 아니라, 그래프 섹션은 고정하고 전체 / 거래처별 / 품목별을 토글 버튼으로 바꾸자").
// 단순 화면(body.r10)에서만 켜져요. 예전 화면(classic)은 접는 섹션 그대로.
//  - 3단계 '자세히 보기'(생산 = 전체 | 거래처별 | 품목별, 온라인 = 전체 | 채널별 | 거래처별) · 업체 상세(전체 | 품목별) · 자재 단가 상세(전체 | 거래처별)
//  - 맨 위 그래프 카드 하나 + 분절 토글, 아래 표는 고른 보기 하나만(상위 10 + 더 보기). 비교 기간 없는 축은 비활성 + 이유 한 줄.
//  - 고른 보기는 주소 #...&ax=vend 에 남아 새로 고쳐도 그대로. 2단계 워터폴 업체 막대 → 3단계 거래처별(온라인 채널 막대 → 채널별).
//  - 거래처별 = 비교 기간 vs 이번 기간 가로 막대(월평균). 상위 5 + 기타 + 원장 외 차이(마감 - 원장 업체 합)라 더하면 전체와 같아요.
//  app.js 원본 함수(step3·stepVendDrill·stepPriceDrill)가 그린 화면에서 접는 섹션(.accs)만 이 카드로 바꾸고, 나머지(머리·시그널·채널 이동 도구)는 그대로 써요.
// r10 상세 화면 2차(2026-10-21 본부장님 피드백):
//  - 그래프 아래 '같은 내용 표'를 없앰. 정확한 숫자 = 막대 툴팁(마우스·키보드 초점), 구성비·단가는 막대 옆 작은 글, 6번째부터는 '나머지 n곳도 보기'.
//  - 비교 기간 없는 보기 단추 = 흐린 글 + 단추 안 '자료 없음' + 누르면 이유 말풍선(단추를 감싼 칸이 누르기를 받아요).
//  - 같은 화면 안에서 보기·채널만 바꾸면 스크롤 그대로(단계를 옮길 때만 맨 위로). 온라인 채널별 = 가로 막대 + 채널 × 월 히트맵 격자.
//  - 화면 글·툴팁에서 테이블 이름 같은 개발 용어를 쉬운 말로(본문 #main 만).
(function(){
if(!document.body.classList.contains('r10'))return;
const AXN={all:'전체',vend:'거래처별',item:'품목별',ch:'채널별'};
const KEYS=['div','s','a','n','ch','pm','hm','va','vv'];
const nv=v=>v==null||v===''?null:String(v);
const axHash=()=>new URLSearchParams(location.hash.slice(1)).get('ax');
const TOPN=5;
let keepY=null;   // 같은 화면 안 이동(보기·채널)이면 주소를 바꾸기 전 스크롤 위치

// 주소: app.js go() 와 같은 모양 + ax. 같은 3단계 화면 안에서 움직이면(채널 고르기 등) 고른 보기를 그대로 둬요
function goR(o){o=Object.assign({},o);let ax=o.ax;delete o.ax;const nx={};KEYS.forEach(k=>nx[k]=st[k]);Object.assign(nx,o);
 const same=+nx.s===+st.s&&['div','a','pm','va','vv','hm'].every(k=>nv(nx[k])===nv(st[k]));
 if(ax===undefined)ax=same&&+nx.s===3?axHash():null;
 const q=new URLSearchParams();KEYS.forEach(k=>{const v=nx[k];if(v!=null&&v!=='')q.set(k,v)});if(nx.cc)q.set('cc','1');/* hq3: 경영지원 공통비 입력 화면(KEYS 에는 없고 부른 쪽이 줄 때만) */if(ax&&ax!=='all')q.set('ax',ax);
 const h=q.toString();if(h===location.hash.slice(1)){parseHash();render();}else{keepY=same?scrollY:null;location.hash=h;}}

// ---------- 값 ----------
const A=()=>amtMode();
function met(m){const x=cmpM(m),C=CC(),a=A();return {x,p:a?x.ap:x.rp,c:a?x.ac:x.rc,d:a?x.d:x.pp,r:x.r,nd:x.nd,pa:x.pa/C.prev.length,ca:x.ca/C.cur.length};}
const wS=v=>{const a=Math.abs(v),s=v<0?'-':'';return a>=1e8?s+(a/1e8).toFixed(1).replace(/\.0$/,'')+'억':a>=1e4?s+f(a/1e4)+'만':s+f(a);};
const vChart=v=>v==null?(A()?'-':'매출 줄 없음'):A()?man(v):v.toFixed(2)+'%';
const dTx=r=>r.nd?ND:r.d==null?(A()?'-':'-'):A()?manS(r.d)+(r.r!=null?` (${r.r>=0?'+':''}${r.r.toFixed(1)}%)`:''):ppS(r.d);
const dCl=r=>r.nd||r.d==null?'nd':r.d>0?'up':r.d<0?'dn':'';
const unitLine=()=>{const C=CC();return `${C.cl} vs ${C.pl} 월평균 · ${A()?'금액(원)':'비율 · '+esc(V5.basisLabel())+' 대비'}`;};
const shareTxt=(r,T)=>T>0&&!r.resid&&r.ca!=null?`구성비 ${(r.ca/T*100).toFixed(1)}%`:'';
const openK=key=>st.open.has('r10m-'+key);
const merge=L=>{const o={};L.forEach(m=>Object.entries(m||{}).forEach(([y,v])=>o[y]=(o[y]||0)+v));return o;};

// 이름·월별 금액 목록 → 줄(이번 기간 금액 순) + 원장 외 차이(total 이 있으면: total - 목록 합, 달마다)
function rowsOf(list,total,residName){const R=list.map(o=>Object.assign({},o,met(o.m))).filter(r=>r.x.ca||r.x.pa).sort((a,b)=>b.ca-a.ca||b.pa-a.pa);
 let resid=null;if(total){const dm={};Object.keys(total).forEach(y=>{dm[y]=total[y]-list.reduce((a,o)=>a+(o.m&&o.m[y]!=null?o.m[y]:0),0);});
  const x=met(dm);if(Math.abs(x.x.ca)>=1||Math.abs(x.x.pa)>=1)resid=Object.assign({key:'__resid',name:residName,m:dm,resid:true},x);}
 return {R,resid};}
// 그래프 줄 = 상위 5(+ 고른 줄) + 기타 n곳 + 원장 외 차이
function chartRows(R,resid,selKey,unitName,key){if(key&&openK(key))return R.concat(resid?[resid]:[]);let top=R.slice(0,TOPN);const s=selKey&&R.find(r=>r.key===selKey);if(s&&!top.includes(s))top=top.concat([s]);
 const rest=R.filter(r=>!top.includes(r));const out=top.slice();
 if(rest.length){const m=merge(rest.map(r=>r.m));out.push(Object.assign({key:'__rest',name:`기타 ${rest.length}${unitName}`,m,rest:true},met(m)));}
 if(resid)out.push(resid);return out;}

// ---------- 그래프 ----------
// 월별 막대: 달마다 초점이 가는 칸(툴팁 = 정확한 값). opt.tipx(y) = 툴팁 뒤에 붙일 글(단가 상세의 수량·금액·전월 대비)
function monthChart(vals,opt){opt=opt||{};const C=CC();const amt=opt.price||A();const V={},miss=[];
 V5.MONTHS.filter(Boolean).forEach(y=>{const raw=vals[y];if(raw==null)return;if(amt){V[y]=raw;return;}const s=V5.salesM(y);if(s)V[y]=raw/s*100;else miss.push(y);});
 const mx=Math.max(0,...Object.values(V))||1;const lab=v=>opt.price?f(v)+'원':amt?wS(v):v.toFixed(1)+'%';
 const tip=y=>{const v=V[y],raw=vals[y];if(raw==null)return `${ym2(y)} 줄 없음`;return (opt.price?`${ym2(y)} 단가 ${f(v)}원`:amt?`${ym2(y)} ${f(raw)}원`:`${ym2(y)} ${v==null?'매출 줄 없음':v.toFixed(2)+'%'} · ${f(raw)}원`)+(opt.tipx?opt.tipx(y):'');};
 const cols=V5.MONTHS.map(y=>{if(!y)return '<div class="r10-mc gap" aria-hidden="true"><span class="r10-mv"></span><span class="r10-mb"></span><span class="r10-ml">줄 없음</span></div>';
  const v=V[y];const k=C.cur.includes(y)?'cur':C.prev.includes(y)?'prev':'oth';const h=v==null?0:Math.max(2,Math.round(Math.max(v,0)/mx*144));const t=tip(y);
  return `<div class="r10-mc ${k}" data-ym="${y}" data-v="${v==null?'':v}" title="${esc(t)}" tabindex="0" role="img" aria-label="${esc(t)}"><span class="r10-mv num">${k!=='oth'&&v!=null?lab(v):''}</span><span class="r10-mb"><i style="height:${h}px"></i></span><span class="r10-ml num">${ym2(y)}</span></div>`;}).join('');
 const leg=`<span><i class="cur"></i>이번 ${C.cl}</span><span><i class="prev"></i>비교 ${C.pl}</span><span><i class="oth"></i>그 밖의 달</span><span class="r10-lh">막대에 마우스를 올리면 정확한 값이 보여요 · 25.10~12 비교 기간 없음</span>`;
 return {chart:`<div class="r10-plot r10-mch" id="r10Plot" data-kind="month" role="group" aria-label="${esc((opt.title||'')+' 월별 막대 그래프')}">${cols}</div>`+(miss.length?`<div class="r10-note">${miss.map(ym2).join(', ')}: ${V5.NOS}</div>`:''),legend:leg};}
// '나머지 n곳도 보기' / '상위 5곳만 보기'(그래프 줄 펼치기, 예전 표의 '더 보기' 대신)
function moreBtn(key,n,unit,lim){lim=lim||TOPN;if(n<=lim)return '';const o=openK(key);return `<button type="button" class="r10-more" id="r10More" data-r10more="${key}" aria-expanded="${o}">${o?`상위 ${lim}${unit}만 보기`:`나머지 ${n-lim}${unit}도 보기`}<span aria-hidden="true">${o?' ⌃':' ⌄'}</span></button>`;}
// 비교 vs 이번 가로 막대. opt.sel(r) = 누르면 할 일(v: 거래처 · c: 채널 · p: 자재 단가), opt.sub(r) = 이름 아래 작은 글(구성비·단가), opt.key = '기타' 줄을 누르면 펼칠 열쇠
function pairChart(rows,opt){opt=opt||{};const C=CC();const fm=opt.fmt||vChart,df=opt.dfmt||dTx;
 // 막대 길이 기준 = 이름 있는 줄의 가장 큰 값(기타·원장 외 차이가 더 크면 끝을 흐리게 잘라 값 글자로 읽어요. 예: 원재료 기타 208개)
 const base=rows.filter(r=>!r.rest&&!r.resid);const mx=Math.max(0,...(base.length?base:rows).flatMap(r=>[Math.abs(r.p||0),Math.abs(r.c||0)]))||1;
 const w=v=>v==null||v===0?0:Math.min(100,Math.max(1,Math.round(Math.abs(v)/mx*1000)/10));const ov=v=>v!=null&&Math.abs(v)>mx*1.0001?' over':'';
 const body=rows.map(r=>{const sub=opt.sub?opt.sub(r):'';const t0=r.tip||`${r.name} · ${C.pl} ${fm(r.p)} → ${C.cl} ${fm(r.c)} · ${df(r)}`;const tip=sub&&!t0.includes(sub)?t0+' · '+sub:t0;
  const sv=opt.sel&&!r.rest&&!r.resid?opt.sel(r):null;
  const act=sv?` role="button" data-r10sel="${esc(sv)}"${opt.selOn?` aria-pressed="${!!r.sel}"`:''}`:r.rest&&opt.key?` role="button" data-r10more="${opt.key}" aria-expanded="false"`:' role="img"';
  return `<div class="r10-pr${r.sel?' sel':''}${r.resid?' resid':''}${r.rest?' rest':''}${sv||r.rest&&opt.key?' act':''}"${act} tabindex="0" aria-label="${esc(tip+(sv?' · '+opt.selTxt:r.rest&&opt.key?' · 누르면 모두 보여요':''))}" data-key="${esc(r.key)}" data-name="${esc(r.name)}" data-p="${r.p==null?'':r.p}" data-c="${r.c==null?'':r.c}" data-ca="${r.ca==null?'':r.ca}" title="${esc(tip)}"><span class="r10-pn"><span class="r10-pt">${esc(r.name)}</span>${sub?`<span class="r10-ps">${esc(sub)}</span>`:''}</span><span class="r10-pb"><i class="p${r.p<0?' neg':''}${ov(r.p)}" style="width:${w(r.p)}%"></i><i class="c${r.c<0?' neg':''}${ov(r.c)}" style="width:${w(r.c)}%"></i></span><span class="r10-pv"><span class="r10-pc num">${fm(r.c)}</span><span class="r10-pd num ${dCl(r)}">${df(r)}</span></span></div>`;}).join('');
 const leg=`<span><i class="prev"></i>비교 ${C.pl} ${opt.what||(A()?'월평균':'비율')}</span><span><i class="cur"></i>이번 ${C.cl} ${opt.what||(A()?'월평균':'비율')}</span><span class="r10-lh">막대에 마우스를 올리면 정확한 값이 보여요${opt.sel?' · '+opt.selTxt:''}</span>`;
 return {chart:`<div class="r10-plot r10-pch" id="r10Plot" data-kind="pair" role="group" aria-label="${esc((opt.title||'비교')+' 가로 막대 그래프')}">${body||'<div class="r10-note">그릴 줄이 없어요</div>'}</div>${opt.more||''}`,legend:leg};}
// 여러 채널 × 월 히트맵 격자: 칸 색·글자 = 그 달 값 vs 그 채널 비교 기간 월평균(금액 %, 비율 %p · DESIGN 히트맵 단계색), 정확한 값은 툴팁
function chGrid(rows,selKey){const C=CC(),a=A();const ms=V5.MONTHS;
 const head=`<span class="r10-gk" aria-hidden="true"></span>`+ms.map(y=>y?`<span class="r10-gm num${C.cur.includes(y)?' cur':C.prev.includes(y)?' prev':''}" aria-hidden="true">${ym2(y)}</span>`:'<span class="r10-gm gap" aria-hidden="true"></span>').join('');
 const body=rows.map(o=>{const x=cmpM(o.m);const base=a?(x.nd?null:x.ap):x.rp;const vals=[];
  const cells=ms.map(y=>{if(!y)return '<span class="r10-gc gap" aria-hidden="true"></span>';const raw=o.m[y];const s=V5.salesM(y);const v=raw==null?null:a?raw:(s?raw/s*100:null);
   let c=null,k='n';if(v!=null&&base!=null&&(!a||base>0)){c=a?(v/base-1)*100:v-base;k=a?bucket(c):bucketP(c);}
   const val=raw==null?'줄 없음':a?f(raw)+'원':(v==null?'매출 줄 없음':v.toFixed(2)+'%')+'('+f(raw)+'원)';vals.push(`${ym2(y)} ${val}`);
   const tip=`${o.name} · ${ym2(y)} ${val}${c!=null?` · 비교 ${C.pl} 월평균 대비 ${a?pctS(c):ppS(c)}`:raw!=null?` · ${C.pl} 비교 기간 없음`:''}`;
   const txt=c==null?'-':(c>=0?'+':'')+(a?Math.round(c)+'%':c.toFixed(2));
   return `<span class="r10-gc bk-${k}${raw==null?' none':''}" data-ym="${y}" data-v="${v==null?'':v}" data-raw="${raw==null?'':raw}" data-c="${c==null?'':c}" title="${esc(tip)}" style="${raw==null?'':`background:${BKC[k]};color:${fg(k)}`}">${txt}</span>`;}).join('');
  const on=o.key===selKey;
  return `<button type="button" class="r10-gl${on?' on':''}" data-r10sel="c:${esc(o.key)}" aria-pressed="${on}" title="${esc(o.name+' · '+vals.join(', '))}">${esc(o.name)}</button>${cells}`;}).join('');
 const B=a?BK:BKP;
 return `<div class="r10-gw" id="r10Grid"><div class="r10-gh"><div class="r10-st2">채널 × 월</div><div class="r10-ss">칸 = 그 달 ${a?'금액':'비율'} vs 채널마다 비교 ${C.pl} 월평균(${a?'%':'%p'}) · 칸에 마우스를 올리면 정확한 값, 채널 이름을 누르면 그 채널을 골라요</div></div>
 <div class="r10-grid" role="group" aria-label="채널 × 월 히트맵">${head}${body}</div><div class="r10-leg r10-gleg">${B.map(([k,l])=>`<span><i style="background:${BKC[k]}"></i>${l}</span>`).join('')}<span><i class="none"></i>그 달 줄 없음(-)</span></div></div>`;}

// ---------- 카드 ----------
function sumLine(t,o){o=o||{};const C=CC();const fm=o.fmt||vChart,df=o.dfmt||dTx;
 return `<div class="r10-sum" id="r10Sum" data-p="${t.p==null?'':t.p}" data-c="${t.c==null?'':t.c}" data-ca="${t.ca}" data-pa="${t.pa}"><span class="r10-sk">비교 ${C.pl}</span><span class="r10-sv num">${t.nd?ND:fm(t.p)}</span><span class="r10-sa" aria-hidden="true">→</span><span class="r10-sk">이번 ${C.cl}</span><span class="r10-sv num">${fm(t.c)}</span><span class="r10-sd num ${dCl(t)}">${df(t)}</span></div>`;}
// 비교 기간 없는 보기 단추: 단추는 disabled 그대로(누르기·기존 선택자), 감싼 칸(.r10-axd, role=button · aria-disabled)이 누르기를 받아 이유 말풍선을 보여요
const whyTxt=x=>{const m=/^(.*?)\((.*)\)$/.exec(x.dis);return `${AXN[x.id]}은 볼 수 없어요 · ${m?m[2]:x.dis}`;};
function card(cfg){const ax0=axHash();const ok=cfg.axes.find(x=>x.id===ax0&&!x.dis);const cur=ok?ax0:'all';const V=cfg.views[cur]();
 const seg=`<div class="r10-ax" id="r10Ax" role="group" aria-label="그래프 보기 고르기">${cfg.axes.map(x=>{const on=x.id===cur;
  if(x.dis)return `<span class="r10-axd" role="button" tabindex="0" aria-disabled="true" data-r10why="${x.id}" data-why="${esc(whyTxt(x))}" title="${esc(x.dis)}" aria-label="${AXN[x.id]} · 줄 없음" aria-describedby="r10axr-${x.id}"><button type="button" data-r10ax="${x.id}" disabled tabindex="-1" aria-hidden="true" aria-pressed="false" data-z="줄 없음">${AXN[x.id]}</button></span>`;
  return `<button type="button" data-r10ax="${x.id}" class="${on?'on':''}" aria-pressed="${on}">${AXN[x.id]}</button>`;}).join('')}</div>`;
 const why=cfg.axes.filter(x=>x.dis).map(x=>`<div class="r10-axr" id="r10axr-${x.id}" data-for="${x.id}">${esc(x.dis)}</div>`).join('');
 return `<section class="r10-sec r10-cc" id="r10Chart" data-ax="${cur}"><div class="r10-ch"><div class="r10-st">${cfg.title}</div><div class="r10-ss" id="r10Unit">${V.unit||unitLine()}</div></div>
 <div class="r10-axw">${seg}<div class="r10-axb" id="r10AxTip" hidden></div>${why?`<div class="r10-axn" id="r10AxNote">${why}</div>`:''}</div>${V.sum}${V.chart}<div class="r10-leg" id="r10Leg">${V.legend}</div>${V.note?`<div class="r10-note" id="r10ChartNote">${V.note}</div>`:''}${V.extra||''}</section>`;}

// ---------- 자료 축 ----------
const vnList=L=>L.length>2?`${L.slice(0,2).join(', ')} 외 ${L.length-2}곳`:L.join(', ');
function itemsOf(mats,vnOf){const g={};mats.forEach(x=>{const o=g[x.item]||(g[x.item]={key:x.item,name:x.name,unit:x.spec||'',mq:{},vs:new Set()});o.vs.add(x.vendor);
  Object.entries(x.m).forEach(([y,v])=>{const t=o.mq[y]||(o.mq[y]=[0,0]);t[0]+=v[0];t[1]+=v[1]||0;});});
 return Object.values(g).map(o=>({key:o.key,name:o.name,unit:o.unit,mq:o.mq,m:Object.fromEntries(Object.entries(o.mq).map(([y,v])=>[y,v[0]])),vns:[...o.vs].map(vnOf)}));}
function itemRows(items){const {R}=rowsOf(items,null);R.forEach(r=>{r.u2=pchg({m:r.mq},st.cmp);const u=r.u2;r.tip=`${r.name} · ${CC().pl} ${vChart(r.p)} → ${CC().cl} ${vChart(r.c)} · 단가 ${u.pu!=null?f(u.pu):'-'}원 → ${u.cu!=null?f(u.cu):'-'}원(${chgLbl(u)}) · ${CC().cl} 수량 ${f(u.cq)}${r.unit?' '+r.unit:''}${r.vns&&r.vns.length?' · 거래처 '+vnList(r.vns):''}`;});return R;}
const priceGo=r=>M2I[r.key]?'p:'+r.key:null;
const unitSub=r=>{const u=r.u2;if(!u)return '';return `단가 ${u.pu!=null?f(u.pu):u.isNew?ND:'-'} → ${u.cu!=null?f(u.cu):'-'}원 · ${chgLbl(u)}`;};
function vendView(list,total,o){const {R,resid}=rowsOf(list,total,'원장 외 차이');R.forEach(r=>{r.sel=o.selKey&&r.key===o.selKey;});const t=met(total);const un=o.unitName||'곳';
 const CR=chartRows(R,resid,o.selKey,un,o.key);
 const P=pairChart(CR,{title:o.title,key:o.key,sel:o.sel,selOn:true,selTxt:o.selTxt,sub:r=>[shareTxt(r,t.ca),o.badge?o.badge(r):''].filter(Boolean).join(' · '),more:moreBtn(o.key,R.length,un)});
 return {sum:sumLine(t),chart:P.chart,legend:P.legend,note:o.note?o.note(resid):'',extra:o.extra?o.extra(R):''};}
function itemView(items,total,o){const R=itemRows(items);const t=met(total);const key=o.key||'item';const CR=chartRows(R,null,null,'개',key);const go=R.some(r=>priceGo(r));
 const P=pairChart(CR,{title:o.title,key,sel:go?priceGo:null,selTxt:'누르면 그 자재 단가 상세로 가요',sub:unitSub,more:moreBtn(key,R.length,'개')});const ps=R.reduce((a,r)=>a+r.ca,0);
 const note=(o.note||'')+' 막대 옆 작은 글 = 그 품목 가중 단가(공급가액 ÷ 수량).'+(o.gl?` 이번 기간 구매현황 합계 월평균 ${f(ps)}원 · 계정 마감 월평균 ${f(t.ca)}원(차이 ${sg(ps-t.ca)}원). 구매현황은 원장 연결 기준이라 계정 합계와 달라요.`:'');
 return {sum:sumLine(t),chart:P.chart,legend:P.legend,note:note.trim()};}
function allView(m,o){const t=met(m);const M=monthChart(m,{title:o.title});return {sum:sumLine(t),chart:M.chart,legend:M.legend,note:o.note||''};}
// r13 c6(본부장님 보완 3): 거래처 탭이 비는 이유를 쉬운 말로 + 대안(전체 대비 비중). 업체 줄이 있는 계정은 DB 에 모두 적재돼서 여기까지 오는 건 정말 업체 줄이 없는 계정뿐이에요
function shareAlt(i,online){const ys=CC().cur;if(!ys.length||!i||!i.m)return '';
 const av=m=>ys.reduce((a,y)=>a+(m&&m[y]!=null?(typeof m[y]==='number'?m[y]:m[y][0]):0),0)/ys.length;let tot=0;
 if(online){const mm={};(DB.online.lines||[]).forEach(l=>{mm[l.ym]=(mm[l.ym]||0)+l.amt;});tot=av(mm);}
 else{const b=st.div==='mgmt'?DB.mgmt:DB.prod;const lab=st.div==='mgmt'?LABOR_M:LABOR_P;tot=(b.acc||[]).filter(a=>!lab[a.code]).reduce((a,x)=>a+av(x.m),0);}
 const mine=av(i.m);if(!(tot>0)||!(mine>0))return '';
 return ` 대신 전체 대비 비중을 봐요: 이 항목은 ${divName()} 비용(인건비 제외)의 ${(mine/tot*100).toFixed(1)}%예요(${CC().cl} 월평균 ${f(mine)}원 / ${f(tot)}원).`;}
const vendDis=(V,i)=>{const lab=!!(i&&(st.div==='mgmt'?LABOR_M:LABOR_P)[i.code]);
 const why=lab?'거래처 줄 없음(인건비 계정은 사람 이름이라 업체로 나누지 않아요)':!V.length?'거래처 줄 없음(이 계정은 장부에 업체 이름이 달린 줄이 없어요)':!V.some(v=>v.code!=='BLANK')?'거래처 줄 없음(장부에 업체 이름이 비어 있어요)':null;
 return why&&why+(lab?'':shareAlt(i,false));};
const vName=v=>v.code==='BLANK'?'거래처 미기재':v.name;
const vnProd=code=>{const L=(PD.vend[code]||[]);const o=Object.fromEntries(L.map(v=>[v.code,v.name]));return c=>o[c]||M2.vn[c]||c;};

// r10 부재료비 거래처·품목(2026-10-21 본부장님 기준): 원장 5029 는 달마다 원가대체 1줄(거래처 공란)이라, 서버가 구매현황 부재료 품목(시트 기준 · 포장재·소모품 포함)을
//  구매처별·품목별로 보내면(sub5029) 그걸로 보여요. 옛 서버 응답(칸 없음)이면 예전처럼 비활성. 계정 금액(사용액)과 구매액 차이는 그래프 아래 한 줄.
const subData=()=>{const s=DB.sub5029;return s&&Array.isArray(s.vend)&&Array.isArray(s.mat)&&s.total&&typeof s.total==='object'?s:null;};
function subGap(i,S){const C=CC();const ms=new Set(Array.isArray(S.months)?S.months:Object.keys(S.total));const av=(m,ys)=>ys.reduce((a,y)=>a+(m[y]||0),0)/ys.length;
 const part=(lab,ys)=>{if(!ys.some(y=>ms.has(y)))return `${lab} 구매 ${ND}`;const b=av(S.total,ys);if(!ys.some(y=>i.m[y]!=null))return `${lab} 월평균 구매 ${f(b)}원 · 계정 ${ND}`;
  const a=av(i.m,ys);return `${lab} 월평균 구매 ${f(b)}원 · 계정 ${f(a)}원(차이 ${sg(b-a)}원)`;};
 return `부재료비 계정 금액은 그 달 사용액(월초 재고 + 구매 - 월말 재고)이라, 아래 거래처·품목 막대(구매액)와는 재고가 늘거나 준 만큼 달라요. 차이(구매 - 사용)는 재고 증감으로 본 추정이에요. ${part('이번 '+C.cl,C.cur)} · ${part('비교 '+C.pl,C.prev)}.`;}
function subCfg(i,S){const vn=Object.fromEntries(S.vend.map(v=>[v.code,v.name]));const none='(구매현황에 부재료 품목 구매 줄이 없어요)';
 return {title:`${esc(i.title)} 한눈에`,axes:[{id:'all'},{id:'vend',dis:S.vend.length?null:'거래처 줄 없음'+none},{id:'item',dis:S.mat.length?null:'품목 줄 없음'+none}],views:{
  all:()=>allView(i.m,{title:i.title}),
  vend:()=>vendView(S.vend.map(v=>({key:v.code,name:v.name,m:v.m})),S.total,{key:'vend',title:i.title+' 거래처별',note:()=>`거래처 = 부재료 품목(시트 기준 · 포장재·소모품 포함)의 구매현황 구매처 · 구성비 = ${CC().cl} 구매 금액 기준. `+subGap(i,S)}),
  item:()=>itemView(itemsOf(S.mat,c=>vn[c]||M2.vn[c]||c),S.total,{key:'item',title:i.title+' 품목별',gl:false,note:'품목 = 부재료 품목(시트 기준 · 포장재·소모품 포함) 구매현황. '+subGap(i,S)})}};}
function prodCfg(i){const code=i.code;if(code==='5029'){const S=subData();if(S)return subCfg(i,S);}const V=PD.vend[code]||[];const MT=PD.mat[code]||[];const zipm=!MT.length&&code==='5028';
 const iDis=MT.length||zipm?null:/부재료/.test(i.title)?'품목 줄 없음(부재료 품목 분류 줄이 없어요)':'품목 줄 없음(구매현황에 이 계정과 연결된 품목이 없어요)';
 const items=()=>zipm?M2.items.filter(x=>x.g==='ZIP_M').map(x=>({key:x.c,name:x.n,unit:x.u,mq:x.m,m:Object.fromEntries(Object.entries(x.m).map(([y,v])=>[y,v[0]])),vns:Object.keys(x.v).map(c=>M2.vn[c]||c)})):itemsOf(MT,vnProd(code));
 return {title:`${esc(i.title)} 한눈에`,axes:[{id:'all'},{id:'vend',dis:vendDis(V,i)}].concat(st.div==='mgmt'?[]:[{id:'item',dis:iDis}]),views:{/* hq3: 경영지원은 구매현황 품목이 없어 품목별 보기를 숨겨요 */
  all:()=>allView(i.m,{title:i.title}),
  vend:()=>vendView(V.map(v=>({key:v.code,name:vName(v),m:v.m})),i.m,{key:'vend',title:i.title+' 거래처별',selKey:st.v,sel:r=>'v:'+r.key,selTxt:'누르면 AI 질문이 그 거래처로 좁혀져요',badge:r=>vNatOf(r.key),
   note:rs=>`거래처 = ${vSrcNote(code)?'회계집계표·원장':'이카운트 원장'} 업체 · 구성비 = ${CC().cl} 금액 기준.${rs?' 원장 외 차이 = 마감 금액 - 원장 업체 합계라 더하면 전체와 같아요.':''}${V.some(v=>vNatOf(v.code))?' 금융성·보험성 표시는 이름으로 구분한 참고예요(합계에서 빼지 않아요).':''}`,
   extra:()=>{const t=[vSrcNote(code),q4VendNote()].filter(Boolean).join(' ');return t?`<div class="sub r13-src" id="r13VendSrc">${esc(t)}</div>`:'';}}),
  item:()=>itemView(items(),i.m,{key:'item',title:i.title+' 품목별',gl:true,note:zipm?'[추정 연결] 원재료비는 원장 연결 품목이 없어 구매현황 원재료 품목 전체로 보여요.':'품목 = 이 계정 원장 줄에 연결된 구매현황 품목.'})}};}
function onlineCfg(i){const V=view();const acc=(DB.ovend||[]).find(a=>a.code===OACC[i.title]);const OV=acc?acc.vend:[];
 const chs=i.drivers.map(d=>({key:d.id,name:d.name,m:d.m}));const cc=curCh();
 const vDis=!OV.length?'거래처 줄 없음(이 항목은 장부에 업체 이름이 달린 줄이 없어요)'+shareAlt(i,true):!OV.some(v=>v.code!=='BLANK')?'거래처 줄 없음(장부에 업체 이름이 비어 있어요)'+shareAlt(i,true):null;
 return {title:`${esc(i.title)} 한눈에`,axes:[{id:'all'},{id:'ch',dis:chs.length?null:'채널 줄 없음(이 항목은 채널별 비용 줄이 없어요)'},{id:'vend',dis:vDis}],views:{
  all:()=>allView(i.m,{title:i.title}),
  ch:()=>vendView(chs,i.m,{key:'ch',title:i.title+' 채널별',unitName:'개 채널',selKey:cc,sel:r=>'c:'+r.key,selTxt:'누르면 그 채널을 골라요(아래 채널 이동도 그 채널)',
   badge:r=>V.some(l=>l.moved&&l.item===i.title&&(l.eff===r.key||l.ch===r.key))?'이동 반영':'',note:()=>'채널 이동이 반영돼요. 채널을 다 더하면 전체와 같아요.',extra:R=>chGrid(R,cc)}),
  vend:()=>vendView(OV.map(v=>({key:v.code,name:v.name,m:v.m})),i.m,{key:'vend',title:i.title+' 거래처별',
   note:rs=>`거래처 = 이카운트 원장(온라인) 업체 · 구성비 = ${CC().cl} 금액 기준.${rs?' 원장 외 차이 = 전체(월 탭 채널 직접비) - 원장 업체 합계라 더하면 전체와 같아요.':''}`})}};}
function vdCfg(){const {a,v}=vdData();const mats=st.div==='prod'?(PD.mat[a.code]||[]).filter(m=>m.vendor===v.code):[];
 const iDis=st.div==='online'?'품목 줄 없음(구매현황에 온라인 원장과 연결된 품목이 없어요)':mats.length?null:'품목 줄 없음(구매현황에 이 업체와 연결된 품목이 없어요)';
 return {title:`${esc(v.name)} 한눈에`,axes:[{id:'all'}].concat(st.div==='mgmt'?[]:[{id:'item',dis:iDis}]),views:{
  all:()=>allView(v.m,{title:v.name}),
  item:()=>itemView(itemsOf(mats,()=>v.name),v.m,{key:'item',title:v.name+' 품목별',gl:false,note:`품목 = ${esc(a.name)} 원장 줄에 연결된 구매현황 품목.`})}};}
function pdCfg(){const it=pItem();const C=CC();const up={};const ms=V5.MONTHS.filter(Boolean);ms.forEach(y=>{const v=it.m[y];if(v&&v[1]>0)up[y]=v[0]/v[1];});
 const c=pchg(it,st.cmp);const ut=it.u?' / '+esc(it.u):'';const fmP=v=>v==null?'-':f(v)+'원';
 const t={p:c.pu,c:c.cu,d:c.chg,nd:c.isNew,ca:c.ca/C.cur.length,pa:c.pa/C.prev.length};const dP=r=>r.c==null?'이번 구매 없음':r.nd?ND:r.d==null?'비교불가':pctS(r.d);
 const vs=Object.entries(it.v).map(([vc,m])=>{const x=pchg({m},st.cmp);const n=M2.vn[vc]||vc;return {key:vc,name:n,p:x.pu,c:x.cu,d:x.chg,nd:x.isNew,x,ca:x.ca/C.cur.length,pa:x.pa/C.prev.length};}).filter(r=>r.x.ca>0||r.x.pa>0).sort((a,b)=>b.x.ca-a.x.ca);
 vs.forEach(r=>{r.tip=`${r.name} · 단가 ${C.pl} ${r.p!=null?f(r.p)+'원':r.nd?ND:'-'} → ${C.cl} ${fmP(r.c)} · ${dP(r)} · ${C.cl} 구매 월평균 ${f(r.ca)}원${r.x.cq?` · 수량 ${f(r.x.cq)}${it.u?' '+it.u:''}`:''}`;});
 // 월별 단가 툴팁 = 수량 · 금액 · 전월 대비(예전 '월별 단가·수량' 표의 칸)
 const tipx=y=>{const v=it.m[y];if(!v)return '';const k=ms.indexOf(y);const pv=k>0&&y!=='2601'?up[ms[k-1]]:null;const u=up[y];return ` · 수량 ${f(v[1])}${it.u?' '+it.u:''} · 금액 ${f(v[0])}원${u!=null&&pv>0?' · 전월 대비 '+pctS((u/pv-1)*100):''}`;};
 const LIM=TOPN+3;
 return {title:`${esc(it.n)} 단가 한눈에`,axes:[{id:'all'},{id:'vend',dis:vs.length?null:`거래처 줄 없음(${C.pl}·${C.cl}에 이 자재를 산 업체가 없어요)`}],views:{
  all:()=>{const M=monthChart(up,{price:true,title:it.n+' 월별 단가',tipx});
   return {unit:`${C.cl} vs ${C.pl} 가중 단가 · 원${ut} · 공급가액 ÷ 수량`,sum:sumLine(t,{fmt:fmP,dfmt:dP}),chart:M.chart,legend:M.legend,note:'막대 툴팁에 그 달 수량 · 금액 · 전월 대비 단가 변화가 있어요.'};},
  vend:()=>{const L=openK('pvend')?vs:vs.slice(0,LIM);const P=pairChart(L,{title:it.n+' 거래처별 단가',fmt:fmP,dfmt:dP,what:'단가',more:moreBtn('pvend',vs.length,'곳',LIM)});
   return {unit:`${C.cl} vs ${C.pl} 거래처별 가중 단가 · 원${ut}`,sum:sumLine(t,{fmt:fmP,dfmt:dP}),chart:P.chart,legend:P.legend,note:vs.length>LIM?`단가가 높은 순이 아니라 ${C.cl} 구매 금액이 큰 순이에요.`:''};}}};}

// ---------- 원본 화면에서 접는 섹션만 바꾸기 ----------
function swap(html,cfg,keep,guideTxt,headTxt){const t=document.createElement('template');t.innerHTML=html;const F=t.content;
 const accs=F.querySelector('.accs');if(!accs)return html;
 const kept=keep.map(id=>{const e=F.getElementById('acc-'+id);return e?e.outerHTML:'';}).join('');
 const box=document.createElement('template');box.innerHTML=card(cfg);
 const sig=F.querySelector('section.sigc');const anchor=sig||accs;anchor.parentNode.insertBefore(box.content,anchor);
 if(kept){accs.innerHTML=kept;accs.classList.add('r10-tools');}else accs.remove();
 const g=F.getElementById('guideText');if(g&&guideTxt)g.textContent=guideTxt;
 if(headTxt){F.querySelectorAll('.pg-s').forEach(e=>{if(/표는 접혀/.test(e.textContent))e.textContent=headTxt;});const bh=F.getElementById('basisHint');if(bh)bh.remove();}
 return t.innerHTML;}

// 화면 글·툴팁의 개발 용어(테이블 이름 등) → 쉬운 말. 본문(#main)만, 글 조각·title·aria-label
const DEV=[[/\s*\((?:fact|dim|v)_[A-Za-z_.]+\)/g,''],[/item_group\s+ZIP_M/g,'원재료 분류'],[/item_group\s+ZIP_S\s*포장재\s*·\s*ZIP_E\s*소모품/g,'포장재·소모품 분류'],[/item_group으로/g,'자재 분류로'],[/item_group/g,'자재 분류'],
 [/\(ZIP_[A-Z]\)/g,''],[/ZIP_M/g,'원재료'],[/ZIP_S/g,'포장재'],[/ZIP_E/g,'소모품'],[/net_sales_tab/g,'채널 매출'],[/v_prod_sales\.prod_sales/g,'생산매출'],[/(?:fact|dim)_[a-z_]+(?:\.[a-z_]+)?/g,'원본 자료'],[/cost_v5\.sqlite/g,'비용 DB']];
const DEVRE=/fact_|dim_|item_group|ZIP_[A-Z]|net_sales|v_prod_|sqlite/;
const plain=t=>DEV.reduce((a,[re,b])=>a.replace(re,b),t);
function clean(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))if(DEVRE.test(n.nodeValue)&&!(n.parentElement&&n.parentElement.closest('[data-nodev]')))n.nodeValue=plain(n.nodeValue);   /* c13: data-nodev 로 표시한 곳(품목 코드)은 그대로 둬요 */
 root.querySelectorAll('[title],[aria-label]').forEach(e=>['title','aria-label'].forEach(k=>{const v=e.getAttribute(k);if(v&&DEVRE.test(v)&&!e.closest('[data-nodev]'))e.setAttribute(k,plain(v));}));}
// 비교 기간 없는 보기 단추를 누르면: 그 단추 아래 말풍선(5초) + 읽기 프로그램 알림
let whyT=0;
function hideWhy(){const t=document.getElementById('r10AxTip');if(t)t.hidden=true;clearTimeout(whyT);}
function showWhy(w){const tip=document.getElementById('r10AxTip');if(!tip)return;const box=tip.parentNode.getBoundingClientRect(),r=w.getBoundingClientRect();
 tip.textContent=w.dataset.why;tip.dataset.for=w.dataset.r10why;tip.style.left=Math.round(r.left-box.left)+'px';tip.style.top=Math.round(r.bottom-box.top+8)+'px';tip.hidden=false;
 if(V5.live)V5.live(w.dataset.why);clearTimeout(whyT);whyT=setTimeout(hideWhy,5000);}

window.R10CHART={met,rowsOf,chartRows,prodCfg,onlineCfg,vdCfg,pdCfg,plain};   // 시험·확인용(화면 동작에는 안 써요)
const base=window.R10HOOK;
window.R10HOOK=function(){const _s3=window.step3,_vd=window.stepVendDrill,_pd=window.stepPriceDrill,_sb=window.setBasesFor,_ph=window.parseHash;
 window.go=goR;
 // 온라인 '월별 줄 · 채널 이동'(줄 고르기 표)은 기능이라 남기되 늘 접힌 채로 열어요(예전엔 워터폴·히트맵에서 오면 펼쳐졌어요)
 window.parseHash=function(){if(st.pendOpen)st.pendOpen=st.pendOpen.filter(x=>x!=='lines');return _ph.apply(this,arguments);};
 // 온라인 3단계 그래프 '전체'는 모든 채널 합이라 비율 기준은 온라인 매출 하나(예전 화면의 '채널 매출' 기준은 채널 하나 월별 그래프용)
 window.setBasesFor=function(){if(st.div==='online'){V5.setBases('online',[['online','온라인 매출']],{online:OSALES.online});return;}_sb();};
 window.step3=function(){const i=cur();if(!i)return step1();const on=st.div==='online';
  return swap(_s3(),on?onlineCfg(i):prodCfg(i),on?['lines','hist']:[],`그래프 위 단추로 ${on?'전체·채널별·거래처별':st.div==='mgmt'?'전체·거래처별':'전체·거래처별·품목별'}을 바꿔 봐요. 오른쪽 AI 창에서 바로 절감 계획을 만들 수 있어요.`,'그래프 위 단추로 보기를 바꿔요. 막대에 마우스를 올리거나 Tab 으로 가면 정확한 숫자가 보여요.');};
 window.stepVendDrill=function(){return swap(_vd(),vdCfg(),[],st.div==='mgmt'?'그래프 위 단추로 보기를 바꿔 봐요.':'그래프 위 단추로 전체·품목별을 바꿔 봐요.');};
 window.stepPriceDrill=function(){return swap(_pd(),pdCfg(),['psame'],'그래프 위 단추로 전체·거래처별을 바꿔 봐요. 오른쪽 AI 창에서 바로 절감 계획을 만들 수 있어요.');};
 // 2단계 워터폴: 업체 막대 → 3단계 거래처별(그 업체 강조), 온라인 채널 막대 → 3단계 채널별(그 채널)
 window.wfClick=function(id){if(id==='__rest'){toggleSet('rest');return;}if(isP()){st.pendV=id;return goR({s:3,ax:'vend'});}return goR({s:3,ch:id,ax:'ch'});};
 const M=document.getElementById('main');
 M.addEventListener('click',e=>{const wy=e.target.closest('[data-r10why]');if(wy){showWhy(wy);return;}hideWhy();
  const b=e.target.closest('[data-r10ax]');if(b){if(!b.disabled)goR({ax:b.dataset.r10ax});return;}
  const mo=e.target.closest('[data-r10more]');if(mo){toggleSet('r10m-'+mo.dataset.r10more);return;}
  const r=e.target.closest('[data-r10sel]');if(!r)return;const [k,v]=[r.dataset.r10sel.slice(0,1),r.dataset.r10sel.slice(2)];
  if(k==='v'){st.v=st.v===v?null:v;st.m=null;render();}else if(k==='c'){st.sel.clear();goR({ch:v});}else if(k==='p')openPrice(v);});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hideWhy();});
 // 같은 화면 안에서 보기·채널만 바꾼 주소 이동이면 app.js 가 맨 위로 올린 뒤 원래 자리로 되돌려요(이 듣기는 app.js 것보다 뒤에 붙어 나중에 불려요)
 window.addEventListener('hashchange',()=>{if(keepY==null)return;const y=keepY;keepY=null;window.scrollTo(0,y);});
 new MutationObserver(()=>clean(M)).observe(M,{childList:true,subtree:true});
 base();clean(M);};
})();
