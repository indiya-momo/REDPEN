const REOPEN_MAIN_KEY = 'indiya-reopen-main';

export function markReturnToMainWorkspace() {
  try {
    sessionStorage.setItem(REOPEN_MAIN_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** reload 직후 초기 screen을 main으로 잡을 때 (플래그는 consume 시 제거) */
export function shouldReopenMainWorkspace() {
  try {
    return sessionStorage.getItem(REOPEN_MAIN_KEY) === '1';
  } catch {
    return false;
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

/** 마이페이지 → 검수 화면 복귀 (뒤로가기·게스트). 프로젝트 전환은 저장만 — 메인에서 picker+reload */
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

  try {
    window.close();
  } catch {
    /* not script-opened */
  }

  const url = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
  window.location.replace(url.toString());
}
