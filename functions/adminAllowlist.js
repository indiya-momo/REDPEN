/**
 * 서버 관리자 allowlist — 클라이언트 VITE_BETA_QUOTA_ADMIN_* 와 동일 값.
 * @param {string | undefined} raw
 * @param {{ lowercase?: boolean }} [options]
 * @returns {string[]}
 */
function parseAdminAllowlist(raw, options = {}) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((entry) => {
      const trimmed = entry.trim();
      return options.lowercase ? trimmed.toLowerCase() : trimmed;
    })
    .filter(Boolean);
}

/**
 * @param {{ uid?: string, token?: { email?: string } } | null | undefined} auth
 * @param {{ uids?: string, emails?: string }} env
 */
function isQuotaAdmin(auth, env = {}) {
  const uid = String(auth?.uid ?? '').trim();
  const email = String(auth?.token?.email ?? '')
    .trim()
    .toLowerCase();
  const uidSet = new Set(parseAdminAllowlist(env.uids));
  const emailSet = new Set(
    parseAdminAllowlist(env.emails, { lowercase: true }),
  );
  if (uid && uidSet.has(uid)) return true;
  if (email && emailSet.has(email)) return true;
  return false;
}

module.exports = {
  parseAdminAllowlist,
  isQuotaAdmin,
};
