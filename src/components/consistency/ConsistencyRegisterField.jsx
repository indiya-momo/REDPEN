import SpaceVisibleInput from '../SpaceVisibleInput.jsx';

/**
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   onRegister: () => void,
 *   placeholder: string,
 *   ariaLabel: string,
 *   inputClassName?: string,
 * }} props
 */
export default function ConsistencyRegisterField({
  value,
  onChange,
  onRegister,
  placeholder,
  ariaLabel,
  inputClassName,
}) {
  return (
    <div className="tail-form">
      <SpaceVisibleInput
        className={inputClassName}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        className="btn-add consistency-register-add-btn"
        onClick={onRegister}
        aria-label="등록"
      >
        +
      </button>
    </div>
  );
}
