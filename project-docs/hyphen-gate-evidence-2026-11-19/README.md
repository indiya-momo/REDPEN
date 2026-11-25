# 긴 합성어 붙임표 게이트 — 증거 스냅샷 (2026-11-19)

`tmp/`는 gitignore·측정 재실행으로 덮어써지므로, 이 폴더에 층화 표본·대조 결과를 고정한다.

## 범위 (좁게 읽을 것)

- API vs H 148건: 오류 0, 불일치 0.
- 다만 그 표본의 `hits`는 1~2뿐이라 **num=10 잘림 구간은 미검증**으로 둔다.
- 추가: TSV에서 `cleanLemma` 행 수 ≥10인 표제어는 **9개뿐**(20~30을 뽑을 모수가 없음). 전수 9개 대조도 불일치 0·잘림 의심 0·API hits 여전히 1~2.
  - 해석: TSV 어깨/행 수 ≠ Open API exact의 `item` 개수. 잘림 우려는 상당히 줄었으나, **차이가 나는 원인은 미규명**이라 “잘림이 구조적으로 안 생긴다”고까지는 말하지 않는다. 더 파고들지는 않음.
- 교체 후 지적이 늘 수 있다는 예상은 근거가 약해짐. 예상 변화로만 남기고, 전후 행 수 비교에서 증가가 나오면 그때 다시 본다.
- ④′(mixed 제외)는 더 큰 원고 묶음 측정 후.

## 파일

| 파일 | 내용 |
|---|---|
| `measured-citations.json` | 경주멍+book_part2 측정 distinct citation 10 |
| `measure-hyphen-gate.summary.json` | 버킷·행 수·allCitations |
| `compare-hyphen-api-vs-h.json` | 148행 전수 |
| `compare-hyphen-api-vs-h.summary.json` | 요약 |
| `compare-homograph-truncation.json` | TSV 동형어≥10 표본 API vs H (있으면) |

## 덤프

- `DOWNLOADED=2026-11-06` (`scripts/build-stdict-verb-forms.mjs`)
- 대조 실행일: 2026-11-19

## 구현 후 확인

두 책에서 긴 합성어 지적 행 수를 교체 전(API) / 후(H)로 비교. → **`compare-hyphen-before-after-rows.json`**

| | 후보 | 게이트 통과 (API→H) | 화면 지적 (API→H) | Δ |
|---|---:|---:|---:|---:|
| 경주멍 (교정완료, 116쪽) | 18 | 12→12 | 3→3 | 0 |
| book_part2 (34쪽) | 7 | 3→3 | 1→1 | 0 |
| 합계 | 25 | 15→15 | 4→4 | **0** |

- 불일치 행 0 · API 오류 0. 교체로 지적이 늘지 않음.
- 경주멍 PDF: 당시 `…검토중_.pdf`가 없어 `…교정완료.pdf`로 대체(쪽 수 116 동일).
- book_part2 A/B는 여전히 미실시.
