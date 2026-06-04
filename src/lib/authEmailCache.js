const STORAGE_KEY = 'indiya-auth-email-cache-v1';

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* storage full / private mode */
  }
}

/** @param {string} uid */
export function getRememberedAuthEmail(uid) {
  if (!uid) return '';
  const email = readMap()[uid];
  return typeof email === 'string' ? email.trim() : '';
}

/** @param {string} uid @param {string} email */
export function rememberAuthEmail(uid, email) {
  const id = uid.trim();
  const mail = email.trim();
  if (!id || !mail) return;
  const map = readMap();
  if (map[id] === mail) return;
  map[id] = mail;
  writeMap(map);
}

/** @param {string} uid */
export function clearRememberedAuthEmail(uid) {
  if (!uid) return;
  const map = readMap();
  if (!(uid in map)) return;
  delete map[uid];
  writeMap(map);
}
