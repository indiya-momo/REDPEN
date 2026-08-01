# Kiwi P0 스파이크 메모

- 일시: 2026-08-02
- 스크립트: `scripts/kiwi-p0-spike.mjs`
- 원본 리포트: `tmp/kiwi-p0-spike-report.json` (gitignore `tmp/`)
- 계획: `project-docs/kiwi-morph-boundary-plan-2026-08-02.md`

## 버전·라이선스 (고정)

| 항목 | 값 |
|------|-----|
| npm `kiwi-nlp` | **0.23.0** / **LGPL-2.1-or-later** |
| wasm `version()` | **0.23.0** |
| 모델 팩 | [kiwi_model_v0.23.1_base.tgz](https://github.com/bab2min/Kiwi/releases/download/v0.23.1/kiwi_model_v0.23.1_base.tgz) |
| 실제 경로 | `models/cong/base/` → **`modelType: 'cong'`** (v0.23.1 “base” 팩이 CoNg 구성) |
| 코어 최신 태그 | v0.23.1 (2026-04-04) — npm wasm은 0.23.0 |
| typo | **`typo.dict` 미포함**, `loadTypoDict: false` |

별도 knlm/sbg “고전 base” 팩은 이번 스파이크에서 받지 않음. README의 문어~94%/웹~87%는 **저자 자체 평가**이며, 이번 측정은 **cong** 단일.

## 용량

| 파일 | 크기 |
|------|------|
| `kiwi-wasm.wasm` | ≈ 3.6 MB |
| `cong.mdl` | ≈ 72.2 MB |
| `multi.dict` | ≈ 11.5 MB |
| `nounchr.mdl` | ≈ 9.3 MB |
| `sj.morph` | ≈ 8.1 MB |
| `default.dict` | ≈ 3.0 MB |
| 기타 | &lt; 0.1 MB |
| **모델 합계 (typo 제외)** | **≈ 104 MB** |

브라우저 첫 로드 시 wasm+모델 ≈ **108 MB**급. Worker + 캐시 필수.

## 성능 (로컬 Node, Windows)

| 단계 | ms |
|------|-----|
| `KiwiBuilder.create` | ≈ 57 |
| `build(cong, no typo)` | ≈ 3157 (첫 로드; 양자화 미지원 경고 → non-quantized) |
| `analyze` (짧은 문장) | ≈ 0.2–8 ms |

경고: `Quantization is not supported for ArchType::none. Fall back to non-quantized model.` (WASM ArchType)

## 표면형 1:1 (`input.slice(pos, pos+len) === token.str`)

샘플 전부:

- `Match.all` → **통과**
- `Match.allWithNormalizing` → **통과** (이번 샘플에서는 차이 없음)
- `Match.none` → **통과**

→ P1 기본 Match는 **`Match.all`** (정규화 없이)로 가도 됨.  
정규화 이슈는 이번 문어 샘플에서 재현되지 않았으나, 정책상 기본은 비정규화 유지.

## 품사·경계 관찰 (핵심)

### 잘 된 예 — 외래어+조사

`나는 초콜렛을 먹었다.`

```
나/NP 는/JX 초콜렛/NNG 을/JKO 먹/VV 었/EP 다/EF ./SF
```

계획했던 “명사 어간 + 조사” 센서에 **적합**.

### 주의 — 지명·붙여 읽기

`항아리 바위로 유명한 명지 계곡` / `… 명지 계곡 외에도 …`

```
명/NNB 지/NNG 계곡/NNG
```

`명지`가 **고유명사(NNP) 한 토큰이 아니라** `명`+`지`로 쪼개짐.  
표기통일·지명 교정에 그대로 쓰면 **오분리**. → P1에 **user dict / 사전 보강** 또는 “띄움 명사구는 heuristic 우선” 정책 필요.

### 복합어

`경제학과 경제 성장` → `경제학/NNG` vs `경제/NNG` 분리.  
부분일치 필터(P2)에 유리한 신호.

## P0 통과 판정

| 기준 | 결과 |
|------|------|
| Worker/idle 로드 가능 구조 | OK (스크립트는 메인 스레드; 제품은 Worker 권장) |
| 문어 샘플 명사+조사 납득 | **외래어·일반 문장 OK** / **지명 명지 계곡 NG** |
| 표면형 1:1 | **OK** (`Match.all`) |
| 버전·모델 기록 | OK |
| typo 미로드 | OK |
| 용량 | **무거움 (≈104MB 모델)** — 제품 기본 ON 비권장 |

**종합:** P0 **조건부 통과**. P1은 플래그 OFF 기본으로 진행 가능하되,  
1) user dict(출판 고유명사) 스파이크,  
2) Kiwi 실패·의심 시 heuristic 폴백,  
을 P1 착수 조건에 넣는다.

## 법무 메모 (미결)

- 코어 README: LGPL **v3** / npm: **LGPL-2.1-or-later**
- WASM≈정적 링크 해당 여부 → **법무 확인 전 제품 배포 보류**
- 고지 문구 초안은 법무 회신 후

## 다음

1. 법무 질문 발송 (라이선스 이중 + WASM)
2. P1 설계: `kiwiMorph` 래퍼 + `Match.all` + user dict 초안 + restored→visual 어댑터
3. 모델은 `tmp/` 유지, **저장소에 커밋하지 않음** (≈84MB tgz)
