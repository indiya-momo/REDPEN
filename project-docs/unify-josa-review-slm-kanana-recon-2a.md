# 카나나-2 SLM 정찰 (단계 2a)

**일자:** 2026-07-30  
**대상 SLM:** `kakaocorp/kanana-2-1.3b-instruct` (조사·어간 2차 필터용)  
**관련:** `unify-josa-review-slm-sketch.md` §0·§7

> **용어:** **SLM** = 아래 카나나 가중치. **vLLM** = SLM을 돌리는 **추론 서버** 이름(모델 아님). 표는 스케치 §0.

---

## 1. 요약 (결론)

| 항목 | 정찰 결과 |
|------|-----------|
| **SLM 적합성** | 한국어·지시 따르기·tool calling 벤치마크상 **분류+JSON 작업에 1.3B로 충분**해 보임. 3B는 여유 있을 때만. |
| **브라우저 WebGPU (`kananaRunner`)** | **당장 불가에 가깝다.** SLM 커스텀 아키텍처 + 공식 ONNX/GGUF(1.3B) 없음. |
| **POC 권장 경로** | **추론 서버** — `transformers` 또는 `vllm serve`로 SLM 로드 → `serverRunner` HTTP. |
| **로컬 수동 추론** | 스케치 **§13** (vLLM E2E·curl·`kanana-recon-sample.py`) |
| **라이선스** | Kanana Open License — **SaaS API로 제3자에게 추론 제공 시 상용 라이선스 검토 필요** (§5). |

**다음 단계:** 골든셋·`serverRunner`·패널 연동 — 스케치 §9 참고.

### 모델 선택 정책 (인디야 §11.5 대입, 확정 초안)

태스크: 브라우저 WebGPU 로컬 처리 또는 인디야 서버 1회 배치로 `{ isBoundary, kind, confidence }` JSON을 내는 **3분류 판별** (`josa_or_suffix` / `compound_word` / `uncertain`).

**Base vs Instruct — Instruct만 후보.** 고정 JSON 스키마를 지키는 지시 수행이므로 `Kanana-2-3B-Base`, `Kanana-2-1.3B-Base`는 제외. Base는 few-shot을 붙여도 형식 이탈(자유 텍스트·필드 누락) 위험이 구조적으로 큼.

**배포 경로별 (장기 설계):**

| 경로 | 추천 | 근거 |
|------|------|------|
| 브라우저 WebGPU 로컬 | **1.3B-Instruct** | SWA(3:1 하이브리드)로 KV 캐시를 줄여 브라우저 메모리 제약과 맞음. 3B는 로딩·추론 부담 큼. |
| 인디야 서버 1회 배치 | **3B-Instruct 고려 가능** | 실시간 압박이 없어 지연 여유. 한국어·경계 판정에서 3B가 도움이 될 수 있음. |

**실질 의사결정 — 골든셋 우선, 1.3B로 통일 시작.** 태스크가 좁고, `confidence === 'high'`가 아니면 배지를 숨기는 누락 우선 원칙이 이미 오탐 리스크를 낮춤. 따라서 **두 경로 모두 `kanana-2-1.3b-instruct`로 골든셋을 먼저 돌리고**, 정확도가 부족한 항목만 3B로 올린다. WebGPU/서버를 경로마다 다른 모델로 나누지 않고 1.3B 하나로 통일할 가능성을 남긴다.

**2a 정찰과의 정합:** 단기 POC·베타는 브라우저에서 SLM 직접 실행이 미지원(§3.3)이므로 **추론 서버 + SLM(`kanana-2-1.3b-instruct`)** 가 실제 1차 경로. WebGPU 행은 ONNX·런타임 가능해진 뒤 재검토. 3B SLM 승격 기준은 골든셋에서 승격 대상 recall 부족, 또는 `compound_word`↔`josa_or_suffix` 혼동이 프롬프트 조정으로도 안 잡힐 때로 둔다.

---

## 2. 모델 스펙

| | |
|---|---|
| HF ID | `kakaocorp/kanana-2-1.3b-instruct` |
| 파라미터 | ~1.29B (BF16 safetensors) |
| 아키텍처 | `Kanana2TinyForCausalLM` — Qwen3 백본 + **3:1 SWA/풀 어텐션 하이브리드** |
| 컨텍스트 | 최대 32K (본 작업은 프롬프트 ~수백 토큰) |
| 로딩 조건 | `transformers >= 4.57`, `--trust-remote-code` |
| 토크나이저 | Kanana-2 전용 (한국어 토큰 효율 이전 대비 +30% 주장) |

**3B 대비 (HF 카드 instruct 벤치):**

| 벤치 | 1.3B | 3B | 비고 |
|------|------|-----|------|
| KoMT-Bench | 6.54 | 6.92 | 한국어 대화 |
| IFEval (strict) | 77.63 | 80.96 | 지시 따르기 |
| IFBench | **34.69** | 33.33 | 1.3B가 소폭 우위 |
| BFCL-v3 Live | 69.64 | 71.94 | tool/구조화 출력 |

→ JSON-only 분류는 **1.3B 우선**. 오탐이 골든셋에서 많으면 3B 재시험.

---

## 3. 배포·추론 경로 (SLM vs 추론 서버)

### 3.1 추론 서버 — vLLM (SLM 가중치 실행)

카드 예시 — **vLLM이 SLM을 로드**한다:

```bash
vllm serve kakaocorp/kanana-2-1.3b-instruct \
  --tensor-parallel-size 1 \
  --max-model-len 32768 \
  --trust-remote-code \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder
```

**SGLang (추론 서버):** 저장소 `sglang/config.json` + `sglang/qwen3.py` 패치 필요 (하이브리드 SWA). `--attention-backend triton` 권장.

**Hugging Face transformers (추론 라이브러리, SLM 직접 로드):**

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model_id = "kakaocorp/kanana-2-1.3b-instruct"
tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(model_id, trust_remote_code=True, device_map="auto")
```

### 3.2 GGUF / llama.cpp

- HF 검색 기준 **1.3B instruct용 커뮤니티 GGUF 없음** (2026-07-30).
- llama.cpp의 Kanana-2 지원(PR #19803)은 **30B MoE(DeepSeek2 계열)** 위주. **1.3B `kanana2_tiny`와 아키텍처가 다름.**
- 자체 변환은 `convert_hf_to_gguf` + SWA 레이어 지원 여부를 별도 검증해야 함 → **POC 범위 밖.**

### 3.3 브라우저 (`@huggingface/transformers.js`)

- v4도 **사전 ONNX 변환 + 허브 등록** 모델 위주. `Kanana2TinyForCausalLM`은 지원 목록에 없음.
- 하이브리드 SWA는 ONNX Runtime WebGPU 커스텀 op 없이는 난이도 높음.
- **판단:** `kananaRunner.js`는 **단계 5 이후 또는 ONNX 공식화 이후**로 연기. 번들·다운로드 부담도 큼 (~2.6GB+ 가중치).

---

## 4. 채팅 템플릿·출력 형식

- 포맷: ChatML 스타일 (`<|im_start|>role` …). instruct는 기본 `no_think` 시 `<think>\n\n</think>` 접두.
- **tool calling:** Qwen3 coder 파서 호환 XML (`<tool_call>`, `<function=…>`). BFCL Live 69.64% — 구조화 출력에 유리.
- **JSON-only 프롬프트:** IFEval 77% 수준 — few-shot + `parse.js`로 1차 POC 가능. 실패 시 tool schema로 2차 시도.

### 4.1 우리 스키마와의 매핑

SLM이 반환할 필드 (`parse.js`와 동일):

```json
{
  "id": "cluster-key",
  "isBoundary": true,
  "kind": "josa_or_suffix",
  "confidence": "high",
  "reason": "선택"
}
```

**승격 조건:** `isBoundary && kind === 'josa_or_suffix' && confidence === 'high'` only.

### 4.2 프롬프트 초안 (POC용)

- 시스템: 한국어 교정 보조, **교정안 금지**, **JSON 한 줄만**.
- 사용자: `variant`, `gluedVariant`, `ruleStem`, `ruleSuffix`, `context` (앞뒤 40자).
- few-shot 2~3건: `활동 이며` → boundary true, `가치평가`+`가` → compound false.

`thinking_mode=no_think` 유지해 thinking 블록 노이즈 최소화.

---

## 5. 라이선스 (Kanana Open License)

- Outputs 저작권: 사용자(우리) 소유.
- **§4.1 상용 라이선스 필요 가능성:**
  - (i) API/클라우드로 **제3자에게** 모델 접근 제공
  - (iii) **온디바이스 임베딩** 후 제3자 배포
- **§4.2:** 위에 해당하지 않으면 자사 서비스 개발·운영은 별도 상용 계약 없이 가능할 수 있음.
- **제품 영향:**
  - **브라우저에 모델 번들** → (iii) 검토 필요.
  - **Firebase 등으로 사용자 PDF 문맥을 서버 추론** → (i) 검토 필요.
  - **개발자 로컬 추론 서버(vLLM 등)만** → 리스크 낮음 (POC용).

배포 전 카카오 `kanana-llm@kakaocorp.com`(팀 메일명에 LLM 포함 — SLM 제품 라인 브랜드) 또는 상용 문의 권장.

---

## 6. 로컬 수동 추론 재현

이 PC: Python 3.14, `pip` 있음, **`torch`/`transformers` 없음** — 대용량 다운로드·GPU 없이 본 정찰 세션에서는 추론 미실행.

**앱 E2E·vLLM·체크리스트:** `unify-josa-review-slm-sketch.md` **§13** (단계 3b 맥락 포함).

```bash
# 별도 venv 권장 (Python 3.10–3.12 + CUDA가 안정적)
python -m venv .venv-kanana
.venv-kanana\Scripts\activate
pip install "transformers>=4.57" accelerate torch --index-url https://download.pytorch.org/whl/cu124

python scripts/kanana-recon-sample.py
```

`scripts/kanana-recon-sample.py` — 5건 fixture, greedy decode, JSON 추출 성공률 출력 (단계 2b 전 워밍업용).

**측정할 지표 (2b와 연계):**

1. JSON 파싱 성공률 (5~10건)
2. `shouldPromoteJosaReview`와 사람 라벨 일치율
3. 1건당 latency (CPU vs GPU)
4. thinking/tool_call 잔여 텍스트 비율

---

## 7. `serverRunner` POC 설계 (단계 3 방향)

```
UnifyCandidateFindPanel
  → filterJosaReviewBySlm(..., { runner: serverRunner })
  → POST /api/unify/josa-slm  (또는 dev: http://127.0.0.1:8000/v1/chat/completions)
  → batch ≤ 50, body: { requests: JosaSlmReviewRequest[] }
  → response: { results: JosaSlmReviewResult[] }
```

- **개발:** 로컬 **추론 서버** `vllm serve` (OpenAI 호환) + `serverRunner` 어댑터 → **SLM** 추론.
- **프로덕션:** 상용 라이선스 확인 후 Firebase Functions / 전용 inference VM.
- **타임아웃:** 배치 50 × ~200ms 가정 → UI 15s cap + 진행 표시 (스케치 §6).

`kananaRunner.js`는 플래그 분기만 남기고 **stub → serverRunner 우선 구현**.

---

## 8. 로드맵 조정

| 단계 | 내용 | 상태 |
|------|------|------|
| 0–1 | candidate·noop·filter | ✅ |
| **2a** | **본 정찰 문서** | ✅ |
| **2b** | 골든셋 20건 + CI | ✅ |
| **3** | `serverRunner` — 추론 서버 HTTP + SLM | ✅ 골격 |
| **4** | 패널 연동 + 로딩 UX | ✅ |
| **5** | (선택) 브라우저 SLM 직접 / 상용 배포 | 보류 |

---

## 9. 참고 링크

- https://huggingface.co/kakaocorp/kanana-2-1.3b-instruct
- https://huggingface.co/kakaocorp/kanana-2-1.3b-instruct/blob/main/LICENSE
- 스케치: `project-docs/unify-josa-review-slm-sketch.md`
