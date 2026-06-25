/**
 * 앱 공통 alert/confirm — CriteriaSaveModal과 동일한 패널 UI.
 * AppDialogHost가 마운트되지 않은 환경(테스트 등)에서는 window.alert/confirm으로 폴백.
 */

/** @typedef {{
 *   title?: string,
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 * }} AppDialogOptions */

const HOST_REGISTRY_KEY = Symbol.for('pdf-publish-proofread.appDialogHost');

/** @type {{
 *   alert: (opts: AppDialogOptions) => Promise<void>,
 *   confirm: (opts: AppDialogOptions) => Promise<boolean>,
 * } | null} */
let moduleHost = null;

/**
 * @returns {{ api: { alert: Function, confirm: Function } | null }}
 */
function getHostRegistry() {
  if (typeof globalThis !== 'undefined') {
    if (!globalThis[HOST_REGISTRY_KEY]) {
      globalThis[HOST_REGISTRY_KEY] = { api: null };
    }
    return globalThis[HOST_REGISTRY_KEY];
  }
  return { api: moduleHost };
}

function resolveHost() {
  return getHostRegistry().api ?? moduleHost;
}

/**
 * @param {{
 *   alert: (opts: AppDialogOptions) => Promise<void>,
 *   confirm: (opts: AppDialogOptions) => Promise<boolean>,
 * }} api
 */
export function registerAppDialogHost(api) {
  moduleHost = api;
  getHostRegistry().api = api;
}

export function unregisterAppDialogHost() {
  moduleHost = null;
  getHostRegistry().api = null;
}

/**
 * `[제목]` 접두가 있으면 title·본문으로 분리
 * @param {string} raw
 */
export function parseBracketTitleMessage(raw) {
  const match = /^(\[[^\]]+\])\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    return { title: '안내', message: raw };
  }
  return {
    title: match[1].slice(1, -1),
    message: match[2].trimStart(),
  };
}

/**
 * @param {AppDialogOptions | string} opts
 */
export async function showAppAlert(opts) {
  const normalized =
    typeof opts === 'string' ? { message: opts } : { ...opts };
  const activeHost = resolveHost();
  if (activeHost) {
    await activeHost.alert(normalized);
    return;
  }
  const title = normalized.title?.trim();
  const body = normalized.message ?? '';
  const text = title ? `${title}\n\n${body}` : body;
  const alertFn = globalThis.alert;
  if (typeof alertFn === 'function') {
    alertFn(text);
    return;
  }
  throw new Error('showAppAlert: no dialog host and alert() unavailable');
}

/**
 * @param {AppDialogOptions | string} opts
 * @returns {Promise<boolean>}
 */
export async function showAppConfirm(opts) {
  const normalized =
    typeof opts === 'string'
      ? parseBracketTitleMessage(opts)
      : { ...opts };
  const activeHost = resolveHost();
  if (activeHost) {
    return activeHost.confirm(normalized);
  }
  const title = normalized.title?.trim();
  const body = normalized.message ?? '';
  const text = title ? `${title}\n\n${body}` : body;
  const confirmFn = globalThis.confirm;
  if (typeof confirmFn === 'function') {
    return confirmFn(text);
  }
  throw new Error('showAppConfirm: no dialog host and confirm() unavailable');
}
