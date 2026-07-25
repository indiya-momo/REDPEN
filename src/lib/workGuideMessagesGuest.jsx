/**
 * 둘러보기(게스트) 작업 가이드 말풍선 문구.
 * 로그인 온보딩 문구는 workGuideMessagesMember.jsx — 여기서 가져오지 않는다.
 */
import { MessageSquare } from 'lucide-react';
import { AUXILIARY_VERB_FEATURE_LABEL } from './bonBojoRules.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
} from './consistencyRuleLimit.js';
import { LOANWORD_FEATURE_LABEL } from './loanwordCheckRules.js';
import {
  LoanwordConvertBtnLook,
  RegisterBtnLook,
  SpellingTabChip,
} from './workGuideMessageUi.jsx';

export function LeftCriteriaMessage() {
  return (
    <>
      나는 교정냥 &apos;모모&apos;, 만나서 반갑다냥
      <br />
      인디야는 출판 PDF를 브라우저에서 검수하는 프로그램이다냥(AI를 사용하지
      않음)
      <br />
      먼저 <SpellingTabChip /> 탭을 소개한다냥
      <br />
      <span className="tooltip-guide__gothic-label">외래어 표기</span>는
      무제한으로 사용할 수 있으니
      <br />
      편안하게 <LoanwordConvertBtnLook /> 해 보라냥
    </>
  );
}

export function SpellingStartCheckMessage() {
  return (
    <>
      <span className="tooltip-guide__criteria-summary-label tooltip-guide__criteria-summary-label--caution">
        편집자 검토 필요
      </span>{' '}
      <span className="tooltip-guide__criteria-summary-label tooltip-guide__criteria-summary-label--spelling">
        맞춤법 규칙
      </span>
      <br />
      <span className="tooltip-guide__criteria-summary-label tooltip-guide__criteria-summary-label--loanword">
        {LOANWORD_FEATURE_LABEL}
      </span>{' '}
      항목이 있다냥
      <br />
      <span className="tooltip-guide__folder-icon" aria-hidden>
        📁
      </span>{' '}
      안에 세부 기준이 있고{' '}
      <span className="tooltip-guide__explain-badge">설명</span>도 볼 수
      있다냥
      <br />
      계속 추가되고 있으니 많관부!
      <br />
      <span className="tooltip-guide__run-btn-look">기준 검수</span>를 시작해
      보자냥
    </>
  );
}

export function FirstResultMessage() {
  return (
    <>
      <SpellingTabChip /> 검수가 완료되었다냥
      <br />
      왼쪽에는 검사 결과가 나온다냥
      <br />
      오른쪽 원고에서 하이라이트를 클릭하면
      <br />
      기준에 대한 <span className="tooltip-guide__explain-badge">설명</span>이
      나온다냥
    </>
  );
}

/** @param {{ unifyAddClicked?: boolean }} props */
export function ConsistencyIntroMessage({ unifyAddClicked = false } = {}) {
  if (unifyAddClicked) {
    return (
      <>
        <span className="tooltip-guide__gothic-label">
          {LITERAL_FIND_FEATURE_LABEL}
        </span>
        에서는 최대 5 항목을
        <br />
        한 번에 검색할 수 있어 편리하다냥
        <br />
        <RegisterBtnLook />을 눌러 예시 항목을 추가해 보자냥!
      </>
    );
  }
  return (
    <>
      <span className="tooltip-guide__gothic-label">{UNIFY_FEATURE_LABEL}</span>
      에서는
      <br />
      여러 항목을 통일📌할 수 있다냥
      <br />
      <RegisterBtnLook />을 눌러 예시 항목을 추가해 보자냥
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
      집사가 이거 넣다가
      <br />
      맞춤법 공부 많이 했다냥
      <br />
      자기전에 생각난다냥...
    </>
  );
}

export function RuleSetSaveMessage() {
  return (
    <>
      회원은 검수 결과를 다운받을 수 있고
      <br />
      검수 항목을 프로젝트로 저장할 수 있다냥
    </>
  );
}

export function WorkExitMessage() {
  return (
    <>
      <span className="tooltip-guide__message-line">
        모모는 늘 여기에 있다냥
      </span>
      <span className="tooltip-guide__message-line">
        회원 가입 후 사용하다 질문이 생기면
      </span>
      <span className="tooltip-guide__message-line">
        <span className="tooltip-guide__feedback-btn-look">
          <MessageSquare
            size={18}
            aria-hidden
            className="tooltip-guide__feedback-btn-look__icon"
          />
          피드백
        </span>
        으로 물어보라냥!
      </span>
    </>
  );
}
