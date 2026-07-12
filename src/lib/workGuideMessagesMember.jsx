/**
 * 로그인 온보딩 작업 가이드 말풍선 문구.
 * 둘러보기 문구는 workGuideMessagesGuest.jsx — 여기서 가져오지 않는다.
 */
import { Save } from 'lucide-react';
import { AUXILIARY_VERB_FEATURE_LABEL } from './bonBojoRules.js';
import { LITERAL_FIND_FEATURE_LABEL } from './consistencyRuleLimit.js';
import { SpellingTabChip } from './workGuideMessageUi.jsx';

/** 0 — 맞춤법 탭·외래어 소개 */
export function SpellingTabIntroMessage() {
  return (
    <>
      교정냥 &apos;모모&apos;다냥
      <br />
      먼저 <SpellingTabChip /> 탭을 소개한다냥
      <br />
      <span className="tooltip-guide__gothic-label">외래어 표기</span>는
      무제한이다냥
      <br />
      필요한 만큼 마음껏 사용하라냥
    </>
  );
}

/** 1 — 검수 기준 */
export function LeftCriteriaMessage() {
  return (
    <>
      <span className="tooltip-guide__gothic-label">편집자 검토 필요</span>,{' '}
      <span className="tooltip-guide__gothic-label">맞춤법 규칙</span>이다냥
      <br />
      <span className="tooltip-guide__folder-icon" aria-hidden>
        📁
      </span>{' '}
      클릭하면 기준 항목을 볼 수 있고
      <br />
      항목을 누르면 설명이 나온다냥
      <br />
      <span className="tooltip-guide__checkbox-look" aria-hidden /> 로 넣고 뺄
      수 있다냥!
    </>
  );
}

/**
 * 1b — 업로드 (옛 0).
 * 회원 체인에서만 사용. 둘러보기 1b(SPELLING_START_CHECK)와 별개.
 */
export function PreUploadMessage() {
  return (
    <>
      여기서 PDF를 올리면 된다냥
      <br />
      서버에 저장되지 않으니 안심하라냥
    </>
  );
}

/** @deprecated 회원 체인에서는 1b=PRE_UPLOAD. 강제 스텝 안전용 */
export function SpellingStartCheckMessage() {
  return <PreUploadMessage />;
}

export function FirstResultMessage() {
  return (
    <>
      검수는 아직 부족한 점이 있다냥
      <br />
      <span className="tooltip-guide__feedback-btn-look">피드백</span>는 언제나
      환영이다냥
      <br />
      원고의 표시를 클릭하면 설명을 볼 수 있다냥
    </>
  );
}

/** @param {{ literalAddClicked?: boolean }} _props */
export function ConsistencyIntroMessage(_props = {}) {
  return (
    <>
      <span className="tooltip-guide__feature-badge">
        {LITERAL_FIND_FEATURE_LABEL}
      </span>
      에서는
      <br />
      여러 항목을 한 번에 검색하고
      <br />
      통일형 만들기에서는
      <br />
      여러 항목을 통일할 수 있다냥
    </>
  );
}

export function ConsistencyUnifyPinMessage() {
  return (
    <>
      통일형으로 지정하고 싶은 항목에
      <br />
      📌를 붙이면 된다냥
    </>
  );
}

export function AuxiliaryVerbMessage() {
  return (
    <>
      <span className="tooltip-guide__gothic-label">
        {AUXILIARY_VERB_FEATURE_LABEL}
      </span>
      <br />
      이거 하다보면 공부 많이 되고
      <br />
      자기 전에 생각난다냥...
    </>
  );
}

export function RuleSetSaveMessage() {
  return (
    <>
      <span className="tooltip-guide__message-line">
        선택한 기준 리스트를{' '}
        <span className="tooltip-guide__save-rules-btn-look" aria-hidden>
          <Save size={14} strokeWidth={2} />
        </span>
        해서
      </span>
      <span className="tooltip-guide__message-line">
        프로젝트로 관리할 수 있다냥
      </span>
    </>
  );
}

export function WorkExitMessage() {
  return (
    <>
      <span className="tooltip-guide__message-line">
        새 업로드와 로그아웃은 여기,
      </span>
      <span className="tooltip-guide__message-line">
        피드백 보내기를 하고 화면을 새로고침하면
      </span>
      <span className="tooltip-guide__message-line">
        곧바로 선물을 받을 수 있다냥!
      </span>
    </>
  );
}
