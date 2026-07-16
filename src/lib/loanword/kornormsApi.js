/**
 * 국립국어원 어문 규범 Open API — 외래어·로마자 용례 검색.
 * @see https://korean.go.kr/kornorms/main/openAPI.do
 *
 * 브라우저 CORS 회피: dev는 Vite 프록시(`/api/kornorms`), 배포는 직접 URL.
 * 인증 키: VITE_KORNORMS_SERVICE_KEY (.env.local, 커밋 금지)
 *
 * 주의: resultType=json 은 StatsVO만 돌아오는 경우가 있어 **xml** 을 사용한다.
 */

export const KORNORMS_LANG_FOREIGN = '0003';

/** @returns {string} */
export function getKornormsServiceKey() {
  return String(import.meta.env.VITE_KORNORMS_SERVICE_KEY ?? '').trim();
}

export function isKornormsConfigured() {
  return Boolean(getKornormsServiceKey());
}

/** @returns {string} */
export function getKornormsRequestUrl() {
  if (import.meta.env.DEV) {
    return '/api/kornorms/exampleReqList.do';
  }
  return 'https://korean.go.kr/kornorms/exampleReqList.do';
}

/**
 * 오표기 문자열 → 표기 목록 ("가디건(X), 캐어디건(X)" → ["가디건","캐어디건"])
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
export function parseRelateMarkList(raw) {
  const text = String(raw ?? '').trim();
  if (!text || text === '-') return [];
  return text
    .split(/[,，]/)
    .map((part) =>
      part
        .replace(/\(X\)/gi, '')
        .replace(/[（(][^)）]*[)）]/g, '')
        .trim(),
    )
    .filter(Boolean);
}

/**
 * @param {Record<string, unknown>} item
 * @returns {{
 *   h: string,
 *   src?: string,
 *   c?: string,
 *   m?: string,
 *   a?: string[],
 *   o?: string[],
 * }}
 */
export function mapKornormsItem(item) {
  const h = String(item?.korean_mark ?? '').trim();
  const src = String(item?.srclang_mark ?? '').trim();
  const c = String(item?.foreign_gubun ?? '').trim();
  const m = String(item?.mean ?? '').trim();
  const a = parseRelateMarkList(item?.relate_mark_e);
  const o = parseRelateMarkList(item?.relate_mark_o);
  /** @type {{ h: string, src?: string, c?: string, m?: string, a?: string[], o?: string[] }} */
  const entry = { h };
  if (src) entry.src = src;
  if (c) entry.c = c;
  if (m) entry.m = m;
  if (a.length) entry.a = a;
  if (o.length) entry.o = o;
  return entry;
}

/** @param {string} xml @param {string} tag */
function xmlTag(xml, tag) {
  const m = String(xml).match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

/**
 * 어문회 XML 응답 파싱 (items 가 형제 반복).
 * @param {string} xml
 * @returns {{ totalCount: number, resultCode: string, resultMsg: string, items: ReturnType<typeof mapKornormsItem>[] }}
 */
export function parseKornormsXmlResponse(xml) {
  const text = String(xml ?? '');
  const resultCode = xmlTag(text, 'resultCode');
  const resultMsg = xmlTag(text, 'resultMsg');
  const totalCount = Number(xmlTag(text, 'totalCount')) || 0;
  const blocks = [...text.matchAll(/<items>([\s\S]*?)<\/items>/gi)].map(
    (m) => m[1],
  );
  const items = blocks
    .map((block) =>
      mapKornormsItem({
        korean_mark: xmlTag(block, 'korean_mark'),
        srclang_mark: xmlTag(block, 'srclang_mark'),
        foreign_gubun: xmlTag(block, 'foreign_gubun'),
        mean: xmlTag(block, 'mean'),
        relate_mark_e: xmlTag(block, 'relate_mark_e'),
        relate_mark_o: xmlTag(block, 'relate_mark_o'),
      }),
    )
    .filter((e) => e.h);
  return { totalCount, resultCode, resultMsg, items };
}

/**
 * @param {{
 *   searchKeyword: string,
 *   searchCondition: string,
 *   searchEquals?: 'equal' | 'like' | 'start' | 'end',
 *   pageNo?: number,
 *   numOfRows?: number,
 *   signal?: AbortSignal,
 * }} opts
 * @returns {Promise<{ totalCount: number, items: ReturnType<typeof mapKornormsItem>[] }>}
 */
export async function searchKornormsExamples(opts) {
  const serviceKey = getKornormsServiceKey();
  if (!serviceKey) {
    throw new Error('KORNORMS_KEY_MISSING');
  }
  const {
    searchKeyword,
    searchCondition,
    searchEquals = 'like',
    pageNo = 1,
    numOfRows = 10,
    signal,
  } = opts;
  const keyword = String(searchKeyword ?? '').trim();
  if (!keyword) return { totalCount: 0, items: [] };

  // json 모드는 StatsVO만 오는 경우가 있어 xml 고정
  const params = new URLSearchParams({
    serviceKey,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    langType: KORNORMS_LANG_FOREIGN,
    resultType: 'xml',
    searchCondition,
    searchEquals,
    searchKeyword: keyword,
  });

  const res = await fetch(`${getKornormsRequestUrl()}?${params}`, {
    method: 'GET',
    signal,
    headers: { Accept: 'application/xml, text/xml, */*' },
  });
  if (!res.ok) {
    throw new Error(`KORNORMS_HTTP_${res.status}`);
  }
  const xml = await res.text();
  if (xml.includes('"StatsVO"') || xml.trimStart().startsWith('{')) {
    throw new Error('KORNORMS_BAD_PAYLOAD');
  }
  const parsed = parseKornormsXmlResponse(xml);
  // 명세 샘플은 00, 실제 응답은 0
  if (
    parsed.resultCode &&
    parsed.resultCode !== '0' &&
    parsed.resultCode !== '00'
  ) {
    throw new Error(
      `KORNORMS_${parsed.resultCode}:${parsed.resultMsg || parsed.resultCode}`,
    );
  }
  return {
    totalCount: parsed.totalCount || parsed.items.length,
    items: parsed.items,
  };
}
