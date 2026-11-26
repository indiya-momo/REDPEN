/**
 * 조판 교정 부호 SVG — 툴바·PDF 오버레이 공용.
 * @param {{
 *   kind: string,
 *   className?: string,
 *   size?: number,
 *   height?: number,
 *   strokeWidth?: number,
 * }} props
 */
export function LayoutMarkGlyph({
  kind,
  className,
  size = 18,
  height,
  strokeWidth = 1.75,
}) {
  const common = {
    width: size,
    height: height ?? size,
    viewBox: '0 0 18 18',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    vectorEffect: 'non-scaling-stroke',
    preserveAspectRatio: height && height !== size ? 'none' : 'xMidYMid meet',
    'aria-hidden': true,
    className,
  };
  if (kind === 'paraSplit') {
    return (
      <svg {...common}>
        <path d="M3.5 15.3h5.5V2.7h5.5" />
      </svg>
    );
  }
  if (kind === 'paraGap') {
    return (
      <svg {...common}>
        <path d="M5 3.5 13 9 5 14.5" />
      </svg>
    );
  }
  if (kind === 'indent') {
    /* 오른자리 옮김표 — 툴바 다른 아이콘과 같은 18 viewBox·선 두께 */
    return (
      <svg {...common}>
        <path d="M12.75 2.4 V5.6 H5.25 V12.4 H12.75 V15.6" />
      </svg>
    );
  }
  return null;
}
