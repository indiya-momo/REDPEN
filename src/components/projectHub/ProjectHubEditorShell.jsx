/**
 * 목업(`mypage-mock`)·실제 마이페이지 「나의 프로젝트」 편집 화면 공통 래퍼.
 */
export default function ProjectHubEditorShell({ children }) {
  return (
    <div className="mypage__main-inner mypage__main-inner--section mypage__overview--projects">
      {children}
    </div>
  );
}
