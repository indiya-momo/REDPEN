/**
 * 국립국어원 어문 규범 Open API — 외래어·로마자 용례 검색.
 * @see https://korean.go.kr/kornorms/main/openAPI.do
 *
 * 브라우저 CORS 회피: 항상 동일 출처 `/api/kornorms`
 * - 로컬: Vite `kornormsDevProxyPlugin` 이 서버 env 키를 붙여 전달
 * - Vercel: `api/kornorms/[...path].js` 가 서버 env 키를 붙여 전달
 * 키는 클라이언트·번들에 넣지 않는다 (`KORNORMS_SERVICE_KEY`).
 *
 * 주의: resultType=json 은 StatsVO만 돌아오는 경우가 있어 **xml** 을 사용한다.
 */

export const KORNORMS_LANG_FOREIGN = '0003';

/** 최근 검색에서 서버 키 미설정(503)을 봤는지 — UI 안내용 */
let kornormsKeyMissingSeen = false;

/** @returns {boolean} */
export function consumeKornormsKeyMissing() {
  const seen = kornormsKeyMissingSeen;
  kornormsKeyMissingSeen = false;
  return seen;
}

/**
 * 키는 서버만 보유. 클라이언트는 항상 프록시를 호출하고,
 * 미설정 시 503 `KORNORMS_KEY_MISSING` 으로 알 수 있다.
 * @returns {boolean}
 */
export function isKornormsConfigured() {
  return true;
}

/** @returns {string} */
export function getKornormsRequestUrl() {
  return '/api/kornorms/exampleReqList.do';
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
 *   guk?: string,
 *   lang?: string,
 * }}
 */
export function mapKornormsItem(item) {
  const h = String(item?.korean_mark ?? '').trim();
  const src = String(item?.srclang_mark ?? '').trim();
  const c = String(item?.foreign_gubun ?? '').trim();
  const m = String(item?.mean ?? '').trim();
  const guk = String(item?.guk_nm ?? '').trim();
  const lang = String(item?.lang_nm ?? '').trim();
  const a = parseRelateMarkList(item?.relate_mark_e);
  const o = parseRelateMarkList(item?.relate_mark_o);
  /** @type {{ h: string, src?: string, c?: string, m?: string, a?: string[], o?: string[], guk?: string, lang?: string }} */
  const entry = { h };
  if (src) entry.src = src;
  if (c) entry.c = c;
  if (m) entry.m = m;
  if (guk) entry.guk = guk;
  if (lang) entry.lang = lang;
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
 * 어문회 XML 응답 파싱 (items 가 항목 반복).
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
        guk_nm: xmlTag(block, 'guk_nm'),
        lang_nm: xmlTag(block, 'lang_nm'),
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

  // json 모드는 StatsVO만 오는 경우가 있어 xml 고정. serviceKey 는 서버 프록시만 붙임.
  const params = new URLSearchParams({
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
  const body = await res.text();
  if (res.status === 503 && body.includes('KORNORMS_KEY_MISSING')) {
    kornormsKeyMissingSeen = true;
    throw new Error('KORNORMS_KEY_MISSING');
  }
  if (!res.ok) {
    throw new Error(`KORNORMS_HTTP_${res.status}`);
  }
  if (body.includes('"StatsVO"') || body.trimStart().startsWith('{')) {
    throw new Error('KORNORMS_BAD_PAYLOAD');
  }
  const parsed = parseKornormsXmlResponse(body);
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
