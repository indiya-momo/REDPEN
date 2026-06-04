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
        disabled={registerDisabled}
        aria-label="등록"
        title={registerDisabled ? '등록 한도에 도달했습니다' : undefined}
      >
        +
      </button>
    </div>
  );
}
