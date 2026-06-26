import { useEffect, useRef } from 'react';
import { BON_BOJO_RULES_FP } from '../lib/bonBojoRules.js';
import {
  fetchBonBojoRulesFromPublic,
  fingerprintBonBojoPayload,
} from '../lib/bonBojoDevRefresh.js';

const SEEN_FP_SESSION_KEY = 'bonBojoDevRefreshSeenFp';
const LAST_APPLIED_FP_KEY = 'bonBojoDevLastAppliedFp';

/** @param {string} fp */
function readSeenFingerprints() {
  try {
    const raw = sessionStorage.getItem(SEEN_FP_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v) => typeof v === 'string' && v.trim())
      : [];
  } catch {
    return [];
  }
}

/** @param {string} fp */
function hasSeenFingerprint(fp) {
  return readSeenFingerprints().includes(fp);
}

/** @param {string} fp */
function markSeenFingerprint(fp) {
  try {
    const next = [...readSeenFingerprints(), fp].slice(-24);
    sessionStorage.setItem(SEEN_FP_SESSION_KEY, JSON.stringify(next));
  } catch {
    // private browsing 등
  }
}

function readLastAppliedFingerprint() {
  try {
    return localStorage.getItem(LAST_APPLIED_FP_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

/** @param {string} fp */
function writeLastAppliedFingerprint(fp) {
  try {
    localStorage.setItem(LAST_APPLIED_FP_KEY, fp);
  } catch {
    // quota 등
  }
}

/**
 * dev 전용 — `npm run sync-bon-bojo` 후 public JSON이 바뀐 경우에만 1회 확인
 * (4초 폴링 없음 · 번들과 같은 지문이면 조용히 맞춤)
 * @param {{
 *   enabled?: boolean,
 *   ready?: boolean,
 *   appliedFingerprint?: string,
 *   onApply: (data: import('../data/bon-bojo-rules.json'), remoteFp: string) => void | Promise<void>,
 * }} options
 */
export function useBonBojoDevRefresh({
  enabled = import.meta.env.DEV,
  ready = true,
  appliedFingerprint = '',
  onApply,
}) {
  const applyingRef = useRef(false);
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  useEffect(() => {
    if (!enabled || !ready || !appliedFingerprint) return;

    let cancelled = false;

    async function check() {
      if (cancelled || applyingRef.current) return;
      const data = await fetchBonBojoRulesFromPublic();
      if (cancelled || !data) return;

      const remoteFp = fingerprintBonBojoPayload(data);
      if (!remoteFp || remoteFp === appliedFingerprint) return;
      if (remoteFp === readLastAppliedFingerprint()) return;
      if (hasSeenFingerprint(remoteFp)) return;

      const applyRemote = async () => {
        applyingRef.current = true;
        try {
          await onApplyRef.current(data, remoteFp);
          writeLastAppliedFingerprint(remoteFp);
        } finally {
          applyingRef.current = false;
        }
      };

      // 저장 지문만 옛날이고 public JSON은 현재 번들과 같으면 팝업 없이 맞춤
      if (remoteFp === BON_BOJO_RULES_FP) {
        await applyRemote();
        return;
      }

      markSeenFingerprint(remoteFp);
      const ok = window.confirm(
        '본용언+보조용언 시트 데이터가 업데이트되었습니다.\n지금 반영할까요?',
      );
      if (!ok) return;

      await applyRemote();
    }

    void check();

    return () => {
      cancelled = true;
    };
  }, [enabled, ready, appliedFingerprint]);
}
