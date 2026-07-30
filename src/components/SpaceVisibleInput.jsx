import { decodeSpacesVisible, encodeSpacesVisible } from '../lib/spaceVisibleText.js';
import CriteriaHoverTip from './CriteriaHoverTip.jsx';

/**
 * 실제 값은 공백, 입력란에는 ˅(아래 쐐기)로 표시
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   className?: string,
 *   placeholder?: string,
 *   tip?: string | false,
 * } & Omit<import('react').InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'placeholder'>} props
 */
export default function SpaceVisibleInput({
  value,
  onChange,
  className = 'field-input',
  placeholder,
  tip = '공백은 ˅ 로 표시됩니다',
  ...rest
}) {
  const input = (
    <input
      {...rest}
      className={`${className} field-input--space-visible`.trim()}
      value={encodeSpacesVisible(value)}
      placeholder={placeholder}
      onChange={(e) => onChange(decodeSpacesVisible(e.target.value))}
      autoComplete="off"
      spellCheck={false}
    />
  );

  if (tip === false || tip == null || tip === '') return input;

  return (
    <CriteriaHoverTip tip={tip} variant="block">
      {input}
    </CriteriaHoverTip>
  );
}
