import StdictCorrectionLink from './StdictCorrectionLink.jsx';
import {
  cautionTipLinkParts,
  cautionTipLinkSpecs,
} from '../lib/stdictCautionChipParts.js';
import { resolveCautionTipWordNo } from '../lib/stdictCautionPosCodes.js';

/**
 * 편집자 검토 카드 아래 설명 (설계안 §12).
 * 제목은 링크 없음. 설명의 품사 이름만 해당 표제어로 직결한다. 검색으로 보내지 않는다.
 */
export default function CautionDictTip({ text, chipLabel, itemId, index }) {
  const specs = cautionTipLinkSpecs(chipLabel, text, itemId).filter(
    (s) => resolveCautionTipWordNo(s) != null,
  );
  const parts = cautionTipLinkParts(text, specs);
  if (!parts.length) return text;
  return parts.map((part, i) => {
    if (part.kind === 'word') {
      const wordNo = resolveCautionTipWordNo(part);
      if (wordNo == null) return <span key={`t:${i}`}>{part.text}</span>;
      return (
        <StdictCorrectionLink
          key={`${part.text}:${i}`}
          word={part.text}
          index={index}
          wordNo={wordNo}
        />
      );
    }
    return <span key={`t:${i}`}>{part.text}</span>;
  });
}
