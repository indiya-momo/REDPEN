/**
 * DEV 전용 — 3단 명사 오표기(병기) 스파이크 패널.
 * 프로덕션 번들에서는 부모가 import.meta.env.DEV로 감싼다.
 */
import { useEffect, useState } from 'react';
import {
  discoverOrthographyFromPages,
  isOrthoNounSurface,
} from '../../lib/unifyOrthographyAnchorSpike.js';
import { stripPageLabelPrefix } from '../../lib/printedPageDisplay.js';

/**
 * @param {{
 *   hasPdf: boolean,
 *   pageTexts: { pageNum?: number, text?: string, textLayout?: string }[],
 *   isProcessing?: boolean,
 *   currentPage?: number,
 *   formatPageLabel: (systemPage: number) => string,
 *   onSelectInstance?: (inst: object) => void,
 * }} props
 */
export default function OrthoSpikeDevPanel({
  hasPdf,
  pageTexts,
  isProcessing = false,
  currentPage,
  formatPageLabel,
  onSelectInstance,
}) {
  const [orthoMixClusters, setOrthoMixClusters] = useState(
    /** @type {Array<import('../../lib/unifyOrthographyAnchorSpike.js').OrthoAnchorCluster & { pagesByVariant?: Record<string, number[]> }>} */ (
      []
    ),
  );
  const [orthoScanning, setOrthoScanning] = useState(false);

  useEffect(() => {
    if (!hasPdf || !pageTexts?.length || isProcessing) {
      setOrthoMixClusters([]);
      setOrthoScanning(false);
      return;
    }
    let cancelled = false;
    setOrthoScanning(true);
    const t = window.setTimeout(() => {
      try {
        const result = discoverOrthographyFromPages(pageTexts);
        if (cancelled) return;
        const mix = (result.mixClusters ?? [])
          .map((c) => ({
            ...c,
            variants: (c.variants ?? []).filter(isOrthoNounSurface),
          }))
          .filter((c) => c.variants.length >= 2);
        setOrthoMixClusters(mix);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[unify-ortho-spike] discover failed', err);
        }
        if (!cancelled) setOrthoMixClusters([]);
      } finally {
        if (!cancelled) setOrthoScanning(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [hasPdf, pageTexts, isProcessing]);

  if (!hasPdf || !pageTexts?.length) return null;

  return (
    <div
      className="unify-candidate-find__ortho-spike"
      role="region"
      aria-label="오표기 찾기"
    >
      <p className="unify-candidate-find__ortho-spike-title">
        오표기 찾기(개발 중)
        <span className="loanword-converter__free-badge loanword-converter__free-badge--yellow">
          3단·명사만
        </span>
      </p>
      {isProcessing || orthoScanning ? (
        <p className="unify-candidate-find__ortho-spike-status">
          {isProcessing ? 'PDF 텍스트 추출 중…' : '찾는 중…'}
        </p>
      ) : (
        <>
          <p className="unify-candidate-find__ortho-spike-status">
            병기 발견: {orthoMixClusters.length}건
          </p>
          {orthoMixClusters.length > 0 ? (
            <ul className="unify-candidate-find__ortho-spike-list">
              {orthoMixClusters.map((c) => (
                <li
                  key={c.key}
                  className="unify-candidate-find__ortho-spike-item"
                >
                  <div className="unify-candidate-find__ortho-spike-head">
                    <strong>{c.variants.join(' · ')}</strong>
                    <span className="unify-candidate-find__ortho-spike-latin">
                      ({c.latin})
                    </span>
                    <span className="unify-candidate-find__ortho-spike-verify">
                      검토 필요
                    </span>
                  </div>
                  <div className="unify-candidate-find__ortho-spike-meta">
                    추천(다수형) 「{c.recommendedUnify}」 ·{' '}
                    {c.variants
                      .map((v) => `${v} ${c.counts[v] ?? 0}`)
                      .join(' / ')}
                  </div>
                  {c.pagesByVariant ? (
                    <div className="unify-candidate-find__ortho-spike-pages">
                      {c.variants.map((v) => {
                        const pages = c.pagesByVariant?.[v] ?? [];
                        if (!pages.length) return null;
                        return (
                          <div
                            key={v}
                            className="unify-candidate-find__ortho-spike-page-row"
                          >
                            <span className="unify-candidate-find__ortho-spike-page-word">
                              {v}:
                            </span>{' '}
                            {pages.slice(0, 8).map((systemPage) => {
                              const label = formatPageLabel(systemPage);
                              const printed = stripPageLabelPrefix(label);
                              const printedDiffers =
                                printed !== String(systemPage);
                              return (
                                <button
                                  key={`${v}-${systemPage}`}
                                  type="button"
                                  className={[
                                    'page-chip',
                                    currentPage === systemPage
                                      ? 'page-chip--current'
                                      : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  title={
                                    printedDiffers
                                      ? `판형 ${printed}쪽 = PDF ${systemPage}쪽`
                                      : `PDF ${systemPage}쪽`
                                  }
                                  onClick={() => {
                                    onSelectInstance?.({
                                      find: v,
                                      replace: c.recommendedUnify,
                                      matchedText: v,
                                      suggestedText: c.recommendedUnify,
                                      pageNum: systemPage,
                                      index: 0,
                                    });
                                  }}
                                >
                                  <span className="page-chip__page">
                                    {label}
                                  </span>
                                </button>
                              );
                            })}
                            {pages.length > 8 ? (
                              <span className="unify-candidate-find__ortho-spike-more">
                                …
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
