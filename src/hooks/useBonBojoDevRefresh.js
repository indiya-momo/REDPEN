import { useEffect, useRef } from 'react';
import {
  fetchBonBojoRulesFromPublic,
  fingerprintBonBojoPayload,
} from '../lib/bonBojoDevRefresh.js';

const POLL_MS = 4000;

/**
 * dev 전용 — `npm run sync-bon-bojo` 후 public JSON 변경 시 확인 대화상자로 반영
 * @param {{
 *   enabled?: boolean,
 *   ready?: boolean,
 *   appliedFingerprint?: string,
 *   onApply: () => void | Promise<void>,
 * }} options
 */
export function useBonBojoDevRefresh({
  enabled = import.meta.env.DEV,
  ready = true,
  appliedFingerprint = '',
  onApply,
}) {
  const promptedFpRef = useRef(/** @type {string | null} */ (null));
  const applyingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !ready || !appliedFingerprint) return;

    let cancelled = false;

    async function check() {
      if (cancelled || applyingRef.current) return;
      const data = await fetchBonBojoRulesFromPublic();
      if (cancelled || !data) return;

      const remoteFp = fingerprintBonBojoPayload(data);
      if (!remoteFp || remoteFp === appliedFingerprint) return;
      if (promptedFpRef.current === remoteFp) return;

      promptedFpRef.current = remoteFp;
      const ok = window.confirm(
        '본용언+보조용언 시트 데이터가 업데이트되었습니다.\n지금 반영할까요?',
      );
      if (!ok) return;

      applyingRef.current = true;
      try {
        await onApply(data, remoteFp);
      } finally {
        applyingRef.current = false;
      }
    }

    void check();
    const id = window.setInterval(() => {
      void check();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, ready, appliedFingerprint, onApply]);
}
