/**
 * 둘러보기(게스트) 작업 가이드 말풍선 문구.
 * 로그인 온보딩 문구는 workGuideMessagesMember.jsx — 여기서 가져오지 않는다.
 */
import { Check, Save } from 'lucide-react';
import { AUXILIARY_VERB_FEATURE_LABEL } from './bonBojoRules.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
} from './consistencyRuleLimit.js';
import { LOANWORD_FEATURE_LABEL } from './loanwordCheckRules.js';
import {
  ConsistencyTabChip,
  FindBtnLook,
  IndiyaBrandLook,
  LoanwordConvertBtnLook,
  LogoutBtnLook,
  RegisterBtnLook,
  SeriesSpacingBtnsLook,
  SpellingTabChip,
} from './workGuideMessageUi.jsx';

export function LeftCriteriaMessage() {
  return (
    <>
      나는 검수냥 &apos;모모&apos; 만나서 반갑다냥
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
      <span className="tooltip-guide__criteria-summary-label">
        편집자 검토 필요
      </span>{' '}
      <span className="tooltip-guide__criteria-summary-label">맞춤법 규칙</span>
      <br />
      <span className="tooltip-guide__criteria-summary-label">
        {LOANWORD_FEATURE_LABEL}
      </span>
      을 검수할 수 있다냥
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
      검수가 완료되었다냥!
      <br />
      왼쪽은 결과창, 오른쪽은 원고창,
      <br />
      <span className="tooltip-guide__pdf-highlight-look">하이라이트</span>를
      클릭하면
      <br />
      기준에 대한 <span className="tooltip-guide__explain-badge">설명</span>이
      나온다냥
      <br />
      스크롤하며 천천히 살펴보라냥
    </>
  );
}

export function ConsistencyIntroMessage() {
  return (
    <>
      <ConsistencyTabChip /> 고민이었다면 ✋
      <br />
      <span className="tooltip-guide__criteria-summary-label">
        표기 통일 추천
      </span>
      은 원고에서 자동으로!
      <br />
      통일이 필요한 항목을 <FindBtnLook /> 제안한다냥
      <br />
      좋은 기능이니 꼭 활용해달라냥
    </>
  );
}

export function ConsistencyUnifyPinMessage() {
  return (
    <>
      표기 통일이 필요한 페이지를 볼 수 있고
      <br />
      <SeriesSpacingBtnsLook /> 하나를 결정하면
      <br />
      원고에 자동으로 반영된다냥
    </>
  );
}

export function ConsistencyLiteralFindMessage() {
  return (
    <>
      <span className="tooltip-guide__criteria-summary-label">
        {LITERAL_FIND_FEATURE_LABEL}
      </span>
      에서는 최대 5항목을
      <br />
      한 번에 검색할 수 있어 편리하다냥
      <br />
      <RegisterBtnLook />을 눌러 예시 항목을 추가해 보자냥!
    </>
  );
}

export function AuxiliaryVerbMessage() {
  return (
    <>
      <span className="tooltip-guide__criteria-summary-label">
        {AUXILIARY_VERB_FEATURE_LABEL}
      </span>
      <br />
      기준은{' '}
      <span
        className="tooltip-guide__checkbox-look tooltip-guide__checkbox-look--checked"
        aria-hidden
      >
        <Check size={10} strokeWidth={3.5} />
      </span>
      로 넣고 뺄 수 있다냥
      <br />
      집사가 이거 넣다가
      <br />
      맞춤법 공부 많이 해서
      <br />
      자기 전에 생각난다냥
    </>
  );
}

export function RuleSetSaveMessage() {
  return (
    <>
      회원은{' '}
      <span className="tooltip-guide__export-btn-look">검수 결과 다운로드</span>{' '}
      가능하고
      <br />
      <SpellingTabChip /> <ConsistencyTabChip /> 검수 기준을
      <br />
      프로젝트로{' '}
      <span className="tooltip-guide__save-rules-btn-look" aria-hidden>
        <Save size={16} strokeWidth={2} />
      </span>{' '}
      하고 관리할 수 있다냥
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
        처음에는 어색해도, 천천히 따라해보면
      </span>
      <span className="tooltip-guide__message-line">
        검수가 훨씬 편해질 거다냥
      </span>
      <span className="tooltip-guide__message-line">
        <LogoutBtnLook /> 후 <IndiyaBrandLook />에서 만나자냥
      </span>
    </>
  );
}
