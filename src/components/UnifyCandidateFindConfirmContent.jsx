/**
 * 표기 통일 추천하기 찾기 직전 confirm 본문
 */

export default function UnifyCandidateFindConfirmContent() {
  return (
    <div className="app-dialog__unify-find-confirm">
      <p className="app-dialog__confirm-line">
        <span className="app-dialog__quota-ticket-kind">표기 통일 검수권</span>
        {' '}
        1장을 사용합니다
      </p>
      <p className="app-dialog__confirm-line">
        사용자의 PC 성능에 따라 10초 ~ 1분 정도 시간이 소요됩니다
      </p>
      <p className="app-dialog__confirm-line app-dialog__confirm-line--question">
        찾기를 진행할까요?
      </p>
    </div>
  );
}
