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
      여기서 PDF를 올리면 되고
      <br />
      원고 PDF는 서버에 저장되지 않으니 안심하라냥
      <br />
      <span className="tooltip-guide__run-btn-look">PDF 열기</span> 후
      설명을 계속한다냥
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
      멋지다냥, 업로드에 성공했다냥!
      <br />
      <span className="tooltip-guide__gothic-label">편집자 검토 필요</span>,{' '}
      <span className="tooltip-guide__gothic-label">맞춤법 규칙</span>에서
      <br />
      적용할 기준을 정하고
      <br />
      <span className="tooltip-guide__run-btn-look">기준 검수</span>를 해
      보자냥
    </>
  );
}

export function FirstResultMessage() {
  return (
    <>
      추가하고 싶은 기준이 있으면
      <br />
      <span className="tooltip-guide__feedback-btn-look">
        <MessageSquare
          size={18}
          aria-hidden
          className="tooltip-guide__feedback-btn-look__icon"
        />
        피드백
      </span>
      으로 알려달라냥
      <br />
      왼쪽은 기준, 오른쪽은 검수 원고가 있고
      <br />
      <span className="tooltip-guide__gothic-label">
        파일 - 원고 페이지 맞추기
      </span>
      를 하면 편해진다냥
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
        {LITERAL_FIND_FEATURE_LABEL}
      </span>
      에서는
      <br />
      여러 항목을 한 번에 검색하고
      <br />
      <span className="tooltip-guide__criteria-heading-look">
        {UNIFY_FEATURE_LABEL}
      </span>
      에서는
      <br />
      여러 항목을 통일할 수 있다냥
    </>
  );
}

export function ConsistencyUnifyPinMessage() {
  return (
    <>
      여러 항목을 입력하고 통일형에📌를 붙이라냥
      <br />
      <span className="tooltip-guide__criteria-heading-look">
        공통 항목 찾기
      </span>
      는 @를 잊지 말라냥
      <br />
      <span className="tooltip-guide__criteria-heading-look">
        검수 제외 항목
      </span>
      은 찾지 않는다냥
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
      집사가 많이 고민했던 부분인데
      <br />
      ｢한글맞춤법｣ 기준으로 정리했다냥
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
        가 가능하다냥
      </span>
      <span className="tooltip-guide__message-line">
        유료 회원은 프로젝트에도 결과(목록·요약)가 잠시 보관된다냥
      </span>
      <span className="tooltip-guide__message-line">
        이때까지 선택한 기준에 이름을 붙이고
      </span>
      <span className="tooltip-guide__message-line">
        프로젝트로{' '}
        <span className="tooltip-guide__save-rules-btn-look" aria-hidden>
          <Save size={16} strokeWidth={2} />
        </span>{' '}
        하면
      </span>
      <span className="tooltip-guide__message-line">
        같은 기준으로 작업을 계속할 수 있다냥
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
        곧바로 선물을 받을 수 있다냥!
      </span>
    </>
  );
}
