const REOPEN_MAIN_KEY = 'indiya-reopen-main';

export function markReturnToMainWorkspace() {
  try {
    sessionStorage.setItem(REOPEN_MAIN_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function consumeReturnToMainWorkspace() {
  try {
    if (sessionStorage.getItem(REOPEN_MAIN_KEY) !== '1') return false;
    sessionStorage.removeItem(REOPEN_MAIN_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearReturnToMainWorkspace() {
  try {
    sessionStorage.removeItem(REOPEN_MAIN_KEY);
  } catch {
    /* private mode */
  }
}

/** 마이페이지·안내 창 → 맞춤법/일관성 검수 화면으로 복귀 */
export function returnToWorkspace() {
  markReturnToMainWorkspace();

  if (window.opener && !window.opener.closed) {
    try {
      window.opener.focus();
      window.close();
      return;
    } catch {
      /* popup blocked or cross-origin */
    }
  }

  const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  window.location.replace(url.toString());
}
