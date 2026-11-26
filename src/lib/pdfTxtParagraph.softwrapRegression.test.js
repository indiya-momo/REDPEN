/**
 * softwrap 육안 표본 → TXT paragraphJoinGlue 회귀.
 * 런타임 판정은 바꾸지 않는다. handoff design-final B.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findLinebreakCandidates } from './pdfTxtLinebreakReview.js';
import { paragraphJoinGlue } from './pdfTxtParagraph.js';

const fixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures/txt-softwrap-glue-regression.json'),
    'utf8',
  ),
);

describe('TXT glue ← softwrap eye (현행 잠금)', () => {
  it('A(단어 중간): 공백 없이 잇는다', () => {
    expect(fixture.A_nospace.length).toBeGreaterThanOrEqual(10);
    for (const row of fixture.A_nospace) {
      expect(paragraphJoinGlue(row.left, row.right), row.id).toBe('');
    }
  });

  it('Y 중 현행이 이미 띄우는 것: 한 칸', () => {
    expect(fixture.Y_space.length).toBeGreaterThanOrEqual(2);
    for (const row of fixture.Y_space) {
      expect(paragraphJoinGlue(row.left, row.right), row.id).toBe(' ');
    }
  });

  it('조사 붙임·완전 1음절(기존 TXT 규칙)', () => {
    expect(paragraphJoinGlue('바다', '가 아름답다')).toBe('');
    expect(paragraphJoinGlue('봤을 때', '손잡이')).toBe(' ');
    expect(paragraphJoinGlue('임금과 물가 간', '악순환으로')).toBe(' ');
  });

  it('softwrap wasm A-FP 문자열: TXT는 목록·경계로 다를 수 있음(문서화)', () => {
    // softwrap A는 붙임 기대. TXT COMPLETE「것」→ 공백.
    expect(paragraphJoinGlue('것', '이었다')).toBe(' ');
    expect(paragraphJoinGlue('한', '쪽으로')).toBe('');
  });
});

describe('TXT glue ← softwrap Y 알려진 과도 붙임 (목표)', () => {
  it.fails('Y인데 현행 nospace인 쌍은 한 칸이어야 한다 (런타임 미수정)', () => {
    expect(fixture.Y_known_wrong_nospace.length).toBeGreaterThanOrEqual(5);
    for (const row of fixture.Y_known_wrong_nospace) {
      expect(paragraphJoinGlue(row.left, row.right), row.id).toBe(' ');
    }
  });
});

describe('TXT softwrap Y → 모달 후보 (자동 glue 불변)', () => {
  it('Y 과도붙임 표본이 midword·nospace 후보로 올라가고 glue는 그대로다', () => {
    const rows = fixture.Y_known_wrong_nospace.filter(
      (row) => paragraphJoinGlue(row.left, row.right) === '',
    );
    expect(rows.length).toBeGreaterThanOrEqual(5);
    const pages = rows.map((row, i) => ({
      pageNum: i + 1,
      lines: [String(row.left).trim(), String(row.right).trim()],
    }));
    const candidates = findLinebreakCandidates(pages);
    for (const row of rows) {
      expect(paragraphJoinGlue(row.left, row.right), row.id).toBe('');
      const hit = candidates.find(
        (c) => c.left === String(row.left).trim() && c.right === String(row.right).trim(),
      );
      expect(hit, row.id).toBeTruthy();
      expect(hit.reason, row.id).toBe('midword');
      expect(hit.defaultDecision, row.id).toBe('nospace');
    }
  });
});
