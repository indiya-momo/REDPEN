import { useState } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
import AppVersionBadge from './AppVersionBadge.jsx';
import MomoHero from './MomoHero.jsx';
import {
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from '../lib/analytics.js';
import { publicAssetUrl } from '../lib/publicAssetUrl.js';

const WELCOME_MOMO_FRAME = publicAssetUrl('welcome/welcome_momo_frame.png');

/**
 * @param {{ onStart: () => void, onOpenRoom: () => void }} props
 */
export default function WelcomeScreen({ onStart, onOpenRoom }) {
  const [analyticsOptedOut, setAnalyticsOptedOut] = useState(() =>
    isAnalyticsOptedOut(),
  );

  return (
    <div className="welcome-gate">
      <div className="welcome-gate__layout">
        <div className="welcome-gate__copy">
          <header className="welcome-gate__header">
            <p className="welcome-gate__eyebrow">조판 PDF 검수 도구</p>
            <h1>
              <span className="welcome-gate__title-main">인디야</span>
              <br />
              <span className="welcome-gate__title-sub">교정냥 모모의 여행</span>
            </h1>
            <p className="welcome-gate__lead">
              맞춤법·표기 일관성을 찾는 조판 PDF 검수 도구입니다
              <br />
              원고와 검사 결과는 <strong>이 브라우저 안에서만</strong> 처리합니다
            </p>
          </header>

          <div className="welcome-gate__panels">
            <section className="welcome-gate__panel welcome-gate__panel--do">
              <h2>하는 일</h2>
              <ul>
                <li>규칙 기준으로 PDF 스캔</li>
                <li>발견 위치를 목록 + 하이라이트로 표시</li>
              </ul>
            </section>
            <section className="welcome-gate__panel welcome-gate__panel--dont">
              <h2>하지 않는 일</h2>
              <ul>
                <li>자동 수정 · 문장 추천</li>
                <li>검사 결과 서버 저장</li>
              </ul>
            </section>
          </div>

          <div className="welcome-gate__steps" aria-label="시작 방법">
            <article className="welcome-gate__step">
              <h3 className="welcome-gate__step-title">
                <span className="welcome-gate__step-num">01</span> 적용규칙 확인
              </h3>
              <p>
                맞춤법·띄어쓰기·일관성 탭에서
                <br />
                적용하려는 규칙을 켭니다
              </p>
            </article>
            <article className="welcome-gate__step">
              <h3 className="welcome-gate__step-title">
                <span className="welcome-gate__step-num">02</span> PDF열기
              </h3>
              <p>
                파일을 선택합니다
                <br />
                (50MB 이하 권장)
              </p>
            </article>
            <article className="welcome-gate__step">
              <h3 className="welcome-gate__step-title">
                <span className="welcome-gate__step-num">03</span> 검사 실행
              </h3>
              <p>
                버튼을 누른 뒤 규칙이 적용된
                <br />
                결과를 확인합니다
              </p>
            </article>
          </div>

          <p className="welcome-gate__analytics-note">
            {analyticsOptedOut ? (
              <>베타 통계 수집을 사용하지 않습니다.</>
            ) : (
              <>
                베타 기간에는 <strong>이용 방식만 익명으로</strong> 수집합니다.
                PDF 원고·검사 문구·규칙 내용은 전송하지 않습니다.
              </>
            )}{' '}
            <button
              type="button"
              className="welcome-gate__analytics-toggle"
              onClick={() => {
                const next = !analyticsOptedOut;
                setAnalyticsOptOut(next);
                setAnalyticsOptedOut(next);
              }}
            >
              {analyticsOptedOut ? '통계 수집 켜기' : '수집 안 함'}
            </button>
          </p>

          <p className="welcome-gate__steps-note">
            시크릿 창에서 작업 시 복원 · 저장이 되지 않습니다
          </p>
        </div>

        <aside className="welcome-gate__stage">
          <div className="welcome-gate__stage-stack">
            <div className="welcome-gate__portrait">
              <div className="welcome-gate__portrait-media">
                <MomoHero variant="gate" />
              </div>
              <img
                className="welcome-gate__portrait-frame"
                src={WELCOME_MOMO_FRAME}
                alt=""
                aria-hidden
                decoding="async"
              />
            </div>
            <div className="welcome-gate__stage-cta">
              <button
                type="button"
                className="btn-welcome-primary welcome-gate__start"
                onClick={onStart}
              >
                검수 시작하기
                <ArrowRight size={18} aria-hidden />
              </button>
            </div>
          </div>
        </aside>
      </div>

      <footer className="welcome-gate__version">
        <div className="welcome-gate__version-row">
          <AppVersionBadge prominent />
          <button
            type="button"
            className="welcome-gate__room-entry"
            onClick={onOpenRoom}
            aria-label="모모의 방"
            title="모모의 방"
          >
            <BookOpen size={17} strokeWidth={1.6} aria-hidden />
          </button>
        </div>
      </footer>
    </div>
  );
}
