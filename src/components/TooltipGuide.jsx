import { useState } from 'react';
import {
  dismissTooltipGuide,
  isTooltipGuideDismissed,
} from '../lib/tooltipGuideStorage.js';

/**
 * 처음 진입 시 대상 요소 옆에 말풍선을 띄우고, 확인 시 localStorage에 저장해 다시 표시하지 않습니다.
 *
 * @param {{
 *   storageKey: string,
 *   message?: import('react').ReactNode,
 *   title?: string,
 *   imageSrc?: string,
 *   imageAlt?: string,
 *   placement?: 'top' | 'bottom' | 'left' | 'right',
 *   children: import('react').ReactElement,
 * }} props
 */
export default function TooltipGuide({
  storageKey,
  message,
  title,
  imageSrc,
  imageAlt = '',
  placement = 'bottom',
  children,
}) {
  const [visible, setVisible] = useState(
    () => !isTooltipGuideDismissed(storageKey),
  );

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
            imageSrc ? ' tooltip-guide--with-image' : ''
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="tooltip-guide__tail" aria-hidden />
          {imageSrc ? (
            <div className="tooltip-guide__media">
              <img
                src={imageSrc}
                alt={imageAlt}
                className="tooltip-guide__image"
              />
            </div>
          ) : null}
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
      ) : null}
    </span>
  );
}
