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
        : result.reason === 'permission_denied'
          ? '공유 링크를 만들 권한이 없습니다. 로그인·유료 상태를 확인해 주세요.'
          : result.reason === 'too_large'
            ? '공유 데이터가 너무 큽니다. 검수 이력이 많으면 일부만 포함하거나 잠시 후 다시 시도해 주세요.'
            : result.reason === 'invalid_payload' ||
                result.reason === 'invalid_project'
              ? '공유할 프로젝트 데이터를 준비하지 못했습니다. 저장 후 다시 시도해 주세요.'
              : '공유 링크를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.';
    await showAppAlert(message);
    return { ok: false };
  }

  try {
    await navigator.clipboard.writeText(result.url);
    await showAppAlert({
      title: '공유 링크가 복사되었습니다',
      message:
        '공유 링크가 있는 사용자는 프로젝트 정보를 볼 수 있으며\n인디야 유료회원은 프로젝트를 적용하여 작업할 수 있습니다.',
      copyableUrl: result.url,
    });
  } catch {
    await showAppAlert({
      title: '공유 링크',
      message: '클립보드 복사에 실패했습니다. 아래 주소를 복사해 주세요.',
      copyableUrl: result.url,
    });
  }
  return { ok: true };
}
