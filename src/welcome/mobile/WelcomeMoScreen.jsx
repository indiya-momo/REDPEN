import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import AppVersionBadge from '../../components/AppVersionBadge.jsx';
import MomoHero from '../../components/MomoHero.jsx';
import {
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from '../../lib/analytics.js';
import welcomeMomoFrame from '../../assets/welcome/welcome_momo_frame3.png';
import './welcome-mo.css';

const WELCOME_MOMO_FRAME = welcomeMomoFrame;

/**
 * 모바일 대문 — welcome-mo 전용 (PC와 마크업·CSS 공유 없음) — git 6b26b31
 * @param {{ onStart: () => void, onOpenRoom: () => void }} props
 */
export default function WelcomeMoScreen({ onStart, onOpenRoom }) {
  const [analyticsOptedOut, setAnalyticsOptedOut] = useState(() =>
    isAnalyticsOptedOut(),
  );

  return (
    <div className="welcome-mo">
      <div className="welcome-mo__layout">
        <div className="welcome-mo__copy">
          <header className="welcome-mo__header">
            <p className="welcome-mo__eyebrow">텍스트 PDF 검수 도구</p>
            <h1>
              <span className="welcome-mo__title-main">인디야</span>
              <br />
              <span className="welcome-mo__title-sub">교정냥 모모의 여행</span>
            </h1>
            <p className="welcome-mo__platform-badge" aria-label="이용 안내">
              [모바일 전용 미리보기 페이지]
            </p>
            <p className="welcome-mo__lead">
              <span className="welcome-mo__lead-line">
                맞춤법·표기 일관성을 찾는 <strong>텍스트 PDF 검수 도구</strong>입니다
              </span>
              <span className="welcome-mo__lead-line">
                원고와 검사 결과는 <strong>저장하지 않습니다</strong>
              </span>
            </p>
          </header>

          <div className="welcome-mo__panels">
            <section className="welcome-mo__panel welcome-mo__panel--do">
              <h2>하는 일</h2>
              <ul>
                <li>기준에 따라 PDF 스캔</li>
                <li>발견 위치를 표시</li>
              </ul>
            </section>
            <section className="welcome-mo__panel welcome-mo__panel--dont">
              <h2>하지 않는 일</h2>
              <ul>
                <li>원고 수정 · 문장 추천</li>
                <li>검사 결과 서버 저장</li>
              </ul>
            </section>
          </div>

          <div className="welcome-mo__steps" aria-label="이용 절차 안내">
            <ol className="welcome-mo__step-flow">
              <li className="welcome-mo__step">
                <span className="welcome-mo__step-num">1</span>
                <span className="welcome-mo__step-label">원고 열기</span>
              </li>
              <li className="welcome-mo__step">
                <span className="welcome-mo__step-num">2</span>
                <span className="welcome-mo__step-label">기준 선택</span>
              </li>
              <li className="welcome-mo__step">
                <span className="welcome-mo__step-num">3</span>
                <span className="welcome-mo__step-label">검사 실행</span>
              </li>
            </ol>
          </div>

          <div className="welcome-mo__bottom-notes">
            <p className="welcome-mo__analytics-note">
              {analyticsOptedOut ? (
                <>베타 통계 수집을 사용하지 않습니다.</>
              ) : (
                <>오픈 베타 기간에는 사용자의 이용 방식만 익명으로 수집합니다.</>
              )}{' '}
              <button
                type="button"
                className="welcome-mo__analytics-toggle"
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

        <aside className="welcome-mo__stage">
          <div className="welcome-mo__stage-stack">
            <div className="welcome-mo__portrait">
              <div className="welcome-mo__portrait-media">
                <MomoHero variant="gate" />
              </div>
              <img
                className="welcome-mo__portrait-frame"
                src={WELCOME_MOMO_FRAME}
                alt=""
                aria-hidden
                decoding="async"
              />
            </div>
            <div className="welcome-mo__stage-cta">
              <button
                type="button"
                className="btn-welcome-primary welcome-mo__start"
                onClick={onStart}
              >
                인디야 살펴보기
              </button>
              <p className="welcome-mo__steps-note welcome-mo__steps-note--stage welcome-mo__steps-note--desktop">
                현재 인디야는 <strong>PC버전만 지원</strong>합니다
              </p>
              <p className="welcome-mo__steps-note welcome-mo__steps-note--stage welcome-mo__steps-note--mobile">
                PDF검수는 PC버전에서 가능합니다
              </p>
            </div>
          </div>
        </aside>
      </div>

      <footer className="welcome-mo__version">
        <div className="welcome-mo__version-row">
          <AppVersionBadge prominent dateOnly />
          <button
            type="button"
            className="welcome-mo__room-entry"
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
