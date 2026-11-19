# 표준국어대사전 품사 색인 출처

`stdict-pos-index.json`은 국립국어원 표준국어대사전 표제어·품사만 뽑은 exact 조회용 색인입니다. 원본 JSON은 레포에 넣지 않습니다.

**라이선스·저작자 표시(정본):** [STDICT-NOTICE.md](./STDICT-NOTICE.md)

- 출처: 국립국어원 표준국어대사전
- 원본 내려받기: 2026-11-06
- 라이선스: [CC BY-SA 2.0 KR](https://creativecommons.org/licenses/by-sa/2.0/kr/)
- 생성: `python scripts/build-stdict-pos-index.py --full "<JSON 폴더>"`
- bareKey 수: 362629
- hit 수: 439516
- 키 규칙: hangulOnlyKey (NFC, Hangul syllables only)
