import { useMemo } from 'react';
import { encodeSpacesVisible } from '../lib/spaceVisibleText.js';
import { groupPhraseSlotInstancesByFill } from '../lib/phraseSlotResultGroups.js';
import ResultPageSummary from './ResultPageSummary.jsx';

/**
 * 공통 항목 찾기 — 카드 안 표기별 묶음 + 페이지 칩.
 * @param {{
 *   instances: import('../lib/ruleEngine.js').MatchInstance[],
 *   currentPage: number,
 *   selectedInstance?: import('../lib/ruleEngine.js').MatchInstance | null,
 *   formatPageLabel?: (systemPage: number) => string,
 *   onSelectPage: (pageNum: number, fillInstances: import('../lib/ruleEngine.js').MatchInstance[]) => void,
 *   onSelectInstance?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 *   isInstanceVisible?: (inst: import('../lib/ruleEngine.js').MatchInstance) => boolean,
 *   onToggleInstanceVisibility?: (inst: import('../lib/ruleEngine.js').MatchInstance) => void,
 * }} props
 */
export default function PhraseSlotResultSummary({
  instances,
  currentPage,
  selectedInstance = null,
  formatPageLabel,
  onSelectPage,
  onSelectInstance,
  isInstanceVisible,
  onToggleInstanceVisibility,
}) {
  const groups = useMemo(
    () => groupPhraseSlotInstancesByFill(instances),
    [instances],
  );

  if (!groups.length) return null;

  return (
    <ul className="phrase-slot-fills">
      {groups.map((group) => (
        <li key={group.text} className="phrase-slot-fills__item">
          <div className="phrase-slot-fills__row">
            <span className="phrase-slot-fills__text">
              {encodeSpacesVisible(group.text)}
            </span>
            <span className="phrase-slot-fills__count">{group.count}</span>
          </div>
          <ResultPageSummary
            instances={group.instances}
            currentPage={currentPage}
            selectedInstance={selectedInstance}
            formatPageLabel={formatPageLabel}
            onSelectPage={(pageNum) => onSelectPage(pageNum, group.instances)}
            onSelectInstance={onSelectInstance}
            isInstanceVisible={isInstanceVisible}
            onToggleInstanceVisibility={onToggleInstanceVisibility}
          />
        </li>
      ))}
    </ul>
  );
}
