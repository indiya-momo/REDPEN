import {
  UI_BUILD_ID,
  UI_FEATURE_MARK,
  versionDateLabel,
  versionLabel,
} from '../lib/appVersion.js';
import CriteriaHoverTip from './CriteriaHoverTip.jsx';

/**
 * @param {{ prominent?: boolean, dateOnly?: boolean }} props
 * dateOnly — V 0.72 · 날짜까지만 (시각·빌드ID 등 생략)
 */
export default function AppVersionBadge({ prominent = false, dateOnly = false }) {
  const label = dateOnly ? versionDateLabel() : versionLabel();
  const detailTitle = `최신 확인: ${UI_FEATURE_MARK}. 빌드 ${UI_BUILD_ID} 가 GitHub 최신 커밋 앞 7자와 같아야 합니다. 다르면 캐시·예전 URL·dev 서버일 수 있습니다.`;

  if (dateOnly) {
    const displayLabel = `V ${label}`;
    return (
      <CriteriaHoverTip tip={detailTitle}>
        <span
          className="app-version-badge app-version-badge--prominent app-version-badge--date-only"
          aria-label={`앱 버전 ${displayLabel}`}
        >
          <span className="app-version-badge__label">V</span>
          <code className="app-version-badge__code">{label}</code>
        </span>
      </CriteriaHoverTip>
    );
  }

  return (
    <CriteriaHoverTip tip={detailTitle}>
      <span
        className={
          prominent ? 'app-version-badge app-version-badge--prominent' : 'app-version-badge'
        }
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
      </span>
    </CriteriaHoverTip>
  );
}
