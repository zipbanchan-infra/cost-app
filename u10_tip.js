// r6nd U10 (R6ND-26): 툴팁(title)으로만 보이던 숫자를 키보드 초점에서도 보이게.
//  키보드로 초점이 간 요소(:focus-visible)에 title 이 있으면 그 아래에 DESIGN 4 '툴팁' 모양(#u10tip, u10.css)으로 같은 글을 보여 줘요.
//  마우스는 지금처럼 브라우저 기본 title. 툴팁은 읽기 프로그램에서 숨김(title 이 이미 설명으로 읽혀요), 누르기·초점을 가로채지 않아요.
//  초점이 안 가던 숫자 칩(2단계 정보 칩 .mchip)·히트맵 '분류별' 줄(div.tm-row)에는 tabindex=0 을 붙여 Tab 으로 갈 수 있게 해요.
(function(){
const tip=document.createElement('div');tip.id='u10tip';tip.setAttribute('aria-hidden','true');document.body.appendChild(tip);
let cur=null;
function hide(){tip.classList.remove('show');cur=null;}
function place(e){const r=e.getBoundingClientRect(),W=innerWidth,H=innerHeight;tip.style.left='0px';tip.style.top='0px';
 const w=tip.offsetWidth,h=tip.offsetHeight;let x=Math.min(Math.max(8,r.left),W-w-8),y=r.bottom+8;if(y+h>H-8)y=Math.max(8,r.top-h-8);
 tip.style.left=Math.round(x)+'px';tip.style.top=Math.round(y)+'px';}
function show(e){const t=(e.getAttribute('title')||'').trim();if(!t){hide();return;}cur=e;tip.textContent=t;tip.classList.add('show');place(e);}
document.addEventListener('focusin',e=>{const t=e.target;if(t&&t.nodeType===1&&t.matches(':focus-visible')&&t.hasAttribute('title'))show(t);else hide();},true);
document.addEventListener('focusout',()=>hide(),true);
document.addEventListener('mousedown',hide,true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();},true);
addEventListener('scroll',()=>{if(cur&&cur.isConnected)place(cur);else hide();},true);
addEventListener('resize',()=>{if(cur&&cur.isConnected)place(cur);else hide();});
function mark(){document.querySelectorAll('#main .mchip[title]:not([tabindex]),#main div.tm-row[title]:not([tabindex])').forEach(x=>x.setAttribute('tabindex','0'));
 if(cur&&!cur.isConnected)hide();}
new MutationObserver(mark).observe(document.getElementById('main'),{childList:true,subtree:true});mark();
})();
