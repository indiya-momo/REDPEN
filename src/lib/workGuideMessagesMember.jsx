/**
 * 로그인 온보딩 작업 가이드 말풍선 문구.
 * 둘러보기 문구는 workGuideMessagesGuest.jsx — 여기서 가져오지 않는다.
 */
import { Check, FilePlus, LogOut, MessageSquare, Save } from 'lucide-react';
import { AUXILIARY_VERB_FEATURE_LABEL } from './bonBojoRules.js';
import {
  LITERAL_FIND_FEATURE_LABEL,
  UNIFY_FEATURE_LABEL,
} from './consistencyRuleLimit.js';
import { ConsistencyTabChip, SpellingTabChip } from './workGuideMessageUi.jsx';

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
      클릭하면 맞춤법 기준을 볼 수 있고
      <br />
      기준을 누르면{' '}
      <span className="tooltip-guide__explain-badge">설명</span>이 나온다냥
      <br />
      <span
        className="tooltip-guide__checkbox-look tooltip-guide__checkbox-look--checked"
        aria-hidden
      >
        <Check size={10} strokeWidth={3} />
      </span>{' '}
      로 넣고 뺄 수 있다냥!
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
      인디야는 인터넷 브라우저 프로그램이라
      <br />
      PDF는 서버에 올라가지 않으니 안심하라냥
      <br />
      업로드 후 설명을 계속한다냥
    </>
  );
}

/**
 * 업로드 직후 — 기준 검수 안내.
 * 둘러보기 SpellingStartCheckMessage 와 문구·시점 모두 다름.
 */
export function SpellingStartCheckMessage() {
  return (
    <>
      업로드 성공!
      <br />
      이제 <span className="tooltip-guide__gothic-label">편집자 검토 필요</span>,{' '}
      <span className="tooltip-guide__gothic-label">맞춤법 규칙</span>,{' '}
      <span className="tooltip-guide__gothic-label">외래어 표기법</span>
      <br />
      세 가지 체크박스에서 적용할 기준을 확인하고
      <br />
      <span className="tooltip-guide__run-btn-look">기준 검수</span>를 해
      보자냥
    </>
  );
}

export function FirstResultMessage() {
  return (
    <>
      왼쪽: 검수 결과, 오른쪽: 반영 원고
      <br />
      위{' '}
      <span
        className="tooltip-guide__inline-real-btn pdf-zoom-bar"
        aria-hidden
      >
        <span className="pdf-zoom-bar__btn">
          <span className="pdf-zoom-bar__sign">−</span>
        </span>
        <span className="pdf-zoom-bar__btn">
          <span className="pdf-zoom-bar__sign">+</span>
        </span>
      </span>
      로 크기를 조절할 수 있고
      <br />
      아래{' '}
      <span
        className="tooltip-guide__inline-real-btn tooltip-guide__pdf-page-nav-look"
        aria-hidden
      >
        <span className="pdf-preview-bar__nav">◀</span>
        <span className="pdf-preview-bar__nav">▶</span>
      </span>
      로 페이지를 이동할 수 있다냥
    </>
  );
}

/** @param {{ literalAddClicked?: boolean }} _props */
export function ConsistencyIntroMessage(_props = {}) {
  return (
    <>
      <ConsistencyTabChip />을 살펴보자냥
      <br />
      <span className="tooltip-guide__criteria-heading-look">
        {UNIFY_FEATURE_LABEL}
      </span>
      는 유용한 기능이다냥
      <br />
      여러 항목을 입력한 다음
      <br />
      통일하고 싶은 항목에📌를 붙이면 된다냥
    </>
  );
}

export function ConsistencyUnifyPinMessage() {
  return (
    <>
      <span className="tooltip-guide__criteria-heading-look">
        {LITERAL_FIND_FEATURE_LABEL}
      </span>
      에서는
      <br />
      여러 항목을 한 번에 찾을 수 있다냥
      <br />
      <span className="tooltip-guide__criteria-heading-look">
        공통 항목 찾기
      </span>
      는 @을 포함한 항목을 모두 찾고
      <br />
      <span className="tooltip-guide__criteria-heading-look">
        검수 제외 항목
      </span>
      에 등록한 항목은 찾지 않는다냥
    </>
  );
}

/** 둘러보기 전용 — 로그인 온보딩 체인에서는 쓰지 않음 */
export function ConsistencyLiteralFindMessage() {
  return null;
}

export function AuxiliaryVerbMessage() {
  return (
    <>
      <span className="tooltip-guide__gothic-label">
        {AUXILIARY_VERB_FEATURE_LABEL}
      </span>
      <br />
      집사가 많이 고민했던 부분인데
      <br />
      ｢한글 맞춤법｣ 기준으로 정리했다냥
      <br />
      필요에 따라{' '}
      <span
        className="tooltip-guide__checkbox-look tooltip-guide__checkbox-look--checked"
        aria-hidden
      >
        <Check size={10} strokeWidth={3} />
      </span>
      해서 쓰라냥
    </>
  );
}

export function RuleSetSaveMessage() {
  return (
    <>
      <span className="tooltip-guide__message-line">
        <span className="tooltip-guide__export-btn-look">검수 결과 다운받기</span>
        도 가능하다냥
      </span>
      <span className="tooltip-guide__message-line">
        선택한 검수 기준에 이름을 붙여
      </span>
      <span className="tooltip-guide__message-line">
        프로젝트로{' '}
        <span className="tooltip-guide__save-rules-btn-look" aria-hidden>
          <Save size={16} strokeWidth={2} />
        </span>{' '}
        하면
      </span>
      <span className="tooltip-guide__message-line">
        같은 기준으로 편집을 계속할 수 있다냥
      </span>
    </>
  );
}

export function WorkExitMessage() {
  return (
    <>
      <span className="tooltip-guide__message-line">
        <span className="tooltip-guide__aux-btn-look">
          <FilePlus
            size={16}
            strokeWidth={2}
            aria-hidden
            className="tooltip-guide__aux-btn-look__icon"
          />
          새 업로드
        </span>
        와{' '}
        <span className="tooltip-guide__aux-btn-look">
          <LogOut
            size={16}
            strokeWidth={2}
            aria-hidden
            className="tooltip-guide__aux-btn-look__icon"
          />
          로그아웃
        </span>
        은 여기에서
      </span>
      <span className="tooltip-guide__message-line">
        인디야가 도움이 되었는지 궁금하다냥
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
        을 보내고 화면을 새로고침하면
      </span>
      <span className="tooltip-guide__message-line">
        곧바로 일일 검수권이 2배가 된다냥!
      </span>
    </>
  );
}
