# 공유 프로젝트 — 유료 공유 패키지 (구현 기준)

**상태:** 구현됨 (2026-07)  
**이전 초안과의 관계:** 2026-06 allowlist·단방향 규칙 배포 설계는 **폐기**. 아래가 현재 코드 기준이다.  
**관련:** [`mypage-project-backlog-2026-06-24.md`](./mypage-project-backlog-2026-06-24.md), Firestore `sharePackages` 규칙

---

## 1. 한 줄 요약

유료 회원이 **저장된 프로젝트**의 기준·검수 이력 메타를 Firestore `sharePackages`에 올려  
`?share=<packageId>` 링크로 나눈다. **원고 PDF는 포함하지 않는다.**  
링크가 있는 사람은 미리보기(읽기)만 가능하고, **유료 수신자만** 기준을 자기 작업대에 적용할 수 있다.

---

## 2. 역할·권한

| 역할 | 조건 | 할 수 있는 것 |
|------|------|----------------|
| **발신** | 로그인 + `plan: paid` | 공유 미리보기 → 링크 발급·클립보드 복사 |
| **수신(누구나)** | 링크 URL만 있으면 됨 (비로그인 가능) | 프로젝트 정보·맞춤법 요약·표기 통일·본보조·작업 이력 **열람** |
| **수신(적용)** | 로그인 + `plan: paid` | 「이 기준으로 내 작업대에서 검수하기」→ 새 RuleSet 저장 |

발신 게이트: `assertPaidShareOrAlert` (`src/lib/paidPlanGate.js`)  
적용 게이트: `SharePackageScreen` 내 `isPaidPlan`

---

## 3. 데이터 모델 (Firestore `sharePackages/{id}`)

문서 id가 곧 비밀 링크 토큰이다. (`allow read: if true` — URL을 아는 사람만 접근한다는 전제)

| 필드 | 설명 |
|------|------|
| `schemaVersion` | `1` |
| `createdAt` / `expiresAt` | 생성·만료 (검수 결과와 동일 보관 기간, 약 30일) |
| `createdByUid` | 발신자 uid |
| `sourceProjectId` / `sourceName` | 원본 프로젝트 |
| `meta` | 제목·태그·메모·formatLabel·pillarMemos(있을 때만) |
| `criteria` | builtIn/caution/customRules·확정 대장 등 **기준 슬라이스** (PDF 바이트 없음) |
| `checkResults` | 검수 이력 **메타·건수**만 (`rows` 본문은 넣지 않음) |
| `truncated` | 용량 한도로 이력 개수를 줄였는지 |

보안 규칙 (`firestore.rules`):

- create: 인증 + `createdByUid == auth.uid` + 필수 키 + PDF 필드 금지  
- update: 불가  
- delete: 발신자만  

페이로드는 Firestore용으로 `undefined` 필드를 제거한다 (`omitUndefinedDeep`).

---

## 4. 사용자 흐름

### 발신

1. 나의 프로젝트 카드 → 공유  
2. `SharePreviewModal` — 폴더 카드 + **설정과 같은** 읽기 패널(`SharePackageReadPanel`)  
3. 「공유 링크 만들기」→ `issueSharePackageLink`  
   - 유료 확인 → 검수 결과 목록 로드 → `createSharePackageCloud` → URL 클립보드

### 수신

1. `https://…/?share=<id>` → `App.jsx`가 `SharePackageScreen`만 렌더  
2. 같은 `SharePackageReadPanel`로 구역 열람  
   - 맞춤법: **건수 배지만** (칩 UI 없음, 데이터는 criteria에 포함)  
   - 표기 통일·본보조: 시스템과 같은 칩  
   - 작업 이력: 마지막 작업·PDF 정보·저장된 검수 결과 건수 (다운받기 버튼은 비활성·안내 문구)  
3. 유료 로그인 후 적용 → `planApplySharePackage` → 로컬(+클라우드) RuleSet 추가·활성

---

## 5. 코드 지도

| 구분 | 경로 |
|------|------|
| 도메인 | `src/lib/sharePackage.js` |
| Firestore | `src/lib/sharePackageCloud.js` |
| 발급 UX | `src/lib/issueSharePackageLink.js` |
| 발신 모달 | `src/components/projectHub/SharePreviewModal.jsx` |
| 수신 화면 | `src/components/SharePackageScreen.jsx` |
| 공통 읽기 UI | `src/components/SharePackageReadPanel.jsx` (+ `project-hub-settings` 클래스) |
| 라우팅 | `src/App.jsx` (`?share=`) |
| 규칙 | `firestore.rules` → `match /sharePackages/{packageId}` |
| 테스트 | `src/lib/sharePackage.test.js` |

설정 패널(`ProjectHubSettingsPanel`)은 **공유 수신용으로 재사용하지 않는다.** 읽기 UI만 공통 패널로 맞춘다.

---

## 6. 정책 메모 (합의된 것)

- 원고 PDF·바이너리 필드 금지  
- 공유 링크 열람은 비로그인 가능 / 적용·발급은 유료  
- 검수 이력 zip 다운로드는 **나의 프로젝트 작업 이력**에서만 (공유 화면에서는 제공하지 않음)  
- 안내 카피 예:  
  「공유 링크가 있는 사용자는 프로젝트 정보를 볼 수 있습니다. 인디야 유료회원은 프로젝트를 적용하여 작업할 수 있습니다.」  
  「검수 이력 다운받기는 유료회원만 가능합니다」

---

## 7. 폐기된 설계 (참고만)

다음은 **하지 않는다.**

- uid/email allowlist로만 공유 기능을 여는 방식  
- owner→viewer 단방향 «공유 규칙 세트» 별도 컬렉션 복제 모델 (6월 테스터 플랜)  
- 수신 화면에서 검수 zip 다운로드  
- 맞춤법 칩을 공유 UI에 나열 (데이터만 criteria에 포함)

테스터 모집·PostHog 모니터링은 제품 운영 이슈이며, 공유 패키지 기술 모델과는 분리한다. 분석은 [`analytics-beta.md`](./analytics-beta.md)를 본다.
