/**
 * 공유 패키지 읽기 전용 구역 — 발신 미리보기·수신 화면 공통.
 * 나의 프로젝트 설정과 같은 project-hub-settings 마크업·칩 클래스를 쓴다.
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
import { resultPillarToneClass } from '../lib/resultPillarTone.js';
import { buildProjectWorkSummary } from '../presentation/projectWorkSummary.js';
import './project-hub-settings.css';
import './share-package-read.css';

/** @typedef {'meta' | 'spelling' | 'consistency' | 'auxiliary' | 'actions'} SharePackageSection */

export const SHARE_PACKAGE_NAV_ITEMS = [
  { id: 'meta', label: '프로젝트 정보' },
  { id: 'spelling', label: '맞춤법', pillar: 'spelling' },
  { id: 'consistency', label: '표기 통일', pillar: 'consistency' },
  { id: 'auxiliary', label: '본용언 + 보조용언', pillar: 'auxiliary' },
  { id: 'actions', label: '작업 이력' },
];

const ACTIONS_CHECK_RESULTS_DESC =
  '검수 이력 다운받기는 유료회원만 가능합니다';

/**
 * @param {{
 *   card: import('../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   ruleSet: import('../lib/ruleSetsStorage.js').RuleSet,
 *   checkResults?: Array<Record<string, unknown>>,
 *   checkResultsLoading?: boolean,
 *   navAriaLabel?: string,
 * }} props
 */
export default function SharePackageReadPanel({
  card,
  ruleSet,
  checkResults = [],
  checkResultsLoading = false,
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
        tone: /** @type {const} */ ('consistency-literal'),
        chips: listConsistencyLiteralEntries(customRules).map((entry) => ({
          label: entry.tailWord,
          active: isConsistencyEntryEnabled(customRules, entry.tailWord),
          pinned: false,
        })),
      },
      {
        label: UNIFY_FEATURE_LABEL,
        tone: /** @type {const} */ ('consistency-unify'),
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

  const workSummary = useMemo(() => {
    const fromSet = buildProjectWorkSummary(ruleSet?.projectContext);
    if (fromSet) return fromSet;

    let latestAt = 0;
    let pdfFileName = '';
    for (const item of checkResults) {
      const createdAt = Number(item.createdAt);
      if (Number.isFinite(createdAt) && createdAt > latestAt) {
        latestAt = createdAt;
      }
      if (
        !pdfFileName &&
        typeof item.pdfFileName === 'string' &&
        item.pdfFileName
      ) {
        pdfFileName = item.pdfFileName;
      }
    }
    if (!latestAt && !pdfFileName) return null;
    return buildProjectWorkSummary({
      lastWorkedAt: latestAt > 0 ? new Date(latestAt).toISOString() : undefined,
      pdfFileName: pdfFileName || undefined,
    });
  }, [ruleSet, checkResults]);

  const checkCountLabel = checkResultsLoading
    ? '…'
    : `${checkResults.length}건`;

  return (
    <div className="project-hub-settings project-hub-settings--share">
      <div className="project-hub-settings__layout">
        <nav className="project-hub-settings__nav" aria-label={navAriaLabel}>
          <ul className="project-hub-settings__nav-list">
            {SHARE_PACKAGE_NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={[
                    'project-hub-settings__nav-btn',
                    section === item.id
                      ? 'project-hub-settings__nav-btn--active'
                      : '',
                    item.pillar
                      ? `project-hub-settings__nav-btn--${item.pillar}`
                      : '',
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

        <div className="project-hub-settings__main">
          {section === 'meta' ? (
            <div className="project-hub-settings__card">
              <MetaReadRow
                label="제목"
                desc="프로젝트 제목"
                value={card.title || '—'}
              />
              <MetaReadRow
                label="태그"
                desc="쉼표로 구분 · 추가 가능"
                value={(card.tags ?? []).join(', ') || '—'}
              />
              <MetaReadRow
                label="그 외 정보"
                desc="예: 신국판, 3교"
                value={card.formatLabel || '—'}
              />
              <MetaReadRow
                label="메모"
                value={card.memo || '—'}
                multiline
              />
            </div>
          ) : null}

          {section === 'spelling' ? (
            <div className="project-hub-settings__criteria project-hub-settings__criteria--single">
              <section
                className="project-hub-settings__criteria-section project-hub-settings__criteria-section--spelling"
                aria-label="맞춤법"
              >
                <div className="project-hub-settings__criteria-head">
                  <h3 className="project-hub-settings__criteria-title visually-hidden">
                    맞춤법
                  </h3>
                  <div
                    className="project-hub-settings__criteria-stats results-header__stats"
                    aria-label="맞춤법 항목 수"
                  >
                    <span className="results-header__stat">
                      <span
                        className={`results-header-badge ${resultPillarToneClass('spelling-caution')}`}
                      >
                        편집자 검토 필요
                      </span>
                      <span className="results-header__stat-count">
                        {card.counts?.editorReview ?? 0}건
                      </span>
                    </span>
                    <span className="results-header__stat">
                      <span
                        className={`results-header-badge ${resultPillarToneClass('spelling-builtin')}`}
                      >
                        맞춤법 규칙
                      </span>
                      <span className="results-header__stat-count">
                        {card.counts?.spelling ?? 0}건
                      </span>
                    </span>
                  </div>
                </div>
                <p className="project-hub-settings__criteria-lead">
                  공유 패키지에 포함된 맞춤법 기준 요약입니다
                </p>
                {card.pillarMemos?.spelling ? (
                  <MetaReadRow
                    label="메모"
                    value={card.pillarMemos.spelling}
                    multiline
                  />
                ) : null}
              </section>
            </div>
          ) : null}

          {section === 'consistency' ? (
            <div className="project-hub-settings__criteria project-hub-settings__criteria--single">
              <section
                className="project-hub-settings__criteria-section project-hub-settings__criteria-section--consistency"
                aria-label="표기 통일"
              >
                <p className="project-hub-settings__criteria-lead">
                  공유 패키지에 포함된 표기 통일 기준입니다
                </p>
                <ul className="project-hub-settings__criteria-groups">
                  {consistencyGroups.map((group) => (
                    <li
                      key={group.label}
                      className="project-hub-settings__criteria-group"
                    >
                      <span
                        className={`results-header-badge project-hub-settings__criteria-group-badge ${resultPillarToneClass(group.tone)}`}
                      >
                        {group.label}
                      </span>
                      {group.chips.length ? (
                        <span className="project-hub-settings__criteria-chips">
                          {group.chips.map((chip, index) => (
                            <span
                              key={`${chip.label}-${index}`}
                              className={[
                                'project-hub-settings__criteria-chip',
                                chip.active
                                  ? ''
                                  : 'project-hub-settings__criteria-chip--off',
                                chip.pinned
                                  ? 'project-hub-settings__criteria-chip--pinned'
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                            >
                              {chip.label}
                              {chip.pinned ? (
                                <span
                                  className="project-hub-settings__criteria-chip-pin"
                                  aria-label="통일형"
                                >
                                  📌
                                </span>
                              ) : null}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="project-hub-settings__criteria-empty">
                          —
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {card.pillarMemos?.consistency ? (
                  <MetaReadRow
                    label="메모"
                    value={card.pillarMemos.consistency}
                    multiline
                  />
                ) : null}
              </section>
            </div>
          ) : null}

          {section === 'auxiliary' ? (
            <div className="project-hub-settings__criteria project-hub-settings__criteria--single">
              <section
                className="project-hub-settings__criteria-section project-hub-settings__criteria-section--auxiliary"
                aria-label="본용언 + 보조용언"
              >
                <p className="project-hub-settings__criteria-lead">
                  공유 패키지에 포함된 본용언·보조용언 기준입니다
                </p>
                {auxiliaryEntries.length ? (
                  <span className="project-hub-settings__criteria-chips">
                    {auxiliaryEntries.map((entry) => (
                      <span
                        key={entry.label}
                        className={[
                          'project-hub-settings__criteria-chip',
                          entry.active
                            ? ''
                            : 'project-hub-settings__criteria-chip--off',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {entry.label}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="project-hub-settings__criteria-empty">—</span>
                )}
                {card.pillarMemos?.auxiliary ? (
                  <MetaReadRow
                    label="메모"
                    value={card.pillarMemos.auxiliary}
                    multiline
                  />
                ) : null}
              </section>
            </div>
          ) : null}

          {section === 'actions' ? (
            <div className="project-hub-settings__card project-hub-settings__card--work-summary">
              {!workSummary ? (
                <div className="project-hub-settings__row project-hub-settings__row--readonly">
                  <p className="project-hub-settings__row-desc">
                    아직 작업 기록이 없습니다.
                  </p>
                </div>
              ) : (
                <>
                  <div className="project-hub-settings__row project-hub-settings__row--readonly">
                    <div className="project-hub-settings__row-text">
                      <span className="project-hub-settings__row-label">
                        마지막 작업
                      </span>
                    </div>
                    <span className="project-hub-settings__value">
                      {workSummary.lastWorked}
                    </span>
                  </div>
                  <div className="project-hub-settings__row project-hub-settings__row--readonly">
                    <div className="project-hub-settings__row-text">
                      <span className="project-hub-settings__row-label">
                        PDF 정보
                      </span>
                    </div>
                    <span className="project-hub-settings__value">
                      {workSummary.pdf}
                    </span>
                  </div>
                </>
              )}

              <div className="project-hub-settings__check-results-embedded">
                <div className="project-hub-settings__row project-hub-settings__row--readonly project-hub-settings__row--check-results-head">
                  <div className="project-hub-settings__row-text">
                    <span className="project-hub-settings__row-label">
                      저장된 검수 결과
                    </span>
                    <p className="project-hub-settings__row-desc">
                      {ACTIONS_CHECK_RESULTS_DESC}
                    </p>
                  </div>
                  <div className="project-hub-check-results__download-box">
                    <span className="project-hub-check-results__download-count">
                      {checkCountLabel}
                    </span>
                    <button
                      type="button"
                      className="project-hub-settings__secondary-btn project-hub-settings__secondary-btn--check-results"
                      disabled
                      title={ACTIONS_CHECK_RESULTS_DESC}
                    >
                      검수 이력 다운받기
                    </button>
                  </div>
                </div>
                {checkResultsLoading ? (
                  <p
                    className="project-hub-settings__row-desc"
                    role="status"
                  >
                    검수 이력을 불러오는 중…
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{ label: string, desc?: string, value: string, multiline?: boolean }} props
 */
function MetaReadRow({ label, desc, value, multiline = false }) {
  return (
    <div
      className={[
        'project-hub-settings__row',
        multiline ? 'project-hub-settings__row--memo' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="project-hub-settings__row-text">
        <span className="project-hub-settings__row-label">{label}</span>
        {desc ? (
          <p className="project-hub-settings__row-desc">{desc}</p>
        ) : null}
      </div>
      {multiline ? (
        <p className="project-hub-settings__input project-hub-settings__textarea share-package-read__readonly-field">
          {value}
        </p>
      ) : (
        <p className="project-hub-settings__input project-hub-settings__input--wide share-package-read__readonly-field">
          {value}
        </p>
      )}
    </div>
  );
}
