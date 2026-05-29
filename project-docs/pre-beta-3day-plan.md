# 비공개 베타 D-3 실행 계획

**목적:** 코드 동결 원칙을 지키면서, 베타 전에 **회귀 위험 낮은** 작업만 순차 수행  
**기준일:** 2026-05-30  
**테스트 게이트:** `npm test` (현재 100) — 매 작업 후 필수

---

## 이미 완료 (D-3 기준)

| 항목 | 상태 |
|------|------|
| Phase 2 안전 작업 (helpers, husky, normalize, dead props 문서) | ✅ |
| Session 방어 테스트 + 복원 무효화 | ✅ `e0b52ef` |
| MainScreen CSS → `main-screen.css` | ✅ |
| `private-beta-guide.md` | ✅ |
| 토글·Quota → `useRuleSets` | ✅ (미푸시 커밋에 포함) |

---

## Day 1 — 구조 격리 + 배포 고정

| # | 작업 | 위험 | 완료 |
|---|------|------|------|
| 1 | **Welcome PC CSS** → `welcome-gate.css` | 낮음 | ✅ |
| 2 | `git push` + Pages 배포 확인 | 낮음 | ☐ |
| 3 | 배포 URL에서 버전 뱃지·대문·검수 1회 smoke | — | ☐ |
| 4 | 테스터용 `private-beta-guide.md` (또는 docx) 배포 | — | ☐ |

**금지:** ruleEngine, dead props 제거, rule-set UI, breakpoint 추가

---

## Day 2 — PDF·결과 UI CSS 격리 (선택, 테스트 후)

| # | 작업 | 파일 | 위험 |
|---|------|------|------|
| 1 | PdfCenterStage 업로드/빈 화면 | `pdf-center-stage.css` | 중간 |
| 2 | CheckResultsPanel 결과 목록 | `check-results-panel.css` | 중간 |

**조건:** Day 1 smoke 이상 없을 때만. 하루 1파일, cut/paste만.

---

## Day 3 — 운영·수집·버퍼

| # | 작업 | 비고 |
|---|------|------|
| 1 | PostHog `.env` / Pages secrets (선택) | `analytics-beta.md` |
| 2 | Feedback Form 응답 탭 1건 테스트 | `feedback-form.md` |
| 3 | Known Issues 최종 점검 (가이드 §7) | 세션·「준비 중」문구 |
| 4 | **코드 freeze 선언** — 베타 시작 전 태그 `v0.1.0-beta.1` | hotfix만 |

---

## CSS 분리 로드 순서 (고정)

```
fonts.css
index.css          ← :root·공용 버튼·토큰
welcome-gate.css   ← 대문 PC
welcome-gate-mobile.css
main-screen.css
momo-room-mobile.css
```

---

## 베타 중 hotfix만 허용

- 세션 복원 크래시
- PDF 업로드 50MB gate 오동작
- 데이터 persist 회귀 (toggle)

---

## 아직 베타 후

- dead props UI 복구
- caution fingerprint 런타임 resync
- `useWorkSession` ↔ `useRuleCheck` 분리
- index.css 잔여 monolith 전면 분해
