// r8 P3 (E8 (1)+(2), 본부장님 승인 2026-10-19): 4단계 절감 계획 카드의 상태 배지 신호등 색 + 상태별 거르기 + '최근 삭제 n건 · 되돌리기'.
//  상태값 4개(초안·진행·완료·보류)는 이름·개수 그대로. 배지 색은 data-st 로 r8_p3.css 가 칠해요(DESIGN 신호등 배지 톤).
//  최근 삭제·되돌리기는 서버가 /api/state 에 trash(일수·건수)를 줄 때만(V5.ST.trash). 옛 서버(값 없음)면 거르기·배지 색만 보이고 최근 삭제는 숨김.
//  plan_edit.js 처럼 #main 을 지켜보다가 #planList 가 새로 그려지면 붙여요(app.js 는 그대로).
(function(){
const esc=V5.esc,STS=['초안','진행','완료','보류'];
const stOf=p=>STS.includes(p&&p.status)?p.status:'초안';
let F='all',open=false,busy='',msg='',keep=0,err=null,trash=null,seq=0;
const byId=id=>V5.ST.plans.find(x=>String(x.id)===String(id));
// ---------- 상태별 거르기(전체/초안/진행/완료/보류 + 개수) ----------
function filterHtml(){const n={all:V5.ST.plans.length};STS.forEach(s=>n[s]=V5.ST.plans.filter(p=>stOf(p)===s).length);
 return `<div class="pfilter" id="planFilter" role="group" aria-label="상태로 거르기"><span class="seg">${[['all','전체']].concat(STS.map(s=>[s,s])).map(([k,t])=>`<button data-pf="${k}" class="${F===k?'on':''}" aria-pressed="${F===k}">${t} <span class="pfc num">${n[k]}</span></button>`).join('')}</span></div>`;}
function apply(L){let shown=0;L.querySelectorAll('.pcard[data-pid]').forEach(c=>{const s=stOf(byId(c.dataset.pid));const b=c.querySelector('.pt .b');if(b)b.dataset.st=s;
  const hide=F!=='all'&&s!==F;c.hidden=hide;if(!hide)shown++;});
 let e=document.getElementById('planFilterEmpty');
 if(F!=='all'&&!shown&&V5.ST.plans.length){if(!e){e=document.createElement('div');e.id='planFilterEmpty';e.className='empty';e.setAttribute('role','status');L.after(e);}e.textContent=`‘${F}’ 상태인 계획이 없어요. ‘전체’를 누르면 모두 보여요.`;}
 else if(e)e.remove();}
function bindFilter(L){document.querySelectorAll('#planFilter [data-pf]').forEach(b=>b.onclick=()=>{F=b.dataset.pf;
  document.querySelectorAll('#planFilter [data-pf]').forEach(x=>{const on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-pressed',String(on));});apply(L);drawTrash();});}
// ---------- 최근 삭제 n건 · 되돌리기 ----------
function trashHtml(){const t=trash,T=V5.ST.trash;const m=`<div class="sub ptr-m" id="trashMsg" role="status">${esc(msg)}</div>`;
 if(!t||!t.total)return msg?`<section class="ptrash" id="planTrash">${m}</section>`:'';
 const rows=t.deleted.map(d=>`<div class="ptr-r" data-tid="${esc(d.id)}"><div class="ptr-i"><b>${esc(d.vendor||'-')}</b> · ${esc(d.method||'-')}<div class="sub">${esc(d.account||'-')} · ${esc(STS.includes(d.status)?d.status:'초안')} · 삭제 ${esc(d.deletedBy||'-')} · ${esc(V5.dt(d.deletedAt))}</div></div>`
  +`<button class="btn sec sm" data-restore="${esc(d.id)}"${busy?' disabled':''}${busy===String(d.id)?' aria-busy="true"':''}>${busy===String(d.id)?'되돌리는 중이에요':'되돌리기'}</button></div>`).join('');
 return `<section class="card ptrash" id="planTrash"><button class="ptr-h" id="trashToggle" aria-expanded="${open}" aria-controls="trashList"><span class="ptr-t">최근 삭제 ${t.total}건 · 되돌리기</span><span class="ptr-c">${open?'접기':'펼치기'}</span></button>`
  +`<div id="trashList"${open?'':' hidden'}><div class="sub ptr-s">최근 ${T.days}일 안에 지운 계획이에요${t.total>t.deleted.length?`(최근 ${t.deleted.length}건만 보여요)`:''}. 되돌리면 목록에 다시 보여요.</div>${err?V5.errHtml(err,'trashErr'):''}${rows}</div>${m}</section>`;}
function drawTrash(){const L=document.getElementById('planList');if(!L||!V5.ST.trash)return;let box=document.getElementById('planTrash');const h=trashHtml();
 if(!h){if(box)box.remove();return;}
 if(box)box.outerHTML=h;else (document.getElementById('planFilterEmpty')||L).insertAdjacentHTML('afterend',h);
 const tg=document.getElementById('trashToggle');if(tg)tg.onclick=()=>{open=!open;drawTrash();const t=document.getElementById('trashToggle');if(t)t.focus();};
 document.querySelectorAll('#planTrash [data-restore]').forEach(b=>b.onclick=()=>restore(b.dataset.restore));}
async function loadTrash(){if(!V5.ST.trash)return;const my=++seq;try{const r=await V5.api('/api/plans/deleted');if(my===seq)trash=r;}catch(e){/* 못 받으면 지난 목록 그대로 */}if(my===seq)drawTrash();}
const reload=r=>{if(r&&r.plans){V5.ST.plans=r.plans;if(typeof render==='function')render();V5.renderAI();}};
async function restore(id){if(busy)return;const d=(trash&&trash.deleted||[]).find(x=>String(x.id)===String(id));busy=String(id);err=null;msg='';drawTrash();
 try{const r=await V5.api('/api/plans/restore','POST',{id:Number(id)});busy='';seq++;trash=r;if(!r.total)open=false;
   msg=`‘${d&&d.vendor||'계획'}’ 계획을 되돌렸어요. 목록에 다시 보여요.`;keep=1;V5.live(msg);
   const p=(r.plans||[]).find(x=>String(x.id)===String(id));if(F!=='all'&&p&&stOf(p)!==F)F='all';// 되돌린 계획이 거르기에 가려지지 않게
   reload(r);const t=document.getElementById('trashToggle');if(t)t.focus();}
 catch(e){busy='';err=V5.errInfo(e,'계획을 되돌리지 못했어요',{403:'이 본부 계획은 되돌릴 권한이 없어요. 필요하면 경영지원본부에 권한을 요청해 주세요.',404:'없는 계획이에요. 최근 삭제 목록을 새로 불러왔어요.'});
   if(e.status===409){err.h='이미 되돌린 계획이에요. 목록을 새로 불러왔어요.';keep=1;V5.api('/api/plans').then(reload).catch(()=>{});}
   drawTrash();if(e.status===404||e.status===409)loadTrash();}}
// ---------- #planList 가 새로 그려질 때 ----------
function decorate(){const L=document.getElementById('planList');if(!L||L.dataset.r8==='1')return;L.dataset.r8='1';
 if(keep>0)keep--;else{msg='';err=null;}// 안내는 바로 다음 다시 그리기까지만
 if(V5.ST.plans.length&&!document.getElementById('planFilter')){L.insertAdjacentHTML('beforebegin',filterHtml());bindFilter(L);}
 apply(L);if(V5.ST.trash){drawTrash();loadTrash();}}
new MutationObserver(decorate).observe(document.getElementById('main'),{childList:true,subtree:true});
})();
