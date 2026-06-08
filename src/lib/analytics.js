import { APP_VERSION, UI_BUILD_ID, deployModeLabel } from './appVersion.js';
import { isBetaQuotaAdminExempt } from './betaDailyQuota.js';
import { resolvePostHogHost, resolvePostHogKey } from './posthogEnv.js';

const OPT_OUT_KEY = 'pdf-proofread-analytics-opt-out';
const SESSION_SENT_KEY = 'pdf-proofread-analytics-session';

/** @type {import('posthog-js').PostHog | null} */
let posthogClient = null;

/** initAnalytics 완료 전 capture — PDF가 빠르게 열릴 때 pdf_opened 유실 방지 */
/** @type {{ event: string, properties: Record<string, string | number | boolean> }[]} */
const pendingCaptures = [];

/** initAnalytics 완료 전 identify — 로그인 직후 person 속성 유실 방지 */
/** @type {{ uid: string, properties: Record<string, boolean> } | null} */
let pendingIdentify = null;

function flushPendingCaptures() {
  if (!posthogClient || isAnalyticsOptedOut()) {
    pendingCaptures.length = 0;
    return;
  }
  for (const item of pendingCaptures) {
    posthogClient.capture(item.event, item.properties);
  }
  pendingCaptures.length = 0;
}

function applyIdentify(id, properties) {
  if (!posthogClient || isAnalyticsOptedOut()) return;
  posthogClient.identify(id, properties);
  posthogClient.register({
    is_internal: properties.is_internal,
    is_logged_in: true,
  });
  // Live events에서 $identify 대신 확인하기 쉬운 커스텀 이벤트 (uid·이메일 없음)
  posthogClient.capture('user_identified', {
    is_internal: properties.is_internal,
    deploy_mode: deployModeLabel(),
    build_id: UI_BUILD_ID,
  });
}

function flushPendingIdentify() {
  if (!posthogClient || isAnalyticsOptedOut() || !pendingIdentify) {
    pendingIdentify = null;
    return;
  }
  const { uid, properties } = pendingIdentify;
  pendingIdentify = null;
  applyIdentify(uid, properties);
}

/** @type {Promise<void> | null} */
let analyticsInitPromise = null;

/** PostHog init 완료까지 대기 (identify 타이밍 보장) */
export function waitForAnalyticsReady() {
  if (!analyticsInitPromise) {
    analyticsInitPromise = initAnalytics();
  }
  return analyticsInitPromise;
}

/** @returns {boolean} */
export function isAnalyticsConfigured() {
  return Boolean(resolvePostHogKey());
}

/**
 * PostHog person — 이메일 없이 uid + 내부 테스트 여부만 (VITE_BETA_QUOTA_ADMIN_*)
 * @param {string} uid
 * @param {string} [email]
 */
export function buildAnalyticsPersonProperties(uid, email = '') {
  return {
    is_internal: isBetaQuotaAdminExempt(uid, email),
  };
}

/**
 * @param {string} uid Firebase uid (distinct_id)
 * @param {string} [email] env 면제 목록 비교용 — PostHog로 전송하지 않음
 */
export function identifyAnalyticsUser(uid, email = '') {
  if (isAnalyticsOptedOut()) return;
  const id = uid.trim();
  if (!id) {
    resetAnalyticsUser();
    return;
  }
  const properties = buildAnalyticsPersonProperties(id, email);
  if (!posthogClient) {
    pendingIdentify = { uid: id, properties };
    return;
  }
  applyIdentify(id, properties);
}

/**
 * check_run 등 로그인 필수 이벤트 직전 — PostHog identify 타이밍 보장
 * @param {string} uid
 * @param {string} [email]
 */
export async function ensureAnalyticsIdentified(uid, email = '') {
  if (isAnalyticsOptedOut()) return;
  if (!uid.trim()) return;
  await waitForAnalyticsReady();
  identifyAnalyticsUser(uid, email);
}

export function resetAnalyticsUser() {
  pendingIdentify = null;
  if (!posthogClient) return;
  posthogClient.reset();
}

export function isAnalyticsOptedOut() {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

/** @param {boolean} optOut */
export function setAnalyticsOptOut(optOut) {
  try {
    if (optOut) localStorage.setItem(OPT_OUT_KEY, '1');
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* private mode */
  }
  if (optOut) {
    pendingCaptures.length = 0;
    pendingIdentify = null;
    if (posthogClient) posthogClient.opt_out_capturing();
    return;
  }
  if (posthogClient) {
    posthogClient.opt_in_capturing();
    flushPendingCaptures();
    flushPendingIdentify();
  }
}

/** @param {number} n */
export function bucketPageCount(n) {
  if (n <= 50) return '1-50';
  if (n <= 150) return '51-150';
  if (n <= 300) return '151-300';
  return '301+';
}

/** @param {number} bytes */
export function bucketFileSizeMb(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb <= 10) return '0-10';
  if (mb <= 30) return '10-30';
  if (mb <= 50) return '30-50';
  return '50+';
}

/** @param {number} n */
export function bucketRuleCount(n) {
  if (n <= 0) return '0';
  if (n <= 10) return '1-10';
  if (n <= 30) return '11-30';
  if (n <= 100) return '31-100';
  return '101+';
}

/** @param {number} n */
export function bucketFindingCount(n) {
  if (n <= 0) return '0';
  if (n <= 20) return '1-20';
  if (n <= 100) return '21-100';
  if (n <= 500) return '101-500';
  return '501+';
}

/**
 * @param {string} event
 * @param {Record<string, string | number | boolean>} [properties]
 */
export function captureAnalytics(event, properties = {}) {
  if (isAnalyticsOptedOut()) return;
  if (!posthogClient) {
    pendingCaptures.push({ event, properties });
    return;
  }
  posthogClient.capture(event, properties);
}

export async function initAnalytics() {
  if (isAnalyticsOptedOut()) {
    pendingCaptures.length = 0;
    return;
  }
  const key = resolvePostHogKey();
  if (!key) {
    pendingCaptures.length = 0;
    pendingIdentify = null;
    return;
  }

  const { default: posthog } = await import('posthog-js');
  const host = resolvePostHogHost();

  posthog.init(key, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
  });

  posthogClient = posthog;
  posthog.opt_in_capturing();

  try {
    if (!sessionStorage.getItem(SESSION_SENT_KEY)) {
      sessionStorage.setItem(SESSION_SENT_KEY, '1');
      captureAnalytics('session_start', {
        app_version: APP_VERSION,
        build_id: UI_BUILD_ID,
        deploy_mode: deployModeLabel(),
      });
    }
  } catch {
    captureAnalytics('session_start', {
      app_version: APP_VERSION,
      build_id: UI_BUILD_ID,
      deploy_mode: deployModeLabel(),
    });
  }

  flushPendingCaptures();
  flushPendingIdentify();
}

/**
 * @param {{ pageCount: number, sizeBytes: number, textExtracted: boolean }} input
 */
export function trackPdfOpened(input) {
  captureAnalytics('pdf_opened', {
    page_count_bucket: bucketPageCount(input.pageCount),
    size_mb_bucket: bucketFileSizeMb(input.sizeBytes),
    text_extracted: input.textExtracted,
  });
}

/**
 * @param {{
 *   scope: 'spelling' | 'consistency' | 'toc-body',
 *   findingCount: number,
 *   activeRuleCount: number,
 * }} input
 * @param {{ uid?: string, email?: string }} [identity]
 */
export async function trackCheckRun(input, identity = {}) {
  await ensureAnalyticsIdentified(identity.uid ?? '', identity.email ?? '');
  captureAnalytics('check_run', {
    scope: input.scope,
    finding_count_bucket: bucketFindingCount(input.findingCount),
    active_rule_count_bucket: bucketRuleCount(input.activeRuleCount),
  });
}

/**
 * @param {{
 *   scope: 'spelling' | 'consistency',
 *   findingCount: number,
 * }} input
 */
export function trackResultViewed(input) {
  captureAnalytics('result_viewed', {
    scope: input.scope,
    finding_count_bucket: bucketFindingCount(input.findingCount),
  });
}

/**
 * @param {{
 *   builtinCount: number,
 *   spacingCount: number,
 *   consistencyCount: number,
 * }} input
 */
export function trackRulesetSaved(input) {
  captureAnalytics('ruleset_saved', {
    builtin_bucket: bucketRuleCount(input.builtinCount),
    spacing_bucket: bucketRuleCount(input.spacingCount),
    consistency_bucket: bucketRuleCount(input.consistencyCount),
  });
}

export function trackFeedbackOpened() {
  captureAnalytics('feedback_opened');
}
