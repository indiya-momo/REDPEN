import { useCallback, useMemo, useState } from 'react';
import { registerConsistencyUnifyBatch } from '../../lib/consistencyLiteralRegister.js';
import { applyUnifyPinWithLedger } from '../../lib/consistencyDecisions.js';
import {
  getConsistencyUnifyPinnedTailWord,
  removeConsistencyUnifyEntry,
} from '../../lib/consistencyUnifyRegister.js';
import {
  listConsistencyUnifyEntries,
  MAX_CONSISTENCY_UNIFY_SLOTS,
} from '../../lib/consistencyRuleLimit.js';
import ConsistencyRegisterField from './ConsistencyRegisterField.jsx';
import ConsistencyHintExample from './ConsistencyHintExample.jsx';
import UnifyRegisteredList from './UnifyRegisteredList.jsx';
import { CONSISTENCY_UNIFY_INPUT_PLACEHOLDER } from './constants.js';

/**
 * @param {{
 *   customRules: import('../../lib/ruleTypes.js').Rule[],
 *   onApplyRules: (
 *     next: import('../../lib/ruleTypes.js').Rule[],
 *     extra?: { consistencyDecisions?: import('../../lib/consistencyDecisions.js').ConsistencyDecision[] },
 *   ) => boolean,
 *   consistencyDecisions?: import('../../lib/consistencyDecisions.js').ConsistencyDecision[],
 *   decisionByUid?: string,
 *   inlineRegisterRow?: boolean,
 *   addButtonGuideAttr?: string,
 *   onAddButtonClick?: () => void,
 *   guidePinTailWord?: string | null,
 *   onGuidePinClick?: (tailWord: string) => void,
 * }} props
 */
export default function ConsistencyUnifySection({
  customRules,
  onApplyRules,
  consistencyDecisions = [],
  decisionByUid = '',
  inlineRegisterRow = false,
  addButtonGuideAttr,
  onAddButtonClick,
  guidePinTailWord = null,
  onGuidePinClick,
}) {
  const [unifiedDraft, setUnifiedDraft] = useState('');
  const unifyEntries = useMemo(
    () => listConsistencyUnifyEntries(customRules),
    [customRules],
  );
  const pinnedTailWord = useMemo(
    () => getConsistencyUnifyPinnedTailWord(customRules),
    [customRules],
  );
  const unifyRegisterFull = unifyEntries.length >= MAX_CONSISTENCY_UNIFY_SLOTS;

  const registerUnified = useCallback(() => {
    const input = unifiedDraft.trim() || CONSISTENCY_UNIFY_INPUT_PLACEHOLDER;
    if (registerConsistencyUnifyBatch(input, customRules, onApplyRules)) {
      setUnifiedDraft('');
    }
  }, [customRules, onApplyRules, unifiedDraft]);

  const pinEntry = useCallback(
    (tailWord) => {
      const result = applyUnifyPinWithLedger(
        customRules,
        consistencyDecisions,
        tailWord,
        { byUid: decisionByUid },
      );
      if (result.warning) {
        window.alert(result.warning);
      }
      onApplyRules(result.nextRules, {
        consistencyDecisions: result.nextDecisions,
      });
      onGuidePinClick?.(tailWord);
    },
    [
      consistencyDecisions,
      customRules,
      decisionByUid,
      onApplyRules,
      onGuidePinClick,
    ],
  );

  const removeEntry = useCallback(
    (tailWord) => {
      onApplyRules(removeConsistencyUnifyEntry(customRules, tailWord));
    },
    [customRules, onApplyRules],
  );

  return (
    <div className="consistency-subsection consistency-unify-section">
      <p className="printed-page-setup__title consistency-subsection-title panel-criteria-heading">
        통일형 만들기
        <span className="panel-criteria-heading-meta">
          (1회 {MAX_CONSISTENCY_UNIFY_SLOTS}항목까지 가능, 통일형 1항목 지원)
        </span>
      </p>
      <p className="hint consistency-hint-block">
        여러 항목 중 하나를 통일형📌으로 지정하고, 나머지를 찾아 바꿀 수 있습니다
        <br />
        <ConsistencyHintExample>
          &apos;신라시대 , 신라˅시대 , 통일신라시대&apos; 입력 → &apos;신라시대&apos; 통일형 📌지정하고 찾기
        </ConsistencyHintExample>
      </p>
      {inlineRegisterRow ? (
        <div className="project-hub-consistency-register-row">
          <ConsistencyRegisterField
            value={unifiedDraft}
            onChange={setUnifiedDraft}
            onRegister={registerUnified}
            placeholder={CONSISTENCY_UNIFY_INPUT_PLACEHOLDER}
            ariaLabel="통일형 만들기"
            registerDisabled={unifyRegisterFull}
            addButtonGuideAttr={addButtonGuideAttr}
            onAddButtonClick={onAddButtonClick}
          />
          <UnifyRegisteredList
            entries={unifyEntries}
            pinnedTailWord={pinnedTailWord}
            onPin={pinEntry}
            onRemove={removeEntry}
            guidePinTailWord={guidePinTailWord}
          />
        </div>
      ) : (
        <>
          <ConsistencyRegisterField
            value={unifiedDraft}
            onChange={setUnifiedDraft}
            onRegister={registerUnified}
            placeholder={CONSISTENCY_UNIFY_INPUT_PLACEHOLDER}
            ariaLabel="통일형 만들기"
            registerDisabled={unifyRegisterFull}
            addButtonGuideAttr={addButtonGuideAttr}
            onAddButtonClick={onAddButtonClick}
          />
          <UnifyRegisteredList
            entries={unifyEntries}
            pinnedTailWord={pinnedTailWord}
            onPin={pinEntry}
            onRemove={removeEntry}
            guidePinTailWord={guidePinTailWord}
          />
        </>
      )}
    </div>
  );
}
