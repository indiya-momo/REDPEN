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
    expect(host.textContent).toContain('단어 중간');
    expect(buttonByText(host, '붙여 씀').className).toContain('is-active');

    await act(async () => {
      buttonByText(host, '띄어 씀').click();
    });
    expect(buttonByText(host, '띄어 씀').className).toContain('is-active');
    expect(buttonByText(host, '붙여 씀').className).not.toContain('is-active');

    await act(async () => {
      buttonByText(host, '최종 TXT 받기').click();
    });
    expect(onConfirm).toHaveBeenCalledWith({
      decisions: { '1:0': 'space' },
      autoParagraph: true,
    });

    await act(async () => {
      host.querySelector('input[type="checkbox"]').click();
    });
    expect(host.textContent).toContain('조판에 보이던 줄바꿈');

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
});
