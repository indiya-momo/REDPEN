/**
 * 바른 Tag enum 숫자 → 세종 품사 문자열.
 * @see https://bareun.ai/docs/ko/3.4.0/howtouse/api-analyze
 */
export const BAREUN_TAG_BY_ID = Object.freeze({
  0: 'UNK',
  1: 'EC',
  2: 'EF',
  3: 'EP',
  4: 'ETM',
  5: 'ETN',
  6: 'IC',
  7: 'JC',
  8: 'JKB',
  9: 'JKC',
  10: 'JKG',
  11: 'JKO',
  12: 'JKQ',
  13: 'JKS',
  14: 'JKV',
  15: 'JX',
  16: 'MAG',
  17: 'MAJ',
  18: 'MMA',
  19: 'MMD',
  20: 'MMN',
  21: 'NA',
  22: 'NF',
  23: 'NNB',
  24: 'NNG',
  25: 'NNP',
  26: 'NP',
  27: 'NR',
  28: 'NV',
  29: 'SE',
  30: 'SF',
  31: 'SH',
  32: 'SL',
  33: 'SN',
  34: 'SO',
  35: 'SP',
  36: 'SS',
  37: 'SW',
  38: 'VA',
  39: 'VCN',
  40: 'VCP',
  41: 'VV',
  42: 'VX',
  43: 'XPN',
  44: 'XR',
  45: 'XSA',
  46: 'XSN',
  47: 'XSV',
});

/**
 * @param {unknown} tag
 * @returns {string}
 */
export function normalizeBareunTag(tag) {
  if (typeof tag === 'string' && tag.trim()) {
    const s = tag.trim();
    if (/^\d+$/.test(s)) {
      return BAREUN_TAG_BY_ID[Number(s)] ?? 'UNK';
    }
    // VV_ = 일부 응답 변형
    return s.replace(/_+$/, '').split('-')[0] || 'UNK';
  }
  if (typeof tag === 'number' && Number.isFinite(tag)) {
    return BAREUN_TAG_BY_ID[tag] ?? 'UNK';
  }
  return 'UNK';
}
