/** details/summary 접기 표시 (▶ 문자 대신 — 폰트·캐시 영향 적음) */
export default function DetailsChevron() {
  return <span className="details-chevron" aria-hidden="true" />;
}

/**
 * React는 DOM `<details>`에 `defaultOpen`을 인식하지 않는다.
 * 마운트 시 한 번만 `open`을 켠다 (이후 사용자 토글은 브라우저 기본).
 * @param {boolean} shouldOpen
 * @returns {(el: HTMLDetailsElement | null) => void}
 */
export function detailsOpenOnceRef(shouldOpen) {
  return (el) => {
    if (!el || el.dataset.openInit === '1') return;
    el.dataset.openInit = '1';
    if (shouldOpen) el.open = true;
  };
}
