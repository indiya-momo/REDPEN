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
import { isGuestBrowseActive } from '../../lib/guestBrowsePolicy.js';
import ConsistencyRegisterField from './ConsistencyRegisterField.jsx';
import ConsistencyHintExample from './ConsistencyHintExample.jsx';
import UnifyRegisteredList from './UnifyRegisteredList.jsx';
import { CONSISTENCY_UNIFY_INPUT_PLACEHOLDER, GUEST_BROWSE_UNIFY_INPUT_PLACEHOLDER } from './constants.js';

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
 *   hideHeading?: boolean,
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
  hideHeading = false,
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
  const guestBrowse = isGuestBrowseActive();
  const unifyPlaceholder = guestBrowse
    ? GUEST_BROWSE_UNIFY_INPUT_PLACEHOLDER
    : CONSISTENCY_UNIFY_INPUT_PLACEHOLDER;
  /** 둘러보기 — 한도 안내 숨김·가이드 + 클릭 유지 (한도 자체는 유지) */
  const suppressLimitMessage = guestBrowse;
  const registerBlocked = unifyRegisterFull && !guestBrowse;

  const registerUnified = useCallback(() => {
    const input = unifiedDraft.trim() || unifyPlaceholder;
    if (
      registerConsistencyUnifyBatch(input, customRules, onApplyRules, {
        silentLimit: suppressLimitMessage,
      })
    ) {
      setUnifiedDraft('');
    }
  }, [
    customRules,
    onApplyRules,
    suppressLimitMessage,
    unifiedDraft,
    unifyPlaceholder,
  ]);

  const pinEntry = useCallback(
    (tailWord) => {
      const result = applyUnifyPinWithLedger(
        customRules,
        consistencyDecisions,
        tailWord,
        { byUid: decisionByUid },
      );
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
      {hideHeading ? null : (
        <>
          <p className="printed-page-setup__title consistency-subsection-title panel-criteria-heading">
            표기 통일하기
          </p>
          <p className="hint consistency-hint-block">
            여러 항목을 입력하고 하나를 📌통일형으로 지정하세요
            <br />
            <ConsistencyHintExample>
              <span className="consistency-hint-batang">
                조선시대, 조선˅시대
              </span>{' '}
              등록 후{' '}
              <span className="consistency-hint-batang">조선시대</span> 📌사용자
              지정 →{' '}
              <span className="consistency-hint-batang">조선˅시대</span> 찾아
              변경 표시
            </ConsistencyHintExample>
          </p>
        </>
      )}
      {inlineRegisterRow ? (
        <div className="project-hub-consistency-register-row">
          <ConsistencyRegisterField
            value={unifiedDraft}
            onChange={setUnifiedDraft}
            onRegister={registerUnified}
            placeholder={unifyPlaceholder}
            ariaLabel="표기 통일하기"
            registerDisabled={registerBlocked}
            hideLimitTitle={suppressLimitMessage}
            addButtonGuideAttr={addButtonGuideAttr}
            onAddButtonClick={onAddButtonClick}
            addLabel="등록"
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
            placeholder={unifyPlaceholder}
            ariaLabel="표기 통일하기"
            registerDisabled={registerBlocked}
            hideLimitTitle={suppressLimitMessage}
            addButtonGuideAttr={addButtonGuideAttr}
            onAddButtonClick={onAddButtonClick}
            addLabel="등록"
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
