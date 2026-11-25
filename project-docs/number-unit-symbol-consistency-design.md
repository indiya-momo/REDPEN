# 숫자·단위·기호 표기 통일 검사 — 설계 문서

**상태:** 설계 초안 (구현 전) · 2026-07-22 검토 반영  
**작성:** 2026-07-22  
**제품:** 인디야(Indiya)  
**범위:** 표기 통일 탭의 **숫자·단위·기호** 일관성 검사 (맞춤법 검사기 아님)  
**관련:** [`consistency-decisions-schema.md`](./consistency-decisions-schema.md) · [`structure.md`](./structure.md) · 기존 `src/lib/ruleEngine.js`(문자열 규칙 스캔과 **분리된 파이프라인**)

---

## 0. 한 줄 요약

PDF에서 뽑은 텍스트를 **정규식 + 사전**으로 토큰화하고, Rule(JSON)로 Match를 만든 뒤, `groupBy`로 묶어 **오류(`error`)** 와 **허용 표기 혼용(`styleVariant`)** 을 구분해 편집자에게 보여 준다. 자동 수정은 하지 않는다.

```
scan(text) → matchRules(tokens, rules) → aggregate(matches, rules) → createResult(groups)
```

모든 단계는 **순수 함수**. 클래스 / Plugin / DI / Matcher 인터페이스는 두지 않는다 (YAGNI).

---

## 1. 전체 구조

### 1.1 파이프라인

| 단계 | 함수(가칭) | 입력 | 출력 |
|------|------------|------|------|
| 1 | `scan(text, dictionaries)` | 페이지 텍스트, 사전 | `Token[]` |
| 2 | `matchRules(tokens, rules, dictionaries)` | 토큰, Rule JSON | `Match[]` |
| 3 | `aggregate(matches, rules)` | Match, Rule의 `groupBy` | `AggGroup[]` |
| 4 | `createResult(groups, meta)` | 집계 결과 | UI/저장용 `NotationCheckResult` |

페이지 단위 실행 예:

```js
function runNotationCheck(pages, rules, dictionaries) {
  const allMatches = [];
  for (const page of pages) {
    const tokens = scan(page.text, dictionaries);
    const matches = matchRules(tokens, rules, dictionaries).map((m) => ({
      ...m,
      pageNum: page.pageNum,
    }));
    allMatches.push(...matches);
  }
  const groups = aggregate(allMatches, rules);
  return createResult(groups, { pageCount: pages.length });
}
```

### 1.2 레이어 경계

```
┌─ UI (표기 통일 탭 / 결과 패널) ─────────────────────┐
│  NotationCheckResult 만 소비. Rule·Scanner 모름.     │
└──────────────────────────▲──────────────────────────┘
                           │ createResult()
┌─ notation/ (신규 모듈, 순수 함수) ───────────────────┐
│  scan · matchRules · aggregate · createResult         │
│  rules/*.json · dict/*.json                           │
└──────────────────────────▲──────────────────────────┘
                           │ pageTexts[]
┌─ 기존 PDF 추출 ─────────────────────────────────────┐
│  pageTexts: { pageNum, text }[]                       │
└─────────────────────────────────────────────────────┘
```

- **UI ↔ Engine 단방향:** UI는 `runNotationCheck`와 결과 타입만 안다.
- **기존 `ruleEngine.js`와 분리:** 현재 엔진은 find/replace·정규식 규칙용. 숫자·단위는 토큰 시퀀스 + 집계가 핵심이므로 **별 모듈**로 둔다. 오픈베타에서는 Match 스키마만 공유한다.

**장기 리스크(명시):** 엔진을 나누면 규칙 저작이 **두 문법**으로 갈라진다 — (1) 기존 찾기/통일형의 정규식·문자열 규칙, (2) 본 모듈의 패턴 DSL. 편집자·기획 UX에서 “규칙을 어디에 어떻게 쓰는지” 혼선이 날 수 있다. 지금은 파이프라인 단순화를 위해 분리를 유지하되, 하우스 스타일·프로젝트 규칙을 한 화면에서 쓰게 되면 **저작 UX 통합 또는 DSL→정규식 어댑터**를 별도 과제로 검토한다 (이 문서 MVP 범위 밖).

### 1.3 제안 파일 배치 (구현 시)

```
src/lib/notation/
  scan.js
  matchRules.js
  aggregate.js
  createResult.js
  runNotationCheck.js
  patternCompile.js          # Rule.pattern → 토큰 시퀀스 매처
  spacingClassify.js         # 제43항·제44항 판정 헬퍼 (+ classify 디스패치 맵)
  resolveUnitHomograph.js    # 동형 단위 스캔 시점 선택 (§2.3)
src/data/notation/
  rules/
    number-unit.json
    man-unit-spacing.json
    symbols.json
  dict/
    numbers/
      arabic.json            # 패턴·예시 시드 (아라비아는 주로 regex)
      native-korean.json
      sino-korean.json
      ordinal-fraction.json  # 서수·분수·소수·범위·백분율 시드
    units/
      person.json
      object.json
      publish.json
      time-date.json
      measure.json           # 길이·무게·온도·SI
      currency.json
    symbols/
      symbols.json
```

> 이 사전·규칙은 **초기 시드**다. 완전 목록이 목표가 아니며, 실제 원고 스캔으로 확장하는 것을 전제로 한다.

---

## 2. Scanner 설계

### 2.1 역할

- 입력 문자열을 **겹치지 않는(또는 longest-match 우선)** 토큰 열로 변환한다.
- 형태소 분석기 없음. **정규식 + 사전 최장일치**.
- 실패 구간은 `UNKNOWN`으로 남기고 다음 문자로 진행한다 (스캔이 멈추지 않음).

### 2.2 스캔 알고리즘 (구현 스케치)

```
i = 0
while i < text.length:
  1) WHITESPACE / PUNCTUATION 단문자·연속 매칭
  2) SYMBOL 사전·정규식 (%, ‰, ℃, ℃, ±, ~, –, —, · 등)
  3) UNIT 사전 최장일치 (이미 숫자 뒤에 올 후보 — 단독 UNIT도 허용)
  4) NUMBER_ARABIC 정규식
  5) NUMBER_SINO_KOREAN 사전 최장일치 (이, 삼, …, 십, 백, 천, 만, 억…)
  6) NUMBER_NATIVE_KOREAN 사전 최장일치 (한, 두, 세, 네, 다섯…)
  7) 그 외 1글자 → UNKNOWN (또는 LETTER 묶음)
  i = token.end
```

**우선순위 이유**

- 기호·단위를 숫자보다 먼저 보면 `%`·`원`이 숫자 꼬리에 붙는 경우를 분리하기 쉽다.
- 한자어 수사와 고유어 수사가 겹치는 어휘는 거의 없으나, 충돌 시 **시드에 `priority`** 를 두고 높은 쪽을 택한다.

### 2.3 동형이의(同形異義) 단위 — 스캔 시점 disambiguation

표면형이 같고 `ordinalEligible`이 다른 단위(`장`, `분` 등)는 **사전 id만 분리해서는 부족**하다. `classify`(예: `unitSpacing43`)는 이미 붙은 `UNIT.meta.ordinalEligible`을 신뢰하므로, **스캔 시점에 어느 후보를 고를지**가 판정 정확도를 좌우한다.

#### 2.3.1 단위 사전 필드 (동형 후보용)

```json
{
  "id": "jang-sheet",
  "surface": ["장"],
  "ordinalEligible": false,
  "homographGroup": "jang",
  "sense": "sheet",
  "preferWhen": ["afterNativeQuantity", "afterArabicQuantity"]
}
```

```json
{
  "id": "jang-section",
  "surface": ["장"],
  "ordinalEligible": true,
  "homographGroup": "jang",
  "sense": "section",
  "preferWhen": ["afterJePrefix", "afterSinoOrdinalCue"]
}
```

`분`도 동일하게 `bun-person` / `bun-time`으로 나누고 `homographGroup: "bun"`을 둔다.

#### 2.3.2 선택 알고리즘 (문맥 윈도우, 형태소 분석 없음)

UNIT 최장일치로 **surface가 같은 후보가 2개 이상**이면:

1. **왼쪽 문맥** (직전 무시 가능: WHITESPACE)을 본다.  
   - 직전이 `제` + (NUMBER) → `jang-section` / 출판·조항 계열 우선.  
   - 직전이 `NUMBER_ARABIC` 또는 고유어 수량 수사(`한`/`두`/`세`…) → `jang-sheet`(수량형) 우선.  
   - 직전이 `시`/`시`+숫자 연쇄의 일부, 또는 `NUMBER` + (`시`) 뒤의 `분` → `bun-time`.  
   - 직전이 사람 수량 패턴(`명` 근처가 아님)만으로 `분`이 오면 → 1차는 **`bun-time` 우선**(출판 시각·분초가 더 흔함). `bun-person`은 오른쪽/왼쪽에 `모신`/`참석` 등 **시드 힌트 단어**가 있을 때만 (없으면 ambiguous).
2. **동점·힌트 없음** → `meta.ambiguous: true`로 토큰을 만들고,  
   - `error` 규칙에서는 **drop** (오탐 방지),  
   - `styleVariant` 혼용 집계에는 **넣지 않거나** `needsVerification` 배지만 로그.  
   - 개발 빌드에서 surface·좌우 20자를 샘플 로그로 남겨 시드·힌트를 보강한다.
3. **오른쪽 문맥**은 보조: `장` 뒤에 `원`/`짜리` 등이 오면 sheet 쪽 가중.

```
resolveUnitHomograph(candidates, leftTokens, rightPeek):
  scored = score each candidate by preferWhen vs leftTokens
  if unique max score: return that candidate
  return { ...fallbackCandidate, meta: { ambiguous: true } }
```

> MVP: `장`·`분`만 하드 규칙 표로 처리해도 된다. 새 동형이 생기면 `homographGroup` + `preferWhen` 시드만 늘린다. **형태소 분석기는 쓰지 않는다.**

### 2.4 페이지·위치

각 토큰에 `start`/`end`(페이지 텍스트 내 오프셋)를 넣는다. Match의 하이라이트는 기존 검수와 같이 `pageNum + start/end`로 연결한다.

---

## 3. Token 종류

```ts
type TokenType =
  | 'NUMBER_ARABIC'
  | 'NUMBER_NATIVE_KOREAN'
  | 'NUMBER_SINO_KOREAN'
  | 'UNIT'
  | 'SYMBOL'
  | 'WHITESPACE'
  | 'PUNCTUATION'
  | 'UNKNOWN';

type Token = {
  type: TokenType;
  start: number;
  end: number;
  text: string;
  /** 정규화 키 (집계·판정용). 없으면 text */
  normalized?: string;
  /** UNIT일 때 사전 메타 */
  meta?: {
    unitId?: string;
    ordinalEligible?: boolean;
    category?: string;
  };
};
```

### 3.1 식별 기준

| TokenType | 식별 방법 | 예시 |
|-----------|-----------|------|
| `NUMBER_ARABIC` | `/^\d{1,3}(?:,\d{3})*(?:\.\d+)?/` 또는 `/^\d+(?:\.\d+)?/` | `5`, `1,234`, `3.14` |
| `NUMBER_NATIVE_KOREAN` | 사전 최장일치 | `한`, `두`, `세`, `다섯`, `열`, `스물` |
| `NUMBER_SINO_KOREAN` | 사전 최장일치 (연속 결합 허용: `이백삼십육`) | `일`…`십`…`만`…`억` |
| `UNIT` | 단위 사전 최장일치 | `개`, `명`, `미터`, `층`, `학년` |
| `SYMBOL` | 기호 사전 + 소규모 regex | `%`, `℃`, `±`, `~` |
| `WHITESPACE` | `/\s+/` | 공백, NBSP |
| `PUNCTUATION` | `/[.,·∙\/\-–—()[\]「」『』""'']/` 등 | `,` `.` `·` |
| `UNKNOWN` | 위 실패 | 일반 한글·영문 덩어리 |

### 3.2 숫자 결합 (한자어)

한자어 수사는 토큰을 **글자 단위로 쪼개지 않고**, 사전 엔트리 + “수사 연쇄 규칙”으로 **한 토큰**을 만든다.

- 허용 연쇄: `(일\|이\|…\|구)?(십\|백\|천)?` 반복 + `(만\|억\|조\|경)?` …
- 스페이스가 끼면 **별 토큰**으로 끊고, 제44항 규칙이 간격 패턴을 본다.

### 3.3 NUMBER 묶음 타입 (패턴용)

Rule pattern에서 `NUMBER`는 다음의 합집합이다.

```
NUMBER := NUMBER_ARABIC | NUMBER_NATIVE_KOREAN | NUMBER_SINO_KOREAN
```

---

## 4. Rule JSON 구조

```ts
type RuleType = 'error' | 'styleVariant';

type NotationRule = {
  id: string;
  category: 'number' | 'unit' | 'symbol' | string;
  type: RuleType;           // 필수 — error | styleVariant
  title: string;
  enabled: boolean;
  pattern: string;          // 아래 §7 DSL
  groupBy: string;          // aggregate 키 경로/별칭 — §6
  message: string;
  /** 선택: 조문·검증 상태 */
  basis?: {
    ordinance?: string;     // 예: "한글 맞춤법 제43항"
    status?: 'confirmed' | 'needsVerification';
    note?: string;
  };
  /** 선택: pattern 매칭 후 추가 필터 (순수 함수 이름 키) */
  classify?: string;        // 예: "unitSpacing43", "manUnitSpacing44"
};
```

### 4.1 시드 규칙 예

**허용 혼용 — 같은 단위에 대한 숫자 표기 혼용**

```json
{
  "id": "number_unit_style",
  "category": "number",
  "type": "styleVariant",
  "title": "숫자+단위 표기 통일",
  "enabled": true,
  "pattern": "NUMBER + UNIT",
  "groupBy": "unit",
  "message": "같은 단위에 숫자 표기가 둘 이상 쓰였습니다. 원고 스타일을 통일할지 확인해 주세요.",
  "basis": {
    "ordinance": "한글 맞춤법 제43항 (허용 범위 내 표기 병존)",
    "status": "confirmed",
    "note": "아라비아/한글 수사·띄어/붙여가 규정 안에서 공존할 수 있음. 혼용 자체는 스타일 이슈."
  }
}
```

**오류 — 한글 수량형 단위 붙여쓰기 (한개, 칠미터)**

```json
{
  "id": "unit_spacing_native_quantity_error",
  "category": "unit",
  "type": "error",
  "title": "한글 수사+수량형 단위 붙여쓰기",
  "enabled": true,
  "pattern": "NUMBER_NATIVE_OR_SINO + UNIT",
  "groupBy": "surface",
  "classify": "unitSpacing43",
  "message": "단위를 나타내는 명사는 띄어 쓰는 것이 원칙입니다. 이 조합은 붙여쓰기가 허용되지 않습니다.",
  "basis": {
    "ordinance": "한글 맞춤법 제43항",
    "status": "confirmed"
  }
}
```

**오류 — 만 단위가 아닌 곳에서 띄어 쓴 수**

```json
{
  "id": "man_unit_spacing_error",
  "category": "number",
  "type": "error",
  "title": "만 단위 띄어쓰기",
  "enabled": true,
  "pattern": "SINO_NUMBER_RUN",
  "groupBy": "surface",
  "classify": "manUnitSpacing44",
  "message": "수를 적을 때는 만(萬) 단위로만 띄어 씁니다.",
  "basis": {
    "ordinance": "한글 맞춤법 제44항",
    "status": "confirmed",
    "note": "십·백·천 단위에서 띄운 표기는 styleVariant가 아니라 error."
  }
}
```

**기호 혼용**

```json
{
  "id": "percent_symbol_style",
  "category": "symbol",
  "type": "styleVariant",
  "title": "백분율 표기 통일",
  "enabled": true,
  "pattern": "NUMBER + (SYMBOL:% | UNIT:퍼센트 | LIT:퍼센트)",
  "groupBy": "concept:percent",
  "message": "백분율 표기(%, 퍼센트 등)가 혼용되어 있습니다.",
  "basis": {
    "status": "needsVerification",
    "note": "맞춤법상 오류라기보다 스타일 가이드 영역. 출판사 규정에 따름."
  }
}
```

---

## 5. Match 구조

모든 검사(향후 맞춤법·외래어·숫자·단위·기호·프로젝트 규칙)가 공유할 최소 공통 구조:

```ts
type Match = {
  ruleId: string;
  category: string;
  type: 'error' | 'styleVariant';
  start: number;
  end: number;
  text: string;          // 원문 그대로 (예: "5개", "세 개")
  normalized: string;    // 집계·비교용 (예: 숫자값+"|"+unitId, 공백 정규화)
  message: string;
  /** 구현 편의 — 공통 확장 필드 (UI는 몰라도 됨) */
  pageNum?: number;
  groupKey?: string;     // aggregate 전에 rule.groupBy로 채워도 됨
  meta?: Record<string, unknown>;
};
```

### 5.1 `normalized` 권장 규칙

| 상황 | normalized 예 |
|------|----------------|
| 숫자+단위 | `"5|unit:개"`, `"세|unit:개"` (숫자 표기 종류는 text에 보존) |
| 띄어쓰기만 다른 동일 의미 | 공백 제거 버전과 별도로 `spacing:attached\|spaced`를 meta에 |
| 기호 | `"symbol:percent"` |

`styleVariant` 집계는 **같은 `groupKey`(주로 unit)** 아래에서 **서로 다른 `text`(또는 spacing/numberKind)** 가 2종 이상일 때 “혼용”으로 올린다.

---

## 6. Aggregation 구조 (`groupBy` 반영)

### 6.1 `groupBy` 해석

엔진은 Rule의 `groupBy` 문자열만 읽고, **하드코딩된 단위 if문이 늘어나지 않게** 별칭 테이블로 해석한다.

```js
const GROUP_BY_RESOLVERS = {
  unit: (m) => m.meta?.unitId ?? m.normalized,
  surface: (m) => m.text,
  'concept:percent': (m) => 'percent',
  numberKind: (m) => m.meta?.numberKind,
  // 새 규칙: groupBy에 새 키를 쓰고 RESOLVERS에 한 줄 추가
};

function resolveGroupKey(match, rule) {
  const resolver = GROUP_BY_RESOLVERS[rule.groupBy];
  if (!resolver) {
    // 기본: meta[groupBy] 또는 normalized
    return String(match.meta?.[rule.groupBy] ?? match.normalized);
  }
  return String(resolver(match));
}
```

> 새 그룹핑이 필요하면 **리졸버 한 줄 + Rule JSON**만 추가. Matcher 클래스 없음.

### 6.2 집계 결과 타입

```ts
type AggVariant = {
  text: string;
  count: number;
  matches: Match[];     // 위치 목록 (하이라이트용)
};

type AggGroup = {
  ruleId: string;
  type: 'error' | 'styleVariant';
  groupKey: string;     // 예: "개", "percent"
  title: string;        // rule.title
  message: string;
  variants: AggVariant[];  // 빈도 내림차순
  /** styleVariant: variants.length >= 2 이고 의미상 혼용일 때 true */
  mixed: boolean;
  /** error: 규정 위반 Match만 모음 — mixed 개념 없음 */
};
```

### 6.3 표시 차이

| type | aggregate 동작 | UI 메시지 톤 |
|------|----------------|--------------|
| `styleVariant` | 같은 `groupKey` 아래 variant 종류 ≥ 2 → `mixed: true`로 **그룹 1개** 제시 | 「혼용되어 있습니다. 통일할지 편집자가 판단」 |
| `error` | Match 각각(또는 동일 surface끼리)을 **위반 목록**으로 제시. 빈도 집계는 UX용 | 「원칙상 허용되지 않는 표기입니다」 |

`styleVariant`에서 variant가 1종뿐이면 **결과에서 제외** (혼용이 아니므로).  
`error`는 1건이어도 **반드시 표시**.

### 6.4 표시 예시 (집계 후)

```
개  (rule: number_unit_style, type: styleVariant)
  세 개 (12)
  5개 (8)
  다섯 개 (3)
→ 혼용 발견

한개  (rule: unit_spacing_native_quantity_error, type: error)
  한개 (4)
→ 오류 (한 개가 원칙; 붙여쓰기 비허용)
```

---

## 7. Pattern 설계 (pattern ↔ 토큰 연결)

### 7.1 Pattern DSL (최소)

토큰 시퀀스를 공백/`+`로 나열한다. 옵션 공백은 `?`로 표기한다.

| DSL | 의미 |
|-----|------|
| `NUMBER` | ARABIC \| NATIVE \| SINO |
| `NUMBER_ARABIC` | 아라비아만 |
| `NUMBER_NATIVE_KOREAN` | 고유어만 |
| `NUMBER_NATIVE_OR_SINO` | NATIVE \| SINO |
| `NUMBER_SINO_KOREAN` | 한자어만 |
| `UNIT` | 단위 토큰 |
| `UNIT:개` | unitId/표기가 `개`인 UNIT |
| `SYMBOL:%` | 특정 기호 |
| `WHITESPACE?` | 공백 0~1 (띄어/붙여 모두) |
| `SINO_NUMBER_RUN` | 한자어 수사 토큰 + (WHITESPACE + 한자어)* 연속 구간 |

컴파일 예:

```
"NUMBER + UNIT"
→ 시퀀스:
  [NUMBER_ARABIC|NUMBER_NATIVE_KOREAN|NUMBER_SINO_KOREAN]
  , WHITESPACE?          // 암묵적 허용: 숫자와 단위 사이 공백 0~1
  , UNIT
```

명시적으로 쓰려면:

```
"NUMBER + WHITESPACE? + UNIT"
```

### 7.2 매칭 절차

1. `compilePattern(rule.pattern)` → `PatternAtom[]`
2. 토큰 배열을 슬라이딩하며 atom 시퀀스 매칭
3. 성공 시 span의 `text = text.slice(start,end)`, `normalized` 계산
4. `rule.classify`가 있으면 헬퍼로 **keep / drop / retarget type**  
   (예: 제43항 — 아라비아+단위 붙여쓰기는 error 규칙에서 drop)

### 7.3 `classify: "unitSpacing43"` (의사코드)

```
입력: NUMBER_* 토큰, 사이 공백 여부, UNIT.meta.ordinalEligible

if NUMBER_ARABIC:
  // 제43항 다만: 아라비아 숫자와 어울리면 붙여쓰기 허용
  // → error 규칙에서는 drop (styleVariant 규칙만 혼용 집계)
  return 'drop-from-error'

if NUMBER_NATIVE or NUMBER_SINO:
  if unit.ordinalEligible === true:
    // 층/학년 등: 붙여쓰기 허용 → error에서 drop
    return 'drop-from-error'
  else:
    // 수량형: 반드시 띄어 씀. 붙여쓰기면 keep error
    return spacing === 'attached' ? 'keep-error' : 'drop'
```

### 7.4 `classify: "manUnitSpacing44"` (의사코드)

```
한자어 수 표기 구간에서 공백 위치를 본다.
만/억/조/경 경계의 공백만 허용.

if 공백이 없거나, 공백이 만·억·조·경 경계에만 있음:
  return 'ok'  // error 규칙에서 drop
if 공백이 십·백·천 등 만 미만 단위 경계에 있음:
  return 'keep-error'  // 예: "이백 삼십육만 …"
if 완전 붙여쓰기 (만 경계조차 없음) && 금액 관례 패턴 아님:
  return 'needsVerification'  // Match를 내되 type을 올리기 전 basis.status로 UI 구분
                              // 또는 별도 rule type 없이 meta.verificationRequired=true
```

> **주의:** “이백 삼십육만 …”을 `styleVariant`로 넣지 않는다. **제44항 위반 = error**.

### 7.5 `classify` 레지스트리 — 복잡도 인식

`classify: "unitSpacing43"` 문자열은 `GROUP_BY_RESOLVERS`와 같은 **작은 디스패치 테이블**이다. 클래스/Plugin은 없지만, “클래스 없음 = 복잡도 없음”은 아니다.

| 단계 | 방침 |
|------|------|
| MVP | `unitSpacing43`, `manUnitSpacing44` **2개만**. 테이블을 `spacingClassify.js`의 객체 맵 한곳에 모은다. |
| 확장 | 조항이 늘면 **조항당 classify 1함수**를 같은 맵에 추가. 맵이 5개를 넘기 전에 “이 판정이 pattern+사전만으로 되는가?”를 한 번 재검토한다. |
| 금지 | classify 안에서 새 토큰 타입을 남발하거나, UI/페이지 I/O를 호출하지 않는다. |

### 7.6 Pattern DSL 한계 (의식적 최소)

지금 DSL은 시드 규칙 소수에 **맞춰진 최소 표현**이다.

- 있음: 토큰 나열, `WHITESPACE?`, `UNIT:…` / `SYMBOL:…`, `SINO_NUMBER_RUN` 같은 **이름 붙은 매크로**
- 없음: 일반 부정(negation), 임의 반복 `*`/`+`, 캡처 그룹

`SINO_NUMBER_RUN`처럼 케이스마다 전용 atom을 늘리면 DSL이 아니라 **특수 케이스 목록**이 된다.  
**가드레일:** 다섯 번째·여섯 번째 Rule을 추가할 때, 새 전용 atom 없이 기존 DSL(+classify)만으로 표현 가능한지 **반드시 시험**한다. 안 되면 (a) 매크로 1개 추가 정당성을 문서에 적거나 (b) 해당 규칙은 후순위로 미룬다.

---

## 8. Dictionary 설계 및 확장 전략

### 8.1 원칙

1. **구조 먼저, 완전 목록은 나중.**
2. 카테고리별 파일 분리 → 충돌·리뷰 단위를 작게.
3. 시드는 출판 실무 빈도 위주.
4. 원고에서 새 표기가 나오면 사전에 추가하는 워크플로를 전제로 한다.
5. `ordinalEligible`은 단위에 **필수** (제43항 분기).

### 8.2 공통 스키마

**단위 항목**

```json
{
  "id": "gae",
  "surface": ["개"],
  "category": "object",
  "ordinalEligible": false,
  "notes": "수량형. 한글 수사와는 띄어 씀(한 개). 아라비아+개 붙여쓰기 허용(10개)."
}
```

**고유어/한자어 수사 항목**

```json
{
  "id": "native-5",
  "surface": ["다섯"],
  "value": 5,
  "kind": "native"
}
```

**기호 항목**

```json
{
  "id": "percent",
  "surface": ["%"],
  "concept": "percent"
}
```

### 8.3 확장 전략

| 단계 | 행동 |
|------|------|
| 베타 | 시드만으로 검수. UNKNOWN+숫자 후보를 로그(선택) |
| 데이터 루프 | 실제 원고에서 자주 나온 UNIT/기호를 주 1회 시드에 반영 |
| 프로젝트 | 출판사 고유 단위는 프로젝트 `customRules`/프로젝트 사전으로 (후속) |

**명시:** 이 문서의 사전은 **초기 시드**이며, 실제 원고 데이터를 스캔하며 확장하는 것을 전제로 한다. 지금 단계에서 모든 단위·기호를 빠짐없이 조사하는 것이 목표가 아니다.

---

## 9. 숫자 시드 사전 (대표 항목만)

### 9.1 아라비아 (`dict/numbers/arabic.json`)

정규식 중심. 시드는 “인식 예시” 메타만.

```json
{
  "patterns": [
    { "id": "int", "regex": "^\\d+" },
    { "id": "grouped", "regex": "^\\d{1,3}(?:,\\d{3})+" },
    { "id": "decimal", "regex": "^\\d+\\.\\d+" }
  ],
  "examples": ["5", "10", "1,234", "3.14"]
}
```

### 9.2 고유어 수사 (`dict/numbers/native-korean.json`) — 시드

| surface | value | 비고 |
|---------|-------|------|
| 한 | 1 | *하나*는 의존명사 앞 관형사형과 구분 — 1차 시드는 `한` 우선 |
| 두 | 2 | |
| 세 / 서 | 3 | `서`는 “서 말” 등 — 단위와 결합 시만 강하게 |
| 네 / 너 | 4 | |
| 다섯 | 5 | |
| 여섯 | 6 | |
| 일곱 | 7 | |
| 여덟 | 8 | |
| 아홉 | 9 | |
| 열 | 10 | |
| 스물 | 20 | |
| 서른 | 30 | |
| 마흔 | 40 | |
| 쉰 | 50 | |

> 11–19(`열한`…) 결합 규칙은 스캐너 연쇄로 확장. 1차 시드는 위 표 + 단순 결합.

### 9.3 한자어 수사 (`dict/numbers/sino-korean.json`) — 시드

| surface | role |
|---------|------|
| 일 이 삼 사 오 육 칠 팔 구 | digit |
| 십 백 천 | small unit |
| 만 억 조 경 | man-boundary (제44항) |

### 9.4 서수·분수·소수·범위·백분율 (`dict/numbers/ordinal-fraction.json`) — 시드

| 종류 | 시드 예 | 상태 |
|------|---------|------|
| 서수 | `첫째`, `둘째`, `제1`, `1번째` | 제1+항 등과 연계 — 일부 **검증 필요** |
| 분수 | `1/2`, `이분의 일` | `-분` 접미사 붙여쓰기(국어원 QnA) — 분수 표기 혼용은 style |
| 소수 | `0.5`, `영점오` | |
| 범위 | `1~3`, `1-3`, `1–3` | 대시 종류 혼용 → symbol style |
| 백분율 | `50%`, `50퍼센트` | styleVariant |

---

## 10. 단위 시드 사전 (`ordinalEligible` 포함)

> `ordinalEligible: true` → 한글 수사와 **붙여쓰기 허용(순서형)**.  
> `false` → 한글 수사와는 **반드시 띄어 씀(수량형)**.  
> 아라비아 숫자와의 붙여쓰기는 제43항상 **단위 종류와 무관하게 허용**.

### 10.1 사람 (`units/person.json`)

| surface | ordinalEligible | 메모 |
|---------|-----------------|------|
| 명 | false | 10명/10 명 허용 혼용 |
| 분 (`bun-person`) | false | `분` 동형 — 스캔 disambiguation은 **§2.3** |
| 인 | false | |

### 10.2 사물 (`units/object.json`)

| surface | id | ordinalEligible | 메모 |
|---------|-----|-----------------|------|
| 개 | gae | false | |
| 병 | byeong | false | |
| 권 | gwon | false | |
| 장 | jang-sheet | false | 종이·장수. `jang-section`과 동형 — **§2.3** |
| 부 | bu | false | |
| 대 | dae | false | |
| 마리 | mari | false | |
| 채 | chae | false | |
| 켤레 | keolle | false | |
| 자루 | jaru | false | |
| 벌 | beol | false | |

### 10.3 출판 (`units/publish.json`)

| surface | id | ordinalEligible | 메모 |
|---------|-----|-----------------|------|
| 쪽 | jjok | false | |
| 페이지 | page | false | |
| 항 | hang | true | 제1항/제1 항 |
| 조 | jo | true | |
| 관 | gwan | true | |
| 호 | ho | true | 16동 502호 류 |
| 장 | jang-section | true | 제삼장 허용. `jang-sheet`와 동형 — **§2.3** |
| 절 | jeol | true | |
| 편 | pyeon | true | |

### 10.4 시간·날짜 (`units/time-date.json`)

| surface | ordinalEligible | 메모 |
|---------|-----------------|------|
| 년 | true* | 연월일 붙여쓰기: 한글 수사는 해설상 허용. 아라비아 연속 표기는 **검증 필요** |
| 월 | true* | 동일 |
| 일 | true* | 동일 |
| 시 | true | 두시 삼십분… — 순서/시각 |
| 분 (`bun-time`) | true | 시각의 분. `bun-person`과 동형 — **§2.3** (힌트 없으면 time 우선) |
| 초 | true | |
| 층 | true | 육층 |
| 학년 | true | 삼학년 |
| 학기 | true | |
| 호실 / 실습실 | true | 제1실습실 |

\*연월일: 국어원 해설에 한글 표기 원칙/허용 예가 있음. `2026년7월21일` 형태는 조문 예시를 이 문서에서 단정하지 않고 **검증 필요**.

### 10.5 길이·무게·온도·SI (`units/measure.json`)

| surface | ordinalEligible |
|---------|-----------------|
| 미터 / m / 미터 | false |
| 센티미터 / cm | false |
| 킬로미터 / km | false |
| 밀리미터 / mm | false |
| 그램 / g | false |
| 킬로그램 / kg | false |
| 도 / ℃ / ℉ | false |
| 평 | false |

> `칠미터` = 한글 수사 + 수량형 붙여쓰기 → **error**. `7미터`/`7 미터` = **허용 혼용(style)**.

### 10.6 통화 (`units/currency.json`)

| surface | ordinalEligible | 메모 |
|---------|-----------------|------|
| 원 | false | 80원 허용. 금액 한글 표기 붙여쓰기는 제44항 단서(관례) — **금액 전용 분기 검증 필요** |
| 달러 / 엔 / 유로 | false | |

---

## 11. 기호 사전 (`dict/symbols/symbols.json`)

종류가 상대적으로 유한하므로 시드를 넓게 잡되, 개념(`concept`)으로 묶어 혼용 집계한다.

| surface | concept | 비고 |
|---------|---------|------|
| % | percent | |
| ％ | percent | fullwidth |
| ‰ | permille | |
| ℃ | temperature | |
| ℉ | temperature | |
| ° | degree | |
| ± | plusminus | |
| + | plus | 문맥 주의 |
| − / - | minus | hyphen vs minus **검증/스타일** |
| ~ / ～ / ∼ | range | |
| – / — | range-or-dash | en/em dash |
| · / ∙ / • | middot | 목록·소수 중점 |
| / | slash | 분수·일자 |
| × / x / * | multiply | |
| ÷ | divide | |
| = | equals | |
| < > ≤ ≥ | compare | |
| & | amp | |
| # | hash | |
| @ | at | |
| ※ | reference | |
| ★ ☆ ● ○ ■ □ | bullet-deco | 스타일 |
| → ← ↔ | arrow | |
| … | ellipsis | |
| ₩ $ € ¥ | currency-symbol | UNIT ‘원’과 병행 |

---

## 12. 실제 원고 패턴 예시

| 원문 조각 | 토큰 개요 | 예상 판정 |
|-----------|-----------|-----------|
| `세 개` | NATIVE + WS + UNIT:개 | style 후보 (혼용 집계) |
| `5개` | ARABIC + UNIT:개 | style 후보 |
| `다섯 개` | NATIVE + WS + UNIT | style 후보 |
| `한개` | NATIVE + UNIT (붙여) | **error** (수량형) |
| `10명` / `10 명` | ARABIC ± WS + UNIT | style 혼용 가능 |
| `칠미터` | SINO + UNIT:미터 | **error** |
| `7미터` / `7 미터` | ARABIC ± WS + UNIT | style |
| `오층` / `오 층` | SINO + UNIT:층 | 허용 — error 제외, style 가능 |
| `제1항` / `제1 항` | (접두 제) + ARABIC + UNIT:항 | style |
| `이백삼십육만 칠천이백구십오` | SINO run, 만 경계 공백 | ok (제44항) |
| `이백 삼십육만 칠천이백구십오` | 만 앞 추가 공백 | **error** (제44항) |
| `이백삼십육만칠천이백구십오` | 완전 붙여 | **검증 필요** (금액 관례 제외) |
| `50%` / `50퍼센트` | NUMBER + SYMBOL/UNIT | styleVariant |
| `2026년 7월 21일` / `2026년7월21일` | 연월일 | **검증 필요** (단정 금지) |
| `1~3쪽` / `1-3쪽` | 범위 기호 혼용 | symbol style |

---

## 13. 오류 vs 허용 혼용 — 판단 기준·근거 조문

### 13.1 확정 (confirmed)

#### 한글 맞춤법 제43항 — 단위를 나타내는 명사는 띄어 쓴다

- **원칙:** `한 개`, `세 병`, `열 살`처럼 띄어 쓴다.
- **다만:** 순서를 나타내는 경우나 **(아라비아) 숫자와 어울리어 쓰이는 경우**에는 붙여 쓸 수 있다.
  - 예(규정·해설·온라인가나다): `10개`, `7미터`, `80원`, `삼학년`, `육층`, `제1실습실`, `2대대` 등.

**엔진 반영**

| 조합 | 붙여쓰기 | 판정 |
|------|----------|------|
| 아라비아 + 임의 UNIT | 허용 | error 아님. 띄어/붙여 공존 → **styleVariant** |
| 한글 수사 + `ordinalEligible:true` | 허용 | error 아님. 혼용 시 styleVariant |
| 한글 수사 + `ordinalEligible:false` | **비허용** | **error** (`한개`, `칠미터`) |

참고: 국어원 온라인가나다·맞춤법 해설(단위 명사 띄어쓰기).

#### 한글 맞춤법 제44항 — 수는 ‘만’ 단위로 띄어 쓴다

- 원칙 예: `십이억 삼천사백오십육만 칠천팔백구십팔`, `이백삼십육만 칠천이백구십오`.
- 십·백·천 단위로 잘게 띄우는 표기는 규정에 맞지 않음 → **error** (styleVariant로 분류 금지).
- **다만:** 금액을 적을 때 변조 방지 등으로 **붙여 쓰는 관례**가 있다는 단서 존재 → 금액 전용 패턴은 별도 분기, 일반 수 표기에 함부로 적용하지 않음.

### 13.2 검증 필요 (needsVerification)

| 항목 | 이유 | 엔진 태도 |
|------|------|-----------|
| `2026년7월21일` 등 아라비아 연월일 붙여쓰기 | 사용자 요청·문서 합의: 명확 조문 인용 전까지 단정 금지. (한글 연월일 원칙/허용은 해설에 존재) | Match 생성 시 `basis.status: needsVerification` 또는 규칙 비활성 기본 |
| 한자어 수 **완전 붙여쓰기** (만 경계 없음, 비금액) | 조문만으로 실무 허용 여부 단정 어려움 | 동일 |
| `분`·`장` 동형 단위 | 사전 id만으로는 부족 | **§2.3** 문맥 스코어. 동점이면 ambiguous → error drop |
| `%` vs `퍼센트` 혼용 | 맞춤법 오류라기보다 하우스 스타일 | styleVariant + needsVerification 가능 |
| 하이픈/en-dash/물결 범위 기호 | 출판사 규정 의존 | styleVariant |
| 금액 한글 표기 붙여쓰기 범위 | 제44항 단서(관례) — 적용 범위 확인 필요 | 금액 키워드(`일금`, `원정`) 있을 때만 예외 후보 |

### 13.3 직관으로 만들지 말 것

- “느낌상 어색함”만으로 `error` 부여 금지.
- 새 예시는 **조문·국어원 답변 URL/인용**을 `basis`에 남긴 뒤 `confirmed`로 승격.

---

## 14. 향후 확장 가능한 구조

| 확장 | 방법 (YAGNI 유지) |
|------|-------------------|
| 새 단위 | `dict/units/*.json`에 항목 + `ordinalEligible` |
| 새 혼용 규칙 | Rule JSON 추가 + 필요 시 `GROUP_BY_RESOLVERS` 1줄 |
| 프로젝트 하우스 스타일 | Rule을 프로젝트에 override (`enabled`, 추가 groupBy) — UI는 결과만 |
| 맞춤법·외래어와 Match 공유 | 동일 `Match` 타입으로 결과 패널 통합 |
| 확정 대장 연동 | `styleVariant` 그룹에서 편집자 확정 시 `consistencyDecisions`에 append ([기존 스키마](./consistency-decisions-schema.md)) |
| 성능 | 페이지 단위 scan, UNIT 사전 trie, Rule은 enabled만 컴파일 캐시 |
| 검증 필요 해소 | `basis.status`만 `confirmed`로 바꾸고 classify 조정 — 엔진 골격 불변 |

### 14.1 의도적으로 하지 않는 것 (오픈베타)

- Plugin / Matcher 인터페이스 / DI 컨테이너
- 형태소 분석기·외부 NLP API
- 자동 치환·원클릭 일괄 수정
- 모든 SI·고전문헌 단위의 완전 수록

### 14.2 기존 인디야와의 연결 (구현 시점)

- 진입: 표기 통일 탭의 **새 구분**(또는 “숫자·단위·기호”) — 기존 찾기/통일형/본보조와 **병렬**.
- 결과: 기존 하이라이트·결과 목록 스키마에 `type: error | styleVariant` 배지만 추가.
- 할당량: 표기 통일 검수 횟수에 포함할지 여부는 제품 결정(이 문서 범위 밖).
- 규칙 저작 UX 이중화 리스크는 **§1.2** 참고.

---

## 15. 구현 체크리스트 (우선순위)

### MVP (1차 — confirmed 규칙만 켜기)

| # | 항목 | 완료 |
|---|------|------|
| M1 | `scan` + 토큰 단위 테스트 (제43/44 **confirmed** 예시) | [ ] |
| M2 | 동형 단위 disambiguation (`장`·`분`) — §2.3 + 테스트 | [ ] |
| M3 | `patternCompile` + `NUMBER + UNIT` | [ ] |
| M4 | `unitSpacing43` / `manUnitSpacing44` (confirmed 경로만) | [ ] |
| M5 | `aggregate` — styleVariant 혼용만 노출, error 단건 노출 | [ ] |
| M6 | 시드 JSON 로드. **`basis.status !== 'confirmed'` 규칙은 `enabled: false` 기본** | [ ] |
| M7 | `runNotationCheck` → UI 어댑터 (error / styleVariant 배지) | [ ] |

> **안전 기본값:** 연월일 붙여쓰기·금액 완전붙여·기타 `needsVerification` 항목은 국어원 온라인가나다 등으로 근거를 확보해 `confirmed`로 올리기 전까지 **규칙을 비활성**으로 둔다. 켜더라도 UI에 “검증 필요” 배지를 붙인다.

### 이후 (2차)

| # | 항목 | 완료 |
|---|------|------|
| L1 | `needsVerification` 배지 UI + 비활성 규칙 목록 관리 | [ ] |
| L2 | 실제 원고 1종으로 시드 갭·동형 ambiguous 로그 리뷰 | [ ] |
| L3 | 5·6번째 Rule 추가 시 DSL 표현력 시험 (§7.6) | [ ] |
| L4 | 기존 ruleEngine과의 저작 UX 통합 여부 제품 결정 | [ ] |

---

## 부록 A. 참고 링크

- 한글 맞춤법 (국어원 규범): `regltn_code=0001`
- 온라인가나다 — 제43항 관련 QnA (단위 명사 띄어쓰기 해설 인용)
- 온라인가나다 — 제44항 관련 QnA (만 단위 띄어쓰기·금액 관례)

## 부록 B. 용어

| 용어 | 의미 |
|------|------|
| error | 규정상 허용되지 않는 표기 (편집자에게 “고쳐야 할 후보”로 강하게 제시) |
| styleVariant | 규정상 둘 다 허용되거나 스타일 선택의 문제 — **혼용**을 보여 줌 |
| ordinalEligible | 해당 단위가 제43항 “순서” 예외를 한글 수사와 함께 받을 수 있는지 |
| groupBy | 집계 키. 엔진은 리졸버로만 해석 |
