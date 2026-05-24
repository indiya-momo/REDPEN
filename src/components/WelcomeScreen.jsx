import { useState } from 'react';
import { ArrowRight, BookOpen, Settings, Shield } from 'lucide-react';
import AppVersionBadge from './AppVersionBadge.jsx';
import MomoHero from './MomoHero.jsx';

const SKIP_KEY = 'pdf-proofread-skip-welcome';

/**
 * @param {{ onStart: () => void, onOpenSettings: () => void }} props
 */
export default function WelcomeScreen({ onStart, onOpenSettings }) {
  const [skipNext, setSkipNext] = useState(
    () => localStorage.getItem(SKIP_KEY) === '1',
  );

  function handleStart() {
    if (skipNext) localStorage.setItem(SKIP_KEY, '1');
    else localStorage.removeItem(SKIP_KEY);
    onStart();
  }

  return (
    <div className="welcome-page">
      <div className="welcome-inner">
        <header className="welcome-hero">
          <MomoHero />
          <p className="welcome-eyebrow">PDF 출판 교정 보조</p>
          <h1>PDF 교정 도우미</h1>
          <p className="welcome-lead">
            조판 PDF에서 <strong>반복 검수</strong>를 빠르게 돕는 도구입니다.
            AI가 문장을 고쳐 주지 않고, 규칙에 맞지 않는 표기를{' '}
            <strong>찾아서 표시</strong>만 합니다.
          </p>
        </header>

        <section className="welcome-section">
          <h2>이런 때 쓰세요</h2>
          <ul className="welcome-list">
            <li>맞춤법·띄어쓰기 후보를 PDF 위에서 한눈에 확인할 때</li>
            <li>「경제 정책 → 경제정책」처럼 표기 일관성을 반복 점검할 때</li>
            <li>원고를 서버에 올리기 어려울 때 (브라우저 안에서만 처리)</li>
          </ul>
        </section>

        <div className="welcome-cards">
          <article className="welcome-card welcome-card--do">
            <h3>하는 일</h3>
            <ul>
              <li>규칙 기준으로 PDF 전체 스캔</li>
              <li>발견 위치를 목록 + PDF 하이라이트로 표시</li>
              <li>클릭 시 해당 페이지·구간으로 이동</li>
            </ul>
          </article>
          <article className="welcome-card welcome-card--dont">
            <h3>하지 않는 일</h3>
            <ul>
              <li>자동 수정·문장 추천</li>
              <li>AI 문맥 교정</li>
              <li>PDF/HWP 재생성·서버 원문 저장</li>
            </ul>
          </article>
        </div>

        <section className="welcome-section welcome-privacy">
          <Shield size={20} aria-hidden />
          <div>
            <h2>보안·저장</h2>
            <p>
              PDF와 검사 결과는 <strong>이 PC·이 브라우저</strong>에서만
              처리합니다. 출판사 원고를 외부 서버에 올리지 않습니다.
            </p>
            <p className="welcome-muted">
              규칙 세트(맞춤법 ON/OFF, 일관성 등록 등)만 브라우저에 저장됩니다.
              검사 결과는 새로고침 후 사라질 수 있으니, 필요하면 별도 메모에
              남기세요.
            </p>
          </div>
        </section>

        <section className="welcome-section">
          <h2>
            <BookOpen size={18} aria-hidden /> 시작 방법
          </h2>
          <ol className="welcome-steps">
            <li>
              <strong>규칙 확인</strong> — 맞춤법·일관성 탭에서 규칙을 켭니다.
              (맞춤법은 시트 연동)
            </li>
            <li>
              <strong>PDF 열기 (권장)</strong> — 100페이지 넘는 PDF는 「파일
              선택」보다 이 방식이 안정적입니다.
            </li>
            <li>
              <strong>검사 실행</strong> — 결과를 규칙별로 묶어 보고, 항목을
              눌러 PDF 위치로 이동합니다.
            </li>
          </ol>
        </section>

        <section className="welcome-section welcome-tips">
          <h2>알아두면 좋은 점</h2>
          <ul className="welcome-list">
            <li>
              맞춤법(내장) 규칙은 Google 시트에서 관리·갱신됩니다. 맞춤법 확인 탭
              하단에서 현재 목록을 확인할 수 있습니다.
            </li>
            <li>
              표기 일관성(빨간펜·RED˅PEN 등)은 「일관성 확인」 탭에서 등록합니다.
            </li>
            <li>
              조판 PDF는 추출 텍스트가 어긋날 수 있어, 후보가 안 잡히면 규칙
              표현을 조정해 보세요.
            </li>
            <li>시크릿/InPrivate 창에서는 PDF 복원 저장이 잘 되지 않습니다.</li>
          </ul>
        </section>

        <div className="welcome-cta">
          <button type="button" className="btn-welcome-primary" onClick={handleStart}>
            검수 시작
            <ArrowRight size={18} />
          </button>
          <button type="button" className="btn-welcome-secondary" onClick={onOpenSettings}>
            <Settings size={16} />
            일관성 확인 먼저
          </button>
        </div>

        <label className="welcome-skip">
          <input
            type="checkbox"
            checked={skipNext}
            onChange={(e) => setSkipNext(e.target.checked)}
          />
          다음부터 이 안내 없이 바로 검수 화면으로
        </label>
      </div>
      <AppVersionBadge />
    </div>
  );
}

export function shouldShowWelcome() {
  return localStorage.getItem(SKIP_KEY) !== '1';
}

export function clearWelcomeSkip() {
  localStorage.removeItem(SKIP_KEY);
}
