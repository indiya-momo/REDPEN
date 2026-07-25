/**
 * 작업 가이드 말풍선 공통 UI — 둘러보기·로그인 문구에서 같이 쓴다.
 */
import { CircleHelp, LogOut } from 'lucide-react';

export function SpellingTabChip() {
  return (
    <span className="tooltip-guide__work-tab-chip tooltip-guide__work-tab-chip--spelling">
      맞춤법
    </span>
  );
}

export function ConsistencyTabChip() {
  return (
    <span className="tooltip-guide__work-tab-chip tooltip-guide__work-tab-chip--consistency">
      표기 통일
    </span>
  );
}

/** 말풍선 안 — 외래어 표기 「변환」버튼 모양 */
export function LoanwordConvertBtnLook() {
  return (
    <span className="tooltip-guide__loanword-convert-btn-look" aria-hidden>
      변환
    </span>
  );
}

/** 말풍선 안 — 통일형 「등록」버튼 모양 */
export function RegisterBtnLook() {
  return (
    <span className="tooltip-guide__register-btn-look" aria-hidden>
      등록
    </span>
  );
}

/** 말풍선 안 — FAQ 버튼 모양 (미리보기 바 FAQ) */
export function FaqBtnLook() {
  return (
    <span className="tooltip-guide__faq-btn-look" aria-hidden>
      <CircleHelp
        size={16}
        strokeWidth={2}
        className="tooltip-guide__faq-btn-look__icon"
      />
      FAQ
    </span>
  );
}

/** 말풍선 안 — 「로그아웃」aux 버튼 모양 */
export function LogoutBtnLook() {
  return (
    <span className="tooltip-guide__aux-btn-look" aria-hidden>
      <LogOut
        size={16}
        strokeWidth={2}
        className="tooltip-guide__aux-btn-look__icon"
      />
      로그아웃
    </span>
  );
}

/** 말풍선 안 — 브랜드 「인디야」 */
export function IndiyaBrandLook() {
  return (
    <span className="tooltip-guide__indiya-brand-look" aria-hidden>
      인디야
    </span>
  );
}
