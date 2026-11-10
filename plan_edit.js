// 13:53 결정3: 같은 본부 사용자 누구나 절감 계획 수정·삭제(삭제 = 소프트 삭제, 서버에 이력). 4단계 계획 카드에 버튼을 붙인다.
(function(){
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function refresh(plans){V5.ST.plans=plans;if(typeof render==='function')render();V5.renderAI();}
function modal(html){document.getElementById('modal').innerHTML=html;document.getElementById('mbg').classList.add('show');}
const close=()=>document.getElementById('mbg').classList.remove('show');
// U5: 저장·삭제 중에는 모달 버튼을 잠그고('저장 중이에요'·'삭제 중이에요') 끝나면 풀어요. 실패는 해요체 안내 + 코드만 작게(서버 원문 안 씀).
//   404(그새 다른 사람이 지운 계획)는 목록을 서버에서 다시 불러오고, 다시 눌러도 안 되니 저장·삭제 버튼은 잠근 채 '닫기'만 남겨요.
const ERR_O={403:'이 본부 계획은 바꿀 권한이 없어요. 필요하면 경영지원본부에 권한을 요청해 주세요.',404:'그사이 지워졌거나 없는 계획이에요. 목록을 새로 불러왔어요.',bad_status:'상태를 다시 골라 주세요.'};
// U6: 칸 검사(V5.planCheck = 서버와 같은 규칙). 칸 아래 해요체 한 줄 + 저장 요청 안 보냄. 서버가 400(칸)을 주면 그 칸에도 표시
const FLD={method:'pmMethod',due:'pmDue',target_amount_krw:'pmAmt'};// R6ND-17: 목표는 금액 칸 하나(문구는 자동)
function fieldErr(k,msg){const i=document.getElementById(FLD[k]),x=document.getElementById(FLD[k]+'Err');if(!i||!x)return;x.textContent=msg||'';if(msg)i.setAttribute('aria-invalid','true');else i.removeAttribute('aria-invalid');}
const val=id=>document.getElementById(id).value.trim();
function check(){const v={method:val('pmMethod'),due:val('pmDue')};const a=V5.amtParse(val('pmAmt'));const E=V5.planCheck(v,true);if(a.err)E.target_amount_krw=a.err;return {v,a,E};}
// 미리보기: 금액이 있으면 그 금액 문구, 비웠으면 원래 금액이 있던 계획은 '목표 금액 입력 필요', 처음부터 금액이 없던(예전) 계획은 지금 문구 그대로
let P0=null;function preview(){const a=V5.amtParse(val('pmAmt'));const x=document.getElementById('pmTgtPrev');if(!x)return;const a0=P0&&P0.target_amount_krw!=null?P0.target_amount_krw:null;
 const keep=!a.err&&a.v==null&&a0==null,t=keep?V5.planTgt(P0).t:'';x.title=keep?t:'';// r7 P1: 긴 예전 문구도 한 줄(말줄임 + title)
 x.textContent=keep?'목표 문구(지금 문구 그대로): '+t:'목표 문구(자동): '+(a.err?'금액을 숫자로 적으면 만들어져요':a.v!=null?V5.targetText(a.v):V5.targetText(null));}
function err(e,title){const m=document.getElementById('pmErr');if(m){m.className='';m.innerHTML=V5.errHtml(V5.errInfo(e,title,V5.planErrO(e,ERR_O)));}
 const fl=e.body&&e.body.field;if(e.status===400&&FLD[fl])fieldErr(fl,V5.planErrO(e)[e.code]);
 if(e.status===404){V5.api('/api/plans').then(r=>{if(r&&r.plans)refresh(r.plans)}).catch(()=>{});}}
async function run(btnId,busyTxt,title,fn){const b=document.getElementById(btnId),c=document.getElementById('pmCancel');if(!b||b.disabled)return;const t0=b.textContent;
 b.disabled=true;b.setAttribute('aria-busy','true');b.textContent=busyTxt;if(c)c.disabled=true;
 try{const r=await fn();close();refresh(r.plans||V5.ST.plans);}
 catch(e){err(e,title);b.removeAttribute('aria-busy');b.textContent=t0;if(c){c.disabled=false;if(e.status===404)c.textContent='닫기';}b.disabled=e.status===404;}}
const fld=(id,label,value,extra,help)=>`<div class="fld"><label class="an" for="${id}">${label}</label><input class="search" id="${id}" value="${esc(value)}" aria-describedby="${id}Err"${extra||''}>${help?`<div class="fhelp">${help}</div>`:''}<div class="ferr" id="${id}Err" role="alert"></div></div>`;
function edit(p){const a0=p.target_amount_krw==null?null:p.target_amount_krw;P0=p;
 modal(`<div class="mt">절감 계획 수정</div><div class="sub">${esc(p.account)} · ${esc(p.vendor)} · 같은 본부 누구나 고칠 수 있어요. 바꾼 내용은 이력에 남아요.</div>
 ${fld('pmMethod','방법',p.method,'','최대 '+V5.PLAN_MAX.method+'자까지 적을 수 있어요.')}
 ${fld('pmAmt','목표 금액(원 · 분기)',a0==null?'':V5.f(a0),' inputmode="numeric"','숫자만 적어요. 쉼표는 써도 돼요. 목표 문구는 이 금액으로 자동으로 만들어요.')}<div class="fhelp" id="pmTgtPrev" aria-live="polite"></div>
 ${fld('pmDue','기한',p.due,' inputmode="numeric" placeholder="2026-12-31"','연-월-일로 적어요(예 2026-12-31).')}
 <div class="an">상태</div><span class="seg" id="pmStatus">${['초안','진행','완료','보류'].map(s=>`<button data-st="${s}" class="${(p.status||'초안')===s?'on':''}">${s}</button>`).join('')}</span>
 <div class="sub" id="pmErr"></div><div class="mbtns"><button class="btn sec sm" id="pmCancel">취소</button><button class="btn pri sm" id="pmSave">저장</button></div>`);
 let st=p.status||'초안';document.querySelectorAll('#pmStatus [data-st]').forEach(b=>b.onclick=()=>{st=b.dataset.st;document.querySelectorAll('#pmStatus [data-st]').forEach(x=>x.classList.toggle('on',x===b))});
 // 칸을 떠날 때 · 이미 안내가 있는 칸을 고칠 때 다시 검사
 Object.entries(FLD).forEach(([k,id])=>{const i=document.getElementById(id);const re=()=>fieldErr(k,check().E[k]);i.onblur=re;i.oninput=()=>{if(k==='target_amount_krw')preview();if(i.getAttribute('aria-invalid'))re();};});preview();
 document.getElementById('pmCancel').onclick=close;
 document.getElementById('pmSave').onclick=()=>{const b=document.getElementById('pmSave');if(!b||b.disabled)return;const {v,a,E}=check();Object.keys(FLD).forEach(k=>fieldErr(k,E[k]));
  const bad=Object.keys(FLD).filter(k=>E[k]);if(bad.length){document.getElementById(FLD[bad[0]]).focus();return;}// 저장 요청을 보내지 않아요
  const plan=Object.assign({},v);if(a.v!==a0)plan.target_amount_krw=a.v;// R6ND-17: 금액을 바꾸면 보내고, 목표 문구는 서버가 금액으로 다시 만들어요
  run('pmSave','저장 중이에요','계획을 저장하지 못했어요',()=>V5.api('/api/plans/'+p.id,'PUT',{plan,status:st}));};}
function del(p){modal(`<div class="mt">절감 계획 삭제</div><div class="sub">${esc(p.vendor)} · ${esc(p.method)}</div><div class="an" id="pmDelNote">${V5.ST.trash?`목록에서 빼요. 삭제해도 ${V5.ST.trash.days}일 동안 최근 삭제에서 되돌릴 수 있어요.`:'목록에서 빼요. 기록은 남아서 되돌릴 수 있어요.'}</div>
 <div class="sub" id="pmErr"></div><div class="mbtns"><button class="btn sec sm" id="pmCancel">취소</button><button class="btn pri sm" id="pmDel">삭제</button></div>`);
 document.getElementById('pmCancel').onclick=close;
 document.getElementById('pmDel').onclick=()=>run('pmDel','삭제 중이에요','계획을 삭제하지 못했어요',()=>V5.api('/api/plans/'+p.id,'DELETE',{}));}
// U6: 카드 순서와 V5.ST.plans 순서를 맞추지 않고(예전: 인덱스 + reverse) 카드의 data-pid 로 계획을 찾아 버튼을 붙여요. 정렬이 바뀌어도 다른 카드가 열리지 않아요
const byId=id=>V5.ST.plans.find(x=>String(x.id)===String(id));
function decorate(){const L=document.getElementById('planList');if(!L||L.dataset.dec==='1')return;
 L.querySelectorAll('.pcard[data-pid]').forEach(c=>{const p=byId(c.dataset.pid);if(!p)return;const b=document.createElement('div');b.className='ai-row pact';b.style.marginTop='8px';
  b.innerHTML=`<span style="margin-left:auto;display:flex;gap:8px"><button class="btn sec sm" data-pedit="${esc(p.id)}">수정</button><button class="btn sec sm" data-pdel="${esc(p.id)}">삭제</button></span>`;c.appendChild(b);});
 L.querySelectorAll('[data-pedit]').forEach(b=>b.onclick=()=>{const p=byId(b.dataset.pedit);if(p)edit(p);});
 L.querySelectorAll('[data-pdel]').forEach(b=>b.onclick=()=>{const p=byId(b.dataset.pdel);if(p)del(p);});L.dataset.dec='1';}
new MutationObserver(decorate).observe(document.getElementById('main'),{childList:true,subtree:true});
})();
