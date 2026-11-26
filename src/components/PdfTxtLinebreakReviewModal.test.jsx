/** @vitest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import PdfTxtLinebreakReviewModal from './PdfTxtLinebreakReviewModal.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
}

/**
 * @param {HTMLElement} root
 * @param {string} label
 */
function buttonByText(root, label) {
  const found = [...root.querySelectorAll('button')].find(
    (node) => node.textContent === label,
  );
  if (!found) throw new Error(`button not found: ${label}`);
  return found;
}

describe('PdfTxtLinebreakReviewModal', () => {
  it('자동 판정을 보여 주고 띄어 씀·조판 유지로 바꿀 수 있다', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onConfirm = vi.fn();
    const onDownloadDraft = vi.fn();

    await act(async () => {
      root.render(
        <PdfTxtLinebreakReviewModal
          open
          sourceName="원고.pdf"
          paragraphStats={{ joined: 4, kept: 2, omitted: 0 }}
          candidates={[
            {
              id: '1:0',
              pageNum: 1,
              lineIndex: 0,
              left: '유명한 명',
              right: '지 계곡',
              defaultDecision: 'nospace',
              glue: '',
              reason: 'midword',
            },
          ]}
          onCancel={() => {}}
          onConfirm={onConfirm}
          onDownloadDraft={onDownloadDraft}
        />,
      );
    });

    expect(host.textContent).toContain('문단 정리');
    expect(host.textContent).toContain('문단 안의 줄바꿈 4곳');
    expect(host.textContent).toContain('형태소 이음');
    expect(buttonByText(host, '붙임').className).toContain('is-active');

    await act(async () => {
      buttonByText(host, '띄움').click();
    });
    expect(buttonByText(host, '띄움').className).toContain('is-active');
    expect(buttonByText(host, '붙임').className).not.toContain('is-active');

    await act(async () => {
      buttonByText(host, '최종 TXT 받기').click();
    });
    expect(onConfirm).toHaveBeenCalledWith({
      decisions: { '1:0': 'space' },
      autoParagraph: true,
    });

    expect(host.textContent).toContain('추천형으로 받기');
    expect(host.textContent).toContain('화면 그대로 받기');
    const modeBoxes = [...host.querySelectorAll('input[type="checkbox"]')];
    expect(modeBoxes).toHaveLength(2);
    expect(modeBoxes[0].checked).toBe(true);
    expect(modeBoxes[1].checked).toBe(false);

    await act(async () => {
      modeBoxes[1].click();
    });
    expect(host.textContent).toContain('화면에 보이던 줄바꿈');
    expect(modeBoxes[0].checked).toBe(false);
    expect(modeBoxes[1].checked).toBe(true);

    await act(async () => {
      buttonByText(host, '검수전 추출본도 받기').click();
    });
    expect(onDownloadDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      buttonByText(host, '최종 TXT 받기').click();
    });
    expect(onConfirm).toHaveBeenLastCalledWith({
      decisions: { '1:0': 'space' },
      autoParagraph: false,
    });

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it('softwrap Y 과도붙임 표본을 단어 중간으로 보여 주고 띄어 씀으로 고친다', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onConfirm = vi.fn();

    await act(async () => {
      root.render(
        <PdfTxtLinebreakReviewModal
          open
          sourceName="표본.pdf"
          paragraphStats={{ joined: 1, kept: 0, omitted: 0 }}
          candidates={[
            {
              id: '1:0',
              pageNum: 1,
              lineIndex: 0,
              left: '에 고개를 끄덕여야 할 것처럼 느끼게 된다. 그러나 꼭',
              right: '그렇게 생각할 필요는 없다. 세상은 여러 퍼즐 조각으로',
              defaultDecision: 'nospace',
              glue: '',
              reason: 'midword',
            },
          ]}
          onCancel={() => {}}
          onConfirm={onConfirm}
        />,
      );
    });

    expect(host.textContent).toContain('형태소 이음');
    expect(host.textContent).toContain('그러나 꼭');
    expect(host.textContent).toContain('그렇게 생각할');
    expect(buttonByText(host, '붙임').className).toContain('is-active');
    expect(host.textContent).toContain(
      '자동 판정이 어려운 줄바꿈 1곳을 표시합니다. 붙임, 띄움, 유지 중 골라 주세요.',
    );

    await act(async () => {
      buttonByText(host, '띄움').click();
    });
    await act(async () => {
      buttonByText(host, '최종 TXT 받기').click();
    });
    expect(onConfirm).toHaveBeenCalledWith({
      decisions: { '1:0': 'space' },
      autoParagraph: true,
    });

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it('쪽 넘김 불확실 후보는 사유와 설명 문구를 보여 준다', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <PdfTxtLinebreakReviewModal
          open
          sourceName="쪽넘김.pdf"
          paragraphStats={{ joined: 0, kept: 1, omitted: 0 }}
          candidates={[
            {
              id: '12:9:page',
              pageNum: 12,
              lineIndex: 9,
              left: '그러',
              right: '지 못한 것은 아니었다',
              defaultDecision: 'keep',
              glue: '',
              reason: 'page-layout',
            },
          ]}
          onCancel={() => {}}
          onConfirm={() => {}}
        />,
      );
    });

    expect(host.textContent).toContain('12쪽 · 쪽 넘김 불확실 · 자동: 유지');
    expect(host.textContent).toContain('쪽이 바뀌는 자리에서 앞뒤 줄이');

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
