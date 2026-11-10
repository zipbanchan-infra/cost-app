// r7 P3 (R6ND-26 남은 한계): 키보드 초점이 안 가던 숫자 글자에도 초점을 줘서 u10_tip.js 툴팁(같은 title 글)이 보이게 해요.
//  (1) 누를 수 없는(disabled) 워터폴 시작·끝·원장 외 차이·자료 없음 막대, 비활성 시그널 대상: 버튼은 disabled 그대로 두고(누르기·기존 선택자 그대로)
//      안의 숫자 글자(.wf-v·.dv)에 tabindex=0 + 같은 title 을 붙여요(disabled 버튼 안 글자도 Tab 으로 갈 수 있어요).
//  (2) 요약 숫자(#divSum·#heatSum·#priceSum·#vdKey·2단계 핵심 수치 안 title·1단계 단가 이슈 줄·업체 상세 연관 자재 줄): tabindex=0.
//  (3) 히트맵 분류 머리(.tm-s 의 title): 머리 줄(.tm-sh)에 tabindex=0 + 같은 title.
//  마우스는 지금처럼 브라우저 기본 title. 화면 모양·누르기 동작은 바뀌지 않아요.
(function(){
const SUM='#divSum[title],#heatSum[title],#priceSum[title],#vdKey[title],#main .s2key [title],#main .imp div.ir[title],#main .rrow[title]';
const DIS='#main .wf-c[disabled][title],#main .sig .ir[disabled][title]';
const t=e=>(e.getAttribute('title')||'').trim();
function mark(){
 document.querySelectorAll(SUM).forEach(e=>{if(!e.hasAttribute('tabindex')&&t(e))e.setAttribute('tabindex','0');});
 document.querySelectorAll(DIS).forEach(b=>{const s=t(b),v=b.querySelector('.wf-v,.dv');if(s&&v&&!v.hasAttribute('tabindex')){v.setAttribute('tabindex','0');v.setAttribute('title',s);}});
 document.querySelectorAll('#tm .tm-s[title]>.tm-sh').forEach(h=>{const s=t(h.parentNode);if(s&&!h.hasAttribute('tabindex')){h.setAttribute('tabindex','0');h.setAttribute('title',s);}});
}
new MutationObserver(mark).observe(document.getElementById('main'),{childList:true,subtree:true});mark();
})();
