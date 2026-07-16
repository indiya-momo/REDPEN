import {
  buildConsistencyExportModel,
  buildSpellingExportModel,
} from './exportResults.js';
import { buildCheckResultSnapshot } from './checkResultSnapshot.js';
import { saveCheckResultCloud } from './checkResultsCloud.js';
import { isPaidPlan } from './userPlan.js';
import { loadUserProfileCloud } from './userProfileCloud.js';

/**
 * 유료·활성 프로젝트일 때만 검수 결과 스냅숏을 Firestore에 저장.
 * 실패해도 throw하지 않음 (검수 UX 유지).
 *
 * @param {{
 *   kind: 'spelling' | 'consistency',
 *   uid: string,
 *   projectId: string | null | undefined,
 *   pdfFileName?: string | null,
 *   exportOptions: object,
 * }} args
 * @returns {Promise<{ saved: boolean, reason?: string, id?: string | null }>}
 */
export async function maybeSavePaidCheckResult({
  kind,
  uid,
  projectId,
  pdfFileName,
  exportOptions,
}) {
  try {
    const id = String(uid ?? '').trim();
    const pid = String(projectId ?? '').trim();
    if (!id) return { saved: false, reason: 'no-uid' };
    if (!pid) return { saved: false, reason: 'no-project' };

    const profile = await loadUserProfileCloud(id);
    if (!isPaidPlan(profile)) return { saved: false, reason: 'not-paid' };

    const exportModel =
      kind === 'spelling'
        ? buildSpellingExportModel(exportOptions)
        : buildConsistencyExportModel(exportOptions);

    const snapshot = buildCheckResultSnapshot({
      kind,
      projectId: pid,
      pdfFileName,
      exportModel,
    });
    if (!snapshot) return { saved: false, reason: 'no-snapshot' };

    const docId = await saveCheckResultCloud({ uid: id, snapshot });
    if (!docId) return { saved: false, reason: 'cloud-disabled' };
    return { saved: true, id: docId };
  } catch (err) {
    console.error('유료 검수 결과 자동 저장 실패:', err);
    return { saved: false, reason: 'error' };
  }
}
