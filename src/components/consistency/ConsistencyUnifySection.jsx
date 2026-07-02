import { useCallback, useMemo, useState } from 'react';
import { registerConsistencyUnifyBatch } from '../../lib/consistencyLiteralRegister.js';
import {
  applyConsistencyUnifyPin,
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
 *   onApplyRules: (next: import('../../lib/ruleTypes.js').Rule[]) => boolean,
 *   inlineRegisterRow?: boolean,
 * }} props
 */
export default function ConsistencyUnifySection({
  customRules,
  onApplyRules,
  inlineRegisterRow = false,
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
      onApplyRules(applyConsistencyUnifyPin(customRules, tailWord));
    },
    [customRules, onApplyRules],
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
          />
          <UnifyRegisteredList
            entries={unifyEntries}
            pinnedTailWord={pinnedTailWord}
            onPin={pinEntry}
            onRemove={removeEntry}
            hidePinUntilPinned
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
          />
          <UnifyRegisteredList
            entries={unifyEntries}
            pinnedTailWord={pinnedTailWord}
            onPin={pinEntry}
            onRemove={removeEntry}
          />
        </>
      )}
    </div>
  );
}
