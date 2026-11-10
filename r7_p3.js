// r7 P3: 히트맵 판(#tm)은 app.js drawTM() 이 그릴 때의 판 크기로 칸을 깔아요. 사이드바를 접고 펴거나(sidebar.js, 그린 뒤에 본문 폭이 바뀜)
//  창 크기를 바꾸면 칸이 판보다 좁게(오른쪽 빈칸) 또는 넓게(오른쪽 잘림) 남았어요(1366 캡처에서 확인). 본문(#main) 폭이 바뀌면 판을 다시 그려요.
//  처음 관찰(크기 기록)에는 다시 그리지 않고, 폭이 실제로 바뀔 때만 한 번(다음 그리기 틀) 그려요.
(function(){
const main=document.getElementById('main');if(!main||typeof ResizeObserver!=='function')return;
let lastW=null,q=0;
new ResizeObserver(()=>{const w=Math.round(main.clientWidth);if(lastW===null||w===lastW){lastW=w;return;}lastW=w;
 cancelAnimationFrame(q);q=requestAnimationFrame(()=>{if(document.getElementById('tm')&&typeof drawTM==='function')drawTM();});}).observe(main);
})();
