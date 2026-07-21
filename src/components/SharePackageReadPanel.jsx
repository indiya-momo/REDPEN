/**
 * 공유 패키지 읽기 전용 구역 — 발신 미리보기·수신 화면 공통.
 * ProjectHubSettingsPanel은 사용하지 않는다.
 */
import { useMemo, useState } from 'react';
import {
  isConsistencyEntryEnabled,
  listConsistencyLiteralEntries,
} from '../lib/compoundPairRegister.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
  listConsistencyUnifyEntries,
} from '../lib/consistencyRuleLimit.js';
import { getConsistencyUnifyPinnedTailWord } from '../lib/consistencyUnifyRegister.js';
import { PROJECT_HUB_TOGGLE_CRITERIA } from '../lib/projectHubCriteriaSections.js';
import './share-package-read.css';

/** @typedef {'meta' | 'spelling' | 'consistency' | 'auxiliary' | 'actions'} SharePackageSection */

export const SHARE_PACKAGE_NAV_ITEMS = [
  { id: 'meta', label: '프로젝트 정보' },
  { id: 'spelling', label: '맞춤법', pillar: 'spelling' },
  { id: 'consistency', label: '표기 통일', pillar: 'consistency' },
  { id: 'auxiliary', label: '본용언 + 보조용언', pillar: 'auxiliary' },
  { id: 'actions', label: '작업 이력' },
];

/**
 * @param {{
 *   card: import('../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   ruleSet: import('../lib/ruleSetsStorage.js').RuleSet,
 *   checkResults?: Array<Record<string, unknown>>,
 *   checkResultsLoading?: boolean,
 *   actionsLead?: string,
 *   navAriaLabel?: string,
 * }} props
 */
export default function SharePackageReadPanel({
  card,
  ruleSet,
  checkResults = [],
  checkResultsLoading = false,
  actionsLead = '공유 패키지에 담긴 검수 결과 목록입니다. 다운로드는 제공하지 않습니다.',
  navAriaLabel = '공유 구역',
}) {
  const [section, setSection] = useState(
    /** @type {SharePackageSection} */ ('meta'),
  );

  const consistencyGroups = useMemo(() => {
    const customRules = ruleSet?.customRules ?? [];
    const pinnedTailWord = getConsistencyUnifyPinnedTailWord(customRules);
    return [
      {
        label: LITERAL_FIND_FEATURE_LABEL,
        chips: listConsistencyLiteralEntries(customRules).map((entry) => ({
          label: entry.tailWord,
          active: isConsistencyEntryEnabled(customRules, entry.tailWord),
          pinned: false,
        })),
      },
      {
        label: UNIFY_FEATURE_LABEL,
        chips: listConsistencyUnifyEntries(customRules).map((entry) => ({
          label: entry.tailWord,
          active: isConsistencyEntryEnabled(customRules, entry.tailWord),
          pinned: pinnedTailWord === entry.tailWord,
        })),
      },
    ];
  }, [ruleSet]);

  const auxiliaryEntries = useMemo(() => {
    const cfg = PROJECT_HUB_TOGGLE_CRITERIA.auxiliary;
    const customRules = ruleSet?.customRules ?? [];
    return cfg.listEntries(customRules).map((row) => ({
      label: row.displayLabel || row.tailWord,
      active: cfg.isEnabled(customRules, row),
    }));
  }, [ruleSet]);

  return (
    <div className="share-receive">
      <nav className="share-receive__nav" aria-label={navAriaLabel}>
        <ul className="share-receive__nav-list">
          {SHARE_PACKAGE_NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={[
                  'share-receive__nav-btn',
                  section === item.id ? 'share-receive__nav-btn--active' : '',
                  item.pillar ? `share-receive__nav-btn--${item.pillar}` : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() =>
                  setSection(/** @type {SharePackageSection} */ (item.id))
                }
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="share-receive__main">
        {section === 'meta' ? (
          <div className="share-receive__card">
            <ReadRow label="제목" desc="프로젝트 제목" value={card.title} />
            <ReadRow
              label="태그"
              desc="쉼표로 구분 · 최대 3개"
              value={(card.tags ?? []).join(', ') || '—'}
            />
            <ReadRow
              label="그 외 정보"
              desc="예: 신국판, 3교"
              value={card.formatLabel || '—'}
            />
            <ReadRow label="메모" value={card.memo || '—'} multiline />
          </div>
        ) : null}

        {section === 'spelling' ? (
          <div className="share-receive__card">
            <p className="share-receive__lead">
              공유 패키지에 포함된 맞춤법 기준 요약입니다
            </p>
            <div className="share-receive__stats">
              <span>
                편집자 검토 필요{' '}
                <strong>{card.counts?.editorReview ?? 0}건</strong>
              </span>
              <span>
                맞춤법 규칙 <strong>{card.counts?.spelling ?? 0}건</strong>
              </span>
            </div>
            {card.pillarMemos?.spelling ? (
              <ReadRow
                label="메모"
                value={card.pillarMemos.spelling}
                multiline
              />
            ) : null}
          </div>
        ) : null}

        {section === 'consistency' ? (
          <div className="share-receive__card">
            <p className="share-receive__lead">
              공유 패키지에 포함된 표기 통일 기준입니다
            </p>
            {consistencyGroups.map((group) => (
              <div key={group.label} className="share-receive__group">
                <span className="share-receive__group-label">{group.label}</span>
                {group.chips.length ? (
                  <div className="share-receive__chips">
                    {group.chips.map((chip, index) => (
                      <span
                        key={`${chip.label}-${index}`}
                        className={[
                          'share-receive__chip',
                          chip.active ? '' : 'share-receive__chip--off',
                          chip.pinned ? 'share-receive__chip--pinned' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {chip.label}
                        {chip.pinned ? ' 📌' : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="share-receive__empty">—</span>
                )}
              </div>
            ))}
            {card.pillarMemos?.consistency ? (
              <ReadRow
                label="메모"
                value={card.pillarMemos.consistency}
                multiline
              />
            ) : null}
          </div>
        ) : null}

        {section === 'auxiliary' ? (
          <div className="share-receive__card">
            <p className="share-receive__lead">
              공유 패키지에 포함된 본용언·보조용언 기준입니다
            </p>
            {auxiliaryEntries.length ? (
              <div className="share-receive__chips">
                {auxiliaryEntries.map((entry) => (
                  <span
                    key={entry.label}
                    className={[
                      'share-receive__chip',
                      entry.active ? '' : 'share-receive__chip--off',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {entry.label}
                  </span>
                ))}
              </div>
            ) : (
              <span className="share-receive__empty">—</span>
            )}
            {card.pillarMemos?.auxiliary ? (
              <ReadRow
                label="메모"
                value={card.pillarMemos.auxiliary}
                multiline
              />
            ) : null}
          </div>
        ) : null}

        {section === 'actions' ? (
          <div className="share-receive__card">
            <p className="share-receive__lead">{actionsLead}</p>
            {checkResultsLoading ? (
              <p className="share-receive__empty" role="status">
                검수 이력을 불러오는 중…
              </p>
            ) : checkResults.length ? (
              <ul className="share-receive__results">
                {checkResults.map((item, index) => {
                  const kind =
                    item.kind === 'consistency' ? '표기 통일' : '맞춤법';
                  const when = Number(item.createdAt);
                  let whenLabel = '-';
                  if (Number.isFinite(when) && when > 0) {
                    try {
                      whenLabel = new Date(when).toLocaleString('ko-KR', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    } catch {
                      whenLabel = '-';
                    }
                  }
                  const rowCount = Number(
                    item.rowCount ??
                      (Array.isArray(item.rows) ? item.rows.length : 0),
                  );
                  return (
                    <li key={String(item.id ?? `r-${index}`)}>
                      <strong>{kind}</strong>
                      <span>
                        {whenLabel}
                        {Number.isFinite(rowCount) && rowCount > 0
                          ? ` · ${rowCount}건`
                          : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="share-receive__empty">
                포함된 검수 결과가 없습니다.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * @param {{ label: string, desc?: string, value: string, multiline?: boolean }} props
 */
function ReadRow({ label, desc, value, multiline = false }) {
  return (
    <div className="share-receive__row">
      <div className="share-receive__row-text">
        <span className="share-receive__row-label">{label}</span>
        {desc ? <p className="share-receive__row-desc">{desc}</p> : null}
      </div>
      {multiline ? (
        <p className="share-receive__value share-receive__value--memo">{value}</p>
      ) : (
        <p className="share-receive__value">{value}</p>
      )}
    </div>
  );
}
