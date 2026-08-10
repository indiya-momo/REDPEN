/** 파일↔원고 쪽수 맞추기 아이콘 — 맞바꾸기 화살표 */
export default function PageMatchIcon({ size = 20, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* 위: 오른쪽 화살 + 왼쪽 아래로 굽은 꼬리 */}
      <path
        d="M8 7h9.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M15.2 4.2 18.5 7l-3.3 2.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 7c-2.4 0-3.8 1.5-3.8 3.6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* 아래: 왼쪽 화살 + 오른쪽 위로 굽은 꼬리 */}
      <path
        d="M16 17H6.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M8.8 19.8 5.5 17l3.3-2.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17c2.4 0 3.8-1.5 3.8-3.6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
