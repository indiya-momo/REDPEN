import SpaceVisibleInput from '../SpaceVisibleInput.jsx';

/**
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   onRegister: () => void,
 *   placeholder: string,
 *   ariaLabel: string,
 *   inputClassName?: string,
 *   registerDisabled?: boolean,
 *   hideLimitTitle?: boolean,
 *   addButtonGuideAttr?: string,
 *   onAddButtonClick?: () => void,
 *   addAriaLabel?: string,
 *   useSpaceVisible?: boolean,
 * }} props
 */
export default function ConsistencyRegisterField({
  value,
  onChange,
  onRegister,
  placeholder,
  ariaLabel,
  inputClassName,
  registerDisabled = false,
  hideLimitTitle = false,
  addButtonGuideAttr,
  onAddButtonClick,
  addAriaLabel = '등록',
  useSpaceVisible = true,
}) {
  const inputClasses = [
    'consistency-register-field__input',
    'field-input',
    inputClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!registerDisabled) onRegister();
    }
  };

  return (
    <div className="tail-form">
      <div className="consistency-register-field">
        {useSpaceVisible ? (
          <SpaceVisibleInput
            className={inputClasses}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onKeyDown={onKeyDown}
          />
        ) : (
          <input
            type="text"
            className={inputClasses}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
        )}
        <button
          type="button"
          className="btn-add consistency-register-add-btn consistency-register-field__add"
          data-work-guide={addButtonGuideAttr || undefined}
          onClick={() => {
            onAddButtonClick?.();
            if (!registerDisabled) onRegister();
          }}
          disabled={registerDisabled}
          aria-label={addAriaLabel}
          title={
            registerDisabled && !hideLimitTitle
              ? '등록 한도에 도달했습니다'
              : undefined
          }
        >
          +
        </button>
      </div>
    </div>
  );
}
