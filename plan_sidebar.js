// COST1112: 모든 화면 오른쪽 절감계획 작성칸. 저장 전 입력값은 localStorage 'cost1112_plan_draft' 에 남아 페이지를 옮기거나 새로 고쳐도 그대로예요.
//  저장은 기존 POST /api/plans(r9_api.js postPlan) 하나만 써요. 탭(P_계획_A·P_이력_A)이 없으면 postPlan 의 ensureTab 이 그 두 탭만 만들어요(2026-11-12 11:43 승인). 거래처 = 화면 거래처(없으면 '전체'), 기한 = 2026-12-31 자동.
(function(){
const KEY='cost1112_plan_draft';
const METHODS=['단가절감','사용량 절감','업체변경','기타'];
const DIVID={prod:'PROD',online:'ONLINE',mgmt:'MGMT'};
const DUE='2026-12-31';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>Math.round(n).toLocaleString('ko-KR');
const D0={method:'',target:'',plan:'',reason:'',account:'',vendor:'',due:''};
const load=()=>{try{return Object.assign({},D0,JSON.parse(localStorage.getItem(KEY))||{});}catch(e){return Object.assign({},D0);}};
let D=load();let busy=false;
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(D));}catch(e){}};
const $=id=>document.getElementById(id);
const g=name=>{try{return (0,eval)(name);}catch(e){return undefined;}};

// ---------- 지금 보는 곳(계정·거래처·품목)과 현재 단가·현재 비율 ----------
function ctx(){const o={account:'',code:'',vendor:'',item:'',itemCode:'',cu:null,unit:'',ratio:null,where:''};
 const st=g('st');if(!st)return o;o.div=st.div;
 try{const R=window.R10CHART;const H=R&&R.HM;
  if(st.s===3&&st.a==='price'&&st.div==='prod'){const it=g('pItem')();if(it){const u=g('pchg')(it,st.cmp);o.item=it.n;o.itemCode=it.c;o.cu=u.cu;o.unit=it.u||'';o.account='원재료 단가';o.where=it.n;}}
  else if(st.a==='vd'&&st.s>=2){const {a,v}=g('vdData')();o.account=`${a.name}(${a.code})`;o.code=a.code;o.vendor=v.name;o.where=`${a.name} · ${v.name}`;let m=v.m;
    const live=H&&H.sel&&H.id===[st.div,st.a,st.va,st.vv,st.pm,H.kind].join('|')&&!!document.getElementById('r10HmMap');const row=live?H.rows.find(r=>r.key===H.sel):null;
    if(row){m=row.m;o.cu=row.cu==null?null:row.cu;o.unit=row.unit||'';o.item=row.name;o.itemCode=row.key;o.where=`${a.name} · ${v.name} · ${row.name}`;}
    const x=g('cmpM')(m);o.ratio=x.rc;}
  else if(st.s>=2&&st.a&&st.a!=='price'&&st.a!=='vd'){const i=g('cur')();if(i){o.account=i.title+(i.code&&/^[0-9]{4}$/.test(i.code)?`(${i.code})`:'');o.code=/^[0-9]{4}$/.test(i.code||'')?i.code:'';o.where=i.title;
    let m=i.m;const live=st.s===3&&H&&H.sel&&H.id===[st.div,st.a,st.va,st.vv,st.pm,H.kind].join('|')&&!!document.getElementById('r10HmMap');const row=live?H.rows.find(r=>r.key===H.sel):null;
    if(row){m=row.m;o.cu=row.cu==null?null:row.cu;o.unit=row.unit||'';if(H.kind==='vend'){o.vendor=row.name;}else{o.item=row.name;o.itemCode=row.key;if(row.vns&&row.vns.length===1)o.vendor=row.vns[0];}o.where=`${i.title} · ${row.name}`;}
    else if(st.v&&st.s===3){o.vendor='';}
    if(m){const x=g('cmpM')(m);o.ratio=x.rc;}}}
 }catch(e){}
 return o;}

// ---------- 화면 ----------
function priceMethod(m){return m==='단가절감'||m==='업체변경';}
function build(){const root=$('planSide');if(!root||root.dataset.built)return;root.dataset.built='1';
 root.innerHTML=`<div class="ps-h"><div class="ps-t">절감계획</div><div class="ps-s">어느 화면에서나 적어요. 저장 전 내용은 화면을 옮겨도 남아요.</div></div>
 <div class="ps-body">
 <div class="ps-ctx" id="psCtx" aria-live="polite"></div>
 <div class="ps-g" role="radiogroup" aria-label="절감 방법"><div class="ps-l">절감 방법을 먼저 골라요</div><div class="ps-m">${METHODS.map(m=>`<label class="ps-r"><input type="radio" name="psMethod" value="${m}"><span>${m}</span></label>`).join('')}</div></div>
 <div class="ps-g" id="psVals"></div>
 <div class="ps-g"><label class="ps-l" for="psPlan">절감계획 <span class="ps-o">자유롭게 적어요</span></label><textarea id="psPlan" rows="5" maxlength="800" placeholder="어떻게 줄일지 편하게 적어 주세요"></textarea></div>
 <div class="ps-g"><label class="ps-l" for="psReason">사유 <span class="ps-req">필수</span></label><textarea id="psReason" rows="3" maxlength="1500" placeholder="왜 이 계획을 세웠는지 자유롭게 적어 주세요"></textarea><div class="ps-e" id="psReasonErr" role="alert"></div></div>

 <button type="button" class="ps-b" id="psSave">저장</button><div class="ps-msg" id="psMsg" role="status" aria-live="polite"></div></div>`;
 root.addEventListener('input',e=>{const t=e.target;
  if(t.id==='psPlan')D.plan=t.value;else if(t.id==='psReason'){D.reason=t.value;$('psReasonErr').textContent='';}else if(t.id==='psTgt')D.target=t.value;
  else if(t.name==='psMethod'){D.method=t.value;D.target='';vals();}
  save();});
 $('psSave').onclick=submit;
 sync();}
function sync(){const r=$('planSide');if(!r)return;
 r.querySelectorAll('input[name=psMethod]').forEach(x=>{x.checked=x.value===D.method;});
 [['psPlan',D.plan],['psReason',D.reason]].forEach(([id,v])=>{const e=$(id);if(e&&e.value!==v)e.value=v;});
 vals();}
// 방법별 칸: 단가절감·업체변경 = 현재 단가(자동) + 목표 단가, 사용량 절감 = 현재 매출 대비 비율(자동) + 목표 비율
function vals(){const box=$('psVals');if(!box)return;const c=ctx();const m=D.method;
 const cxt=$('psCtx');if(cxt)cxt.textContent=c.where?`지금 보는 곳 · ${c.where}`:'지금 보는 곳 · 계정이나 칸을 고르면 여기에 나와요';
 if(priceMethod(m)){const cur=c.cu!=null?`${fmt(c.cu)}원${c.unit?' / '+c.unit:''}`:'';const had=box.dataset.k==='price';
  if(!had){box.dataset.k='price';box.innerHTML=`<div class="ps-l">현재 단가 <span class="ps-o">자동</span></div><div class="ps-v" id="psCur"></div><label class="ps-l" for="psTgt">목표 단가(원)</label><input id="psTgt" type="text" inputmode="decimal" autocomplete="off" placeholder="예) 1200"><div class="ps-e" id="psTgtErr" role="alert"></div>`;}
  $('psCur').textContent=cur||'품목 칸이나 단가 상세를 열면 현재 단가가 자동으로 들어가요';$('psCur').dataset.v=c.cu==null?'':String(c.cu);
  const t=$('psTgt');if(t&&t.value!==D.target)t.value=D.target;}
 else if(m==='사용량 절감'){const cur=c.ratio!=null?`${c.ratio.toFixed(2)}%`:'';const had=box.dataset.k==='ratio';
  if(!had){box.dataset.k='ratio';box.innerHTML=`<div class="ps-l">현재 매출 대비 비율 <span class="ps-o">자동</span></div><div class="ps-v" id="psCur"></div><label class="ps-l" for="psTgt">목표 비율(%)</label><input id="psTgt" type="text" inputmode="decimal" autocomplete="off" placeholder="예) 3.5"><div class="ps-e" id="psTgtErr" role="alert"></div>`;}
  $('psCur').textContent=cur||'계정을 고르면 현재 매출 대비 비율이 자동으로 들어가요';$('psCur').dataset.v=c.ratio==null?'':String(c.ratio);
  const t=$('psTgt');if(t&&t.value!==D.target)t.value=D.target;}
 else{box.dataset.k=m?'etc':'';box.innerHTML=m?'<div class="ps-note">기타는 아래 절감계획 칸에 자유롭게 적어요.</div>':'<div class="ps-note">방법을 고르면 현재값과 목표값 칸이 나와요.</div>';}
 }
function parseNum(s){s=String(s==null?'':s).replace(/[\s,%원]/g,'');if(!s)return {v:null};return /^[0-9]+(\.[0-9]+)?$/.test(s)?{v:Number(s)}:{err:'숫자로 적어 주세요(예 1200).'};}
function say(t,kind){const m=$('psMsg');if(!m)return;m.className='ps-msg'+(kind?' '+kind:'');m.textContent=t;}

// ---------- 저장 ----------
function payload(c){const st=g('st');const div=DIVID[st.div]||'PROD';const m=D.method;const tgt=parseNum(D.target);
 const memo=[D.plan.trim(),m==='단가절감'||m==='업체변경'?(tgt.v!=null?`목표 단가 ${fmt(tgt.v)}원`:'')+($('psCur')&&$('psCur').dataset.v?` (현재 단가 ${fmt(Number($('psCur').dataset.v))}원)`:''):m==='사용량 절감'?(tgt.v!=null?`목표 매출 대비 비율 ${tgt.v}%`:'')+($('psCur')&&$('psCur').dataset.v?` (현재 ${Number($('psCur').dataset.v).toFixed(2)}%)`:''):''].filter(Boolean).join('\n').slice(0,1000);
 const plan={account:c.account||'전체',vendor:c.vendor||'전체',method:m,due:DUE,basis:D.reason.trim(),target:'',target_amount_krw:null,state:'계획',turns:[]};
 if(memo)plan.memo=memo;if(m==='사용량 절감'&&tgt.v!=null&&tgt.v<=100)plan.target_ratio=tgt.v;
 if(tgt.v!=null&&(priceMethod(m)||m==='사용량 절감'))plan.target_note=priceMethod(m)?`목표 단가 ${fmt(tgt.v)}원${c.unit?'/'+c.unit:''}`:`목표 비율 ${tgt.v}%`;
 if(c.itemCode&&div==='PROD'&&c.item)plan.item_code=c.itemCode;
 return {plan,division:div,account_code:c.code||null,page:'절감계획 사이드바',manual:true};}
async function submit(){if(busy)return;const c=ctx();say('');$('psReasonErr').textContent='';const te=$('psTgtErr');if(te)te.textContent='';
 if(!D.method){say('절감 방법을 먼저 골라 주세요.','err');return;}
 if(!D.reason.trim()){$('psReasonErr').textContent='사유를 적어 주세요. 사유 없이는 저장할 수 없어요.';$('psReason').focus();say('사유를 적어 주세요.','err');return;}
 const tg=parseNum(D.target);if(tg.err){if(te)te.textContent=tg.err;say(tg.err,'err');return;}
 if(D.method==='사용량 절감'&&tg.v!=null&&tg.v>100){if(te)te.textContent='목표 비율은 0~100 사이로 적어 주세요.';say('목표 비율은 0~100 사이로 적어 주세요.','err');return;}
 busy=true;$('psSave').disabled=true;say('시트 상태를 확인하는 중이에요');
 try{vals();const p=payload(c);
  say('저장하는 중이에요');
  const o=await V5.api('/api/plans','POST',p);if(o&&o.plans)V5.ST.plans=o.plans;
  const back=await V5.api('/api/plans');const hit=(back.plans||[]).some(x=>String(x.id)===String(o.id));
  if(!hit)throw Object.assign(new Error('readback'),{kind:'readback'});
  D=Object.assign({},D0);save();sync();say('저장했어요. 시트에서 다시 읽어 확인했어요.','ok');window.COST1112_SAVE_STATE='saved';window.COST1112_SAVED_ID=o.id;
 }catch(e){const x=e&&e.kind==='readback'?{h:'저장은 했지만 다시 읽어서 확인하지 못했어요. 절감계획 탭에서 확인해 주세요.'}:V5.errInfo(e,'저장하지 못했어요',V5.planErrO?V5.planErrO(e):undefined);say(x.h+' 입력한 내용은 남아 있어요.','err');}
 finally{busy=false;const b=$('psSave');if(b)b.disabled=false;}}

function init(){build();const M=document.getElementById('main');if(!M)return;let q=false;
 const later=()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;try{vals();}catch(e){}});};
 new MutationObserver(later).observe(M,{childList:true,subtree:true});window.addEventListener('hashchange',later);}
window.COST1112_SIDE={ctx,key:KEY,get draft(){return Object.assign({},D);}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
