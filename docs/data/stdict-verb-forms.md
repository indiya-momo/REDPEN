# 표준국어대사전 용언 추출본 출처

`stdict-verb-forms.json`은 국립국어원 표준국어대사전의 용언 표제어·활용형에서 뽑은 추출본입니다. 원본 JSON은 레포에 넣지 않습니다.

**라이선스·저작자 표시(정본):** [STDICT-NOTICE.md](./STDICT-NOTICE.md)

- 출처: 국립국어원 표준국어대사전
- 원본 내려받기: 2026-11-06
- 라이선스: [CC BY-SA 2.0 KR](https://creativecommons.org/licenses/by-sa/2.0/kr/)
- 생성: `node scripts/build-stdict-verb-forms.mjs "<verbs.tsv 경로>"`
- `lemmas`: 띄움 필수 기본형→활용형 (K)
- `hyphenLemmasOutsideK`: 붙임표 표제어 중 K에 없는 기본형 (H∖K). 긴 합성어 붙임표 게이트는 K∪이 목록.
