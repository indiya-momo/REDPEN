import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import AppVersionBadge from '../../components/AppVersionBadge.jsx';
import MomoHero from '../../components/MomoHero.jsx';
import {
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from '../../lib/analytics.js';
import { publicAssetUrl } from '../../lib/publicAssetUrl.js';
import welcomeMomoFrame from '../../assets/welcome/welcome_momo_frame3.png';
import { WelcomeMoIllustrationFigure } from './WelcomeMoIllustrationCompare.jsx';
import './welcome-mo.css';

const WELCOME_MOMO_FRAME = welcomeMomoFrame;
const WELCOME_MO_BEFORE = `${import.meta.env.BASE_URL}welcome/m_before.png`;
const WELCOME_MO_AFTER = `${import.meta.env.BASE_URL}welcome/m_after3.png`;
const PDF_MOMO = publicAssetUrl('momo/pdf-momo.png');

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
            <p className="welcome-mo__eyebrow">텍스트 PDF 검수</p>
            <h1>
              <span className="welcome-mo__title-main">인디야</span>
              <br />
              <span className="welcome-mo__title-sub">교정냥 모모의 여행</span>
            </h1>
            <p className="welcome-mo__platform-badge" aria-label="이용 안내">
              [모바일 안내 페이지]
            </p>
            <p className="welcome-mo__lead">
              <span className="welcome-mo__lead-line">
                PDF에서 맞춤법 · 일관성을 검수합니다
              </span>
              <span className="welcome-mo__lead-line">
                원고와 검사 결과는 서버에 <strong>저장하지 않습니다</strong>
              </span>
            </p>
          </header>

          <section
            id="welcome-mo-showcase"
            className="welcome-mo__showcase"
            aria-labelledby="welcome-mo-showcase-title"
          >
            <h2 id="welcome-mo-showcase-title" className="welcome-mo__showcase-title">
              검수 화면
            </h2>
            <ol className="welcome-mo__showcase-flow">
              <li className="welcome-mo__showcase-item welcome-mo__showcase-item--compare">
                <div className="welcome-mo__compare">
                  <div className="welcome-mo__compare-block">
                    <p className="welcome-mo__compare-label">
                      <span className="welcome-mo__showcase-step-num">1</span>
                      검수 전
                    </p>
                    <figure className="welcome-mo__showcase-figure">
                      <WelcomeMoIllustrationFigure
                        src={WELCOME_MO_BEFORE}
                        alt="검수 전 — 원고 본문"
                      />
                      <figcaption>
                        적용할 맞춤법 · 일관성 기준을 선택합니다
                      </figcaption>
                    </figure>
                  </div>
                  <div className="welcome-mo__compare-bridge" aria-hidden="true">
                    <img
                      className="welcome-mo__compare-momo-img"
                      src={PDF_MOMO}
                      alt=""
                      width={140}
                      height={140}
                      loading="lazy"
                      decoding="async"
                    />
                    <p className="welcome-mo__showcase-title welcome-mo__compare-bridge-title">
                      모모가 살펴봐요
                    </p>
                  </div>
                  <div className="welcome-mo__compare-block">
                    <p className="welcome-mo__compare-label">
                      <span className="welcome-mo__showcase-step-num">2</span>
                      검수 후
                    </p>
                    <figure className="welcome-mo__showcase-figure">
                      <WelcomeMoIllustrationFigure
                        src={WELCOME_MO_BEFORE}
                        afterSrc={WELCOME_MO_AFTER}
                        alt="검수 후 — 맞춤법 표시가 적용된 원고 본문"
                      />
                      <figcaption>
                        기준이 적용된 결과를 확인합니다
                      </figcaption>
                    </figure>
                  </div>
                </div>
              </li>
              <li className="welcome-mo__showcase-item welcome-mo__showcase-item--message">
                <p className="welcome-mo__showcase-message">
                  중요한 일에 집중하도록
                </p>
              </li>
            </ol>
          </section>

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
                화면 구성 보기
              </button>
              <p className="welcome-mo__steps-note welcome-mo__steps-note--stage welcome-mo__steps-note--mobile">
                실제 PDF 검수·업로드는 <strong>PC 브라우저</strong>에서 이용하세요
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
