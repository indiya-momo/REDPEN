import StdictCorrectionLink from './StdictCorrectionLink.jsx';
import {
  cautionTipLinkParts,
  cautionTipLinkSpecs,
} from '../lib/stdictCautionChipParts.js';
import { resolveCautionTipWordNo } from '../lib/stdictCautionPosCodes.js';

/**
 * 편집자 검토 카드 아래 설명 (설계안 §12).
 * 제목은 링크 없음. 설명의 품사 이름만 해당 표제어로 직결한다. 번호를 정하지 못한 말(수동 지정 search)만 검색 화면으로 보낸다.
 * 설명의 줄바꿈(\n)은 줄을 바꿔 보여 준다.
 */
export default function CautionDictTip({ text, chipLabel, itemId, index }) {
  const specs = cautionTipLinkSpecs(chipLabel, text, itemId).filter(
    (s) => s.search === true || resolveCautionTipWordNo(s) != null,
  );
  const parts = cautionTipLinkParts(text, specs);
  if (!parts.length) return text;
  return parts.map((part, i) => {
    if (part.kind === 'word' && part.search) {
      return (
        <StdictCorrectionLink
          key={`${part.text}:${i}`}
          word={part.text}
          index={index}
          search
        />
      );
    }
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
    return (
      <span key={`t:${i}`}>
        {part.text.split('\n').map((line, j) => (
          <span key={j}>
            {j > 0 ? <br /> : null}
            {line}
          </span>
        ))}
      </span>
    );
  });
}
