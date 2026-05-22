import { UI_BUILD_ID, versionLabel } from '../lib/appVersion.js';

export default function AppVersionBadge() {
  return (
    <div
      className="app-version-badge"
      title={`UI 빌드 ID: ${UI_BUILD_ID}. 이 문구가 다르면 예전 화면입니다.`}
    >
      {versionLabel()}
    </div>
  );
}
