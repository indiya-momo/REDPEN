/**
 * @param {string} raw
 * @returns {{ meta: Record<string, unknown>, body: string }}
 */
export function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) {
    return { meta: {}, body: raw };
  }

  const end = raw.indexOf('\n---', 3);
  if (end === -1) {
    return { meta: {}, body: raw };
  }

  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n+/, '');
  const meta = {};

  for (const line of fm.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    meta[key] = parseFrontmatterValue(value);
  }

  return { meta, body };
}

/**
 * @param {string} value
 */
function parseFrontmatterValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);

  const unquoted = value.replace(/^["']|["']$/g, '');
  if (unquoted.includes(', ')) {
    return unquoted.split(', ').map((part) => part.trim());
  }

  return unquoted;
}
