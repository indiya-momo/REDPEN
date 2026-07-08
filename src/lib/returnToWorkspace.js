/** localStorage — popup·탭 간 검수 화면 복귀 신호 (sessionStorage는 창마다 분리됨) */
export const RETURN_TO_MAIN_STORAGE_KEY = 'indiya-reopen-main';

export function markReturnToMainWorkspace() {
  try {
    localStorage.setItem(RETURN_TO_MAIN_STORAGE_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** reload 직후 초기 screen을 main으로 잡을 때 (플래그는 consume 시 제거) */
export function shouldReopenMainWorkspace() {
  try {
    return localStorage.getItem(RETURN_TO_MAIN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function consumeReturnToMainWorkspace() {
  try {
    if (localStorage.getItem(RETURN_TO_MAIN_STORAGE_KEY) !== '1') return false;
    localStorage.removeItem(RETURN_TO_MAIN_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function clearReturnToMainWorkspace() {
  try {
    localStorage.removeItem(RETURN_TO_MAIN_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

/** 마이페이지 → 검수 화면 복귀 (뒤로가기·게스트). 프로젝트 전환은 저장만 — 메인에서 picker+reload */
export function returnToWorkspace() {
  markReturnToMainWorkspace();

  const mainUrl = new URL(import.meta.env.BASE_URL || '/', window.location.origin);

  if (window.opener && !window.opener.closed) {
    try {
      window.opener.focus();
      window.close();
      return;
    } catch {
      /* popup blocked or cross-origin */
    }
  }

  // opener 없음(단독 탭·메인 창 닫힘): close()만 하면 창 전체가 사라짐 → 메인 URL로 이동
  window.location.replace(mainUrl.toString());
}
