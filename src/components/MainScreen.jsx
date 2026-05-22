import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, BookOpen } from 'lucide-react';
import PdfViewer from './PdfViewer.jsx';
import ResizableBuiltinSpelling from './ResizableBuiltinSpelling.jsx';
import ConsistencyPanel from './ConsistencyPanel.jsx';
import RuleSetSaveBar from './RuleSetSaveBar.jsx';
import { buildCautionCheckRules } from '../lib/cautionRules.js';
import { BUILT_IN_RULES, SPELLING_RULES_FP } from '../lib/builtInRules.js';
import { runRuleCheck } from '../lib/ruleEngine.js';
import CheckResultsPanel from './CheckResultsPanel.jsx';
import PdfWorkSection from './PdfWorkSection.jsx';
import {
  extractAllPagesText,
  highlightRangeForInstance,
  loadPdfFromBuffer,
} from '../lib/pdfService.js';
import {
  clearWorkSession,
  getStorageHint,
  loadWorkSession,
  saveWorkSession,
} from '../lib/sessionStore.js';

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
  const fileRef = useRef(null);
  const pdfBufferRef = useRef(null);
  /** @type {React.MutableRefObject<FileSystemFileHandle | null>} */
  const fileHandleRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [pdfFileName, setPdfFileName] = useState(null);
  const [pageTexts, setPageTexts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [spellingResults, setSpellingResults] = useState([]);
  const [consistencyResults, setConsistencyResults] = useState([]);
  const [spellingSelected, setSpellingSelected] = useState(null);
  const [consistencySelected, setConsistencySelected] = useState(null);
  const [spellingCheckDone, setSpellingCheckDone] = useState(false);
  const [consistencyCheckDone, setConsistencyCheckDone] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [sessionHint, setSessionHint] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const groupedResults =
    workTab === 'spelling' ? spellingResults : consistencyResults;
  const selectedInstance =
    workTab === 'spelling' ? spellingSelected : consistencySelected;
  const checkDone =
    workTab === 'spelling' ? spellingCheckDone : consistencyCheckDone;

  useEffect(() => {
    setWorkTab(initialWorkTab);
  }, [initialWorkTab]);

  const spellingActiveRules = useMemo(() => {
    const builtIn = BUILT_IN_RULES.filter(
      (r) => builtInEnabled[r.find] !== false,
    ).map((r) => ({
      ...r,
      enabled: true,
      category: 'spelling',
    }));
    const caution = buildCautionCheckRules(cautionEnabled).map((r) => ({
      ...r,
      enabled: true,
    }));
    return [...builtIn, ...caution];
  }, [builtInEnabled, cautionEnabled]);

  const consistencyActiveRules = useMemo(
    () =>
      customRules
        .filter((r) => r.enabled)
        .map((r) => ({
          ...r,
          category:
            r.patternKind === 'compound-tail' || r.patternKind === 'compound-spacing'
              ? 'consistency'
              : 'custom',
        })),
    [customRules],
  );

  const activeRules =
    workTab === 'spelling' ? spellingActiveRules : consistencyActiveRules;
  const activeCount = activeRules.length;

  const persistSession = useCallback(async () => {
    if (!pdfFileName || !pageTexts.length) return false;
    if (!fileHandleRef.current && !pdfBufferRef.current) return false;

    const result = await saveWorkSession({
      fileName: pdfFileName,
      fileHandle: fileHandleRef.current,
      pdfBuffer: fileHandleRef.current ? undefined : pdfBufferRef.current,
      pageTexts: pageTexts.map((p) => ({ pageNum: p.pageNum, text: p.text })),
      groupedResults: spellingResults,
      consistencyGroupedResults: consistencyResults,
      spellingRulesFingerprint: SPELLING_RULES_FP,
      currentPage,
      selectedInstance: spellingSelected,
      consistencySelectedInstance: consistencySelected,
    });

    if (result.ok) {
      const hint =
        result.mode === 'handle'
          ? '연결됨 — 새로고침 후 「PDF 다시 연결」만 누르면 됩니다 (대용량 권장)'
          : `저장됨 (${result.mode}) — 새로고침 시 복원`;
      setSessionHint(hint);
      setLoadError(null);
    } else {
      const storageHint = await getStorageHint();
      setSessionHint('저장 실패');
      setLoadError(
        [result.error, storageHint].filter(Boolean).join(' · ') ||
          'Chrome/Edge에서 「PDF 열기」를 사용해 보세요.',
      );
    }
    return result.ok;
  }, [
    pdfFileName,
    pageTexts,
    spellingResults,
    consistencyResults,
    currentPage,
    spellingSelected,
    consistencySelected,
  ]);

  function restoreCheckResults(saved) {
    const rulesMatch = saved.spellingRulesFingerprint === SPELLING_RULES_FP;
    const spelling = rulesMatch ? (saved.groupedResults ?? []) : [];
    const consistency = saved.consistencyGroupedResults ?? [];
    const staleRules = !rulesMatch && (saved.groupedResults?.length ?? 0) > 0;
    return { spelling, consistency, staleRules };
  }

  useEffect(() => {
    const mounted = { current: true };

    (async () => {
      const saved = await loadWorkSession();
      if (!mounted.current) return;
      if (!saved) {
        setIsRestoring(false);
        return;
      }

      if (saved.needFilePermission && saved.fileHandle) {
        fileHandleRef.current = saved.fileHandle;
        setPdfFileName(saved.fileName);
        const { spelling, consistency, staleRules } = restoreCheckResults(saved);
        setSpellingResults(spelling);
        setConsistencyResults(consistency);
        setSpellingCheckDone(spelling.length > 0);
        setConsistencyCheckDone(consistency.length > 0);
        setSpellingSelected(spelling.length ? saved.selectedInstance ?? null : null);
        setConsistencySelected(
          consistency.length ? saved.consistencySelectedInstance ?? null : null,
        );
        setSessionHint(
          staleRules
            ? '규칙이 바뀌어 이전 맞춤법 결과는 비웠습니다. PDF 연결 후 「검사 실행」을 다시 누르세요.'
            : '이전 PDF — 아래 「PDF 다시 연결」을 누르세요',
        );
        setLoadError(null);
        setIsRestoring(false);
        return;
      }

      setIsProcessing(true);
      setProgress({ current: 0, total: 1, phase: 'restore' });
      setSessionHint('이전 작업 복원 중…');

      try {
        pdfBufferRef.current = saved.pdfBuffer;
        if (saved.fileHandle) fileHandleRef.current = saved.fileHandle;
        setPdfFileName(saved.fileName);
        const { spelling, consistency, staleRules } = restoreCheckResults(saved);
        setSpellingResults(spelling);
        setConsistencyResults(consistency);
        setSpellingCheckDone(spelling.length > 0);
        setConsistencyCheckDone(consistency.length > 0);
        setSpellingSelected(spelling.length ? saved.selectedInstance ?? null : null);
        setConsistencySelected(
          consistency.length ? saved.consistencySelectedInstance ?? null : null,
        );

        const doc = await loadPdfFromBuffer(saved.pdfBuffer);
        if (!mounted.current) return;

        setPdf(doc);

        const page = Math.min(
          Math.max(1, saved.currentPage ?? 1),
          doc.numPages,
        );
        setCurrentPage(page);

        const pages = await extractAllPagesText(doc, (current, total) => {
          if (mounted.current) {
            setProgress({ current, total, phase: 'restore' });
          }
        });
        if (!mounted.current) return;

        setPageTexts(pages);
        setSessionHint(
          staleRules
            ? `복원됨 · ${saved.fileName} — 규칙이 바뀌어 맞춤법 결과는 비웠습니다. 「검사 실행」을 다시 누르세요.`
            : `복원됨 · ${saved.fileName} (${new Date(saved.savedAt).toLocaleString('ko-KR')})`,
        );
      } catch (err) {
        if (mounted.current) {
          setLoadError(
            err instanceof Error ? err.message : '이전 작업 복원 실패',
          );
          setSessionHint(null);
        }
        await clearWorkSession();
      } finally {
        if (mounted.current) {
          setIsProcessing(false);
          setProgress(null);
          setIsRestoring(false);
        }
      }
    })();

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isRestoring || !pdfBufferRef.current || !pageTexts.length) return;

    const t = setTimeout(() => {
      persistSession();
    }, 300);

    const onHide = () => {
      if (pdfFileName && pageTexts.length && (fileHandleRef.current || pdfBufferRef.current)) {
        void saveWorkSession({
          fileName: pdfFileName,
          fileHandle: fileHandleRef.current,
          pdfBuffer: fileHandleRef.current ? undefined : pdfBufferRef.current,
          groupedResults: spellingResults,
          consistencyGroupedResults: consistencyResults,
          spellingRulesFingerprint: SPELLING_RULES_FP,
          currentPage,
          selectedInstance: spellingSelected,
          consistencySelectedInstance: consistencySelected,
        });
      }
    };
    window.addEventListener('pagehide', onHide);

    return () => {
      clearTimeout(t);
      window.removeEventListener('pagehide', onHide);
    };
  }, [
    isRestoring,
    persistSession,
    pdfFileName,
    pageTexts,
    spellingResults,
    consistencyResults,
    currentPage,
    spellingSelected,
    consistencySelected,
  ]);

  function clearAllCheckState() {
    setSpellingResults([]);
    setConsistencyResults([]);
    setSpellingSelected(null);
    setConsistencySelected(null);
    setSpellingCheckDone(false);
    setConsistencyCheckDone(false);
  }

  async function loadPdfFromFile(file) {
    setLoadError(null);
    setPdfFileName(file.name);

    const buffer = await file.arrayBuffer();
    pdfBufferRef.current = buffer;
    const doc = await loadPdfFromBuffer(buffer);
    setPdf(doc);
    setCurrentPage(1);
    setIsProcessing(true);
    setProgress({ current: 0, total: doc.numPages, phase: 'extract' });

    const pages = await extractAllPagesText(doc, (current, total) => {
      setProgress({ current, total, phase: 'extract' });
    });

    setPageTexts(pages);
    if (pages.every((p) => !p.text.trim())) {
      setLoadError('텍스트를 추출하지 못했습니다. 스캔 PDF는 지원하지 않습니다.');
    }
    return doc;
  }

  async function openPdfWithPicker() {
    clearAllCheckState();
    fileHandleRef.current = null;

    try {
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'PDF',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
        multiple: false,
      });
      fileHandleRef.current = handle;
      const file = await handle.getFile();
      await loadPdfFromFile(file);
      await persistSession();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setLoadError(err instanceof Error ? err.message : 'PDF 열기 실패');
      setPdf(null);
      setPageTexts([]);
      pdfBufferRef.current = null;
      fileHandleRef.current = null;
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }

  async function reconnectPdfFile() {
    if (!fileHandleRef.current) {
      await openPdfWithPicker();
      return;
    }
    setLoadError(null);
    setIsProcessing(true);
    setProgress({ current: 0, total: 1, phase: 'restore' });
    try {
      const file = await fileHandleRef.current.getFile();
      await loadPdfFromFile(file);
      await persistSession();
      setSessionHint('파일 다시 연결됨');
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : '파일 연결 실패 — PDF 열기로 다시 선택하세요',
      );
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    clearAllCheckState();
    fileHandleRef.current = null;

    try {
      await loadPdfFromFile(file);
      await persistSession();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'PDF 로드 실패');
      setPdf(null);
      setPageTexts([]);
      pdfBufferRef.current = null;
    } finally {
      setIsProcessing(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function runCheck() {
    if (!pageTexts.length) {
      alert('먼저 PDF를 업로드하세요.');
      return;
    }
    const tab = workTab;
    const rules = tab === 'spelling' ? spellingActiveRules : consistencyActiveRules;
    if (!rules.length) {
      alert(
        tab === 'spelling'
          ? '활성화된 맞춤법 규칙이 없습니다. 규칙을 켜 주세요.'
          : '활성화된 일관성 규칙이 없습니다. 붙임 패턴·규칙을 추가하세요.',
      );
      return;
    }

    setIsProcessing(true);
    setProgress({ current: pageTexts.length, total: pageTexts.length, phase: 'check' });

    await new Promise((r) => setTimeout(r, 0));

    const { results: grouped, errors } = runRuleCheck(pageTexts, rules, {
      globalExcludePhrases,
    });

    if (errors.length) {
      alert(errors.join('\n'));
    }

    const first = grouped[0]?.instances[0] ?? null;
    if (tab === 'spelling') {
      setSpellingResults(grouped);
      setSpellingCheckDone(true);
      setSpellingSelected(first);
    } else {
      setConsistencyResults(grouped);
      setConsistencyCheckDone(true);
      setConsistencySelected(first);
    }
    if (first) {
      setCurrentPage(first.pageNum);
    }
    setIsProcessing(false);
    setProgress(null);
    await persistSession();
  }

  function backToConsistencySetup() {
    setConsistencyCheckDone(false);
  }

  function selectInstance(inst) {
    if (workTab === 'spelling') {
      setSpellingSelected(inst);
    } else {
      setConsistencySelected(inst);
    }
    setCurrentPage(inst.pageNum);
  }

  function groupKey(group) {
    return `${group.find}\0${group.replace}`;
  }

  function instanceKey(inst) {
    return `${inst.find}\0${inst.replace}`;
  }

  /** 같은 규칙의 해당 페이지 발견으로 선택을 맞춤 (페이지만 바꿀 때 index 꼬임 방지) */
  function goToPage(pageNum) {
    setCurrentPage(pageNum);
    if (!selectedInstance) return;

    const key = instanceKey(selectedInstance);
    const group = groupedResults.find((g) => groupKey(g) === key);
    const onPage = group?.instances.find((i) => i.pageNum === pageNum);
    if (workTab === 'spelling') {
      setSpellingSelected(onPage ?? null);
    } else {
      setConsistencySelected(onPage ?? null);
    }
  }

  function selectPageInGroup(pageNum, instances) {
    const onPage = instances.find((i) => i.pageNum === pageNum);
    if (onPage) selectInstance(onPage);
    else goToPage(pageNum);
  }

  /** 규칙 전체 선택 — 현재 페이지의 해당 규칙 발견을 모두 하이라이트 */
  function selectGroup(group) {
    const onPage = group.instances.filter((i) => i.pageNum === currentPage);
    const inst = onPage[0] ?? group.instances[0] ?? null;
    if (!inst) return;
    selectInstance(inst);
  }

  function isSameGroupAsSelected(group) {
    if (!selectedInstance) return false;
    return (
      group.find === selectedInstance.find &&
      group.replace === selectedInstance.replace
    );
  }

  async function handleClearSession() {
    if (
      !confirm(
        '저장된 PDF와 검사 결과를 이 브라우저에서 삭제합니다. 계속할까요?',
      )
    ) {
      return;
    }
    await clearWorkSession();
    pdfBufferRef.current = null;
    fileHandleRef.current = null;
    setPdf(null);
    setPdfFileName(null);
    setPageTexts([]);
    clearAllCheckState();
    setCurrentPage(1);
    setSessionHint(null);
    setLoadError(null);
  }

  const currentPageData = pageTexts.find((p) => p.pageNum === currentPage) ?? null;

  function findActiveGroup(results, inst) {
    if (!inst) return null;
    return (
      results.find(
        (g) => g.find === inst.find && g.replace === inst.replace,
      ) ?? null
    );
  }

  const spellingActiveGroup = useMemo(
    () => findActiveGroup(spellingResults, spellingSelected),
    [spellingResults, spellingSelected],
  );
  const consistencyActiveGroup = useMemo(
    () => findActiveGroup(consistencyResults, consistencySelected),
    [consistencyResults, consistencySelected],
  );
  const activeGroup =
    workTab === 'spelling' ? spellingActiveGroup : consistencyActiveGroup;

  const pageHighlights = useMemo(() => {
    if (!activeGroup || !currentPageData) return [];
    return activeGroup.instances
      .filter((i) => i.pageNum === currentPage)
      .map((i) => {
        const range = highlightRangeForInstance(currentPageData, i);
        if (!range) return null;
        const primary =
          selectedInstance &&
          i.pageNum === selectedInstance.pageNum &&
          i.index === selectedInstance.index &&
          i.matchedText === selectedInstance.matchedText;
        return { ...range, primary: Boolean(primary) };
      })
      .filter(Boolean);
  }, [activeGroup, currentPage, currentPageData, selectedInstance]);

  const activeRuleOnPageCount =
    workTab === 'spelling' ? spellingActiveOnPage : consistencyActiveOnPage;

  const sortedFindings = useMemo(() => {
    if (!activeGroup) return [];
    return [...activeGroup.instances].sort((a, b) => {
      if (a.pageNum !== b.pageNum) return a.pageNum - b.pageNum;
      return a.index - b.index;
    });
  }, [activeGroup]);

  const currentFindingIndex = useMemo(() => {
    if (!selectedInstance || !sortedFindings.length) return -1;
    return sortedFindings.findIndex(
      (i) =>
        i.pageNum === selectedInstance.pageNum &&
        i.index === selectedInstance.index &&
        i.matchedText === selectedInstance.matchedText,
    );
  }, [selectedInstance, sortedFindings]);

  function goToFinding(delta) {
    if (!sortedFindings.length) return;
    const base =
      currentFindingIndex >= 0
        ? currentFindingIndex
        : delta > 0
          ? -1
          : sortedFindings.length;
    const next = base + delta;
    if (next < 0 || next >= sortedFindings.length) return;
    selectInstance(sortedFindings[next]);
  }

  const spellingTotalFindings = spellingResults.reduce(
    (n, g) => n + g.instances.length,
    0,
  );
  const consistencyTotalFindings = consistencyResults.reduce(
    (n, g) => n + g.instances.length,
    0,
  );
  const spellingFindingsOnPage = spellingResults.reduce(
    (n, g) => n + g.instances.filter((i) => i.pageNum === currentPage).length,
    0,
  );
  const consistencyFindingsOnPage = consistencyResults.reduce(
    (n, g) => n + g.instances.filter((i) => i.pageNum === currentPage).length,
    0,
  );
  const spellingFindings = spellingResults
    .filter((g) => g.category === 'spelling' || g.category === 'caution')
    .reduce((n, g) => n + g.instances.length, 0);
  const consistencyFindings = consistencyResults.reduce(
    (n, g) => n + g.instances.length,
    0,
  );
  const hasBuiltInActive =
    BUILT_IN_RULES.some((r) => builtInEnabled[r.find] !== false) ||
    buildCautionCheckRules(cautionEnabled).length > 0;
  const hasConsistencyRulesActive = consistencyActiveRules.length > 0;
  const findingsOnCurrentPage =
    workTab === 'spelling' ? spellingFindingsOnPage : consistencyFindingsOnPage;
  const spellingActiveOnPage = spellingActiveGroup
    ? spellingActiveGroup.instances.filter((i) => i.pageNum === currentPage).length
    : 0;
  const consistencyActiveOnPage = consistencyActiveGroup
    ? consistencyActiveGroup.instances.filter((i) => i.pageNum === currentPage).length
    : 0;

  const progressLabel =
    progress?.phase === 'restore'
      ? `복원 중 ${progress.current} / ${progress.total}`
      : progress?.phase === 'extract'
        ? `텍스트 추출 ${progress.current} / ${progress.total}`
        : progress?.phase === 'check'
          ? '검사 실행 중…'
          : null;

  const pdfWorkSection = (
    <PdfWorkSection
      fileRef={fileRef}
      onOpenPicker={openPdfWithPicker}
      onFileChange={handleFileChange}
      onReconnect={reconnectPdfFile}
      onClearSession={handleClearSession}
      isProcessing={isProcessing}
      pdf={pdf}
      pdfFileName={pdfFileName}
      fileHandleActive={Boolean(fileHandleRef.current)}
      loadError={loadError}
      sessionHint={sessionHint}
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
              onClick={() => setWorkTab('spelling')}
            >
              맞춤법 확인
            </button>
            <button
              type="button"
              className={`work-tab work-tab--consistency ${workTab === 'consistency' ? 'active' : ''}`}
              onClick={() => setWorkTab('consistency')}
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
                <p className="hint">
                  맞춤법 활성 {spellingActiveRules.length}개 · 대용량 PDF는 「PDF 열기」 권장
                </p>
                {sessionHint && <p className="hint session-hint">{sessionHint}</p>}
              </section>

              {pdfWorkSection}

              <section className="panel-section">
                <button
                  type="button"
                  className="btn-run"
                  onClick={runCheck}
                  disabled={isProcessing || !pageTexts.length}
                >
                  <Play size={16} />
                  {isProcessing && progress?.phase === 'check' ? '검사 중…' : '검사 실행'}
                </button>
                {isProcessing && progress?.phase === 'check' && (
                  <p className="hint" style={{ marginTop: 8 }}>
                    검사 실행 중…
                  </p>
                )}
                {isProcessing && progressLabel && progress?.phase !== 'check' && (
                  <>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(progress.current / progress.total) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="hint">{progressLabel}</p>
                  </>
                )}
              </section>

              {spellingCheckDone && (
                <CheckResultsPanel
                  mode="spelling"
                  groupedResults={spellingResults}
                  currentPage={currentPage}
                  pdf={pdf}
                  activeGroup={spellingActiveGroup}
                  activeRuleOnPageCount={spellingActiveOnPage}
                  findingsOnCurrentPage={spellingFindingsOnPage}
                  totalFindings={spellingTotalFindings}
                  categoryFindings={spellingFindings}
                  hasCategoryRulesActive={hasBuiltInActive}
                  isSameGroupAsSelected={isSameGroupAsSelected}
                  onSelectGroup={selectGroup}
                  onSelectPageInGroup={selectPageInGroup}
                />
              )}
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
          <>
            <PdfWorkSection
              fileRef={fileRef}
              onOpenPicker={openPdfWithPicker}
              onFileChange={handleFileChange}
              onReconnect={reconnectPdfFile}
              onClearSession={handleClearSession}
              isProcessing={isProcessing}
              pdf={pdf}
              pdfFileName={pdfFileName}
              fileHandleActive={Boolean(fileHandleRef.current)}
              loadError={loadError}
              sessionHint={null}
              compact
            />
            {consistencyCheckDone ? (
              <>
                <CheckResultsPanel
                  mode="consistency"
                  groupedResults={consistencyResults}
                  currentPage={currentPage}
                  pdf={pdf}
                  activeGroup={consistencyActiveGroup}
                  activeRuleOnPageCount={consistencyActiveOnPage}
                  findingsOnCurrentPage={consistencyFindingsOnPage}
                  totalFindings={consistencyTotalFindings}
                  categoryFindings={consistencyFindings}
                  hasCategoryRulesActive={hasConsistencyRulesActive}
                  isSameGroupAsSelected={isSameGroupAsSelected}
                  onSelectGroup={selectGroup}
                  onSelectPageInGroup={selectPageInGroup}
                  ruleSetName={ruleSetName}
                  onAdditionalCheck={backToConsistencySetup}
                />
              </>
            ) : (
              <div className="consistency-rules-scroll">
                <ConsistencyPanel
                  embedded
                  customRules={customRules}
                  onCustomRulesChange={onCustomRulesChange}
                  globalExcludePhrases={globalExcludePhrases}
                  onGlobalExcludePhrasesChange={onGlobalExcludePhrasesChange}
                  builtInEnabled={builtInEnabled}
                  onRunCheck={runCheck}
                  isProcessing={isProcessing}
                  canRunCheck={!!pageTexts.length}
                  progress={progress}
                  progressLabel={progressLabel}
                />
              </div>
            )}
          </>
        )}
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
          key={pdf ? `pdf-${pdf.numPages}` : 'no-pdf'}
          pdf={pdf}
          pageNum={currentPage}
          pageData={currentPageData}
          highlights={pageHighlights}
          emptyTitle={
            workTab === 'consistency' ? 'PDF를 연결하세요' : 'PDF를 업로드하세요'
          }
          emptyHint={
            workTab === 'consistency'
              ? '좌측 「PDF 열기」로 파일을 연결한 뒤 검사 실행'
              : '좌측 「PDF 업로드」 · 메모리에서만 처리'
          }
        />
        {pdf && (
          <div className="pdf-toolbar">
            {checkDone && sortedFindings.length > 0 ? (
              <>
                <button
                  type="button"
                  className="btn-finding-nav"
                  disabled={currentFindingIndex <= 0}
                  onClick={() => goToFinding(-1)}
                >
                  ← 이전 발견
                </button>
                <span className="pdf-toolbar-page">
                  발견 {currentFindingIndex >= 0 ? currentFindingIndex + 1 : '—'}{' '}
                  / {sortedFindings.length}
                  <span className="pdf-toolbar-findings">
                    · p.{currentPage}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn-finding-nav btn-finding-nav--next"
                  disabled={
                    currentFindingIndex < 0 ||
                    currentFindingIndex >= sortedFindings.length - 1
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
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  ← 이전 페이지
                </button>
                <span className="pdf-toolbar-page">
                  {currentPage} / {pdf.numPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= pdf.numPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(pdf.numPages, p + 1))
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
