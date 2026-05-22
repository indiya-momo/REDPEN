# 맞춤법 규칙 — Google 시트 연동

**앱은 시트를 읽지 않습니다.** `npm run sync-spelling` → `src/data/spelling-rules.json` → 앱이 로드합니다.

Language Map 프로젝트의 `sync-data`와 같은 방식(공개 CSV export)입니다.

---

## 1. 시트 준비

1. Google **스프레드시트** 새로 만들거나 기존 문서 사용
2. 탭 이름: **`spelling_rules`** (다르면 `.env`에 `SPELLING_SHEET=탭이름`)
3. **1행 헤더** (소문자 권장):

| find | replace | enabled | tip | memo |
|------|---------|---------|-----|------|
| 우리 나라 | 우리나라 | TRUE | 띄어쓰기 통일 | |
| 빼곡이 | 빼곡히 | TRUE | 표준국어대사전 '빼곡히' 등재 | 관리용 메모 |

- **find** · **replace**: 필수
- **enabled**: `TRUE` / `FALSE` (기본 TRUE) — `sync-spelling` 후 앱 **내장 맞춤법 규칙** 체크·검사 on/off 초기값. `FALSE`면 체크 해제·검사 제외 (앱에서 다시 켤 수 있음)
- **tip**: 맞춤법 **검사 결과**에 표시되는 안내 문구
- **memo**: 편집·관리용 메모 (앱 목록에만 표시, 검사 결과에는 **미표시**)

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

---

## 5. 주의(직접 검토) — `caution_rules` 탭

**맞춤법 탭과 분리**하세요. `find`/`replace` 열을 넣지 마세요.

### 탭 이름

- **`caution_rules`** (기본)
- 다른 이름이면 `.env`에 `CAUTION_SHEET=탭이름` 또는 `CAUTION_GID=시트gid`

템플릿: [`templates/caution_rules.csv`](templates/caution_rules.csv)

### 표기 A — 그룹당 여러 행 (권장)

**1행 헤더:** `group_id` · `item_id`(또는 `id`) · `label` · `stems` · `tip` · `enabled` · `match_mode` · `display_label`

| group_id | id | label | stems | tip | enabled | match_mode | display_label |
|----------|---------|-------|-------|-----|---------|--------------|---------------|
| particle-josa | particle-man | 만 | | 체언 뒤에 붙은… (첫 행만) | FALSE | | |
| particle-josa | particle-mankun | 만큼 | | | FALSE | | |
| particle-josa | particle-ji | 지 | | | FALSE | | |
| verb-bon | verb-boda1 | 보 | | 본동사 붙임… | FALSE | spaced-stem | ^보 |
| verb-bon | verb-boda2 | 본 | | | FALSE | spaced-stem | ^본다 |
| verb-bon | verb-boda3 | 있 | | | FALSE | spaced-stem | ^있다 |
| verb-bon | verb-boda4 | 주 | 주,준 | | FALSE | spaced-stem | ^주다 |
| verb-bon | verb-boda5 | 하 | 하,한 | | FALSE | spaced-stem | ^하다 |
| verb-bon | verb-boda6 | 두 | | | FALSE | spaced-stem | ^두다 |
| verb-bon | verb-boda7 | 놓 | | | FALSE | spaced-stem | ^놓다 |

**조사와 같은 짝:** `particle-josa` + `particle-man` ↔ **`verb-bon`** + **`verb-boda1`** … **`verb-boda7`** (그룹=종류, `item_id`=규칙 키).

| 짝 | group_id (종류) | item_id (규칙) | label (검색 어간) |
|----|-----------------|----------------|-------------------|
| 조사 | particle-josa | particle-man | 만 |
| 본동사 | verb-bon | verb-boda4 | 주 | `stems` **주,준** → 체크 **^주다** 한 칸 |

`stems`에 **주,준**처럼 쉼표로 여러 어간을 넣으면 체크박스는 하나(`^주다`)인데 검사는 주다·준다 모두 합니다. **하,한** → **^하다** 한 칸.

`verb-bon` = 본동사 **한 블록**. 설명(`tip`)은 첫 행에만 써도 됩니다.

| 열 | 의미 |
|----|------|
| **group_id** | UI에서 설명·가로 배치를 묶는 그룹 키 |
| **item_id** / **id** | 항목 고정 키 (바꾸지 않는 편이 좋음) |
| **label** | 대표 **어간** (체크 한 줄의 기본값) |
| **stems** | 비우면 `label`만. **주,준**처럼 쉼표로 여러 어간 → 한 체크에 묶음 (`^주다` = 주+준) |
| **tip** | 그룹 공통 설명 (첫 행만 써도 됨, 아래 행은 비워도 이어짐) |
| **enabled** | `TRUE`/`FALSE` — sync 후 앱 **첫 반영·신규 항목** 체크 on 여부 (보통 `FALSE`) |
| **match_mode** | 비우면 `any-before`. `spaced-before` = `앞말+공백+label`만 (`살아 있다`). `spaced-stem` = `앞말+공백+label+어미` (`살아 있었다`, `살아 있고` — `살아있다`·`살아있었다` X) |
| **display_label** | 체크박스에 보일 이름 (비우면 `spaced-before`·`spaced-stem`일 때 `^{label}`) |

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

앱 새로고침 후 **주의** 체크 목록·설명이 갱신됩니다. 이미 켜 둔 체크 상태는 localStorage에 남습니다.

---

## 6. 문제 해결

| 증상 | 확인 |
|------|------|
| HTML instead of CSV | 시트 공개·탭 이름 `spelling_rules` |
| 0 rules | find/replace 빈칸 · 헤더 철자 |
| 앱에 안 바뀜 | sync 후 F5 · dev 서버 재시작 |

---

## 7. 관련 파일

| 파일 | 역할 |
|------|------|
| `docs/sheet-spelling.md` | 이 문서 |
| `scripts/sync-spelling.mjs` | 시트 → JSON |
| `src/data/spelling-rules.json` | 앱이 import |
| `src/lib/builtInRules.js` | JSON → BUILT_IN_RULES |
| `src/data/caution-rules.json` | 주의(직접 검토) 목록 |
| `src/lib/cautionRules.js` | JSON → CAUTION_RULES |
