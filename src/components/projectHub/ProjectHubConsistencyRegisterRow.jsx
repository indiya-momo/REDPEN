/**
 * 마이페이지 표기 통일 — 등록 칩(좌) + 검색창(우) 한 줄 배치.
 *
 * @param {{ children: import('react').ReactNode }} props
 */
export default function ProjectHubConsistencyRegisterRow({ children }) {
  return (
    <div className="project-hub-consistency-register-row">{children}</div>
  );
}
