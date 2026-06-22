export const VERSION_BUMP_STEP = 0.001;

/**
 * @param {string} version
 * @param {number} [step]
 * @returns {string}
 */
export function nextVersion(version, step = VERSION_BUMP_STEP) {
  const current = Number.parseFloat(String(version).trim());
  if (!Number.isFinite(current)) {
    throw new Error(`Invalid version: ${version}`);
  }
  const bumped = Math.round((current + step) * 1000) / 1000;
  return bumped.toFixed(3);
}

/**
 * CI·docs 배포 커밋 등에서는 버전을 올리지 않는다.
 * @param {NodeJS.ProcessEnv} env
 * @param {string[]} stagedFiles
 */
export function shouldSkipVersionBump(env, stagedFiles) {
  if (env.SKIP_VERSION_BUMP === '1') return true;
  if (env.CI === 'true' || env.GITHUB_ACTIONS === 'true') return true;
  if (stagedFiles.length === 0) return true;
  return stagedFiles.every((file) => file.startsWith('docs/'));
}
