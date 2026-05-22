import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, BookOpen } from 'lucide-react';
import PdfViewer from './PdfViewer.jsx';
import AppVersionBadge from './AppVersionBadge.jsx';
import ResizableBuiltinSpelling from './ResizableBuiltinSpelling.jsx';
import ConsistencyPanel from './ConsistencyPanel.jsx';
import RuleSetSaveBar from './RuleSetSaveBar.jsx';
import CheckResultsPanel from './CheckResultsPanel.jsx';
import PdfWorkSection from './PdfWorkSection.jsx';
import { findResultSource } from '../lib/checkResultUtils.js';
import { usePdfDocument } from '../hooks/usePdfDocument.js';
import { useRuleCheck } from '../hooks/useRuleCheck.js';
import { useWorkSession } from '../hooks/useWorkSession.js';
import { useHighlights } from '../hooks/useHighlights.js';

/**
 * @param {{
 *   ruleSetName: string,
 *   builtInEnabled: Record<string, boolean>,
 *   customRules: import('../lib/ruleTypes.js').Rule[],
 *   globalExcludePhrases: string[],
 *   onRuleSetNameChange: (name: string) => void,
 *   onBuiltInToggle: (find: string) => void,
 *   cautionEnabled: Record<string, boolean>,
 *   onCautionToggle: (id: string) => void,
 *   onCustomRulesChange: (rules: import('../lib/ruleTypes.js').Rule[]) => void,
 *   onGlobalExcludePhrasesChange: (phrases: string[]) => void,
 *   onSaveRules: () => void,
 *   onOpenWelcome: () => void,
 *   initialWorkTab?: 'spelling' | 'consistency',
 * }} props
 */
export default function MainScreen({
  ruleSetName,
  builtInEnabled,
  customRules,
  globalExcludePhrases,
  onRuleSetNameChange,
  onBuiltInToggle,
  cautionEnabled,
  onCautionToggle,
  onCustomRulesChange,
  onGlobalExcludePhrasesChange,
  onSaveRules,
  onOpenWelcome,
  initialWorkTab = 'spelling',
}) {
  const [workTab, setWorkTab] = useState(initialWorkTab);
  const afterCheckRef = useRef(async () => false);

  const pdf = usePdfDocument();
  const ruleCheck = useRuleCheck({
    builtInEnabled,
    cautionEnabled,
    customRules,
    globalExcludePhrases,
    pageTexts: pdf.pageTexts,
    currentPage: pdf.currentPage,
    setCurrentPage: pdf.setCurrentPage,
    setIsProcessing: pdf.setIsProcessing,
    setProgress: pdf.setProgress,
    afterCheckRef,
  });
  const session = useWorkSession(pdf, ruleCheck);
  afterCheckRef.current = session.persistSession;

  const highlights = useHighlights({
    currentPage: pdf.currentPage,
    currentPageData: pdf.currentPageData,
    spellingResults: ruleCheck.spellingResults,
    consistencyResults: ruleCheck.consistencyResults,
    resultVisibility: ruleCheck.resultVisibility,
    highlightTab: workTab,
    activeSource: ruleCheck.activeSource,
    selectedInstance: ruleCheck.selectedInstance,
  });

  useEffect(() => {
    setWorkTab(initialWorkTab);
  }, [initialWorkTab]);

  const tabEntries = useMemo(() => {
    /** @type {{ group: import('../lib/ruleEngine.js').GroupedResult, source: 'spelling' | 'consistency' }[]} */
    const entries = [];
    if (workTab === 'spelling') {
      for (const group of ruleCheck.spellingResults) {
        entries.push({ group, source: 'spelling' });
      }
    } else {
      for (const group of ruleCheck.consistencyResults) {
        entries.push({ group, source: 'consistency' });
      }
    }
    return entries;
  }, [workTab, ruleCheck.spellingResults, ruleCheck.consistencyResults]);

  const tabTotalFindings = useMemo(
    () =>
      tabEntries.reduce((n, { group }) => n + group.instances.length, 0),
    [tabEntries],
  );

  const visibleOnCurrentPage = ruleCheck.countVisibleOnPage(
    pdf.currentPage,
    workTab,
  );
  const activeRuleOnPageCount = ruleCheck.getActiveOnPage(pdf.currentPage);

  const tabCheckDone =
    workTab === 'spelling'
      ? ruleCheck.spellingCheckDone
      : ruleCheck.consistencyCheckDone;

  function switchTab(tab) {
    setWorkTab(tab);
    ruleCheck.syncSelectionForTab(tab);
  }

  function goToFinding(delta) {
    if (!highlights.sortedFindings.length) return;
    const base =
      highlights.currentFindingIndex >= 0
        ? highlights.currentFindingIndex
        : delta > 0
          ? -1
          : highlights.sortedFindings.length;
    const next = base + delta;
    if (next < 0 || next >= highlights.sortedFindings.length) return;
    const inst = highlights.sortedFindings[next];
    const source = findResultSource(
      ruleCheck.spellingResults,
      ruleCheck.consistencyResults,
      inst,
    );
    ruleCheck.selectInstance(inst, source);
  }

  const combinedResultsPanel = tabCheckDone ? (
    <CheckResultsPanel
      entries={tabEntries}
      viewSource={workTab}
      currentPage={pdf.currentPage}
      pdf={pdf.pdf}
      activeGroup={ruleCheck.activeGroup}
      activeSource={ruleCheck.activeSource}
      activeRuleOnPageCount={activeRuleOnPageCount}
      visibleOnCurrentPage={visibleOnCurrentPage}
      totalFindings={tabTotalFindings}
      ruleCount={tabEntries.length}
      spellingFindings={ruleCheck.spellingFindings}
      consistencyFindings={ruleCheck.consistencyFindings}
      spellingCheckDone={ruleCheck.spellingCheckDone}
      consistencyCheckDone={ruleCheck.consistencyCheckDone}
      isGroupVisible={ruleCheck.isGroupVisible}
      onToggleVisibility={ruleCheck.toggleResultVisibility}
      isSameGroupAsSelected={ruleCheck.isSameGroupAsSelected}
      onSelectGroup={ruleCheck.selectGroup}
      onSelectPageInGroup={ruleCheck.selectPageInGroup}
      ruleSetName={ruleSetName}
      onAdditionalCheck={
        workTab === 'consistency' ? ruleCheck.backToConsistencySetup : undefined
      }
    />
  ) : null;

  const runCheckSection = (
    <section className="panel-section">
      <button
        type="button"
        className="btn-run"
        onClick={ruleCheck.runCheck}
        disabled={pdf.isProcessing || !pdf.pageTexts.length}
      >
        <Play size={16} />
        {pdf.isProcessing && pdf.progress?.phase === 'check'
          ? '검사 중…'
          : '검사 실행 (맞춤법·일관성)'}
      </button>
      <p className="hint" style={{ marginTop: 8 }}>
        맞춤법 {ruleCheck.spellingActiveRules.length}개 · 일관성{' '}
        {ruleCheck.consistencyActiveRules.length}개 동시 검사
      </p>
      {pdf.isProcessing && pdf.progress?.phase === 'check' && (
        <p className="hint">검사 실행 중…</p>
      )}
      {pdf.isProcessing &&
        pdf.progressLabel &&
        pdf.progress?.phase !== 'check' && (
          <>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${(pdf.progress.current / pdf.progress.total) * 100}%`,
                }}
              />
            </div>
            <p className="hint">{pdf.progressLabel}</p>
          </>
        )}
    </section>
  );

  const pdfWorkSection = (
    <PdfWorkSection
      fileRef={pdf.fileRef}
      onOpenPicker={session.openPdfWithPicker}
      onFileChange={session.handleFileChange}
      onReconnect={session.reconnectPdfFile}
      onClearSession={session.handleClearSession}
      isProcessing={pdf.isProcessing}
      pdf={pdf.pdf}
      pdfFileName={pdf.pdfFileName}
      fileHandleActive={pdf.fileHandleActive}
      loadError={pdf.loadError}
      sessionHint={session.sessionHint}
    />
  );

  return (
    <div className="layout-main">
      <aside className={`panel-left panel-left--${workTab}`}>
        <header className="panel-header panel-header--tabs">
          <nav className="work-tabs" aria-label="검수 종류">
            <button
              type="button"
              className={`work-tab work-tab--spelling ${workTab === 'spelling' ? 'active' : ''}`}
              onClick={() => switchTab('spelling')}
            >
              맞춤법 확인
            </button>
            <button
              type="button"
              className={`work-tab work-tab--consistency ${workTab === 'consistency' ? 'active' : ''}`}
              onClick={() => switchTab('consistency')}
            >
              일관성 확인
            </button>
          </nav>
          <button
            type="button"
            className="btn-ghost btn-ghost--compact"
            onClick={onOpenWelcome}
            title="사용 안내"
          >
            <BookOpen size={18} />
          </button>
        </header>

        {workTab === 'spelling' && (
          <div className="spelling-tab-layout">
            <div className="spelling-tab-scroll">
              <section className="panel-section">
                <label className="field-label">규칙 세트</label>
                <div className="rule-set-name">{ruleSetName}</div>
                {session.sessionHint && (
                  <p className="hint session-hint">{session.sessionHint}</p>
                )}
              </section>

              {pdfWorkSection}
              {runCheckSection}
              {combinedResultsPanel}
            </div>

            <ResizableBuiltinSpelling
              builtInEnabled={builtInEnabled}
              onBuiltInToggle={onBuiltInToggle}
              cautionEnabled={cautionEnabled}
              onCautionToggle={onCautionToggle}
            />
          </div>
        )}

        {workTab === 'consistency' && (
          <div className="panel-left-work-scroll">
            <PdfWorkSection
              fileRef={pdf.fileRef}
              onOpenPicker={session.openPdfWithPicker}
              onFileChange={session.handleFileChange}
              onReconnect={session.reconnectPdfFile}
              onClearSession={session.handleClearSession}
              isProcessing={pdf.isProcessing}
              pdf={pdf.pdf}
              pdfFileName={pdf.pdfFileName}
              fileHandleActive={pdf.fileHandleActive}
              loadError={pdf.loadError}
              sessionHint={null}
              compact
            />
            {runCheckSection}
            {combinedResultsPanel}
            {!ruleCheck.consistencyCheckDone && (
              <div className="consistency-rules-scroll">
                <ConsistencyPanel
                  customRules={customRules}
                  onCustomRulesChange={onCustomRulesChange}
                  globalExcludePhrases={globalExcludePhrases}
                  onGlobalExcludePhrasesChange={onGlobalExcludePhrasesChange}
                  builtInEnabled={builtInEnabled}
                  onRunCheck={ruleCheck.runCheck}
                  isProcessing={pdf.isProcessing}
                  canRunCheck={!!pdf.pageTexts.length}
                  progress={pdf.progress}
                  progressLabel={pdf.progressLabel}
                />
              </div>
            )}
          </div>
        )}

        <AppVersionBadge />
      </aside>

      <main className="panel-right">
        {workTab === 'consistency' && (
          <RuleSetSaveBar
            ruleSetName={ruleSetName}
            onRuleSetNameChange={onRuleSetNameChange}
            onSave={onSaveRules}
          />
        )}
        <PdfViewer
          key={pdf.pdf ? `pdf-${pdf.pdf.numPages}` : 'no-pdf'}
          pdf={pdf.pdf}
          pageNum={pdf.currentPage}
          pageData={pdf.currentPageData}
          highlights={highlights.pageHighlights}
          emptyTitle="PDF를 업로드하세요"
          emptyHint="좌측에서 PDF를 연결한 뒤 「검사 실행」을 누르세요"
        />
        {pdf.pdf && (
          <div className="pdf-toolbar">
            {tabCheckDone && highlights.sortedFindings.length > 0 ? (
              <>
                <button
                  type="button"
                  className="btn-finding-nav"
                  disabled={highlights.currentFindingIndex <= 0}
                  onClick={() => goToFinding(-1)}
                >
                  ← 이전 발견
                </button>
                <span className="pdf-toolbar-page">
                  발견{' '}
                  {highlights.currentFindingIndex >= 0
                    ? highlights.currentFindingIndex + 1
                    : '—'}{' '}
                  / {highlights.sortedFindings.length}
                  <span className="pdf-toolbar-findings">
                    · p.{pdf.currentPage}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn-finding-nav btn-finding-nav--next"
                  disabled={
                    highlights.currentFindingIndex < 0 ||
                    highlights.currentFindingIndex >=
                      highlights.sortedFindings.length - 1
                  }
                  onClick={() => goToFinding(1)}
                >
                  다음 발견 →
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={pdf.currentPage <= 1}
                  onClick={() =>
                    pdf.setCurrentPage((p) => Math.max(1, p - 1))
                  }
                >
                  ← 이전 페이지
                </button>
                <span className="pdf-toolbar-page">
                  {pdf.currentPage} / {pdf.pdf.numPages}
                </span>
                <button
                  type="button"
                  disabled={pdf.currentPage >= pdf.pdf.numPages}
                  onClick={() =>
                    pdf.setCurrentPage((p) =>
                      Math.min(pdf.pdf.numPages, p + 1),
                    )
                  }
                >
                  다음 페이지 →
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
