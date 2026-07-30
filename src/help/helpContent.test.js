import { describe, expect, it } from 'vitest';
import { filePathToSlug } from './filePathToSlug.js';
import { parseFrontmatter } from './parseFrontmatter.js';
import { findNavTrail } from './helpNavUtils.js';
import { getHelpArticle, getHelpNav } from './loadHelpContent.js';
import {
  getLookClassForPhrase,
  splitTextByInlineLooks,
} from './helpInlineLooks.js';
import {
  parseImageCaptionLine,
  parseMarkdownImageLine,
  resolveHelpImageSrc,
} from './helpImagePath.js';

describe('parseFrontmatter', () => {
  it('parses title, booleans, numbers, and related list', () => {
    const raw = `---
title: 테스트
index: true
readMinutes: 3
related: a/b, c/d
---

본문입니다.`;

    const { meta, body } = parseFrontmatter(raw);
    expect(meta.title).toBe('테스트');
    expect(meta.index).toBe(true);
    expect(meta.readMinutes).toBe(3);
    expect(meta.related).toEqual(['a/b', 'c/d']);
    expect(body).toBe('본문입니다.');
  });
});

describe('filePathToSlug', () => {
  it('maps index.md to parent slug', () => {
    expect(filePathToSlug('../../content/help/spelling/highlights/index.md')).toBe(
      'spelling/highlights',
    );
  });

  it('maps nested article paths', () => {
    expect(filePathToSlug('../../content/help/getting-started/first-check.md')).toBe(
      'getting-started/first-check',
    );
  });
});

describe('help content bundle', () => {
  it('loads nav and first-check article', () => {
    const nav = getHelpNav();
    expect(nav.groups.length).toBeGreaterThan(0);

    const article = getHelpArticle('getting-started/first-check');
    expect(article).not.toBeNull();
    expect(article?.meta.title).toBe('첫 검수하기');
    expect(article?.body).toContain('기준 검수');
  });

  it('resolves breadcrumb trail for nested highlight article', () => {
    const nav = getHelpNav();
    const trail = findNavTrail(nav.groups, 'spelling/highlights/spacing');
    expect(trail?.groupLabel).toBe('맞춤법 검수');
    expect(trail?.crumbs.map((c) => c.slug)).toEqual([
      'spelling/highlights',
      'spelling/highlights/spacing',
    ]);
  });
});

describe('helpInlineLooks', () => {
  it('maps UI phrases to tooltip-guide look classes', () => {
    expect(getLookClassForPhrase('기준 검수')).toBe('tooltip-guide__run-btn-look');
    expect(getLookClassForPhrase('맞춤법 탭')).toContain('tooltip-guide__work-tab-chip--spelling');
  });

  it('prefers longer phrases such as 표기 통일 탭', () => {
    const parts = splitTextByInlineLooks('표기 통일 탭에서 통일형 지정을 합니다.');
    expect(parts[0]).toMatchObject({
      type: 'look',
      value: '표기 통일 탭',
    });
    expect(parts[2]).toMatchObject({
      type: 'look',
      value: '통일형 지정',
    });
  });
});

describe('helpImagePath', () => {
  it('resolves help-image shorthand with article slug', () => {
    expect(
      resolveHelpImageSrc('help-image:01-upload.png', 'getting-started/first-check'),
    ).toBe('/help/images/getting-started/first-check/01-upload.png');
  });

  it('resolves explicit slug paths', () => {
    expect(
      resolveHelpImageSrc(
        'help-image:spelling/highlights/overview/01.png',
        'getting-started/first-check',
      ),
    ).toBe('/help/images/spelling/highlights/overview/01.png');
  });

  it('detects image and caption lines', () => {
    expect(parseMarkdownImageLine('![업로드](help-image:01.png)')).toEqual({
      alt: '업로드',
      href: 'help-image:01.png',
    });
    expect(parseImageCaptionLine('*업로드 직후 화면*')).toBe('업로드 직후 화면');
  });
});
