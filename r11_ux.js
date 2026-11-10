// r11(2026-10-26 본부장님 지시): '처음 쓰는 사람' 관점 점검에서 나온 불편을 고쳐요. 단순 화면(body.r10)에서만 켜지고,
//  화면을 그린 뒤(render 뒤) 글·작은 단추만 고쳐요. 숫자·계산·저장·서버는 그대로예요.
//  되돌리기: flow.html 의 r11_ux.css · r11_ux.js 두 줄을 빼면 r10 화면 그대로(서버 다시 시작 필요 없음).
//  고친 것(점검 번호는 보고서와 같음)
//   1 이슈 오른쪽 두 숫자에 이름 붙이기(작은 숫자 = '금액 +41.7%' / 금액 보기면 '증가율')
//   2 '거래처 공란' → '거래처 미기재', '거래처 줄 없음' → '거래처별 내역 없음'
//   3 온라인 이슈 설명: 채널 숫자와 전체 숫자가 섞여 보이던 것 → '가장 많이 오른 채널: 자사몰 +0.6%p'
//   4 홈 첫 카드에 '(인건비 제외)', 히트맵 머리에 '인건비 포함' → 같은 본부 숫자가 6.4%/11.6%로 달라 보이던 것 설명
//   5 2단계: 안내 문장 쉽게, 오른쪽 위 작은 막대에 '월별 흐름' 이름, '세로축은 0부터가 아니에요' → 쉬운 말
//   6 3단계: 머리의 계정 번호(5029) 숨김, 같은 안내 두 번 나오던 줄 숨김, 긴 설명은 접기 + 한 줄 요약
//   7 3·4단계: '오른쪽 AI 창에서…'만 있던 안내 → 'AI로 절감 계획 만들기' 단추(접힌 AI 창을 열고 작성 단추로 이동)
(function(){
if(!document.body.classList.contains('r10'))return;
const AI_BTN='<button type="button" class="btn sec sm r11-ai" data-r11ai="1">AI로 절감 계획 만들기</button>';
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const leaf=e=>e&&!e.children.length;
function setTxt(e,fn){if(!leaf(e))return;const t=e.textContent,n=fn(t);if(n!=null&&n!==t)e.textContent=n;}
function eachText(root,fn){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const L=[];while(w.nextNode())L.push(w.currentNode);L.forEach(n=>{const v=fn(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;});}
const isAmt=()=>{try{return typeof amtMode==='function'&&amtMode();}catch(e){return false;}};

function openAI(){const side=document.getElementById('aiSide');const o=document.getElementById('aiOpen');
 if((!side||side.classList.contains('closed'))&&o)o.click();
 setTimeout(()=>{const b=$$('#aiSide button').find(x=>/절감 계획 작성하기/.test(x.textContent));const t=b||document.querySelector('#aiSide textarea');if(t){t.focus();t.scrollIntoView({block:'nearest'});}},150);}
document.addEventListener('click',e=>{const b=e.target.closest('[data-r11ai]');if(b){e.preventDefault();openAI();}});

function fixAll(){const M=document.getElementById('main');if(!M)return;const page=M.querySelector('#page');const s=page?page.dataset.step:'';
 // 2 쉬운 말(글자만, 단추·속성은 그대로)
 eachText(M,v=>v.replace(/거래처 공란/g,'거래처 미기재').replace(/ · 거래처 줄 없음/g,' · 거래처별 내역 없음'));
 // 1 이슈 두 숫자 이름
 $$('#issueList .r10-row').forEach(r=>{const sub=r.querySelector('.r10-sub'),big=r.querySelector('.r10-big');
  if(sub&&leaf(sub)&&sub.textContent.trim()&&!sub.dataset.r11){sub.dataset.r11='1';sub.textContent=(isAmt()?'증가율 ':'금액 ')+sub.textContent.trim();}
  if(big&&!big.title)big.title=isAmt()?'월평균 금액 변화':'매출 대비 비율 변화(%p)';});
 // 3 온라인 이슈 설명
 $$('#issueList .r10-s').forEach(e=>setTxt(e,t=>{const m=t.match(/^(.+?) 비율이 ([+\-−]?[\d.,]+%p) 올랐어요 · .+ 기준$/);return m?`가장 많이 오른 채널: ${m[1]} ${m[2]}`:null;}));
 // 홈 부제
 setTxt(M.querySelector('#r10Issues #divSum'),t=>{const m=t.match(/^(.+) vs (.+) 월평균 · 인건비 묶음 제외$/);return m?`${m[1]} 월평균 · ${m[2]} 대비 · 인건비 제외`:null;});
 // 4 인건비 포함/제외 표시
 const k1=M.querySelector('#r10Kpis .r10-kpi .r10-kl');setTxt(k1,t=>/인건비/.test(t)?null:t.replace(/^\S+본부 비용( · |$)/,'비용(인건비 제외)$1'));   // 본부 이름은 위 탭에 있어 빼고, 줄이 늘지 않게
 const hs=M.querySelector('#heatSum');if(hs){const eb=hs.closest('.vhead')&&hs.closest('.vhead').querySelector('.pg-eyebrow');
  if(eb&&/인건비/.test(M.textContent.replace(eb.textContent,''))&&leaf(eb)&&!/인건비/.test(eb.textContent))eb.textContent+=' · 인건비 포함';}
 // 5 2단계
 setTxt(M.querySelector('#guideText'),t=>{const m=t.match(/^막대를 누르면 그 (.+)의 상세로 가요\.$/);const jo=w=>{try{return typeof josa==='function'?josa(w,'을','를'):w+'을(를)';}catch(e){return w+'을(를)';}};return m?`가운데 색 막대가 늘어난 이유예요. 누르면 그 ${jo(m[1])} 자세히 봐요.`:null;});
 $$('.wf-ax',M).forEach(e=>setTxt(e,()=>'차이가 잘 보이게 막대 아래쪽을 잘라 그렸어요'));
 $$('.s2head > .spark',M).forEach(sp=>{if(sp.previousElementSibling&&sp.previousElementSibling.classList.contains('r11-cap'))return;
  const w=document.createElement('div');w.className='r11-spw';sp.before(w);const c=document.createElement('div');c.className='r11-cap';c.textContent='월별 흐름 · 진한 막대 = 이번 분기';w.append(c,sp);});
 // 6 3단계 머리·안내·긴 설명
 $$('.pg-eyebrow',M).forEach(e=>setTxt(e,t=>t.replace(/ \d{4}( · 업체)?$/,'$1')));
 $$('.pg-s',M).forEach(e=>{if(/^그래프 위 단추로 보기를 바꿔요/.test(e.textContent))e.remove();});
 const no=M.querySelector('#r10ChartNote');if(no&&!no.dataset.r11&&no.textContent.length>110){no.dataset.r11='1';
  const short=/재고/.test(no.textContent)?'거래처별·품목별은 ‘산 금액’ 기준이라 ‘전체’(쓴 금액)와 숫자가 조금 달라요.':'';
  const d=document.createElement('details');d.className='r11-more';d.innerHTML='<summary>숫자 기준·자료 출처 보기</summary>';
  while(no.firstChild)d.appendChild(no.firstChild);if(short){const p=document.createElement('div');p.className='r11-short';p.textContent=short;no.appendChild(p);}no.appendChild(d);}
 // 7 AI 단추
 const g=M.querySelector('#guideText');if(g&&/오른쪽 AI 창/.test(g.textContent)){setTxt(g,t=>t.replace(/\s*(오른쪽 AI 창에서 바로 절감 계획을 만들 수 있어요\.|대화는 오른쪽 AI 창에서 어느 화면에서나 이어져요\.)/,'').trim());
  const gb=M.querySelector('#guide .gb');if(gb&&!gb.querySelector('[data-r11ai]'))gb.insertAdjacentHTML('afterbegin',AI_BTN);}
 const pe=M.querySelector('#planEmpty');if(pe&&!pe.querySelector('[data-r11ai]')){$$('*',pe).forEach(e=>setTxt(e,t=>/^오른쪽 AI 창에서/.test(t)?'아래 단추를 누르면 AI가 빈 칸을 하나씩 물어보며 계획을 적어 줘요. 마지막에 ‘절감 계획에 저장’을 누르면 여기에 모여요.':null));
  pe.insertAdjacentHTML('beforeend','<div class="r11-pe">'+AI_BTN.replace('btn sec sm','btn pri sm')+'</div>');}
}
const base=window.R10HOOK;
window.R10HOOK=function(){const r=window.render;
 if(typeof r==='function')window.render=function(){const out=r.apply(this,arguments);try{fixAll();}catch(e){console.warn('r11_ux',e);}return out;};
 window.R11_UX=true;return base&&base.apply(this,arguments);};
})();
