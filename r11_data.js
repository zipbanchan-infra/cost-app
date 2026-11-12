// r11b(2026-10-26 본부장님 지시 "처음 보는 사람이 보기 어렵고 어디에 무엇을 적어야 할지 모름 · 업체별·자재별 데이터가 제대로 안 보임")
//  단순 화면(body.r10)에서만 켜져요. 서버·계산식은 그대로이고, 화면이 이미 받은 자료(hmModel·M2)로 표를 더 그려요.
//  되돌리기: flow.html 의 r11_data.css · r11_data.js 두 줄을 빼면 돼요(다시 시작 필요 없음).
//  1 히트맵마다 '표로 보기': 작은 칸·잘린 이름 대신 전체 줄을 표로(이름 찾기 · 머리 눌러 정렬 · 줄 누르면 기존 상세로)
//    원재료·포장재 표는 비교/이번 단가와 '주 거래처'(바뀌었으면 '바뀜')도 보여요 → 단가가 거래처 변경 때문인지 바로 보여요
//  2 생산 '구매 거래처' 표: 원장에 거래처가 적힌 계정은 4개뿐(부재료비는 거래처 미기재)이라, 구매 기록(원재료·포장재·소모품)으로 거래처별 금액·증감·품목을 보여요
//  3 업체 히트맵 위 안내: 어떤 계정만 거래처 자료가 있는지 한 줄
//  4 칸·표의 '입력 필요'(비교 기간 자료가 없다는 뜻) → '비교 기간 없음'(사람이 뭔가 적어야 하는 것처럼 보이던 문제)
//  5 AI 입력칸: 지금 무엇을 적을지 칸 위에 한 줄 + 예시 글(계획 작성 중이면 묻는 칸에 맞춰 바뀜)
//  6 공통비 입력 = 실제 비용(2026-10-30 본부장님 결정, 합계에 더함 · app.js ccMerge): 순서 안내 + 금액 칸 설명 + 단계별 '합계 반영' 열 안내
(function(){
if(!document.body.classList.contains('r10'))return;
const R={view:'map',pv:false,q:'',sort:null,open:new Set()};
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const g=n=>{try{return (0,eval)(n);}catch(e){return undefined;}};   // app.js 의 전역 const(st·CC·M2 등)를 전역 범위에서 이름으로 읽기(이 파일 안 같은 이름과 안 섞임)
const cleanN=n=>String(n||'').replace(/_/g,' ').replace(/\s+/g,' ').replace(/^거래처 공란$/,'거래처 미기재').trim();
const fm=n=>n==null?'-':Math.round(n).toLocaleString('ko-KR');
const man=n=>{const m=g('man');return m?m(n):fm(n)+'원';};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=(v,p)=>v==null?'<span class="r11-nd">비교 기간 없음</span>':`<span class="${v>0.05?'up':v<-0.05?'dn':''}">${v>0?'+':''}${v.toFixed(p==null?1:p)}%</span>`;
const ppx=v=>v==null?'<span class="r11-nd">-</span>':`<span class="${v>0.005?'up':v<-0.005?'dn':''}">${v>0?'+':''}${Math.abs(v)<0.1?v.toFixed(2):v.toFixed(1)}%p</span>`;
function C(){const c=g('CC');return c?c():{cur:['2607','2608','2609'],prev:['2507','2508','2509'],cl:'2026 Q3',pl:'2025 Q3'};}
function sum(m,ys){let a=0,q=0;for(const y of ys){const v=m&&m[y];if(v){a+=v[0];q+=v[1]||0;}}return [a,q];}
function setView(v){R.view=v;try{sessionStorage.setItem('r11_hmv',v);}catch(e){}rr();}
function rr(){const r=window.render;if(typeof r==='function')r();}

// ---------- 1 히트맵 표 ----------
function hmRows(){const H=g('hmModel')();const st=g('st');const cc=C();const price=H.kind==='price';const M2I=g('M2I')||{};const vn=(g('M2')||{}).vn||{};
 const rows=[];H.secs.forEach(s=>s.items.forEach(i=>{const r={id:i.id,n:i.n,sec:s.s,ca:i.ca/cc.cur.length,chg:i.chg,pp:i.pp,nd:i.isNew,click:i.click!==false};
  if(price){const it=M2I[i.id];if(it){const [a1,q1]=sum(it.m,cc.cur),[a0,q0]=sum(it.m,cc.prev);r.cu=q1>0?a1/q1:null;r.pu=q0>0?a0/q0:null;r.imp=(r.cu!=null&&r.pu!=null)?q1*(r.cu-r.pu):null;r.unit=it.u||'';
    const top=ys=>{let b=null,bv=0;Object.entries(it.v||{}).forEach(([vc,m])=>{const [a]=sum(m,ys);if(a>bv){bv=a;b=vc;}});return b;};const v1=top(cc.cur),v0=top(cc.prev);r.v1=v1?(vn[v1]||v1):'';r.v0=v0?(vn[v0]||v0):'';r.vch=!!(v1&&v0&&v1!==v0);r.nv=Object.keys(it.v||{}).length;}}
  rows.push(r);}));return {H,rows,price,st};}
function sortRows(rows,price){const s=R.sort||(price?{k:'imp',d:-1}:{k:'chgAmt',d:-1});const key={n:r=>r.n,sec:r=>r.sec,ca:r=>r.ca,chg:r=>r.chg==null?-1e9:r.chg,pp:r=>r.pp==null?-1e9:r.pp,imp:r=>r.imp==null?-1e15:r.imp,chgAmt:r=>r.chg==null?-1e15:r.ca*r.chg/(100+r.chg),v1:r=>r.v1||''}[s.k]||(r=>r.ca);
 return rows.slice().sort((a,b)=>{const x=key(a),y=key(b);return (x>y?1:x<y?-1:0)*s.d;});}
function th(k,l,cls){const s=R.sort;const on=s&&s.k===k;return `<th class="${cls||''}"><button type="button" data-r11sort="${k}" aria-label="${l} 순으로 정렬">${l}${on?(s.d<0?' ↓':' ↑'):''}</button></th>`;}
function tableHtml(){const {H,rows,price}=hmRows();const cc=C();const q=R.q.trim();const L=sortRows(rows.filter(r=>!q||cleanN(r.n).includes(q)||r.n.includes(q)||(r.v1||'').includes(q)),price);
 const head=price?`<tr>${th('n','자재')}${th('sec','분류')}<th class="num">단가 ${esc(cc.pl)} → ${esc(cc.cl)}</th>${th('chg','단가 변화','num')}${th('ca','월평균 구매액','num')}${th('imp','영향(늘어난 금액)','num')}${th('v1','주 거래처')}</tr>`
  :`<tr>${th('n','이름')}${th('sec','묶음')}${th('ca','월평균 금액','num')}${th('chgAmt','금액 변화','num')}${th('pp','매출 대비 변화','num')}</tr>`;
 const body=L.map(r=>{const nm=`<span class="r11-nm" title="${esc(r.n)}">${esc(cleanN(r.n))}</span>`;
  if(price)return `<tr data-r11row="${esc(r.id)}" tabindex="0"><td>${nm}${r.unit?`<span class="r11-u">${esc(r.unit)}당</span>`:''}</td><td>${esc(r.sec)}</td><td class="num">${r.pu!=null?fm(r.pu)+'원':'-'} → ${r.cu!=null?fm(r.cu)+'원':'-'}</td><td class="num">${pct(r.chg)}</td><td class="num">${man(r.ca)}</td><td class="num">${r.imp==null?'-':(r.imp>0?'+':'')+man(r.imp/cc.cur.length)}</td><td>${r.vch?`<span class="r11-vch" title="주 거래처가 바뀌었어요">${esc(r.v0)} → <b>${esc(r.v1)}</b></span>`:esc(r.v1||'-')}${r.nv>1?`<span class="r11-u">외 ${r.nv-1}곳</span>`:''}</td></tr>`;
  const da=r.chg==null?null:r.ca*r.chg/(100+r.chg);
  return `<tr data-r11row="${esc(r.id)}" tabindex="0" class="${r.click?'':'nock'}"><td>${nm}</td><td>${esc(r.sec)}</td><td class="num">${man(r.ca)}</td><td class="num">${da==null?'<span class="r11-nd">비교 기간 없음</span>':`<span class="${da>0?'up':'dn'}">${da>0?'+':''}${man(da)}</span> <span class="r11-u">${r.chg>0?'+':''}${r.chg.toFixed(1)}%</span>`}</td><td class="num">${ppx(r.pp)}</td></tr>`;}).join('');
 const hint=price?'‘영향’ = 이번 분기 구매량 × 단가 차이(월평균). 주 거래처가 바뀐 자재는 단가가 거래처 변경 때문일 수 있어요.':'금액 변화 = 이번 월평균 - 비교 월평균.';
 return `<section class="r10-sec r11-tblsec" id="r11Tbl"><div class="r11-tbar"><label class="r11-q"><span>이름으로 찾기</span><input id="r11Q" type="search" value="${esc(R.q)}" placeholder="${price?'예) 양파, 소고기, 아워팩':'예) 지급수수료, 한국전력'}" autocomplete="off"></label><span class="r11-cnt">${L.length}줄 · ${esc(cc.cl)} vs ${esc(cc.pl)}</span></div>
 <div class="r11-tw"><table class="r11-t"><thead>${head}</thead><tbody>${body||`<tr><td colspan="7" class="r11-empty">찾는 이름이 없어요</td></tr>`}</tbody></table></div><div class="r11-hint">${hint} 줄을 누르면 자세히 봐요.</div></section>`;}

// ---------- 2 구매 거래처 표(생산) ----------
function pvModel(){const M2=g('M2');const cc=C();const by={};
 M2.items.forEach(it=>Object.entries(it.v||{}).forEach(([vc,m])=>{const [a1,q1]=sum(m,cc.cur),[a0,q0]=sum(m,cc.prev);if(!a1&&!a0)return;const o=by[vc]||(by[vc]={vc,name:M2.vn[vc]||vc,a1:0,a0:0,its:[]});o.a1+=a1;o.a0+=a0;
  o.its.push({c:it.c,n:it.n,u:it.u,sec:it.sec,a1,a0,cu:q1>0?a1/q1:null,pu:q0>0?a0/q0:null});}));
 return Object.values(by).map(o=>{o.m1=o.a1/cc.cur.length;o.m0=o.a0/cc.prev.length;o.chg=o.m0>0?(o.m1/o.m0-1)*100:null;o.d=o.m1-o.m0;o.its.sort((x,y)=>y.a1-x.a1);
  o.up=o.its.filter(i=>i.cu!=null&&i.pu>0&&i.cu/i.pu>1.05).length;return o;});}
function pvHtml(){const cc=C();const q=R.q.trim();const s=R.sort&&['name','m1','d','chg','n','up'].includes(R.sort.k)?R.sort:{k:'m1',d:-1};
 const key={name:o=>o.name,m1:o=>o.m1,d:o=>o.d,chg:o=>o.chg==null?-1e9:o.chg,n:o=>o.its.length,up:o=>o.up}[s.k];
 const L=pvModel().filter(o=>!q||o.name.includes(q)||o.its.some(i=>i.n.includes(q)||cleanN(i.n).includes(q))).sort((a,b)=>{const x=key(a),y=key(b);return (x>y?1:x<y?-1:0)*s.d;});
 const T=pvModel().reduce((a,o)=>a+o.m1,0);
 const rows=L.map(o=>{const op=R.open.has(o.vc);const top=o.its.filter(i=>i.a1>0).slice(0,3).map(i=>cleanN(i.n)).join(', ');
  const sub=op?`<tr class="r11-sub"><td colspan="6"><table class="r11-t r11-in"><thead><tr><th>자재</th><th class="num">이 거래처 단가 ${esc(cc.pl)} → ${esc(cc.cl)}</th><th class="num">변화</th><th class="num">월평균 구매액</th></tr></thead><tbody>${o.its.map(i=>`<tr data-r11pm="${esc(i.c)}" tabindex="0"><td><span class="r11-nm">${esc(cleanN(i.n))}</span>${i.u?`<span class="r11-u">${esc(i.u)}당</span>`:''}</td><td class="num">${i.pu!=null?fm(i.pu)+'원':'-'} → ${i.cu!=null?fm(i.cu)+'원':'-'}</td><td class="num">${i.cu!=null&&i.pu>0?pct((i.cu/i.pu-1)*100):i.a1&&!i.a0?'<span class="r11-nd">새로 산 자재</span>':i.a0&&!i.a1?'<span class="r11-nd">이번엔 안 삼</span>':'-'}</td><td class="num">${man(i.a1/cc.cur.length)}</td></tr>`).join('')}</tbody></table></td></tr>`:'';
  return `<tr data-r11pv="${esc(o.vc)}" tabindex="0" aria-expanded="${op}"><td><span class="r11-cv">${op?'▾':'▸'}</span> <span class="r11-nm">${esc(o.name)}</span><div class="r11-u r11-top">${esc(top)}</div></td><td class="num">${man(o.m1)}<div class="r11-u">비중 ${T?(o.m1/T*100).toFixed(1):0}%</div></td><td class="num">${o.m0>0?`<span class="${o.d>0?'up':'dn'}">${o.d>0?'+':''}${man(o.d)}</span>`:'<span class="r11-nd">새 거래처</span>'}</td><td class="num">${o.m0>0?pct(o.chg):'-'}</td><td class="num">${o.its.length}개</td><td class="num">${o.up?`<span class="up">${o.up}개</span>`:'0개'}</td></tr>${sub}`;}).join('');
 return `<div class="vhead r11-vh"><div><div class="pg-eyebrow">생산본부 · 구매 기록 기준 · ${esc(cc.cl)} vs ${esc(cc.pl)}</div><div class="pg-h">구매 거래처 <span class="pg-n num">월평균 ${man(T)}</span></div><div class="pg-s">원재료·포장재·소모품을 어느 거래처에서 얼마나 샀는지예요. 줄을 누르면 그 거래처에서 산 자재와 단가가 펼쳐져요.</div></div></div>
 <section class="r10-sec r11-tblsec" id="r11Pv"><div class="r11-tbar"><label class="r11-q"><span>거래처·자재 이름으로 찾기</span><input id="r11Q" type="search" value="${esc(R.q)}" placeholder="예) 아워팩, 대흥물산, 양파" autocomplete="off"></label><span class="r11-cnt">${L.length}곳</span></div>
 <div class="r11-tw"><table class="r11-t"><thead><tr>${th('name','거래처')}${th('m1','월평균 구매액','num')}${th('d','늘어난 금액','num')}${th('chg','증감률','num')}${th('n','자재 수','num')}${th('up','단가 5%↑ 자재','num')}</tr></thead><tbody>${rows||'<tr><td colspan="6" class="r11-empty">찾는 이름이 없어요</td></tr>'}</tbody></table></div>
 <div class="r11-hint">구매현황(이카운트 구매) 기준이라 회계 계정 금액과는 조금 달라요(재고 증감만큼). 단가 = 공급가액 ÷ 수량.</div></section>`;}


// ---------- 6 공통비 = 실제 비용 (2026-10-30 본부장님 결정: 합계에 더함. 2026-10-26 '예산·합계 제외'를 뒤집음) ----------
function fixCC(M){const st=g('st');if(!st||st.div!=='mgmt')return;
 const form=M.querySelector('#ccForm');if(!form)return;
 const ah=form.querySelector('#ccAmtIn')&&form.querySelector('#ccAmtIn').parentElement.querySelector('.fhelp');if(ah&&!ah.dataset.r11){ah.dataset.r11='1';ah.textContent='그 기간 전체 실제 비용을 원 단위로 적어요. 분기는 3달로 똑같이 나눠 더해요. 예) 26Q4 지급수수료 4,000만원 → 40000000';}
 if(!form.querySelector('#r11CcHow')){const ct=form.querySelector('.ct');if(ct)ct.insertAdjacentHTML('afterend','<ol class="r11-how" id="r11CcHow"><li>계정을 고르고</li><li>기간(26Q4 또는 2610)을 적고</li><li>그 기간 실제 비용을 적은 뒤 ‘저장’</li></ol>');}}
// ---------- 화면 고치기(render 뒤) ----------
function fixHm(M){const st=g('st');const hk=M.querySelector('#hmKinds');if(!hk||!st||!st.hm)return;
 const isProd=st.div==='prod';
 if(isProd&&!hk.querySelector('[data-r11pvbtn]'))hk.insertAdjacentHTML('beforeend',`<button type="button" class="chipb${R.pv?' on':''}" data-r11pvbtn="1">구매 거래처</button>`);
 if(R.pv)hk.querySelectorAll('[data-hm]').forEach(b=>b.classList.remove('on'));
 const page=M.querySelector('#page');
 if(R.pv){page.classList.add('r11-pvmode');if(!M.querySelector('#r11Pv'))hk.insertAdjacentHTML('afterend',pvHtml());
  const gt=M.querySelector('#guideText');if(gt)gt.textContent='거래처 줄을 누르면 그 거래처에서 산 자재와 단가가 펼쳐져요. 자재를 누르면 단가 상세로 가요.';return;}
 if(R.view==='tbl'){page.classList.add('r11-tblmode');if(!M.querySelector('#r11Tbl'))(M.querySelector('.tm-ctrl')||hk).insertAdjacentHTML('afterend',tableHtml());
  const gt=M.querySelector('#guideText');if(gt)gt.textContent='표 머리를 누르면 정렬돼요. 줄을 누르면 자세히 봐요.';}
 if(st.hm==='vend'&&!M.querySelector('#r11VendNote')){const H=g('hmModel')();const names=H.secs.map(s=>s.s).join(' · ');
  const msg=`거래처가 원장에 적힌 계정만 보여요: ${esc(names)}.${isProd?' 부재료비는 원장에 거래처가 안 적혀 ‘거래처 미기재’ 한 칸이에요. 원재료·포장재는 ‘구매 거래처’에서 거래처별로 볼 수 있어요.':' 다른 계정은 원장 거래처 줄이 없어 여기에는 안 나와요.'}`;
  hk.insertAdjacentHTML('afterend',`<div class="r11-note" id="r11VendNote">${msg}${isProd?' <button type="button" class="r11-link" data-r11pvbtn="1">구매 거래처 보기 ›</button>':''}</div>`);}}
function fixND(M){['#tm','#tmSide','.tm-ctrl','.r10-plot','#issueList','#r10Kpis'].forEach(sel=>$$(sel,M).forEach(root=>{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const L=[];while(w.nextNode())L.push(w.currentNode);
  L.forEach(n=>{if(/입력 필요/.test(n.nodeValue))n.nodeValue=n.nodeValue.replace(/매출·비교 기간 없음\(입력 필요\)|비교 기간 없음\(입력 필요\)/g,'비교 기간 없음').replace(/입력 필요/g,'비교 기간 없음');});}));}
function fixMain(){const M=document.getElementById('main');if(!M)return;const st=g('st');if(!st||!st.hm||st.s!==1){R.pv=false;}
 try{fixHm(M);}catch(e){console.warn('r11 hm',e);}try{fixND(M);}catch(e){console.warn('r11 nd',e);}try{fixCC(M);}catch(e){console.warn('r11 cc',e);}}

// ---------- 5 AI 입력칸 ----------
const EX={'계정':'예) 부재료비','대상':'예) 아워팩 주식회사 / 포장재 전체','방법':'예) 포장재 거래처를 바꿔 단가 10% 낮추기','목표 금액':'예) 분기 300만원','기한':'예) 2026-12-31 또는 12월 말'};
function fixAI(){const side=document.getElementById('aiSide');if(!side)return;const ta=side.querySelector('#aiText');if(!ta)return;
 const asking=$$('*',side).find(e=>!e.children.length&&/·\s*묻는 중$/.test(e.textContent.trim()));const slot=asking?asking.textContent.replace(/·\s*묻는 중/,'').trim():'';
 const lbl=slot?`지금 적을 것: <b>${esc(slot)}</b> · 아래 칸에 적고 ‘보내기’`:'AI에게 물어보기 · 아래 칸에 궁금한 걸 적고 ‘보내기’';
 const ph=slot?(EX[slot]||'여기에 적어 주세요'):'예) 부재료비가 왜 늘었어? / 포장비 줄일 방법 알려줘';
 if(ta.placeholder!==ph)ta.placeholder=ph;
 let L=side.querySelector('#r11AiLbl');const box=ta;   // .ai-in(세로 묶음) 안, 입력칸 바로 위
 if(!L){L=document.createElement('div');L.id='r11AiLbl';L.className='r11-ailbl';box.before(L);}else if(L.nextElementSibling!==box)box.before(L);
 if(L.innerHTML!==lbl)L.innerHTML=lbl;
 if(!slot){let h=side.querySelector('#r11AiHelp');const pb=$$('button',side).find(b=>/절감 계획 작성하기/.test(b.textContent));
  if(pb&&!h){h=document.createElement('div');h.id='r11AiHelp';h.className='r11-aihelp';h.textContent='‘절감 계획 작성하기’를 누르면 AI가 계정·대상·방법·목표 금액·기한을 하나씩 물어봐요. 칸에 적어 둔 글이 있으면 첫 답으로 쓰여요.';(pb.parentElement||pb).after(h);}}
 else{const h=side.querySelector('#r11AiHelp');if(h)h.remove();}}
let aiQ=false;function aiLater(){if(aiQ)return;aiQ=true;requestAnimationFrame(()=>{aiQ=false;try{fixAI();}catch(e){console.warn('r11 ai',e);}});}
function watchAI(){const side=document.getElementById('aiSide');if(!side||side.dataset.r11w)return;side.dataset.r11w='1';new MutationObserver(aiLater).observe(side,{childList:true,subtree:true});aiLater();}

// ---------- 클릭·입력 ----------
document.addEventListener('click',e=>{const t=e.target;
 if(t.closest('button[data-hm],button[data-div],button[data-step],button.r10-back,button[data-view],button[data-issue]'))R.pv=false;   // #page 에도 data-step 이 있어 단추만 봐요   // 다른 보기로 가면 구매 거래처 표는 닫힘(기존 동작 그대로)
 const v=t.closest('[data-r11v]');if(v){e.preventDefault();setView(v.dataset.r11v);return;}
 const pb=t.closest('[data-r11pvbtn]');if(pb){e.preventDefault();R.pv=!R.pv||pb.classList.contains('r11-link');R.q='';R.sort=null;R.open.clear();rr();return;}
 const so=t.closest('[data-r11sort]');if(so){e.preventDefault();const k=so.dataset.r11sort;R.sort=R.sort&&R.sort.k===k?{k,d:-R.sort.d}:{k,d:(k==='n'||k==='name'||k==='sec'||k==='v1')?1:-1};rr();return;}
 const pm=t.closest('[data-r11pm]');if(pm){e.preventDefault();R.pv=false;const op=g('openPrice');if(op)op(pm.dataset.r11pm);return;}
 const pv=t.closest('[data-r11pv]');if(pv){const k=pv.dataset.r11pv;R.open.has(k)?R.open.delete(k):R.open.add(k);rr();return;}
 const row=t.closest('[data-r11row]');if(row&&!row.classList.contains('nock')){const hc=g('hmClick');if(typeof hc==='function')hc(row.dataset.r11row);   // r12 c4: 표 보기로 새로 열면 칸 그림이 안 그려져 있어서(단추 없음) 줄이 안 눌리던 것 - 칸 단추와 같은 함수를 직접 불러요
  else{const b=document.querySelector(`#tm [data-tm="${CSS.escape(row.dataset.r11row)}"]`);if(b)b.click();}}},true);
document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const r=e.target.closest&&e.target.closest('[data-r11row],[data-r11pv],[data-r11pm]');if(r){e.preventDefault();r.click();}});
let qT;document.addEventListener('input',e=>{if(e.target.id!=='r11Q')return;R.q=e.target.value;clearTimeout(qT);qT=setTimeout(()=>{const pos=e.target.selectionStart;rr();const n=document.getElementById('r11Q');if(n){n.focus();try{n.setSelectionRange(pos,pos);}catch(_){}}},250);});

function wrap(){const r=window.render;if(typeof r!=='function'||r.r11d)return false;const w=function(){const out=r.apply(this,arguments);fixMain();watchAI();return out;};w.r11d=true;window.render=w;return true;}
const base=window.R10HOOK;
if(typeof window.render==='function'&&window.R10_READY){wrap();rr();}   // 늦게 붙였을 때(확인용)
else window.R10HOOK=function(){wrap();window.R11_DATA=true;return base&&base.apply(this,arguments);};
window.R11D={R,pvModel,hmRows};
})();
