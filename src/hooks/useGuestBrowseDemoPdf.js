/**
 * 둘러보기 전용 — 데모 원고 자동 로드 (로그인 온보딩 PRE_UPLOAD 경로와 분리)
 */
import { useEffect, useRef } from 'react';
import {
  guestBrowseAllowsDemoPdfAutoLoad,
  guestBrowseAllowsLocalDevExtras,
} from '../lib/guestBrowsePolicy.js';
import { fetchOnboardingSamplePdfFile } from '../lib/onboardingSamplePdf.js';

/**
 * @param {{
 *   isRestoring: boolean,
 *   hasPdf: boolean,
 *   loadPdfFile: (file: File) => Promise<unknown>,
 *   dismissPreUpload: () => void,
 *   onLoaded?: () => void,
 * }} options
 */
export function useGuestBrowseDemoPdf({
  isRestoring,
  hasPdf,
  loadPdfFile,
  dismissPreUpload,
  onLoaded,
}) {
  const loadRef = useRef(/** @type {'idle' | 'loading' | 'done'} */ ('idle'));

  useEffect(() => {
    if (!hasPdf && loadRef.current === 'done') {
      // 로컬 DEV: 「새 업로드」후 데모가 다시 덮어쓰지 않도록 유지
      if (guestBrowseAllowsLocalDevExtras()) return;
      loadRef.current = 'idle';
    }
  }, [hasPdf]);

  useEffect(() => {
    if (!guestBrowseAllowsDemoPdfAutoLoad()) return undefined;
    // 로컬 DEV: 데모 대신 직접 PDF 업로드
    if (guestBrowseAllowsLocalDevExtras()) return undefined;
    if (isRestoring) return undefined;
    if (hasPdf || loadRef.current !== 'idle') return undefined;
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
  }, [isRestoring, hasPdf, loadPdfFile, dismissPreUpload, onLoaded]);
}
