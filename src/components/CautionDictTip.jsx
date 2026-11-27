import StdictCorrectionLink from './StdictCorrectionLink.jsx';
import {
  cautionTipLinkParts,
  cautionTipLinkTerms,
} from '../lib/stdictCautionChipParts.js';

/**
 * 편집자 검토 카드 아래 설명. 품사·사전형·이형태가 나오는 곳에 각각 사전 링크.
 */
export default function CautionDictTip({ text, chipLabel, index }) {
  const terms = cautionTipLinkTerms(chipLabel, text);
  const parts = cautionTipLinkParts(text, terms);
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
    return <span key={`t:${i}`}>{part.text}</span>;
  });
}
