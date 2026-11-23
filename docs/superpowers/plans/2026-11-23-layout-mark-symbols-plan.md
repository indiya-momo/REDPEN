# 조판 기호 1차 — 줄바꿈·행갈이·들여쓰기 (Replace)

**스펙:** [`../specs/2026-11-23-layout-mark-symbols-design.md`](../specs/2026-11-23-layout-mark-symbols-design.md)  
**범위:** 작업대 찍기 + 화면 기호 + 인디자인용 Replace. 내어·proof·FreeText 조판 없음.  
```text
사용자 목표: 줄바꿈·행갈이·들여쓰기를 화면에 찍고, 인디자인용 PDF 바꾸기 주석으로 Accept 반영
성공 기준: 합성·제외 고지 포함; found=W·replacement=스펙; Accept 본문 일치; 문자 Replace 회귀
축소 여부: 내어·문자+조판 자동 합성은 다음
다음: 앱 PDF Accept 스모크 B
```

## Contents 매핑 (확정)

| kind / 합성 | found | replacement |
|-------------|-------|-------------|
| `paraSplit`만 | `W` | `"\n" + W` |
| `paraGap`만 | `W` | `"\n\n" + W` |
| `indent`만 | `W` | `"　" + W` (전각 1자) |
| 줄바꿈+들여 | `W` | `"\n" + "　" + W` |
| 행갈이+들여 | `W` | `"\n\n" + "　" + W` |
| 같은 앵커에 split+gap | `W` | **gap 우선** `"\n\n"+…` |

지시 문구 `(줄바꿈)` 등 Contents 금지.

## 겹침 · 제외 (스펙 §5 — 계획 필수)

1. **조판끼리 같은 `W`:** 겹침 제외로 버리지 말고 **한 Replace로 합성**(위 표).
2. **문자 Replace(맞춤법 등)와 구간 겹침:** 문자 고침 **유지**, 조판 건 **제외**, 내보내기에 **`조판 기호 N건 제외(문자 고침과 겹침)`** 고지. 1차에서 문자 Contents에 개행·들여 자동 합치기 없음.

## 단계

1. `layoutMarkToReplacePayload` + **합성 함수** 단위 테스트  
2. `LayoutMark` 타입·세션 저장 (수동 finding과 분리)  
3. 작업대 UI + 오버레이 (`setGroups`/`publish`/`remap` 금지)  
4. 인디자인 내보내기: 합성 → 문자 겹침 제외·N건 고지 → Caret+StrikeOut  
5. 테스트: 매핑·합성·겹침 고지·경계(첫/끝 어절, 줄끝·하이픈 `W`)·문자 Replace 회귀  
6. 앱 PDF Accept 스모크 B  

## 검증

- [ ] 줄바꿈+들여 → 단일 `"\n"+INDENT+W`
- [ ] 문자 Replace 겹침 시 조판 제외 + N건 안내
- [ ] `paraGap`=`"\n\n"+W`, indent 전각 1자, 합성 문자열 일치
- [ ] 페이지 첫·끝 어절, 줄끝/하이픈 `W` found 정합
- [ ] 기존 indesignReplace 회귀
- [ ] Accept 스모크 B

## 비범위

- `outdent`, proof, FreeText 조판, 문자+조판 자동 합성, ruleEngine
