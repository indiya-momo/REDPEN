# 맞춤법 규칙 — Google 시트 연동

**앱은 시트를 읽지 않습니다.** `npm run sync-spelling` → `src/data/spelling-rules.json` → 앱이 로드합니다.

Language Map 프로젝트의 `sync-data`와 같은 방식(공개 CSV export)입니다.

---

## 1. 시트 준비

1. Google **스프레드시트** 새로 만들거나 기존 문서 사용
2. 탭 이름: **`spelling_rules`** (다르면 `.env`에 `SPELLING_SHEET=탭이름`)
3. **1행 헤더** (소문자 권장):

| find | replace | enabled | tip | memo | counts_in_quota |
|------|---------|---------|-----|------|-----------------|
| 우리 나라 | 우리나라 | TRUE | 띄어쓰기 통일 | | TRUE |
| 구별 | 구분/구별 | FALSE | 구분·구별 안내 | | FALSE |
| 구분 | 구별/구분 | FALSE | 구분·구별 안내 | | FALSE |

- **find** · **replace**: 필수
- **enabled**: `TRUE` / `FALSE` (기본 TRUE) — `sync-spelling` 후 앱 **내장 맞춤법 규칙** 체크·검사 on/off 초기값. `FALSE`면 체크 해제·검사 제외 (앱에서 다시 켤 수 있음)
- **tip**: 맞춤법 **검사 결과**에 표시되는 안내 문구
- **memo**: 편집·관리용 메모 (앱 목록에만 표시, 검사 결과에는 **미표시**)
- **counts_in_quota**: `TRUE`(기본) / `FALSE` — `FALSE`면 **1000개 한도**와 **맞춤법 확인 (N/M)** 집계에서 제외. 검사는 켜면 동작함. 앱에서는 **「규칙 제외 · 서비스」** 구역에 표시
- 앱 코드 `SPELLING_SERVICE_NO_QUOTA_FINDS`(`src/lib/builtInRules.js`)에 있는 find는 시트가 TRUE여도 **항상 제외** (구별·구분·과반수 이상·우리 나라 등). 시트 `FALSE`와 **합집합**

템플릿: [`templates/spelling_rules.csv`](templates/spelling_rules.csv) → 시트에 붙여넣기

4. 시트 **공유**: 「링크가 있는 모든 사용자」**보기** 이상 (CSV export용)

---

## 2. 환경 변수

프로젝트 루트 `.env` (git에 올리지 않음):

```env
SPREADSHEET_ID=여기에_시트_ID
# SPELLING_SHEET=spelling_rules
```

시트 ID = URL `https://docs.google.com/spreadsheets/d/【이부분】/edit`

---

## 3. 싱크 명령

```bash
npm run sync-spelling
```

성공 시:

- `src/data/spelling-rules.json`
- `public/data/spelling-rules.json`

`npm run dev` 실행 중이면 **브라우저 새로고침**만 하면 설정 → **맞춤법 (내장)** 목록이 갱신됩니다.

---

## 4. 운영 루프 (로사님)

| 순서 | 할 일 |
|------|--------|
| 1 | 시트 `spelling_rules`에서 find/replace 수정 |
| 2 | `npm run sync-spelling` |
| 3 | 앱 새로고침 → 내장 규칙 반영 확인 |
| 4 | (선택) git commit — JSON도 같이 커밋하면 다른 PC에서도 동일 |

**일관성(붙임 패턴)** 은 계속 앱·localStorage. **맞춤법·주의**는 각각 `spelling_rules` / `caution_rules` 탭이 소스입니다.

**본용언+보조용언** (`verb-bon`, `verb-special`, `verb-or`)은 **`caution_rules` sync에서 제외**합니다. 대신 **`bon-bojo` 탭** → `npm run sync-bon-bojo` → 일관성 「본용언+보조용언 띄어쓰기」 시드(개발중·규칙 수·검사 미포함).

---

## 5. 본용언+보조용언 — `bon-bojo` 탭

**`caution_rules`와 같은 열**을 씁니다. (`find`/`replace` 없음)

### 탭 이름

- **`bon-bojo`** (기본)
- 다른 이름이면 `.env`에 `BON_BOJO_SHEET=탭이름` 또는 `BON_BOJO_GID=시트gid`

템플릿: [`templates/bon_bojo_rules.csv`](templates/bon_bojo_rules.csv)

### 열 (caution과 동일)

`group_id` · `item_id` · `label` · `stems` · `tip` · `enabled` · `match_mode` · `display_label` · `except` · `counts_in_quota` · `inventory`

| 열 | bon-bojo에서 쓰는 방식 |
|----|------------------------|
| **label** | **tail_word** — `보`, `주`, `해 보` (어미 `보다` 말고 **어간·문구**) |
| **stems** | 같은 행의 **추가 검색 변이** (`해 보`, `해 본` …). sync·목록은 **1칸**(`display_label`), 검사만 어간마다 regex |
| **display_label** | 일관성 목록에 보이는 이름 (`(아/어) + 보다` 등) |
| **match_mode** · **except** · **counts_in_quota** | **무시** (caution 전용) |

### 싱크

```bash
npm run sync-bon-bojo
# 맞춤법·띄어쓰기·보조용언 한 번에
npm run sync
```

→ `src/data/bon-bojo-rules.json`, `public/data/bon-bojo-rules.json`  
앱은 규칙 세트 로드 시 **없는 tail만** 추가(기본 체크 off). **이미 등록된 tail은 삭제·이름 자동 교체 안 함** — 표시명 갱신은 sync 후 규칙 세트 새로 만들거나 수동 정리.

---

## 6. 띄어쓰기 검토 — `caution_rules` 탭

**맞춤법 탭과 분리**하세요. `find`/`replace` 열을 넣지 마세요.

### 탭 이름

- **`caution_rules`** (기본)
- 다른 이름이면 `.env`에 `CAUTION_SHEET=탭이름` 또는 `CAUTION_GID=시트gid`

템플릿: [`templates/caution_rules.csv`](templates/caution_rules.csv)

### 표기 A — 그룹당 여러 행 (권장)

**1행 헤더:** `group_id` · `item_id`(또는 `id`) · `label` · `stems` · `tip` · `enabled` · `match_mode` · `display_label` · `except`

| group_id | id | label | stems | tip | enabled | match_mode | display_label |
|----------|---------|-------|-------|-----|---------|--------------|---------------|
| particle-josa | particle-man | 만 | | 체언 뒤에 붙은… (첫 행만) | FALSE | | |
| particle-josa | particle-mankun | 만큼 | | | FALSE | | |
| particle-josa | particle-ji | 지 | | | FALSE | | |

**그룹:** `group_id`로 UI 블록·`tip`을 묶습니다. 시트에 `particle-or` 등이 있으면 `npm run sync-caution`이 `particle-josa`로 합칠 수 있습니다. `item_id`는 `particle-*` 형식을 유지합니다.

`stems`에 여러 어간을 쉼표로 넣으면 체크는 한 칸인데 검사는 어간마다 regex가 생깁니다. 설명(`tip`)은 첫 행만 써도 아래 행에 이어집니다.

| 열 | 의미 |
|----|------|
| **group_id** | UI에서 설명·가로 배치를 묶는 그룹 키 |
| **item_id** / **id** | 항목 고정 키 (바꾸지 않는 편이 좋음) |
| **label** | 대표 **어간** (체크 한 줄의 기본값) |
| **stems** | 비우면 `label`만. **주,준**처럼 쉼표로 여러 어간 → 한 체크에 묶음 (`^주다` = 주+준) |
| **tip** | 그룹 공통 설명 (첫 행만 써도 됨, 아래 행은 비워도 이어짐) |
| **enabled** | `TRUE`/`FALSE` — sync 후 앱 **첫 반영·신규 항목** 체크 on 여부 (보통 `FALSE`) |
| **match_mode** | 비우면 `any-before`. 자세한 설명·표·예시: **[caution-match-mode.md](caution-match-mode.md)** |
| **display_label** | 체크박스에 보일 이름 (비우면 `spaced-before`·`spaced-stem`일 때 `^{label}`) |
| **except** | 검사에서 **빼는 문구** (쉼표 구분, **통째** 일치). 예: `여름가지,산가지` — 유저 설정 아님, 편집자가 시트에만 기록 |

### 표기 B — 한 행에 여러 label

| group_id | labels | tip | enabled |
|----------|--------|-----|---------|
| particle-josa | 만, 만큼, 지 | 체언 뒤에 붙은… | FALSE |

### 싱크

```bash
npm run sync-caution
# 맞춤법+주의 한 번에
npm run sync
```

→ `src/data/caution-rules.json`, `public/data/caution-rules.json`

앱 새로고침 후 **띄어쓰기 검토** 체크 목록·설명이 갱신됩니다. 이미 켜 둔 체크 상태는 localStorage에 남습니다.

---

## 7. 문제 해결

| 증상 | 확인 |
|------|------|
| HTML instead of CSV | 시트 공개·탭 이름 `spelling_rules` |
| 0 rules | find/replace 빈칸 · 헤더 철자 |
| 앱에 안 바뀜 | sync 후 F5 · dev 서버 재시작 |

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `project-docs/sheet-spelling.md` | 이 문서 |
| `scripts/sync-spelling.mjs` | 시트 → JSON |
| `src/data/spelling-rules.json` | 앱이 import |
| `src/lib/builtInRules.js` | JSON → BUILT_IN_RULES |
| `src/data/caution-rules.json` | 띄어쓰기 검토 목록 |
| `src/lib/cautionRules.js` | JSON → CAUTION_RULES |
| `scripts/sync-bon-bojo.mjs` | bon-bojo 탭 → JSON |
| `src/data/bon-bojo-rules.json` | 일관성 보조용언 시드 |
| `src/lib/bonBojoRules.js` | JSON → BON_BOJO_LIST_ITEMS · tail 시드 |
