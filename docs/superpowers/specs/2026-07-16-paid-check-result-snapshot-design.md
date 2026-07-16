# 유료 검수 결과 스냅숏 · 프로젝트 재다운로드

**상태:** 구현 완료 (배포·수동 스모크 대기)  
**날짜:** 2026-07-16  
**범위:** 맞춤법·표기 통일 엑셀 결과의 유료 자동 저장(Firestore) + 프로젝트 허브 재다운로드  
**비범위:** 결제 연동, PDF 파일 클라우드 업로드, 둘러보기 게스트 export 개방

**운영 메모:** Firebase 콘솔에서 `userCriteria/{uid}.profile.plan = 'paid'` 수동 기입. `expiresAt` TTL 정책은 콘솔에서 1회 설정. `firestore.rules` 배포 필요. 상세 §9.

---

## 1. 목표

유료 회원은 검수할 때마다 결과 스냅숏이 프로젝트에 자동 보관되고, 작업대와 프로젝트 관리 양쪽에서 엑셀을 받을 수 있다.  
무료 회원은 지금처럼 작업대에서 **탭별 일 1회** 직후 다운로드만 가능하고, 프로젝트 허브의 결과 다운로드는 「유료회원 전용」으로 막는다.

---

## 2. 합의된 정책

| 구분 | 작업대 「검수 결과 다운로드」 | 검수 완료 시 자동 저장 | 프로젝트 허브에서 다시 받기 |
|------|---------------------------|------------------------|------------------------------|
| **무료 (`plan` 없음/`free`)** | 유지 (탭별 일 1회 쿼터) | 없음 | 차단 + 「유료회원 전용입니다」 |
| **유료 (`plan: 'paid'`)** | 유지 (쿼터 정책은 기존 `betaDailyQuota` 따름) | 맞춤법·표기통일 각각 완료 시 스냅숏 1건 | 목록·다운로드 허용 |
| **둘러보기 게스트** | 기존처럼 차단 | 없음 | N/A |

**유료 판별 (MVP, ~4명·1개월):** Firestore 프로필에 `plan`을 **수동** 기입. 결제 연동 전.  
**결과 저장소:** Firestore (의도적 정책 — PDF 원고는 올리지 않음. 발견 목록·페이지·요약만 보관).

### 카피·신뢰 문구 (구현과 함께)

- 대문 「원고는 서버에 저장되지 않습니다」는 **유지** (PDF 미업로드).
- 유료/허브/약관 안내에 추가: **검수 결과(발견 목록·요약)는 유료 회원 프로젝트에 일정 기간 보관**될 수 있음.
- 무료가 허브 다운로드를 누르면: **「유료회원 전용입니다」**.

---

## 3. 현재 구조 (기준점)

- 엑셀: `src/lib/exportResults.js` — 조판(행 내용)과 인쇄(ExcelJS·다운로드)가 한 흐름.
- 작업대 버튼·쿼터: `MainScreen.jsx` + `betaDailyQuota.js` (`spellingExportCount` / `consistencyExportCount`).
- 프로필 클라우드: `userCriteria/{uid}.profile` (`userProfileCloud.js`).
- 프로젝트(기준): 동일 `userCriteria` + localStorage. PDF·검수 세션 결과는 IndexedDB 로컬.

---

## 4. 아키텍처

```
검수 완료 (유료)
  → buildCheckResultSnapshot(...)  // 순수 JSON (조판 결과)
  → saveCheckResultCloud(...)      // Firestore (실패해도 검수 UX는 성공)

작업대 다운로드 (무료·유료)
  → (기존) 조판 → 인쇄 → 브라우저 다운로드
  → 리팩터 후: buildRows → writeWorkbook → download

프로젝트 허브 다운로드 (유료만)
  → loadCheckResultsCloud(projectId)
  → writeWorkbook(snapshot.rows) → download
```

### 4.1 `exportResults.js` 리팩터 (1단계)

- **조판:** 화면/세션 데이터 → `rows` + `summary` 등 순수 객체. (기존 `formatPageLabel`, `isInstanceVisible` 의존은 이 단계에만.)
- **인쇄:** 순수 객체 → ExcelJS → Blob 다운로드.
- 기존 버튼은 두 단계를 연속 호출 → **사용자 체감 변화 없음.**
- 기존/추가 단위 테스트로 회귀 확인.

### 4.2 스냅숏 도메인 (2단계) — `checkResultSnapshot.js`

검수 완료 시점에 조판 함수를 호출해 JSON을 굳힌다.

최소 필드:

| 필드 | 설명 |
|------|------|
| `kind` | `'spelling'` \| `'consistency'` |
| `createdAt` | ms 또는 Firestore Timestamp |
| `expiresAt` | 저장 시각 + **30일** |
| `projectId` | 활성 규칙 세트(프로젝트) ID. 없으면 저장 스킵 또는 `unassigned` 정책 — **구현 시 활성 프로젝트 없으면 저장하지 않음** 권장 |
| `pdfFileName` | 표시용 (바이너리 없음) |
| `summary` | 엑셀 2행 요약에 쓰는 수치·문구용 데이터 |
| `rows` | 조판 완료 행 배열 |
| `truncated` | 문서 크기 한도 대비 행을 자른 경우 `true` |
| `schemaVersion` | `1` |

**크기:** Firestore 문서 1MiB 대비. 초과 시 뒤에서부터 행을 자르고 `truncated: true`. UI에 「일부만 저장됨」표시.

**포함 금지:** PDF 바이트, OPFS 핸들, 세션 전체 raw.

### 4.3 플랜 (3단계)

- 저장 위치: `userCriteria/{uid}.profile.plan`
- 값: `'free'` \| `'paid'`. **필드 없음 → `free`.**
- `src/lib/userPlan.js`: `isPaidPlan(profile)` — 결제 연동 시 이 모듈만 확장.
- `userProfileCloud.js` / 로컬 프로필 normalize에 `plan` 읽기 추가.
- **쓰기:** MVP는 Firebase 콘솔 수동. 앱 UI로 plan 변경하지 않음 (테스터 4명).

테스터 운영:

- 기본 free.
- 본인 포함 ~4명 uid에만 `plan: 'paid'`.
- 누가 paid인지 시트/메모 유지.

### 4.4 Firestore (4단계) — `checkResultsCloud.js`

**권장 경로 (보안 규칙 단순):**

```
userCriteria/{uid}/checkResults/{resultId}
```

문서 필드: §4.2 + `uid`(중복 가능하나 rules용으로 문서 소유는 path의 uid).

**동작:**

- `saveCheckResultCloud({ uid, projectId, snapshot })` — merge/create.
- `listCheckResultsCloud({ uid, projectId })` — `expiresAt > now`만. 만료 건은 목록에서 제외.
- TTL: Firebase 콘솔에서 `expiresAt` TTL 정책 1회 설정 (구현 후 안내).
- **rules:** `userCriteria/{userId}/checkResults/{id}` — `request.auth.uid == userId` only read/create. update/delete는 MVP에서 클라이언트 삭제 없이 TTL에 맡기거나, 본인 delete만 허용.

상위 `userCriteria` write 규칙이 넓으므로, 서브컬렉션을 **명시 match**로 제한하는 편이 안전.

### 4.5 화면 연결 (5단계)

**MainScreen.jsx**

- 맞춤법·표기통일 검수 **성공 완료** 훅에서: `isPaidPlan`이면 스냅숏 저장 fire-and-forget (실패 시 console/조용히, 검수 팝업은 성공).
- `MainScreen`은 호출만 얇게 — 로직은 새 모듈. (커서와 충돌 주의: 동일 파일 병행 작업 시 조율.)

**프로젝트 허브**

- 「저장된 검수 결과」: 종류·일시·건수·남은 보관일·`truncated` 배지.
- 다운로드: 유료만. 무료는 버튼 비활성/클릭 시 안내.
- 인쇄: 저장된 `rows`/`summary`만으로 workbook 생성 (화면 세션 불필요).

**작업대 다운로드**

- 무료·유료 모두 기존 경로 유지 (리팩터된 조판→인쇄).
- 유료가 작업대에서 받을 때 **반드시 스냅숏을 또 쓰지 않아도 됨** (완료 시 이미 저장). 원하면 “다운로드 시점에 최신으로 덮어쓰기”는 **비범위(후속)**.

---

## 5. 구현 순서 (권장)

1. `exportResults` 조판/인쇄 분리 + 테스트 (동작 동일)
2. `checkResultSnapshot` + 테스트
3. `userPlan` + 프로필 `plan` 읽기
4. `checkResultsCloud` + `firestore.rules` + (콘솔) TTL 안내
5. MainScreen 저장 훅 + 프로젝트 허브 목록/다운 + 무료 차단 카피
6. 대문/허브 보관 안내 문구 (최소)
7. `npm test` / 수동: free 1회 다운, paid 자동 저장·허브 다운

---

## 6. 위험·결정 메모

| 항목 | 결정 |
|------|------|
| 결과 클라우드 | **허용** (발견 목록만). PDF 금지. |
| 활성 프로젝트 없음 | 스냅숏 **저장 안 함** |
| 30일 만료 | 채택. 허브에 남은 일수 표시 |
| truncate | 채택 + UI 표시 |
| 결제 | 비범위. `isPaidPlan`만 교체 지점 |
| MainScreen 대형 파일 | 최소 diff |

---

## 7. 성공 기준

- [x] 무료: 작업대 탭별 일 1회 다운 가능, 허브 다운 시 유료 전용 안내 *(코드 완료 · 수동 확인 권장)*
- [x] 유료(`plan: 'paid'`): 검수 완료 후 허브에 스냅숏 보임, 엑셀 재다운 가능 (세션 없어도) *(코드 완료 · rules 배포·plan 기입 후 수동)*
- [x] 유료: 작업대 다운도 가능 *(기존 경로 유지)*
- [x] 둘러보기: export 계속 차단 *(기존 정책 유지)*
- [x] PDF가 Firestore에 올라가지 않음 *(스냅숏에 바이트 없음)*
- [x] 조판/인쇄 분리 후에도 기존 엑셀 형식·테스트 통과 *(npm test)*

---

## 8. 열린 항목 (구현 직전 확정 가능)

- 허브 UI를 **마이페이지 프로젝트 카드**에 둘지 **프로젝트 편집(허브) 패널**에 둘지 — 기본 제안: **프로젝트 허브/카드 상세** (플래그 `MYPAGE_PROJECT_HUB`와 맞춤). 허브 off면 임시로 마이페이지 프로젝트 행에 「결과」진입.
- 유료 export 일일 쿼터를 완화할지 — **MVP는 기존 쿼터 유지** (테스터 allowlist/쿼터 면제는 별도 운영).

---

## 9. 운영 체크리스트 (배포 직후)

1. **Firestore rules 배포** — 로컬 `firestore.rules`의 `userCriteria/{uid}/checkResults` 규칙 반영
2. **테스터 plan** — `userCriteria/{uid}.profile.plan = "paid"` (콘솔 수동, ~4명)
3. **TTL (1회)** — Firestore → TTL 정책 → 컬렉션 그룹 `checkResults` → 필드 `expiresAt`  
   - 타임스탬프 필드가 아니면 숫자(ms) TTL은 콘솔 지원 여부를 확인. 미지원 시 목록에서 `expiresAt <= now` 제외로 MVP 유지(이미 구현됨).
4. **수동 스모크**  
   - free: 작업대 다운 1회, 허브 「유료회원 전용입니다」  
   - paid: 저장 프로젝트에서 검수 완료 → 허브 「작업 이력」에 항목 → 엑셀 재다운
