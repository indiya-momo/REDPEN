/** 파일↔원고 쪽수 맞추기 아이콘 — 1장 ↔ 펼침면(1|2) */
export default function PageMatchIcon({ size = 20, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 24"
      width={size}
      height={Math.round((size * 24) / 48)}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M4.5 3.5h9.2l3.3 3.3V20.5H4.5V3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M13.7 3.5v3.3h3.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <text
        x="10.5"
        y="15.2"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="9"
        fontWeight="600"
        fill="currentColor"
      >
        1
      </text>
      <path
        d="M21 9.2h6.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M25.4 6.8 28 9.2l-2.6 2.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27.2 14.8H21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M22.8 12.4 20.2 14.8l2.6 2.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="31"
        y="3.5"
        width="14.5"
        height="17"
        rx="1.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M38.25 3.5v17" stroke="currentColor" strokeWidth="1.6" />
      <text
        x="34.6"
        y="15.2"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="8"
        fontWeight="600"
        fill="currentColor"
      >
        1
      </text>
      <text
        x="41.9"
        y="15.2"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize="8"
        fontWeight="600"
        fill="currentColor"
      >
        2
      </text>
    </svg>
  );
}
