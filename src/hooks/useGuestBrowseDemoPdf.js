/**
 * 둘러보기 전용 — 데모 원고 자동 로드 (로그인 온보딩 PRE_UPLOAD 경로와 분리)
 */
import { useEffect, useRef } from 'react';
import { guestBrowseAllowsDemoPdfAutoLoad } from '../lib/guestBrowsePolicy.js';
import { fetchOnboardingSamplePdfFile } from '../lib/onboardingSamplePdf.js';

/**
 * @param {{
 *   isRestoring: boolean,
 *   hasPdf: boolean,
 *   loadPdfFile: (file: File) => Promise<unknown>,
 *   showPreUploadGuide: boolean,
 *   dismissPreUpload: () => void,
 *   onLoaded?: () => void,
 * }} options
 */
export function useGuestBrowseDemoPdf({
  isRestoring,
  hasPdf,
  loadPdfFile,
  showPreUploadGuide,
  dismissPreUpload,
  onLoaded,
}) {
  const loadRef = useRef(/** @type {'idle' | 'loading' | 'done'} */ ('idle'));

  useEffect(() => {
    if (!hasPdf && loadRef.current === 'done') {
      loadRef.current = 'idle';
    }
  }, [hasPdf]);

  useEffect(() => {
    if (!guestBrowseAllowsDemoPdfAutoLoad()) return undefined;
    if (isRestoring) return undefined;
    if (hasPdf || loadRef.current !== 'idle') return undefined;
    if (!showPreUploadGuide) return undefined;
    if (import.meta.env.DEV) {
      const devPdf = new URLSearchParams(window.location.search).get('devPdf');
      if (devPdf) return undefined;
    }

    let cancelled = false;
    loadRef.current = 'loading';
    void (async () => {
      try {
        const file = await fetchOnboardingSamplePdfFile();
        if (cancelled) {
          loadRef.current = 'idle';
          return;
        }
        await loadPdfFile(file);
        if (cancelled) {
          loadRef.current = 'idle';
          return;
        }
        loadRef.current = 'done';
        onLoaded?.();
        dismissPreUpload();
      } catch {
        loadRef.current = 'idle';
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isRestoring,
    hasPdf,
    loadPdfFile,
    showPreUploadGuide,
    dismissPreUpload,
    onLoaded,
  ]);
}
