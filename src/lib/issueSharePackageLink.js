/**
 * 허브에서 공유 패키지 발급 → 클립보드 URL.
 */
import { showAppAlert } from './appDialog.js';
import { listCheckResultsCloud } from './checkResultsCloud.js';
import { assertPaidShareOrAlert } from './paidPlanGate.js';
import { createSharePackageCloud } from './sharePackageCloud.js';

/**
 * @param {{
 *   uid: string,
 *   ruleSet: import('./ruleSetsStorage.js').RuleSet | null | undefined,
 * }} args
 * @returns {Promise<{ ok: boolean }>}
 */
export async function issueSharePackageLink({ uid, ruleSet }) {
  const id = String(uid ?? '').trim();
  if (!(await assertPaidShareOrAlert(id))) {
    return { ok: false };
  }
  if (!ruleSet?.id || !ruleSet.savedAt) {
    await showAppAlert('저장된 프로젝트만 공유할 수 있습니다.');
    return { ok: false };
  }

  let checkResults = [];
  try {
    checkResults = await listCheckResultsCloud({
      uid: id,
      projectId: ruleSet.id,
    });
  } catch (err) {
    console.error('공유용 검수 결과 목록 실패:', err);
  }

  const result = await createSharePackageCloud({
    uid: id,
    ruleSet,
    checkResults,
  });

  if (!result.ok) {
    const message =
      result.reason === 'cloud_disabled'
        ? '공유 기능을 사용할 수 없습니다. 네트워크·로그인을 확인해 주세요.'
        : '공유 링크를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.';
    await showAppAlert(message);
    return { ok: false };
  }

  try {
    await navigator.clipboard.writeText(result.url);
    await showAppAlert({
      title: '공유 링크가 복사되었습니다',
      message:
        '링크를 상대에게 보내 주세요.\n상대는 기준·검수 결과를 보고, 자기 PDF로 같은 기준 검수를 할 수 있습니다.\n\n' +
        result.url,
    });
  } catch {
    await showAppAlert({
      title: '공유 링크',
      message:
        '클립보드 복사에 실패했습니다. 아래 주소를 직접 복사해 주세요.\n\n' +
        result.url,
    });
  }
  return { ok: true };
}
