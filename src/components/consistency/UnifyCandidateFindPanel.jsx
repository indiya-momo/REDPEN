/**
 * 표기 통일 후보 찾기 — 외래어 표기(변환)처럼 흰 박스 + 전용 버튼으로 따로 돌린다.
 * 기준 검수와 무관. 결과는 이후 표기 통일하기에 연결.
 */
import { useState } from 'react';
import ConsistencyHintExample from './ConsistencyHintExample.jsx';

/**
 * @param {{
 *   hasPdf?: boolean,
 *   onFind?: () => void | Promise<void>,
 * }} props
 */
export default function UnifyCandidateFindPanel({
  hasPdf = false,
  onFind,
}) {
  const [finding, setFinding] = useState(false);

  async function handleFind() {
    if (!hasPdf) {
      alert('먼저 PDF를 업로드하세요.');
      return;
    }
    if (finding) return;
    setFinding(true);
    try {
      await onFind?.();
    } finally {
      setFinding(false);
    }
  }

  return (
    <div className="loanword-converter unify-candidate-find">
      <div className="loanword-converter__summary panel-criteria-heading">
        <span className="loanword-converter__summary-title">
          표기 통일 후보 찾기
        </span>
      </div>

      <p className="hint consistency-hint-block unify-candidate-find__hint">
        표기 통일이 필요한 항목을 본문 속에서 찾아 추천합니다
        <br />
        <ConsistencyHintExample>
          책 속 &apos;제1차 세계대전, 제 1차 세계대전, 제 1차 세계 대전&apos;
          혼재 → 항목 수 분석 후 &apos;제1차 세계대전&apos; 통일형 추천
        </ConsistencyHintExample>
      </p>

      <div className="loanword-converter__field unify-candidate-find__field">
        <button
          type="button"
          className="loanword-converter__submit unify-candidate-find__submit"
          onClick={() => void handleFind()}
          disabled={finding}
          aria-busy={finding}
        >
          {finding ? '찾는 중…' : '찾기'}
        </button>
      </div>
    </div>
  );
}
