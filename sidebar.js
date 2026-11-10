// 2026-10-18 20:08 본부장님 지시: 왼쪽 메뉴(#side)·오른쪽 AI 대화(#aiSide) 접기/펼치기. 접힌 상태는 브라우저(localStorage)에 기억해요.
//  왼쪽: 'v6_side_open'(이 파일), 오른쪽: 기존 'v6_ai_open'(common.js renderAI 가 그대로 씀). 화면 코드가 #side 를 innerHTML 로 다시 그려서 버튼은 그릴 때마다 다시 붙여요.
//  키보드: 두 버튼 모두 진짜 button(Enter·Space) + aria-expanded·aria-controls. AI 창 안 ESC = 접기(u8_a11y.js)는 그대로, 접으면 초점은 다시 여는 탭(#aiOpen).
(function(){
const KEY='v6_side_open';
const $=id=>document.getElementById(id);
const ICON={col:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3.5" width="14" height="13" rx="2"/><path d="M8 3.5v13"/><path d="M13 8l-2 2 2 2"/></svg>',
 exp:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3.5" width="14" height="13" rx="2"/><path d="M8 3.5v13"/><path d="M11 8l2 2-2 2"/></svg>',
 ai:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4.5h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-3.5 3v-3H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"/><path d="M12 7.5l-2 1.5 2 1.5"/></svg>'};
const sideOpen=()=>{try{const v=JSON.parse(localStorage.getItem(KEY));return v!==false;}catch(e){return true;}};
function applySide(){const side=$('side');if(!side)return;const open=sideOpen();document.body.classList.toggle('side-col',!open);
 let b=$('sideToggle');if(!b){b=document.createElement('button');b.id='sideToggle';b.type='button';b.className='side-tg';b.setAttribute('aria-controls','side');b.onclick=()=>{localStorage.setItem(KEY,JSON.stringify(!sideOpen()));applySide();};}
 if(b.parentNode!==side||side.firstChild!==b)side.insertBefore(b,side.firstChild);
 const lbl=open?'왼쪽 메뉴 접기':'왼쪽 메뉴 펼치기';if(b.getAttribute('aria-label')!==lbl){b.setAttribute('aria-label',lbl);b.title=lbl;b.innerHTML=open?ICON.col:ICON.exp;}
 b.setAttribute('aria-expanded',String(open));
 side.querySelectorAll('.nav').forEach(n=>{const t=n.childNodes[0]&&n.childNodes[0].nodeType===3?n.childNodes[0].nodeValue.trim():n.textContent.trim();if(open){if(n.dataset.sbTitle){n.removeAttribute('title');delete n.dataset.sbTitle;}}else if(!n.title){n.title=t;n.dataset.sbTitle='1';}});}
function applyAI(){const ai=$('aiSide');if(!ai)return;const open=!ai.classList.contains('closed');document.body.classList.toggle('ai-col',!open);
 let r=$('aiRail');if(!r){r=document.createElement('aside');r.id='aiRail';r.className='ai-rail';r.setAttribute('aria-label','AI 대화(접힘)');
  const cap=document.createElement('span');cap.className='ai-cap';cap.textContent='AI 대화';cap.setAttribute('aria-hidden','true');cap.onclick=()=>{const o=$('aiOpen');if(o)o.click();};r.appendChild(cap);ai.after(r);}
 const o=$('aiOpen');if(o){if(o.parentNode!==r)r.insertBefore(o,r.firstChild);
  if(o.dataset.sb!=='1'){o.dataset.sb='1';o.type='button';o.innerHTML=ICON.ai;o.setAttribute('aria-label','AI 대화 펼치기');o.title='AI 대화 펼치기';o.setAttribute('aria-controls','aiSide');}
  o.setAttribute('aria-expanded','false');}
 const c=$('aiClose');if(c){c.setAttribute('aria-expanded','true');c.setAttribute('aria-controls','aiSide');}}
function apply(){applySide();applyAI();}
let q=false;const later=()=>{if(q)return;q=true;Promise.resolve().then(()=>{q=false;apply();});};
const watch=()=>{const s=$('side'),a=$('aiSide');if(s)new MutationObserver(later).observe(s,{childList:true});if(a)new MutationObserver(later).observe(a,{childList:true,attributes:true,attributeFilter:['class']});
 new MutationObserver(m=>{if(m.some(x=>[...x.addedNodes].some(n=>n.id==='aiOpen')))later();}).observe(document.body,{childList:true});apply();};
window.addEventListener('storage',e=>{if(e.key===KEY)applySide();});
watch();
window.V5SIDE={apply,sideOpen,KEY};
})();
