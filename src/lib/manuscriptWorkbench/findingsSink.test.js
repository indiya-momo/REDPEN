import { describe, expect, it } from 'vitest';
import { addManualFinding, manualAddRejectReason } from './addManualFinding.js';
import {
  countManualInstances,
  coveredByManualFinding,
  removeManualInstance,
} from './findingsSink.js';
import { manualListButtonLabel } from './types.js';
import { isManuscriptToolboxMode, MANUAL_LIST_MODE } from './modes.js';
import { collectAnnotFindings } from '../pdfAnnotExport/collectAnnotFindings.js';

const pageTexts = [
  {
    pageNum: 1,
    text: '방문할때면 마음 속',
    visualText: '방문할때면 마음 속',
    items: [],
    itemRefs: [{ start: 0, end: 10, itemIndex: 0 }],
  },
];

describe('addManualFinding', () => {
  const page = pageTexts[0];

  it('빈 원문은 넣지 않는다', () => {
    expect(
      addManualFinding(
        [],
        { pageNum: 1, start: 0, end: 0, matchedText: '', replace: '가' },
        page,
      ),
    ).toEqual([]);
  });

  it('공백만 고침은 넣지 않는다', () => {
    expect(
      addManualFinding(
        [],
        { pageNum: 1, start: 2, end: 4, matchedText: '할때', replace: '  ' },
        page,
      ),
    ).toEqual([]);
  });

  it('고침이 원문과 같으면 넣지 않는다', () => {
    expect(
      addManualFinding(
        [],
        { pageNum: 1, start: 2, end: 4, matchedText: '할때', replace: '할때' },
        page,
      ),
    ).toEqual([]);
  });

  it('고침 줄바꿈은 넣지 않는다', () => {
    expect(
      addManualFinding(
        [],
        { pageNum: 1, start: 2, end: 4, matchedText: '할때', replace: '할\n때' },
        page,
      ),
    ).toEqual([]);
  });

  it('같은 구간은 한 번만', () => {
    const manual = {
      pageNum: 1,
      start: 2,
      end: 4,
      matchedText: '할때',
      replace: '할 때',
      source: 'manual',
    };
    const once = addManualFinding([], manual, pageTexts[0]);
    const twice = addManualFinding(once, manual, pageTexts[0]);
    expect(once).toHaveLength(1);
    expect(twice).toHaveLength(1);
    expect(twice[0].instances).toHaveLength(1);
  });

  it('collectAnnotFindings에 동일 구간이 들어간다', () => {
    const groups = addManualFinding(
      [],
      {
        pageNum: 1,
        start: 2,
        end: 4,
        matchedText: '할때',
        replace: '할 때',
        source: 'manual',
      },
      pageTexts[0],
    );
    const findings = collectAnnotFindings({
      spellingEntries: groups.map((group) => ({ source: 'spelling', group })),
      pageTexts,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      pageNum: 1,
      found: '할때',
      replacement: '할 때',
    });
    expect(findings[0].start).toBe(2);
    expect(findings[0].end).toBe(4);
    expect(findings[0].style).not.toBe('review');
    expect(findings[0].fromManual).toBe(true);
    expect(findings[0].replacement).toBe('할 때');
  });

  it('페이지가 없으면 넣지 않는다', () => {
    expect(
      addManualFinding(
        [],
        { pageNum: 1, start: 2, end: 4, matchedText: '할때', replace: '할 때' },
      ),
    ).toEqual([]);
  });

  it('건수는 카드가 아니라 인스턴스', () => {
    const groups = addManualFinding(
      [],
      {
        pageNum: 1,
        start: 2,
        end: 4,
        matchedText: '할때',
        replace: '할 때',
        source: 'manual',
      },
      pageTexts[0],
    );
    expect(countManualInstances(groups)).toBe(1);
    expect(countManualInstances([])).toBe(0);
    expect(manualListButtonLabel(0)).toBe('수정 리스트');
    expect(manualListButtonLabel(3)).toBe('수정 리스트 3');
    expect(isManuscriptToolboxMode(MANUAL_LIST_MODE)).toBe(true);
  });

  it('인스턴스를 지우면 빈 그룹도 빠진다', () => {
    const groups = addManualFinding(
      [],
      {
        pageNum: 1,
        start: 2,
        end: 4,
        matchedText: '할때',
        replace: '할 때',
        source: 'manual',
      },
      pageTexts[0],
    );
    const next = removeManualInstance(groups, groups[0].instances[0]);
    expect(next).toEqual([]);
  });

  it('거부 이유를 구분한다', () => {
    const page = pageTexts[0];
    const base = { pageNum: 1, start: 2, end: 4, matchedText: '할때' };
    expect(manualAddRejectReason({ ...base, replace: '' }, page)).toBe(
      '수정을 입력하세요.',
    );
    expect(manualAddRejectReason({ ...base, replace: '할\n때' }, page)).toBe(
      '수정과 메모에는 줄바꿈을 넣을 수 없습니다.',
    );
    expect(manualAddRejectReason({ ...base, replace: '할때' }, page)).toBe(
      '원본과 다른 수정을 입력하세요.',
    );
    expect(
      manualAddRejectReason({ ...base, start: 0, replace: '할 때' }, page),
    ).toBe('선택한 구간이 원문과 맞지 않습니다.');
    expect(manualAddRejectReason({ ...base, replace: '할 때' }, page)).toBe('');
  });
});

describe('coveredByManualFinding', () => {
  it('수정 리스트에 넣은 자리는 원래 발견을 가린다', () => {
    const groups = addManualFinding(
      [],
      {
        pageNum: 1,
        start: 2,
        end: 4,
        matchedText: '할때',
        replace: '할 때',
        source: 'manual',
      },
      pageTexts[0],
    );
    expect(coveredByManualFinding({ pageNum: 1, index: 2 }, groups)).toBe(true);
    expect(coveredByManualFinding({ pageNum: 1, index: 3 }, groups)).toBe(false);
    expect(
      coveredByManualFinding({ pageNum: 1, index: 2, manual: true }, groups),
    ).toBe(false);
  });
});
