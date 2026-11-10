// r13 c6 (본부장님 보완 1): 다시 들어와도 하던 곳으로 - (1) 마지막으로 본 화면(주소 #…)을 이 브라우저에 기억해 로그인 뒤 같은 화면으로 돌아가고,
//  (2) 첫 화면 맨 위에 '이어서 할 절감 계획' 카드(진행 중 계획 + 쓰다 만 글)를 보여 줘요. 서버·DB 는 안 바뀌어요(계획은 /api/plans 에서).
(function(){
const KEY=u=>'r13_last_'+String(u||'');
const who=me=>String((me&&(me.user&&me.user.email||me.user))||'');
const WEEK=7*864e5;
window.R13_resumeHash=function(me){   // 주소에 화면 위치가 없을 때만(로그인을 거치면 주소 #… 가 사라져요) 마지막 위치로
 try{const v=JSON.parse(localStorage.getItem(KEY(who(me)))||'null');
  if((!location.hash||location.hash==='#')&&v&&v.h&&Date.now()-v.t<WEEK){history.replaceState(null,'','#'+v.h);window.R13_RESTORED=true;}}catch(e){}
 const save=()=>{try{const h=location.hash.slice(1);if(h)localStorage.setItem(KEY(who(me)),JSON.stringify({h,t:Date.now()}));}catch(e){}};
 window.addEventListener('hashchange',save);window.addEventListener('pagehide',save);save();};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const stateOf=p=>{const s=p.state||p.status;return ['계획','진행','완료','보류'].includes(s)?s:'계획';};
function cardHtml(){
 const open=V5.ST.plans.filter(p=>ALLOWED.has(p.division)&&['계획','진행'].includes(stateOf(p)));
 const dr=V5.ST.draft&&String(V5.ST.draft.text||'').trim();
 if(!open.length&&!dr)return '';
 const top=V5.plansSorted?V5.plansSorted().filter(p=>open.includes(p)).slice(0,3):open.slice(0,3);
 const rows=top.map(p=>`<li><b>${esc(p.vendor||'계정 전체')}</b> · ${esc(String(p.account||'').replace(/\(\d{4}\)$/,''))} · ${esc(stateOf(p))}${p.due?' · 기한 '+esc(p.due):''}</li>`).join('');
 return `<section class="r13-resume" id="r13Resume" aria-label="이어서 할 절감 계획"><div class="r13-rs-h"><b>이어서 할 절감 계획이 있어요</b><span class="r13-rs-s">${open.length?`진행 중 ${open.length}건`:''}${open.length&&dr?' · ':''}${dr?`쓰다 만 글 ${dr.length}자`:''}</span></div>
  ${rows?`<ul class="r13-rs-l">${rows}</ul>`:''}<div class="r13-rs-b">${open.length?'<button type="button" class="btn pri sm" id="r13RsGo">이어서 하기</button>':''}${dr?'<button type="button" class="btn sec sm" id="r13RsDraft">쓰다 만 글 이어 쓰기</button>':''}</div></section>`;}
function mount(){if(typeof st==='undefined'||st.s!==1||st.hm||st.cc)return;const pg=document.getElementById('page');if(!pg||document.getElementById('r13Resume'))return;
 const h=cardHtml();if(!h)return;pg.insertAdjacentHTML('afterbegin',h);
 const g=document.getElementById('r13RsGo');if(g)g.onclick=()=>go({s:4,a:null,n:null,ch:null,pm:null,va:null,vv:null,hm:null});
 const d=document.getElementById('r13RsDraft');if(d)d.onclick=()=>{const o=document.getElementById('aiOpen');if(o&&!document.getElementById('aiText'))o.click();setTimeout(()=>{const t=document.getElementById('aiText');if(t)t.focus();},50);};}
function wrap(){const r=window.render;if(typeof r!=='function'||r.r13r)return false;
 const w=function(){const out=r.apply(this,arguments);try{mount();}catch(e){console.warn('r13_resume',e);}return out;};w.r13r=true;Object.keys(r).forEach(k=>{w[k]=r[k];});window.render=w;return true;}
const base=window.R10HOOK;
window.R10HOOK=function(){wrap();return base&&base.apply(this,arguments);};
window.R13RS={cardHtml,mount};
})();
