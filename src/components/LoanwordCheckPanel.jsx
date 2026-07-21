/**
 * 자주 틀리는 외래어 표기법 검수 기준 패널 — 맞춤법 탭 세 번째 구분.
 *
 * 국립국어원 심의 근거로 선별한 내장 규칙 중 "자주 틀리는 외래어 표기법(…)" 묶음
 * (영어 / 프랑스어·독일어 / 그 외)만 따로 보여준다. 렌더링·켜고 끄기·항목 CSS는
 * 맞춤법 규칙 패널(BuiltinSpellingPanel / rules-scroll)과 동일하다.
 */
import BuiltinSpellingPanel from './BuiltinSpellingPanel.jsx';
import { LOANWORD_QUOTA_RULES_UI } from '../lib/builtInRules.js';
import { LOANWORD_FEATURE_LABEL } from '../lib/loanwordCheckRules.js';
import { LOANWORD_ORTHOGRAPHY_URL } from '../lib/koreanNormsLinks.js';

/**
 * @param {{
 *   builtInEnabled: Record<string, boolean>,
 *   onBuiltInToggle: (find: string) => void,
 *   onBuiltInSetAll: (enabled: boolean, rules?: import('../lib/ruleTypes.js').Rule[]) => void,
 * }} props
 */
export default function LoanwordCheckPanel({
  builtInEnabled,
  onBuiltInToggle,
  onBuiltInSetAll,
}) {
  return (
    <BuiltinSpellingPanel
      builtInEnabled={builtInEnabled}
      onBuiltInToggle={onBuiltInToggle}
      onBuiltInSetAll={onBuiltInSetAll}
      quotaRules={LOANWORD_QUOTA_RULES_UI}
      guideRules={[]}
      title={LOANWORD_FEATURE_LABEL}
      sourceHref={LOANWORD_ORTHOGRAPHY_URL}
      sourceLabel="외래어 표기법"
      classPrefix="loanword-check"
      dataWorkGuide="criteria-loanword-heading"
      selectAllAriaLabel={`${LOANWORD_FEATURE_LABEL} 전체 선택`}
    />
  );
}
