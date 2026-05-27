import { publicAssetUrl } from '../lib/publicAssetUrl.js';

const DEFAULT_MOMO_IMAGE = publicAssetUrl('momo/bullon4.png');

/**
 * 작업 중 말풍선을 항상 표시하는 가이드 UI.
 * (현재 확인 버튼은 닫기 동작을 하지 않습니다.)
 *
 * @param {{
 *   storageKey: string,
 *   message?: import('react').ReactNode,
 *   title?: string,
 *   imageSrc?: string | null,
 *   imageAlt?: string,
 *   placement?: 'top' | 'bottom' | 'left' | 'right',
 *   offsetX?: number,
 *   offsetY?: number,
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
  offsetX = 0,
  offsetY = 0,
  children,
}) {
  const visible = true;
  const showMomo = imageSrc != null && imageSrc !== '';

  function handleDismiss() {
    // 디자인 조정 작업 중에는 말풍선을 항상 유지합니다.
  }

  return (
    <span className="tooltip-guide-anchor">
      {children}
      {visible ? (
        <div
          style={{
            '--tooltip-shift-x': `${offsetX}px`,
            '--tooltip-shift-y': `${offsetY}px`,
          }}
          className={`tooltip-guide tooltip-guide--${placement}`}
          role="status"
          aria-live="polite"
        >
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
            </div>
            <button
              type="button"
              className="tooltip-guide__confirm"
              onClick={handleDismiss}
            >
              확인
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}
