# 표기통일 잡음 리스트 시트 sync

맞춤법·주의 시트와 같이 **시트를 편집본**으로 두고, 앱 런타임은 `src/data/unify-noise-list.json`만 읽습니다. (앱이 시트를 실시간 fetch하지 않음)

## 열 (탭 이름 기본 `unify_noise_list`)

| 열 | sync | 설명 |
|----|------|------|
| `kind` | ✅ | `exception` · `verbal` · `copula` · `hagoJc` |
| `surface` | ✅ | 한글 표면 (공백·기호는 sync 시 제거) |
| `kiwi_pattern` | 참고 | 이 kind가 가리키는 Kiwi / tagTemplates 패턴 |
| `kiwi_morph` | 참고 | 실제 Kiwi 분석 (`형태/태그+…`). export 시 모델로 채움 |
| `kiwi_role` | 참고 | **행별** morph를 한글 태그로 풀어쓴 설명 + kind 일치/불일치 (export 시 생성) |
| `note` | 메모 | 출처·검수 메모 (JSON에는 아직 안 넣음) |
| `enabled` | ✅ | 비우거나 `Y` = 포함. `N` / `false` = 제외 |

### kind ↔ Kiwi

| kind | JSON | Kiwi / tagTemplates |
|------|------|---------------------|
| `exception` | `exceptionEojeols` | 닫힌 표면 Set. NNG여도 복합 성분 아님(MAG·NP·NNB…) |
| `verbal` | `verbalTails` | `NNG+(XSV\|VV\|VX)+E*` · `noun-verbal-connective` |
| `copula` | `copulaTails` | `N*+VCP+(EF\|EC)` · `copula-ending` |
| `hagoJc` | `hagoJcTails` | `NNG+하고/JC` · `noun-hago-jc` |

`kiwi_morph` 예: `대부분/MAG`, `있/VV+다고/EC`, `이/VCP+고/EC`

## 명령

```bash
# 1) 현재 JSON → 시드 엑셀 (Kiwi 형태소 열 포함, 모델: tmp/kiwi-models)
npm run export-unify-noise-list-sheet

# 형태소 없이 빠르게
npm run export-unify-noise-list-sheet -- --no-kiwi

# 2a) 구글 시트 → JSON
npm run sync-unify-noise-list

# 2b) 로컬 엑셀 / CSV
npm run sync-unify-noise-list -- --xlsx=project-docs/unify-noise-list-sheet.xlsx

# 3) 회귀
npx vitest run src/lib/unifyNoiseList.test.js src/lib/unifyNoiseRegressionCorpus.test.js
```

`.env` 예:

```
SPREADSHEET_ID=…
UNIFY_NOISE_SHEET=unify_noise_list
# 또는 UNIFY_NOISE_GID=
```

## 역할 분담

| 경로 | 역할 |
|------|------|
| 시트 sync | 사람이 확정한 예외·꼬리 목록 |
| `kiwi:harvest-noise-list` | Kiwi로 후보 표면 제안 후 JSON/`--add` |
| 회귀 코퍼스 JS | KEEP/DROP 가드 (시트가 덮지 않음) |

시트를 「링크 있는 사용자 · 보기」로 두어야 CSV export가 됩니다 (맞춤법 sync와 동일).
