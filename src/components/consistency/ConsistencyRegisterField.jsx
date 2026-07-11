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
 *   addButtonGuideAttr?: string,
 *   onAddButtonClick?: () => void,
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
  addButtonGuideAttr,
  onAddButtonClick,
}) {
  const inputClasses = [
    'consistency-register-field__input',
    'field-input',
    inputClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="tail-form">
      <div className="consistency-register-field">
        <SpaceVisibleInput
          className={inputClasses}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (!registerDisabled) onRegister();
            }
          }}
        />
        <button
          type="button"
          className="btn-add consistency-register-add-btn consistency-register-field__add"
          data-work-guide={addButtonGuideAttr || undefined}
          onClick={() => {
            onAddButtonClick?.();
            onRegister();
          }}
          disabled={registerDisabled}
          aria-label="등록"
          title={registerDisabled ? '등록 한도에 도달했습니다' : undefined}
        >
          +
        </button>
      </div>
    </div>
  );
}
