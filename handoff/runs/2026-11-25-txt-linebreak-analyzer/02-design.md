# 02 설계 — TXT 문단 줄바꿈에 softwrap 교훈을 얹는 범위

작성: 2026-11-25 (이 대화에서 조사 직후 설계. 클로드 창 미경유).  
근거: `01-investigate.md`. `src/` 미수정.

## 한 줄 결론

**1차로 안 B(모달·회귀 표본만).** 런타임 분석기(C·D)는 표본 게이트를 통과한 뒤에만 연다.  
통일 softwrap merge를 TXT에 연결하지 않는다.

## 왜 B인가

- TXT는 이미 레이아웃 + `isLikelyHangulEojeolBoundary` + 모달로 문단을 잇는다. 부족한 것은 “키위가 없어서”가 아니라 **잘못 잇기·모호 후보의 검증 가능한 기준**이다.
- softwrap에서 분석기 SPACE는 충돌 키를 바꾸지 못했고, 가려진 키 1건은 JOIN이라 「띄움이면 구제」가 성립하지 않았다. 그 이득 논리를 TXT 자동 glue에 옮기면 안 된다.
- 다만 softwrap이 남긴 **방어선**은 TXT에도 맞다: **A를 잘못 잇거나 잘못 띄우는 쪽이 더 해롭다.** 자동을 공격적으로 바꾸기 전에, uncertain(midword·josa) 표본으로 회귀를 고정하는 편이 싸다.
- C(uncertain만 분석기)는 비동기·키·Pages·전송 이슈가 있고, D는 1차 핫패스에 가깝다. B 없이 C로 가면 softwrap 때와 같이 **측정 없는 구현**이 된다.

## 안 비교 (채택)

| 안 | 채택 | 이유 |
|----|------|------|
| A 안 얹음 | 기각(지금은) | 교훈을 제품에 안 남김. 문서만이면 run 목표가 빈다 |
| **B 모달·회귀** | **1차 채택** | 런타임 비용 0. A-FP·Y 표본을 테스트로 잠금 |
| C uncertain+분석기 | 보류 | B 표본 게이트 후. 라이선스·전송·갈림=현행 유지 |
| D 전면 분석기 | 기각 | 비용·1차 금지 |

## 1차 구현 범위 (승인 후에만)

### 할 일

1. **회귀 표본 세트** (새 테스트 파일 권장, 기존 `it.fails`·통일 softwrap 테스트 불변)
   - softwrap 육안 200 중 TXT glue와 대응 가능한 쌍을 골라  
     `classifyParagraphPair` / `paragraphJoinGlue` 기대값(keep / nospace / space)을 고정.
   - 최소 게이트 제안: Y형(띄움·어절 경계) 잘못 nospace 금지, A형(단어 중간) 잘못 space/keep으로 문단이 깨지는지 문서화.
   - softwrap wasm A-FP 사례(`것|이었다`, `한|쪽으로`)는 **「자동 nospace가 깨지면 안 되는 입력」**으로 TXT 쪽에도 넣을지 표본에서 결정 (레이아웃 없으면 glue만).
2. **모달 순위·카피** (선택, 작으면)
   - `EXCEPTION_RANK`에서 midword/josa가 이미 상위. 바꾸지 않아도 됨.  
   - 필요 시 도움말 한 줄: “단어 중간·조사는 확인 권장” — UX만, 찾기 CPU 무관.
3. **측정 기록**
   - 표본 n, 자동 판정 vs 기대, 모달에 오른 비율. `handoff/experiments/log.md` 한 블록.

### 하지 말 일 (1차)

- `mergeUnifyHangulSoftWrapScanLines` 호출
- Kiwi/Bareun을 `analyzeParagraphFlow`에 넣기
- `COMPLETE_ONE_SYLLABLE_EOJEOL`에 softwrap Y 상위 음절·`건` 대량 추가
- `pdfPageText` 휴리스틱 본문·`ruleEngine` 변경
- 검수전(`joinPagesWithMarkers`) 의미 변경 (조판 줄 유지)

## 2차 (별도 승인 · C)

조건 모두:

1. B 회귀가 머지·통과.
2. TXT uncertain 후보 **표본 ≥ 합의 n**(제안 100, 잠금 PDF)에서  
   - 분석기로 바꾸면 **좋아지는 비율**과 **A형 악화(오경보)** 를 숫자로 냄.  
   - A 악화 상한: softwrap과 같이 **A-FP를 방어선** (구체 %는 표본 후 확정).
3. 갈림(키위≠바른): **현행 glue 유지** (띄움으로 확정하지 않음).
4. 플래그 기본 OFF. Pages는 분석기 없이 현행.
5. 전송·유료 라이선스 항목을 BRIEF에 닫은 뒤.

## 데이터 흐름 (B)

```text
PDF → extract → cleanPageLinesForTxt
    → analyzeParagraphFlow (현행, 동기)
    → 모달(uncertain) / 최종 applyLinebreakDecisions
테스트만: softwrap·TXT 공유 사례 픽스처 → classifyParagraphPair 기대
```

## 예외·부작용

- 레이아웃 있는 쌍은 softwrap 문자열 전용 라벨과 1:1이 아닐 수 있음 → 픽스처는 **문자열 glue**와 **레이아웃 keep**을 분리.
- 모달 80 상한은 유지. B가 상한을 올리라고 하지 않음.
- 실험 5개 중 1개로 이 run을 센다.

## 성공 기준 (구현 승인 시)

- [ ] 새 회귀 테스트가 softwrap에서 합의된 “잘못 붙/띄우면 안 되는” 사례를 최소 합의 개수만큼 고정
- [ ] 런타임 TXT 경로 동작·성능 변화 없음 (B)
- [ ] issues.md에 미반영 이유 유지
- [ ] C는 이 승인에 포함되지 않음

## 사람에게

이 설계를 승인하면 Grok이 **테스트·(선택) UX 문구**만 구현합니다.  
분석기 런타임은 승인 범위 밖입니다.
