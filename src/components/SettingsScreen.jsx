import { ArrowLeft } from 'lucide-react';
import ConsistencyPanel from './ConsistencyPanel.jsx';
import RuleSetSaveBar from './RuleSetSaveBar.jsx';

/**
 * @deprecated Welcome 등 레거시 진입용. 일반 흐름은 MainScreen 탭 사용.
 */
export default function SettingsScreen({
  ruleSetName,
  onRuleSetNameChange,
  builtInEnabled,
  customRules,
  onCustomRulesChange,
  globalExcludePhrases,
  onGlobalExcludePhrasesChange,
  onSave,
  onBack,
}) {
  return (
    <div className="settings-screen">
      <header className="settings-header">
        <div>
          <h1>일관성 확인</h1>
          <p className="subtitle">붙임 · 띄우기 패턴 · 사용자 규칙</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onBack}>
          <ArrowLeft size={16} />
          돌아가기
        </button>
      </header>
      <RuleSetSaveBar
        ruleSetName={ruleSetName}
        onRuleSetNameChange={onRuleSetNameChange}
        onSave={onSave}
      />
      <ConsistencyPanel
        customRules={customRules}
        onCustomRulesChange={onCustomRulesChange}
        globalExcludePhrases={globalExcludePhrases}
        onGlobalExcludePhrasesChange={onGlobalExcludePhrasesChange}
        builtInEnabled={builtInEnabled}
      />
    </div>
  );
}
