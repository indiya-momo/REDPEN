/** @type {import('../../presentation/projectCardViewModel.js').ProjectCardViewModel[]} */
export const MOCK_PROJECT_CARDS = [
  {
    id: 'proj-1',
    title: '검수냥 모모 이야기2',
    tags: ['문학', '시리즈 2/5'],
    memo: '띄어쓰기·외래어 표기 강화. 1권과 「그러나」 통일.',
    headline:
      '띄어쓰기 \'한 번/한번\' · \'그러나\' 통일 · 본보조 8쌍',
    chipPreview: {
      spelling: [
        { label: '한 번 / 한번', active: true },
        { label: '되 / 돼', active: true },
        { label: '갯수 → 개수', active: true },
        { label: '전세계 → 전 세계', active: false },
      ],
      consistency: [
        { label: '붉은표시 · 빨간표시 → 붉은 표시', active: true },
        { label: '「그러나」 통일', active: true },
        { label: '공통 문자열', active: true },
      ],
      auxiliary: [
        { label: '본용언(아/어) ⁀ 하다', active: true },
        { label: '본용언(아/어) ⁀ 지다', active: true },
        { label: '본용언(아/어) ⁀ 놓다', active: true },
        { label: '본용언(아/어) ⁀ 버리다', active: true },
        { label: '본용언(아/어) ⁀ 두다', active: true },
        { label: '본용언(아/어) ⁀ 오다', active: true },
        { label: '본용언(아/어) ⁀ 가다', active: true },
        { label: '본용언(아/어) ⁀ 있다', active: true },
      ],
    },
    highlights: [
      {
        category: '맞춤법 검수',
        label: '편집자 검토 필요, 맞춤법(외래어·띄어쓰기)',
        count: 15,
      },
      {
        category: '일관성 검수',
        label: '"그러나" 포함 4건, 공통 문자열 2건',
        count: 6,
      },
      {
        category: '본용언 + 보조용언',
        label: '"앉다+있다" 포함 8쌍',
        count: 8,
      },
    ],
    counts: {
      editorReview: 3,
      spelling: 12,
      find: 4,
      commonString: 2,
      auxiliary: 8,
    },
    lastWork: { date: '26.06.20', manuscriptPages: 312 },
    createdDate: '26.06.18',
    proofRevision: '3교',
    savedDate: '6/15',
    formatLabel: '신국판',
    isActive: true,
    dirty: true,
    shareScope: 'project',
  },
  {
    id: 'proj-2',
    title: '실용서 편집 공통',
    tags: ['실용서', '출판사 매뉴얼'],
    memo: '신규 입사자용 템플릿. 숫자·단위 표기 통일.',
    headline: '숫자·단위 표기 · 따옴표 통일 · 검수 제외어 3개',
    chipPreview: {
      spelling: [
        { label: '숫자·단위', active: true },
        { label: '％ → %', active: true },
      ],
      consistency: [
        { label: '따옴표 통일', active: true },
      ],
      auxiliary: [],
    },
    highlights: [
      {
        category: '맞춤법 검수',
        label: '맞춤법(숫자·단위)',
        count: 9,
      },
      {
        category: '일관성 검수',
        label: '공통 문자열 1건, 제외어 3개',
        count: 4,
      },
      {
        category: '본용언 + 보조용언',
        label: '없음',
        count: 0,
      },
    ],
    counts: {
      editorReview: 2,
      spelling: 7,
      find: 0,
      commonString: 1,
      auxiliary: 0,
    },
    lastWork: { date: '26.06.10', manuscriptPages: 0 },
    createdDate: '26.05.28',
    proofRevision: '1교',
    savedDate: '5/28',
    isActive: false,
    dirty: false,
    shareScope: 'folder',
  },
  {
    id: 'proj-3',
    title: '에세이 시리즈 1권',
    tags: ['문학'],
    headline: '맞춤법 기본 · 일관성 찾기 2건 · 본보조 3쌍',
    chipPreview: {
      spelling: [
        { label: '맞춤법 기본', active: true },
      ],
      consistency: [
        { label: '"그러나"', active: true },
        { label: '공통 문자열', active: true },
      ],
      auxiliary: [
        { label: '"서다+있다"', active: true },
        { label: '"앉다+있다"', active: true },
        { label: '"눕다+있다"', active: true },
      ],
    },
    highlights: [
      {
        category: '맞춤법 검수',
        label: '맞춤법 기본 세트',
        count: 6,
      },
      {
        category: '일관성 검수',
        label: '"그러나" 2건',
        count: 2,
      },
      {
        category: '본용언 + 보조용언',
        label: '"서다+있다" 3쌍',
        count: 3,
      },
    ],
    counts: {
      editorReview: 1,
      spelling: 5,
      find: 2,
      commonString: 0,
      auxiliary: 3,
    },
    lastWork: { date: '26.06.01', manuscriptPages: 198 },
    createdDate: '26.05.20',
    proofRevision: '2교',
    savedDate: '5/20',
    isActive: false,
    dirty: false,
  },
];
