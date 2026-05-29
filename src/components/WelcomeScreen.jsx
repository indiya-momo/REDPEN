import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import AppVersionBadge from './AppVersionBadge.jsx';
import MomoHero from './MomoHero.jsx';
import {
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from '../lib/analytics.js';
import welcomeMomoFrame from '../assets/welcome/welcome_momo_frame3.png';

const WELCOME_MOMO_FRAME = welcomeMomoFrame;

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
            <p className="welcome-gate__eyebrow">텍스트 PDF 검수 도구</p>
            <h1>
              <span className="welcome-gate__title-main">인디야</span>
              <br />
              <span className="welcome-gate__title-sub">교정냥 모모의 여행</span>
            </h1>
            <p className="welcome-gate__platform-badge" aria-label="이용 안내">
              [모바일 전용 미리보기 페이지]
            </p>
            <p className="welcome-gate__lead">
              <span className="welcome-gate__lead-line">
                맞춤법·표기 일관성을 찾는 <strong>텍스트 PDF 검수 도구</strong>입니다
              </span>
              <span className="welcome-gate__lead-line">
                원고와 검사 결과는 <strong>저장하지 않습니다</strong>
              </span>
            </p>
          </header>

          <div className="welcome-gate__panels">
            <section className="welcome-gate__panel welcome-gate__panel--do">
              <h2>하는 일</h2>
              <ul>
                <li>기준에 따라 PDF 스캔</li>
                <li>발견 위치를 표시</li>
              </ul>
            </section>
            <section className="welcome-gate__panel welcome-gate__panel--dont">
              <h2>하지 않는 일</h2>
              <ul>
                <li>원고 수정 · 문장 추천</li>
                <li>검사 결과 서버 저장</li>
              </ul>
            </section>
          </div>

          <div className="welcome-gate__steps" aria-label="이용 절차 안내">
            <ol className="welcome-gate__step-flow">
              <li className="welcome-gate__step">
                <span className="welcome-gate__step-num">1</span>
                <span className="welcome-gate__step-label">원고 열기</span>
              </li>
              <li className="welcome-gate__step">
                <span className="welcome-gate__step-num">2</span>
                <span className="welcome-gate__step-label">기준 선택</span>
              </li>
              <li className="welcome-gate__step">
                <span className="welcome-gate__step-num">3</span>
                <span className="welcome-gate__step-label">검사 실행</span>
              </li>
            </ol>
          </div>

          <div className="welcome-gate__bottom-notes">
            <p className="welcome-gate__analytics-note">
              {analyticsOptedOut ? (
                <>베타 통계 수집을 사용하지 않습니다.</>
              ) : (
                <>
                  오픈 베타 기간에는 사용자의 이용 방식만 익명으로 수집합니다.
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

          </div>
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
                인디야 살펴보기
              </button>
              <p className="welcome-gate__steps-note welcome-gate__steps-note--stage welcome-gate__steps-note--desktop">
                현재 인디야는 <strong>PC버전만 지원</strong>합니다
              </p>
              <p className="welcome-gate__steps-note welcome-gate__steps-note--stage welcome-gate__steps-note--mobile">
                PDF검수는 PC버전에서 가능합니다
              </p>
            </div>
          </div>
        </aside>
      </div>

      <footer className="welcome-gate__version">
        <div className="welcome-gate__version-row">
          <AppVersionBadge prominent dateOnly />
          <button
            type="button"
            className="welcome-gate__room-entry"
            onClick={onOpenRoom}
            aria-label="모모의 방"
            title="모모의 방"
          >
            <BookOpen size={22} strokeWidth={1.6} aria-hidden />
          </button>
        </div>
      </footer>
    </div>
  );
}
