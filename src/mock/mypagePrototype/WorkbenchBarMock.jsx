/**
 * @param {{
 *   card: import('../../presentation/projectCardViewModel.js').ProjectCardViewModel,
 *   onBackToLibrary: () => void,
 * }} props
 */
export default function WorkbenchBarMock({ card, onBackToLibrary }) {
  return (
    <div className="mypage-proto__workbench">
      <header className="mypage-proto__workbench-bar">
        <div className="mypage-proto__workbench-info">
          <p className="mypage-proto__workbench-label">작업 중인 기준</p>
          <p className="mypage-proto__workbench-title">
            《{card.title}》
            {card.dirty ? (
              <span className="sheet-card__flag sheet-card__flag--dirty">저장 전</span>
            ) : (
              <span className="sheet-card__flag sheet-card__flag--active">저장됨</span>
            )}
          </p>
        </div>
        <button
          type="button"
          className="sheet-card__btn"
          onClick={onBackToLibrary}
        >
          ← 라이브러리
        </button>
      </header>
      <div className="mypage-proto__workbench-body">
        <p className="mypage-proto__workbench-placeholder">
          규칙 on/off·추가·삭제는 <strong>기존 검수 화면(작업대)</strong>과
          동일합니다.
          <br />
          목업에서는 활성 프로젝트 바와 화면 전환만 확인합니다.
        </p>
        <div className="mypage-proto__workbench-fake-tabs" aria-hidden>
          <span className="mypage-proto__fake-tab mypage-proto__fake-tab--on">
            맞춤법
          </span>
          <span className="mypage-proto__fake-tab">일관성</span>
          <span className="mypage-proto__fake-tab">본·보조</span>
        </div>
      </div>
    </div>
  );
}
