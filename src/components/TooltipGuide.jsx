import { useState } from 'react';
import { publicAssetUrl } from '../lib/publicAssetUrl.js';
import {
  dismissTooltipGuide,
  isTooltipGuideDismissed,
} from '../lib/tooltipGuideStorage.js';

const DEFAULT_MOMO_IMAGE = publicAssetUrl('momo/bullon.png');

/**
 * 처음 진입 시 대상 요소 옆에 말풍선을 띄우고, 확인 시 localStorage에 저장해 다시 표시하지 않습니다.
 *
 * @param {{
 *   storageKey: string,
 *   message?: import('react').ReactNode,
 *   title?: string,
 *   imageSrc?: string | null,
 *   imageAlt?: string,
 *   placement?: 'top' | 'bottom' | 'left' | 'right',
 *   children: import('react').ReactElement,
 * }} props
 */
export default function TooltipGuide({
  storageKey,
  message,
  title,
  imageSrc = DEFAULT_MOMO_IMAGE,
  imageAlt = '모모',
  placement = 'bottom',
  children,
}) {
  const [visible, setVisible] = useState(
    () => !isTooltipGuideDismissed(storageKey),
  );
  const showMomo = imageSrc != null && imageSrc !== '';

  function handleDismiss() {
    dismissTooltipGuide(storageKey);
    setVisible(false);
  }

  return (
    <span className="tooltip-guide-anchor">
      {children}
      {visible ? (
        <div
          className={`tooltip-guide tooltip-guide--${placement}${
            showMomo ? ' tooltip-guide--with-momo' : ''
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="tooltip-guide__tail" aria-hidden />
          <div className="tooltip-guide__body">
            {showMomo ? (
              <div className="tooltip-guide__momo">
                <img
                  src={imageSrc}
                  alt={imageAlt}
                  className="tooltip-guide__image"
                />
              </div>
            ) : null}
            <div className="tooltip-guide__content">
              {title ? <p className="tooltip-guide__title">{title}</p> : null}
              {message ? (
                <div className="tooltip-guide__message">{message}</div>
              ) : null}
              <button
                type="button"
                className="tooltip-guide__confirm"
                onClick={handleDismiss}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </span>
  );
}
