# Kiwi 로컬 사용

- 날짜: 2026-08-02
- **권장: 시나리오 C** — `kiwi-server-c-2026-08-02.md` (서버 analyze, 브라우저 wasm 미전송)
- 시나리오 A(브라우저 wasm)는 C ping 실패 시 DEV 폴백만.
- 질문지: `kiwi-legal-questions-2026-08-02.md`

## 준비

1. 모델 (gitignore `tmp/`):

```
https://github.com/bab2min/Kiwi/releases/download/v0.23.1/kiwi_model_v0.23.1_base.tgz
→ tmp/kiwi-models/ 에 풀어 models/cong/base/ 가 보이게
```

2. `.env.local` (커밋 금지, **Vite 재시작**):

```
VITE_UNIFY_KIWI_JOSA=true
VITE_SPELLING_KIWI_BOUNDARY=true
```

둘 중 하나만 켜도 boot 대상.

3. `npm run dev` → `http://127.0.0.1:5173`

부트가 `GET /api/kiwi/analyze` → `ready:true` 이면 **서버 모드(C)**.  
모델/`/@kiwi` 없고 서버도 실패하면 **heuristic**.

## 스크립트

```
npm run kiwi:spike   # Node P0 스파이크 (tmp 모델 필요)
```

## 동작 요약

| 구성 | 역할 |
|------|------|
| `kiwiAnalyzeDevPlugin` | DEV `POST /api/kiwi/analyze` (C) |
| `kiwiDevModelsPlugin` | DEV `/@kiwi/wasm`, `/@kiwi/models/*` (A 폴백) |
| `bootKiwiIfNeeded` | C ping → 실패 시 A |
| `loadNode.js` | Vitest·스파이크·서버 서비스 |

배포 빌드에는 모델이 포함되지 않습니다.
