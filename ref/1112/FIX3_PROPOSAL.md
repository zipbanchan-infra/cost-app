# FIX3_PROPOSAL - 결함 3 (목표 단가·비율이 target 칸에 안 들어감)

상태: 제안만. r9_api.js 는 이번 회차에서 수정하지 않음(해시 일치 확인). 아래 diff 는 적용·시험하지 않은 제안.

## 1. r9_api.js 없이 해결 가능한가
- 결론: 단가 목표는 **불가능**. 비율 목표는 이미 target_ratio 로 들어감(변경 불필요).
- 이유: postPlan(r9_api.js:214)이 target 을 항상 targetText(target_amount_krw, target_unit)로 덮어씀. 금액(정수 원)이 없으면 "목표 금액 입력 필요". 수정 경로(r9_api.js:239,243)도 같은 규칙. target 필드를 화면이 직접 채울 방법이 없음.
- 사용자가 적은 목표 단가를 target_amount_krw 에 넣는 우회는 금하는 쪽을 권장: 이 칸은 월 목표 금액(원)이라 "단가 1200원"을 넣으면 의미가 틀어져 r13_plan.js 의 비율 계산(목표 금액 / 월평균)이 거짓 값을 만듦.
- 현재 사이드바 동작(변경 없음): 목표 단가·비율은 content.memo 문구에 "목표 단가 1,200원 (현재 단가 ...)" 로 저장되고, 비율은 content.target_ratio 에도 저장. target 칸은 "목표 금액 입력 필요"로 남음. 정보 손실은 없고 표시 위치만 다름.

## 2. r9_api.js 최소 수정안 (diff, 1곳)
새 선택 필드 target_note(문자열, 최대 60자)가 있고 금액이 없을 때만 target 문구로 사용. 기존 호출은 target_note 가 없으므로 동작 동일.

```diff
--- a/r9_api.js
+++ b/r9_api.js
@@ postPlan (214행)
-          if (p && typeof p === 'object') p = Object.assign({}, p, { target: targetText(p.target_amount_krw, p.target_unit) });
+          if (p && typeof p === 'object') p = Object.assign({}, p, { target: (!isInt(p.target_amount_krw) && isStr(p.target_note) && trim(p.target_note)) ? trim(p.target_note).slice(0, 60) : targetText(p.target_amount_krw, p.target_unit) });
```
- target_note 자체는 content 에 저장되지 않음(content 키 목록에 없음). 저장되는 것은 target 문구뿐.
- 화면 쪽(plan_sidebar.js payload)은 승인 후 plan.target_note = '목표 단가 1,200원/kg' 또는 '목표 비율 3.5%' 를 같이 보내도록 한 줄 추가.

## 3. 위험·확인할 것
- planSchemaOk(r9_api.js:73)는 필수 문자열과 target_amount_krw 형식만 보므로 target_note 같은 모르는 키는 통과함(코드 읽어 확인, 실행 시험은 안 함).
- 수정 경로(243행)는 건드리지 않음: 편집 화면은 금액 칸 하나로 문구를 자동 생성하는 R6ND-17 규칙 유지.
- 적용은 본부장님 승인 필요(보호 파일).
