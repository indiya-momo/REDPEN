import { publicAssetUrl } from '../lib/publicAssetUrl.js';

const DEFAULT_MOMO_IMAGE = publicAssetUrl('momo/bullon4.png');

/**
 * @param {{
 *   storageKey: string,
 *   message?: import('react').ReactNode,
 *   title?: string,
 *   imageSrc?: string | null,
 *   imageAlt?: string,
 *   placement?: 'top' | 'bottom' | 'left' | 'right',
 *   bubbleType?: 'auto' | 'left' | 'right',
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
  bubbleType = 'auto',
  offsetX = 0,
  offsetY = 0,
  children,
}) {
  void storageKey;
  const showMomo = imageSrc != null && imageSrc !== '';

  return (
    <span className="tooltip-guide-anchor">
      {children}
      <div
        style={{
          '--tooltip-shift-x': `${offsetX}px`,
          '--tooltip-shift-y': `${offsetY}px`,
        }}
        className={[
          'tooltip-guide',
          `tooltip-guide--${placement}`,
          bubbleType !== 'auto' ? `tooltip-guide--bubble-${bubbleType}` : '',
          !showMomo ? 'tooltip-guide--no-momo' : '',
        ]
          .filter(Boolean)
          .join(' ')}
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
          <button type="button" className="tooltip-guide__confirm">
            확인
          </button>
        </div>
      </div>
    </span>
  );
}
