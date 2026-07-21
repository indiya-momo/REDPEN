import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  MAX_PROJECT_FORMAT_LABEL_LENGTH,
  MAX_PROJECT_PILLAR_MEMO_LENGTH,
  normalizeProjectMemo,
  normalizeProjectPillarMemos,
  normalizeProjectTags,
} from '../lib/projectMeta.js';
import { buildProjectWorkSummary } from '../presentation/projectWorkSummary.js';
import ProjectHubCriteriaPanel from './projectHub/ProjectHubCriteriaPanel.jsx';
import ProjectHubCheckResultsPanel from './projectHub/ProjectHubCheckResultsPanel.jsx';
import ProjectWorkHistoryChart from './projectHub/ProjectWorkHistoryChart.jsx';
import './project-hub-settings.css';

/** @typedef {'meta' | 'spelling' | 'consistency' | 'auxiliary' | 'actions'} ProjectHubSettingsSection */

const NAV_ITEMS = [
  { id: 'meta', label: '프로젝트 정보' },
  { id: 'spelling', label: '맞춤법', pillarKey: 'spelling' },
  { id: 'consistency', label: '표기 통일', pillarKey: 'consistency' },
  { id: 'auxiliary', label: '본용언 + 보조용언', pillarKey: 'auxiliary' },
  { id: 'actions', label: '작업 이력' },
];

const CRITERIA_SECTIONS = new Set(['spelling', 'consistency', 'auxiliary']);
/** 메타 자동 저장이 도는 섹션 — 기둥별 메모가 있는 맞춤법·본용언 포함 */
const META_AUTOSAVE_SECTIONS = new Set([
  'meta',
  'spelling',
  'consistency',
  'auxiliary',
]);
/** 기둥별 메모를 편집하는 섹션 → pillarMemos 키 매핑 */
const PILLAR_MEMO_SECTIONS = {
  spelling: 'spelling',
  consistency: 'consistency',
  auxiliary: 'auxiliary',
};
const META_AUTOSAVE_MS = 400;

/**
 * 작업 이력 — 마지막 작업·PDF·저장된 검수 결과 (한 카드).
 * @param {{
 *   summary: import('../presentation/projectWorkSummary.js').ProjectWorkSummary | null,
 *   uid?: string,
 *   projectId?: string,
 *   projectName?: string,
 * }} props
 */
function ProjectWorkSummaryCard({
  summary,
  uid = '',
  projectId = '',
  projectName = '',
}) {
  return (
    <div className="project-hub-settings__card project-hub-settings__card--work-summary">
      {!summary ? (
        <div className="project-hub-settings__row project-hub-settings__row--readonly">
          <p className="project-hub-settings__row-desc">
            아직 작업 기록이 없습니다. 검수 작업을 진행하면 여기에 요약이
            남습니다.
          </p>
        </div>
      ) : (
        [
          { label: '마지막 작업', value: summary.lastWorked },
          { label: 'PDF 정보', value: summary.pdf },
        ].map((row) => (
          <div
            key={row.label}
            className="project-hub-settings__row project-hub-settings__row--readonly"
          >
            <div className="project-hub-settings__row-text">
              <span className="project-hub-settings__row-label">{row.label}</span>
            </div>
            <span className="project-hub-settings__value">{row.value}</span>
          </div>
        ))
      )}
      {uid && projectId ? (
        <ProjectHubCheckResultsPanel
          uid={uid}
          projectId={projectId}
          projectName={projectName}
          embedded
        />
      ) : null}
    </div>
  );
}

/** @param {import('../presentation/projectCardViewModel.js').ProjectCardViewModel} card */
function buildCardMetaSyncKey(card) {
  return [
    card.title,
    card.tags.join('\u0001'),
    card.memo ?? '',
    card.formatLabel ?? '',
  ].join('\u0002');
}

/**
 * @param {{
 *   card: import('../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   ruleSet?: import('../lib/ruleSetsStorage.js').RuleSet | null,
 *   pdfFileName?: string,
 *   pdfPageCount?: number,
 *   lastWorkedAt?: string,
 *   saving?: boolean,
 *   criteriaSaving?: boolean,
 *   onSave: (payload: {
 *     name?: string,
 *     tags: string[],
 *     memo?: string,
 *     formatLabel?: string,
 *   }, cardId?: string) => void | Promise<{ ok?: boolean } | void>,
 *   onCriteriaChange?: (
 *     patch: {
 *       customRules?: import('../lib/ruleTypes.js').Rule[],
 *       builtInEnabled?: Record<string, boolean>,
 *       cautionEnabled?: Record<string, boolean>,
 *     },
 *   ) => void | Promise<void>,
 *   onStartWork?: () => void,
 *   uid?: string,
 * }} props
 */
export default function ProjectHubSettingsPanel({
  card,
  ruleSet = null,
  pdfFileName: _pdfFileName,
  pdfPageCount: _pdfPageCount,
  lastWorkedAt: _lastWorkedAt,
  saving = false,
  criteriaSaving = false,
  onSave,
  onCriteriaChange,
  onStartWork,
  uid = '',
}) {
  const tagsInputId = useId();
  const nameInputId = useId();
  const formatLabelInputId = useId();
  const memoInputId = useId();
  const spellingMemoInputId = useId();
  const consistencyMemoInputId = useId();
  const auxiliaryMemoInputId = useId();

  const [activeSection, setActiveSection] =
    useState(/** @type {ProjectHubSettingsSection} */ ('meta'));
  const [tagsInput, setTagsInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [formatLabelInput, setFormatLabelInput] = useState('');
  const [spellingMemoInput, setSpellingMemoInput] = useState('');
  const [consistencyMemoInput, setConsistencyMemoInput] = useState('');
  const [auxiliaryMemoInput, setAuxiliaryMemoInput] = useState('');

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;
  const skipMetaAutosaveRef = useRef(true);
  const metaDirtyRef = useRef(false);
  const metaInputRef = useRef({
    nameInput,
    tagsInput,
    memoInput,
    formatLabelInput,
    spellingMemoInput,
    consistencyMemoInput,
    auxiliaryMemoInput,
  });
  metaInputRef.current = {
    nameInput,
    tagsInput,
    memoInput,
    formatLabelInput,
    spellingMemoInput,
    consistencyMemoInput,
    auxiliaryMemoInput,
  };

  const markMetaDirty = useCallback(() => {
    metaDirtyRef.current = true;
  }, []);

  const buildMetaPayloadFromRef = useCallback(() => {
    const {
      nameInput: name,
      tagsInput: tagsRaw,
      memoInput: memoRaw,
      formatLabelInput: formatLabelRaw,
      spellingMemoInput: spellingMemoRaw,
      consistencyMemoInput: consistencyMemoRaw,
      auxiliaryMemoInput: auxiliaryMemoRaw,
    } = metaInputRef.current;
    const tags = normalizeProjectTags(
      tagsRaw
        .split(/[,，]/)
        .map((part) => part.trim())
        .filter(Boolean),
    );
    const memo = normalizeProjectMemo(memoRaw);
    const pillarMemos =
      normalizeProjectPillarMemos({
        spelling: spellingMemoRaw,
        consistency: consistencyMemoRaw,
        auxiliary: auxiliaryMemoRaw,
      }) ?? null;
    const formatLabel = formatLabelRaw
      .trim()
      .slice(0, MAX_PROJECT_FORMAT_LABEL_LENGTH);
    return {
      name: name.trim(),
      tags,
      memo,
      pillarMemos,
      formatLabel: formatLabel || undefined,
    };
  }, []);

  const syncFormFromCard = useCallback((sourceCard) => {
    setNameInput(sourceCard.title);
    setTagsInput(sourceCard.tags.join(', '));
    setMemoInput(sourceCard.memo ?? '');
    setFormatLabelInput(sourceCard.formatLabel ?? '');
    setSpellingMemoInput(sourceCard.pillarMemos?.spelling ?? '');
    setConsistencyMemoInput(sourceCard.pillarMemos?.consistency ?? '');
    setAuxiliaryMemoInput(sourceCard.pillarMemos?.auxiliary ?? '');
  }, []);

  const flushMetaSave = useCallback(async (forCardId) => {
    if (!metaDirtyRef.current) return true;
    try {
      const result = await onSaveRef.current(
        buildMetaPayloadFromRef(),
        forCardId,
      );
      if (result && typeof result === 'object' && result.ok === false) {
        metaDirtyRef.current = true;
        return false;
      }
      metaDirtyRef.current = false;
      return true;
    } catch {
      metaDirtyRef.current = true;
      return false;
    }
  }, [buildMetaPayloadFromRef]);

  const flushMetaSaveRef = useRef(flushMetaSave);
  flushMetaSaveRef.current = flushMetaSave;

  const prevCardIdRef = useRef(card.id);
  const cardMetaSyncKey = buildCardMetaSyncKey(card);

  useEffect(() => {
    const cardSwitched = prevCardIdRef.current !== card.id;
    prevCardIdRef.current = card.id;
    if (cardSwitched) {
      metaDirtyRef.current = false;
    }
    if (cardSwitched || !metaDirtyRef.current) {
      syncFormFromCard(card);
      skipMetaAutosaveRef.current = true;
    }
  }, [card, card.id, cardMetaSyncKey, syncFormFromCard]);

  useEffect(() => {
    const saveForCardId = card.id;
    return () => {
      void flushMetaSaveRef.current(saveForCardId);
    };
  }, [card.id]);

  useEffect(() => {
    if (!META_AUTOSAVE_SECTIONS.has(activeSection)) return undefined;

    if (skipMetaAutosaveRef.current) {
      skipMetaAutosaveRef.current = false;
      return () => {
        if (!META_AUTOSAVE_SECTIONS.has(activeSectionRef.current)) {
          void flushMetaSaveRef.current(card.id);
        }
      };
    }

    const saveForCardId = card.id;
    const timer = setTimeout(() => {
      void flushMetaSaveRef.current(saveForCardId);
    }, META_AUTOSAVE_MS);

    return () => {
      clearTimeout(timer);
      if (!META_AUTOSAVE_SECTIONS.has(activeSectionRef.current)) {
        void flushMetaSaveRef.current(saveForCardId);
      }
    };
  }, [
    activeSection,
    card.id,
    nameInput,
    tagsInput,
    memoInput,
    formatLabelInput,
    spellingMemoInput,
    consistencyMemoInput,
    auxiliaryMemoInput,
  ]);

  const showCriteriaPanel =
    CRITERIA_SECTIONS.has(activeSection) && ruleSet && onCriteriaChange;

  const pillarMemoKey = PILLAR_MEMO_SECTIONS[activeSection] ?? null;
  const pillarMemoConfig = pillarMemoKey
    ? {
        spelling: {
          id: spellingMemoInputId,
          label: '메모',
          desc: '이 프로젝트의 맞춤법 원칙·예외를 메모하세요',
          value: spellingMemoInput,
          setValue: setSpellingMemoInput,
        },
        consistency: {
          id: consistencyMemoInputId,
          label: '메모',
          desc: '이 프로젝트의 표기 통일 원칙·예외를 메모하세요',
          value: consistencyMemoInput,
          setValue: setConsistencyMemoInput,
        },
        auxiliary: {
          id: auxiliaryMemoInputId,
          label: '메모',
          desc: '이 프로젝트의 본용언·보조용언 허용·예외 기준을 메모하세요',
          value: auxiliaryMemoInput,
          setValue: setAuxiliaryMemoInput,
        },
      }[pillarMemoKey]
    : null;

  return (
    <section
      className="project-hub-settings"
      aria-label={`${card.title} 프로젝트 설정`}
    >
      <div className="project-hub-settings__layout">
        <nav className="project-hub-settings__nav" aria-label="설정 구역">
          <ul className="project-hub-settings__nav-list">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              const pillarKey =
                'pillarKey' in item ? item.pillarKey : undefined;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={[
                      'project-hub-settings__nav-btn',
                      isActive ? 'project-hub-settings__nav-btn--active' : '',
                      pillarKey
                        ? `project-hub-settings__nav-btn--${pillarKey}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setActiveSection(item.id)}
                  >
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="project-hub-settings__autosave-note">
            ※변경 사항은 자동 저장됩니다
          </p>
        </nav>

        <div className="project-hub-settings__main">
          {activeSection === 'meta' ? (
            <div className="project-hub-settings__form">
              <div className="project-hub-settings__group">
                <div className="project-hub-settings__card">
                  <div className="project-hub-settings__row">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={nameInputId}
                      >
                        제목
                      </label>
                      <p className="project-hub-settings__row-desc">
                        프로젝트 제목
                      </p>
                    </div>
                    <input
                      id={nameInputId}
                      className="project-hub-settings__input project-hub-settings__input--wide"
                      value={nameInput}
                      onChange={(e) => {
                        markMetaDirty();
                        setNameInput(e.target.value);
                      }}
                      placeholder="프로젝트 제목"
                      maxLength={60}
                      aria-busy={saving}
                      autoComplete="off"
                    />
                  </div>

                  <div className="project-hub-settings__row">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={tagsInputId}
                      >
                        태그
                      </label>
                      <p className="project-hub-settings__row-desc">
                        쉼표로 구분 · 최대 3개
                      </p>
                    </div>
                    <input
                      id={tagsInputId}
                      className="project-hub-settings__input project-hub-settings__input--wide"
                      value={tagsInput}
                      onChange={(e) => {
                        markMetaDirty();
                        setTagsInput(e.target.value);
                      }}
                      placeholder="문학, 시리즈 2/5"
                      aria-busy={saving}
                      autoComplete="off"
                    />
                  </div>

                  <div className="project-hub-settings__row">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={formatLabelInputId}
                      >
                        그 외 정보
                      </label>
                      <p className="project-hub-settings__row-desc">
                        예: 신국판, 3교
                      </p>
                    </div>
                    <input
                      id={formatLabelInputId}
                      className="project-hub-settings__input"
                      value={formatLabelInput}
                      onChange={(e) => {
                        markMetaDirty();
                        setFormatLabelInput(e.target.value);
                      }}
                      placeholder="신국판"
                      aria-busy={saving}
                      autoComplete="off"
                    />
                  </div>

                  <div className="project-hub-settings__row project-hub-settings__row--memo">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={memoInputId}
                      >
                        메모
                      </label>
                    </div>
                    <textarea
                      id={memoInputId}
                      className="project-hub-settings__textarea"
                      value={memoInput}
                      onChange={(e) => {
                        markMetaDirty();
                        setMemoInput(e.target.value);
                      }}
                      rows={3}
                      aria-busy={saving}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {showCriteriaPanel ? (
            <div className="project-hub-settings__group">
              <div className="project-hub-settings__card project-hub-settings__card--criteria">
                <ProjectHubCriteriaPanel
                  section={activeSection}
                  ruleSet={ruleSet}
                  criteriaSaving={criteriaSaving}
                  onCriteriaChange={onCriteriaChange}
                  onStartWork={onStartWork}
                  editorReviewCount={card.counts?.editorReview ?? 0}
                  spellingRuleCount={card.counts?.spelling ?? 0}
                />
                {pillarMemoConfig ? (
                  <div className="project-hub-settings__row project-hub-settings__row--memo project-hub-settings__pillar-memo">
                    <div className="project-hub-settings__row-text">
                      <label
                        className="project-hub-settings__row-label"
                        htmlFor={pillarMemoConfig.id}
                      >
                        {pillarMemoConfig.label}
                      </label>
                      <p className="project-hub-settings__row-desc">
                        {pillarMemoConfig.desc}
                      </p>
                    </div>
                    <textarea
                      id={pillarMemoConfig.id}
                      className="project-hub-settings__textarea"
                      value={pillarMemoConfig.value}
                      onChange={(e) => {
                        markMetaDirty();
                        pillarMemoConfig.setValue(e.target.value);
                      }}
                      rows={3}
                      maxLength={MAX_PROJECT_PILLAR_MEMO_LENGTH}
                      aria-busy={saving}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeSection === 'actions' ? (
            <div className="project-hub-settings__group">
              <ProjectWorkSummaryCard
                summary={buildProjectWorkSummary(ruleSet?.projectContext)}
                uid={uid}
                projectId={card?.id}
                projectName={card.title || ruleSet?.name || ''}
              />
              <ProjectWorkHistoryChart
                history={ruleSet?.workHistory}
                projectContext={ruleSet?.projectContext}
                customRules={ruleSet?.customRules ?? []}
                globalExcludePhrases={ruleSet?.globalExcludePhrases ?? []}
                consistencyDecisions={ruleSet?.consistencyDecisions ?? []}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
