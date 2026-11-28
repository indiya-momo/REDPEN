/**
 * 표준국어대사전 데이터 다운로드 목록 (마이페이지 카드 · 도움말이 같이 쓴다).
 * 파일은 public/data 의 공개 사본을 그대로 내려받는다. 로그인은 버튼 표시 조건일 뿐이다.
 */

export const STDICT_DATA_TITLE = '표준국어대사전(26/10/16) 데이터와 사용 안내';
export const STDICT_DATA_MEMBER_NOTE = '(인디야 회원 전용)';

/** GoldenDict(StarDict) 사전 zip. GitHub 릴리스 `stdict` 태그에 올린다. */
export const GOLDENDICT_ZIP_URL =
  'https://github.com/indiya-momo/REDPEN/releases/download/stdict/2611_indiya_goldendict.zip';

/**
 * @typedef {{ id: string, label: string, note: string, file?: string, href?: string }} StdictDataItem
 * file: public/data 안의 파일 이름 / href: 외부 주소(릴리스 zip)
 */

/** @type {ReadonlyArray<StdictDataItem>} */
export const STDICT_DATA_FILES = Object.freeze([
  {
    id: 'goldendict',
    label: 'GoldenDict 사전 (zip)',
    href: GOLDENDICT_ZIP_URL,
    note: 'GoldenDict·StarDict에서 바로 읽는 사전 파일 묶음입니다. 사전 프로그램은 들어 있지 않습니다.',
  },
  {
    id: 'pos-index',
    label: '품사 색인',
    file: 'stdict-pos-index.json',
    note: '단어마다 품사를 찾는 색인입니다. 용어 검사의 품사 판정에 쓰입니다.',
  },
  {
    id: 'verb-forms',
    label: '용언 추출본',
    file: 'stdict-verb-forms.json',
    note: '붙임표로 된 합성 용언 목록입니다. 보조 용언 띄어쓰기 판정에 쓰입니다.',
  },
  {
    id: 'link-index',
    label: '링크 색인',
    file: 'stdict-link-index.json',
    note: '표준국어대사전 뜻풀이 페이지로 이어지는 링크 색인입니다.',
  },
  {
    id: 'de-headwords',
    label: '두음 표제어',
    file: 'stdict-de-headwords.json',
    note: '두음 법칙 적용 표제어 목록입니다.',
  },
  {
    id: 'notice',
    label: '출처·라이선스 고지',
    file: 'STDICT-NOTICE.md',
    note: '데이터의 출처와 라이선스(CC BY-SA 2.0 KR) 고지입니다. 재배포하실 때 함께 두어 주십시오.',
  },
]);

/**
 * @param {StdictDataItem} item
 * @returns {string} 다운로드 주소 (외부 href 우선, 아니면 배포 기준 public/data 경로)
 */
export function getStdictDataDownloadUrl(item) {
  if (item.href) return item.href;
  const base = String(import.meta.env.BASE_URL || '/');
  return `${base}data/${item.file}`;
}

/**
 * 사용 안내 문단. 파일 설명과 같은 문장을 도움말에도 쓴다.
 */
export const STDICT_DATA_USAGE_LINES = Object.freeze([
  '인디야의 일부 검사 기능은 국립국어원 『표준국어대사전』 데이터를 가공해 씁니다.',
  '아래 파일은 같은 데이터를 가공한 색인과 추출본입니다. 원본 사전 전체는 아닙니다.',
  '재배포나 수정을 하실 때는 출처를 밝히고 같은 라이선스(CC BY-SA 2.0 KR)를 지켜 주십시오.',
]);
