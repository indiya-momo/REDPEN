import {
  UI_BUILD_ID,
  UI_FEATURE_MARK,
  versionDateLabel,
  versionLabel,
} from '../lib/appVersion.js';

/**
 * @param {{ prominent?: boolean, dateOnly?: boolean }} props
 * dateOnly — v0.7.0 · 날짜까지만 (시각·빌드ID 등 생략)
 */
export default function AppVersionBadge({ prominent = false, dateOnly = false }) {
  const label = dateOnly ? versionDateLabel() : versionLabel();
  const detailTitle = `최신 확인: ${UI_FEATURE_MARK}. 빌드 ${UI_BUILD_ID} 가 GitHub 최신 커밋 앞 7자와 같아야 합니다. 다르면 캐시·예전 URL·dev 서버일 수 있습니다.`;

  if (dateOnly) {
    return (
      <div
        className="app-version-badge app-version-badge--prominent app-version-badge--date-only"
        title={detailTitle}
        aria-label={`앱 버전 ${label}`}
      >
        <span className="app-version-badge__label">버전</span>
        <code className="app-version-badge__code">{label}</code>
      </div>
    );
  }

  return (
    <div
      className={
        prominent ? 'app-version-badge app-version-badge--prominent' : 'app-version-badge'
      }
      title={detailTitle}
      aria-label={`앱 버전 ${label}`}
    >
      {prominent ? (
        <>
          <span className="app-version-badge__label">버전</span>
          <code className="app-version-badge__code">{label}</code>
        </>
      ) : (
        label
      )}
    </div>
  );
}
