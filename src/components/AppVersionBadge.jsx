import { UI_BUILD_ID, UI_FEATURE_MARK, versionLabel } from '../lib/appVersion.js';

/**
 * @param {{ prominent?: boolean }} props
 */
export default function AppVersionBadge({ prominent = false }) {
  const label = versionLabel();
  return (
    <div
      className={
        prominent ? 'app-version-badge app-version-badge--prominent' : 'app-version-badge'
      }
      title={`최신 확인: ${UI_FEATURE_MARK}. 빌드 ${UI_BUILD_ID} 가 GitHub 최신 커밋 앞 7자와 같아야 합니다. 다르면 캐시·예전 URL·dev 서버일 수 있습니다.`}
      aria-label={`앱 버전 ${label}`}
    >
      {prominent ? (
        <>
          <span className="app-version-badge__label">배포 버전</span>
          <code className="app-version-badge__code">{label}</code>
        </>
      ) : (
        label
      )}
    </div>
  );
}
