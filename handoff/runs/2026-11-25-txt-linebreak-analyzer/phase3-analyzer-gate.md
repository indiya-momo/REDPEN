# 3단계 — uncertain만 분석기 게이트

## 상태

스캐폴드만. **플래그 기본 OFF.** 형태소(키위→바른) 미연결. 승인 전 기본 ON 금지.

## 게이트 (모두 충족 후 승인)

| 게이트 | 상태 |
|--------|------|
| 1·2단계 머지(layout keep + 모달 Y 표본) | 코드 반영 |
| TXT uncertain 표본 n(합의, 제안 100)에서 A 악화 상한 | **미측정 — ON 전 필수** |
| 갈림 시 현행 glue 유지 | `suggestUncertainLinebreakDecisions` / `mergeUncertainSuggestions` |
| 플래그 기본 OFF | `VITE_TXT_LINEBREAK_ANALYZER` !== `true` |
| Pages 폴백 | 플래그 OFF와 동일(현행) |
| 전송·라이선스 BRIEF 닫힘 | **미닫음 — ON 전 필수** |

## 핫패스

`analyzeParagraphFlow` / `classifyParagraphPair`에 분석기 호출 **금지**.  
uncertain 후보 배치만 `src/lib/pdfTxtUncertainAnalyzer.js`.

## 측정

`handoff/runs/2026-11-25-txt-linebreak-analyzer/phase3-y-space-rate.json`  
softwrap `Y_known_wrong_nospace`가 현행 glue에서 space로 바뀌는 비율.  
이 숫자·A-FP 보고 뒤에만 기본 ON 논의.

## 플래그

```text
VITE_TXT_LINEBREAK_ANALYZER=true   # 켤 때만. 기본은 두지 않음(OFF)
```

## 구현 메모 (2026-11-25 계속)

- 로컬 Kiwi만 midword Y→space 제안. 바른·원격 전송 없음.
- VITE_TXT_LINEBREAK_ANALYZER 기본 OFF. preparePdfTxtReview는 ON일 때만 후보 default 보정.
- 기본 ON은 softwrap A-FP·depressione Y catch 보고 후 별도 승인.
