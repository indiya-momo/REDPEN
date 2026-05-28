import { encodeSpacesVisible } from '../../lib/spaceVisibleText.js';
import RegisteredChip from './RegisteredChip.jsx';

/**
 * @param {{
 *   phrases: string[],
 *   onRemove: (phrase: string) => void,
 * }} props
 */
export default function ExcludePhraseList({ phrases, onRemove }) {
  if (!phrases.length) return null;

  return (
    <ul className="tail-list tail-list--exclude">
      {phrases.map((phrase) => {
        const label = encodeSpacesVisible(phrase);
        return (
          <RegisteredChip
            key={phrase}
            label={label}
            onRemove={() => onRemove(phrase)}
          />
        );
      })}
    </ul>
  );
}
