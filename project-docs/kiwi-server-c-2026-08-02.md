# Kiwi 서버 analyze (시나리오 C)

- 날짜: 2026-08-02
- 법무: `kiwi-legal-questions-2026-08-02.md` Q3 — wasm 미전송 → Relinking/소스공개 의무 없음
- 배포 기본 경로. 브라우저 WASM(B)은 고지·약관 준비 전 OFF.

## 구조

```
브라우저 ──POST /api/kiwi/analyze──▶ Node(Vite 플러그인 또는 api/)
                                      └─ kiwi-nlp + tmp/kiwi-models
브라우저 ◀── tokens JSON ────────────┘
```

| 구성 | 역할 |
|------|------|
| `scripts/kiwiAnalyzeDevPlugin.js` | `npm run dev` 시 `/api/kiwi/analyze` |
| `api/kiwi/analyze.js` | Vercel 등 — 로컬 모델 또는 `KIWI_ANALYZE_UPSTREAM` 프록시 |
| `src/lib/kiwiMorph/serverRunner.js` | 클라이언트 prefetch |
| `remoteCache` + `analyzeLine` | 동기 strip/경계가 서버 결과 사용 |

## 로컬

1. 모델: `tmp/kiwi-models/models/cong/base/` (기존 A와 동일)
2. `.env.local` (선택 — 맞춤법 경계·조사 리뷰용):

```
# 표기통일 잡음 제외(경제학상·이다 연결 등)는 플래그 없이 부트만 되면 동작
# VITE_UNIFY_KIWI_JOSA=true
# VITE_SPELLING_KIWI_BOUNDARY=true
```

3. `npm run dev` → `http://127.0.0.1:5173`
4. App boot이 `GET /api/kiwi/analyze` → `ready:true` 이면 **서버 모드**(브라우저에 wasm 안 받음). ping 실패 시 DEV만 wasm 폴백.
5. 표기 통일 찾기 시 `bootKiwiIfNeeded` + 표면형 배치 prefetch 후 조사 strip·잡음 제외
6. 맞춤법 `runRuleCheckAsync` 시작 시 줄·페이지 텍스트 prefetch 후 경계 게이트 (`VITE_SPELLING_KIWI_BOUNDARY`)

헬스 확인:

```
GET http://127.0.0.1:5173/api/kiwi/analyze
→ { "ok": true, "ready": true }
```

```
POST http://127.0.0.1:5173/api/kiwi/analyze
Content-Type: application/json
{ "text": "초콜렛을" }
```

## 배포

- GitHub Pages(정적만): 서버 API 없음 → Kiwi OFF(heuristic)
- Vercel: `api/kiwi/analyze.js` 존재. **cong 모델 ≈104MB는 서버리스에 넣기 어려움**
  - 권장: 모델 있는 전용 호스트를 `KIWI_ANALYZE_UPSTREAM` 으로 지정
  - 또는 모델이 있는 Node 호스트에서 동일 핸들러 실행
- 클라이언트: `VITE_KIWI_ANALYZE_ENDPOINT=https://…/api/kiwi/analyze` (필요 시)

## 시나리오 A (브라우저 wasm)

C ping 실패 + `npm run dev` 일 때만 `loadBrowser` 폴백. 프로덕션 기본 경로 아님.
