import StdictCorrectionLink from './StdictCorrectionLink.jsx';
import { cautionChipLinkParts } from '../lib/stdictCautionChipParts.js';

/**
 * 편집자 검토 문구. 말마다 표준국어대사전 링크, 괄호 안 안내는 글자만.
 */
export default function CautionDictLabel({ text, index }) {
  const parts = cautionChipLinkParts(text);
  if (!parts.length) return text;
  return parts.map((part, i) => {
    if (part.kind === 'word') {
      return (
        <StdictCorrectionLink
          key={`${part.text}:${i}`}
          word={part.text}
          index={index}
          fallback="search"
        />
      );
    }
    return <span key={`${part.kind}:${i}`}>{part.text}</span>;
  });
}
