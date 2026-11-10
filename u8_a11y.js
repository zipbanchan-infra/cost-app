// r6nd U8 접근성: 모달 초점(들어가기·가두기·ESC·돌려주기), 클릭 전용 요소 키보드 동작(Enter·Space), 다시 그린 뒤 초점 이어 가기, 상태 속성(aria-pressed·aria-disabled).
//  화면 코드(app.js·common.js·plan_edit.js)는 #main·#aiSide·#modal 을 innerHTML 로 통째로 다시 그려서 누른 버튼이 사라지면 초점이 문서 처음(body)으로 가요.
//  → 초점이 사라졌을 때만 같은 요소(id 또는 data-* 이 같은 것)에 다시 초점, 없으면 그 영역 제목(본문 = .pg-h, AI = 입력칸). 스크롤은 움직이지 않아요(preventScroll).
(function(){
const PS={preventScroll:true};
const $=id=>document.getElementById(id);
const TABBABLE='button,a[href],input,textarea,select,[tabindex]';
const vis=e=>!!(e&&e.isConnected&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
const canFocus=e=>vis(e)&&!e.disabled&&e.tabIndex>=-1&&(e.tabIndex>=0||e.hasAttribute('tabindex'));
const tryFocus=e=>{if(!canFocus(e))return false;e.focus(PS);return document.activeElement===e;};
const cssq=v=>'"'+String(v).replace(/["\\]/g,'\\$&')+'"';
// 다시 그린 뒤 같은 요소를 찾는 열쇠: id → 태그 + data-* 전부 → 입력칸 name·value
function keyOf(e){if(!e||e===document.body)return null;if(e.id)return '#'+CSS.escape(e.id);
 const d=[...e.attributes].filter(a=>a.name.startsWith('data-')&&a.name!=='data-dec').map(a=>`[${a.name}=${cssq(a.value)}]`).join('');
 if(d)return e.tagName.toLowerCase()+d;
 if(e.name)return e.tagName.toLowerCase()+`[name=${cssq(e.name)}]`+(e.type==='radio'?`[value=${cssq(e.value)}]`:'');
 return null;}
const byKey=k=>{try{return k?document.querySelector(k):null}catch(x){return null}};
const region=e=>{for(let x=e;x;x=x.parentElement){if(x.id==='modal')return 'modal';if(x.id==='aiSide')return 'ai';if(x.id==='side')return 'side';if(x.id==='main')return 'main';if(x.id==='toast')return 'toast';}return '';};
function heading(){const h=document.querySelector('#page .pg-h')||document.querySelector('#main .pg-h');if(h&&!h.hasAttribute('tabindex'))h.setAttribute('tabindex','-1');return h;}
function fallback(rg){if(rg==='ai')return tryFocus($('aiText'))||tryFocus($('aiOpen'));if(rg==='side')return tryFocus(document.querySelector('#side .nav.on'))||tryFocus(heading());return tryFocus(heading());}
// 사라진 버튼 → 대신 갈 곳(AI 창 닫기 → 'AI 열기', 'AI 열기' → 입력칸)
const NEXT={'#aiClose':'#aiOpen','#aiOpen':'#aiText'};
let last=null,lastKey=null,lastRg='';
document.addEventListener('focusin',e=>{const t=e.target;if(t===document.body)return;last=t;lastKey=keyOf(t);lastRg=region(t);},true);
// ---------- 모달 ----------
const M=()=>$('modal'),BG=()=>$('mbg');const isOpen=()=>{const b=BG();return !!b&&b.classList.contains('show');};
let wasOpen=false,opener=null,openerKey=null,openerRg='';
function tabbables(root){const L=[...root.querySelectorAll(TABBABLE)].filter(e=>canFocus(e)&&e.tabIndex>=0);
 // 라디오 묶음은 Tab 한 번 = 한 묶음(고른 것, 없으면 첫 개)
 const seen=new Set();return L.filter(e=>{if(e.type!=='radio'||!e.name)return true;if(seen.has(e.name))return false;const g=L.filter(x=>x.type==='radio'&&x.name===e.name);const pick=g.find(x=>x.checked)||g[0];if(pick!==e)return false;seen.add(e.name);return true;});}
const same=(a,b)=>a===b||(a&&b&&a.type==='radio'&&b.type==='radio'&&a.name&&a.name===b.name);
function onOpen(){const m=M();opener=last&&region(last)!=='modal'?last:(document.activeElement!==document.body?document.activeElement:null);openerKey=keyOf(opener);openerRg=region(opener);
 const t=m.querySelector('.mt');if(t&&!t.id)t.id='mTitle';m.setAttribute('aria-labelledby',t?t.id:'mTitle');
 // 첫 입력칸(없으면 첫 버튼)에 초점
 const L=tabbables(m);const first=L.find(e=>/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName))||L.find(e=>e.tagName==='BUTTON')||L[0];if(first)first.focus(PS);}
function onClose(){const o=opener,ok=openerKey,rg=openerRg;opener=null;
 setTimeout(()=>{if(isOpen())return;const a=document.activeElement;if(a&&a!==document.body&&region(a)!=='modal')return;
  if(tryFocus(o))return;if(tryFocus(byKey(ok)))return;fallback(rg||'main');},0);}// 저장 뒤 다시 그린 화면에서도 같은 버튼(data-pedit 등)을 찾아요
function cancelBtn(){const m=M();return m.querySelector('#mCancel,#pmCancel,[data-close]');}
// ---------- 다시 그린 뒤 초점 이어 가기 ----------
let pend=false;
function settle(){pend=false;const a=document.activeElement;if(a&&a!==document.body&&a!==document.documentElement)return;
 if(!last)return;
 if(isOpen()){if(region(last)==='modal'&&tryFocus(last))return;return;}// 모달 안에서 잠금이 풀린 버튼 등으로 · 아니면 Tab 이 모달 처음으로
 if(region(last)==='modal')return;// 모달 닫힘은 onClose 가 맡아요
 if(canFocus(last))return;// 빈 곳을 눌러 초점이 빠진 경우는 그대로
 const t=byKey(lastKey);if(tryFocus(t))return;
 if(NEXT[lastKey]&&tryFocus(byKey(NEXT[lastKey])))return;
 if(lastRg)fallback(lastRg);}
const later=()=>{if(!pend){pend=true;setTimeout(settle,0);}};
// ---------- 상태 속성 ----------
function enhance(){
 // 고르기 버튼(세그먼트·칩·단가 타일·본부 탭): 눌린 상태 = .on
 document.querySelectorAll('.seg button,.chipb,.pt3[data-cmp],button.tab[data-div]').forEach(b=>{const v=String(b.classList.contains('on'));if(b.getAttribute('aria-pressed')!==v)b.setAttribute('aria-pressed',v);});
 document.querySelectorAll('.mi[role="button"]').forEach(b=>{const v=String(b.classList.contains('on'));if(b.getAttribute('aria-pressed')!==v)b.setAttribute('aria-pressed',v);});
 document.querySelectorAll('tr.click[tabindex]').forEach(r=>{if(r.classList.contains('selrow'))r.setAttribute('aria-current','true');else r.removeAttribute('aria-current');});
 // 글자 없는 버튼은 툴팁 문구를 이름으로
 document.querySelectorAll('button:not([aria-label])').forEach(b=>{if(!b.textContent.trim()&&b.title)b.setAttribute('aria-label',b.title);});
 const h=heading();if(h&&!h.hasAttribute('tabindex'))h.setAttribute('tabindex','-1');
 const o=isOpen();if(o&&!wasOpen){wasOpen=true;onOpen();}else if(!o&&wasOpen){wasOpen=false;onClose();}}
new MutationObserver(()=>{enhance();later();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
// ---------- 키보드 ----------
document.addEventListener('keydown',e=>{
 if(isOpen()){const m=M();
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();const c=cancelBtn();if(c&&!c.disabled)c.click();return;}// 저장·삭제·이동 중(취소 잠김)에는 닫지 않아요(U5)
  if(e.key==='Tab'){const L=tabbables(m);if(!L.length){e.preventDefault();return;}const a=document.activeElement,f=L[0],l=L[L.length-1];
   if(!m.contains(a)){e.preventDefault();(e.shiftKey?l:f).focus(PS);return;}
   if(e.shiftKey&&same(a,f)){e.preventDefault();l.focus(PS);}else if(!e.shiftKey&&same(a,l)){e.preventDefault();f.focus(PS);}}
  return;}
 const t=e.target;
 if(e.key==='Escape'&&!e.isComposing&&region(t)==='ai'){const c=$('aiClose');if(c&&vis(c)){e.preventDefault();c.click();}return;}// AI 창: Esc 로 접기(DESIGN: 다시 누르거나 Esc·닫기)
 // 버튼이 아닌 클릭 요소(표 줄·자재 목록 등 role=button/tabindex=0): Enter·Space = 누르기
 if((e.key==='Enter'||e.key===' ')&&t&&t.nodeType===1&&!/^(BUTTON|A|INPUT|TEXTAREA|SELECT|LABEL)$/.test(t.tagName)&&(t.getAttribute('role')==='button'||t.matches('tr.click[tabindex]'))&&!e.isComposing){e.preventDefault();t.click();}
},true);
enhance();
})();
