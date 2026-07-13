/**
 * 둘러보기(게스트) 작업 가이드 말풍선 문구.
 * 로그인 온보딩 문구는 workGuideMessagesMember.jsx — 여기서 가져오지 않는다.
 */
import { MessageSquare } from 'lucide-react';
import { AUXILIARY_VERB_FEATURE_LABEL } from './bonBojoRules.js';
import { LITERAL_FIND_FEATURE_LABEL } from './consistencyRuleLimit.js';
import {
  ConsistencyTabChip,
  SpellingTabChip,
} from './workGuideMessageUi.jsx';

export function LeftCriteriaMessage() {
  return (
    <>
      교정냥 &apos;모모&apos;다냥, 만나서 반갑다냥!
      <br />
      먼저 <SpellingTabChip /> 탭부터 보자냥
      <br />
      <span className="tooltip-guide__gothic-label">외래어 표기</span>는 매일
      무제한 사용 가능하다냥
    </>
  );
}

export function SpellingStartCheckMessage() {
  return (
    <>
      <span className="tooltip-guide__gothic-label">편집자 검토 필요</span>는
      확인을 꼭 해야 한다냥
      <br />
      <span className="tooltip-guide__gothic-label">맞춤법 규칙</span>은 바로
      적용해도 괜찮다냥
      <br />
      일단 검수를 시작해 보자냥
    </>
  );
}

export function FirstResultMessage() {
  return (
    <>
      맞춤법 검수가 완료되었다냥
      <br />
      왼쪽에는{' '}
      <span className="results-header-badge result-pillar--spelling-caution">
        편집자 검토 필요
      </span>{' '}
      <span className="results-header-badge result-pillar--spelling">
        맞춤법 규칙
      </span>
      <br />
      검사 결과가 나온다냥
      <br />
      오른쪽 원고에서 하이라이트를 클릭하면
      <br />
      해당하는 설명이 나온다냥
    </>
  );
}

/** @param {{ literalAddClicked?: boolean }} props */
export function ConsistencyIntroMessage({ literalAddClicked = false }) {
  if (literalAddClicked) {
    return (
      <>
        <span className="tooltip-guide__gothic-label">통일형 만들기</span>
        에서는
        <br />
        여러 항목을 통일할 수 있다냥
        <br />
        +를 눌러 예시 항목을 추가해 보자냥!
      </>
    );
  }
  return (
    <>
      <ConsistencyTabChip /> 기능이다냥
      <br />
      <span className="tooltip-guide__gothic-label">
        {LITERAL_FIND_FEATURE_LABEL}
      </span>
      에서는 최대 5개를
      <br />
      한 번에 검색할 수 있어 편리하다냥
      <br />
      +를 눌러 예시 항목을 추가해 보자냥!
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
