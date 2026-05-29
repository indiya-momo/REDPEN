import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import AppVersionBadge from '../../components/AppVersionBadge.jsx';
import MomoHero from '../../components/MomoHero.jsx';
import TooltipGuide from '../../components/TooltipGuide.jsx';
import {
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from '../../lib/analytics.js';
import welcomeMomoFrame from '../../assets/welcome/welcome_momo_frame3.png';
import { publicAssetUrl } from '../../lib/publicAssetUrl.js';
import './welcome-pc.css';

const WELCOME_MOMO_FRAME = welcomeMomoFrame;
const MOMO_TOOLTIP = publicAssetUrl('momo/bullon4.png');

/**
 * PC 대문 — welcome-pc 전용 (모바일과 마크업·CSS 공유 없음)
 * @param {{ onStart: () => void, onOpenRoom: () => void }} props
 */
export default function WelcomePcScreen({ onStart, onOpenRoom }) {
  const [analyticsOptedOut, setAnalyticsOptedOut] = useState(() =>
    isAnalyticsOptedOut(),
  );

  return (
    <div className="welcome-pc">
      <div className="welcome-pc__layout">
        <div className="welcome-pc__copy">
          <header className="welcome-pc__header">
            <p className="welcome-pc__eyebrow">인디자인 텍스트 PDF 검수 도구</p>
            <h1>
              <span className="welcome-pc__title-main">인디야</span>
              <br />
              <span className="welcome-pc__title-sub">교정냥 모모의 여행</span>
            </h1>
            <p className="welcome-pc__lead">
              <span className="welcome-pc__lead-line">
                맞춤법·표기 일관성을 찾는 <strong>인디자인 텍스트 PDF 검수 도구</strong>입니다
              </span>
              <span className="welcome-pc__lead-line">
                원고와 검사 결과는 <strong>이 브라우저 안에서만 처리</strong>합니다(PC버전만 지원)
              </span>
            </p>
          </header>
          <div className="welcome-pc__editor-note-anchor" aria-hidden>
            <TooltipGuide
              storageKey="welcome-editor-note"
              placement="right"
              offsetX={-292}
              offsetY={0}
              imageSrc={MOMO_TOOLTIP}
              imageAlt="모모"
              message="현직 편집자가 만들었다냥"
            >
              <span className="welcome-pc__editor-note-dot" />
            </TooltipGuide>
          </div>

          <div className="welcome-pc__panels">
            <section className="welcome-pc__panel welcome-pc__panel--do">
              <h2>하는 일</h2>
              <ul>
                <li>설정된 기준에 따라 PDF 스캔</li>
                <li>발견 위치를 목록 + 하이라이트로 표시</li>
              </ul>
            </section>
            <section className="welcome-pc__panel welcome-pc__panel--dont">
              <h2>하지 않는 일</h2>
              <ul>
                <li>원고 자동 수정 · AI 문장 추천</li>
                <li>검사 결과 서버 저장</li>
              </ul>
            </section>
          </div>

          <div className="welcome-pc__steps" aria-label="시작 방법">
            <article className="welcome-pc__step">
              <h3 className="welcome-pc__step-title">
                <span className="welcome-pc__step-num">1 </span> 원고 PDF 열기
              </h3>
              <p>
                텍스트 PDF 파일을 선택합니다
                <br />
                (스캔 PDF는 작업이 불가합니다)
              </p>
            </article>
            <article className="welcome-pc__step">
              <h3 className="welcome-pc__step-title">
                <span className="welcome-pc__step-num">2 </span> 적용 기준 선택
              </h3>
              <p>
                맞춤법·띄어쓰기·일관성 탭에서
                <br />
                적용하려는 기준을 선택합니다
              </p>
            </article>
            <article className="welcome-pc__step">
              <h3 className="welcome-pc__step-title">
                <span className="welcome-pc__step-num">3 </span> 검사 실행 및 확인
              </h3>
              <p>
                검사 실행 버튼을 누른 뒤
                <br />
                기준이 적용된 결과를 확인합니다
              </p>
            </article>
          </div>

          <div className="welcome-pc__bottom-notes">
            <p className="welcome-pc__analytics-note">
              {analyticsOptedOut ? (
                <>베타 통계 수집을 사용하지 않습니다.</>
              ) : (
                <>오픈 베타 기간에는 사용자의 이용 방식만 익명으로 수집합니다.</>
              )}{' '}
              <button
                type="button"
                className="welcome-pc__analytics-toggle"
                onClick={() => {
                  const next = !analyticsOptedOut;
                  setAnalyticsOptOut(next);
                  setAnalyticsOptedOut(next);
                }}
              >
                {analyticsOptedOut ? '통계 수집 켜기' : '수집 안 함'}
              </button>
            </p>
            <div className="welcome-pc__bottom-meta">
              <AppVersionBadge dateOnly />
              <button
                type="button"
                className="welcome-pc__room-entry"
                onClick={onOpenRoom}
                aria-label="모모의 방"
                title="모모의 방"
              >
                <BookOpen size={16} strokeWidth={1.6} aria-hidden />
              </button>
            </div>
          </div>
        </div>

        <aside className="welcome-pc__stage">
          <div className="welcome-pc__stage-stack">
            <div className="welcome-pc__portrait">
              <div className="welcome-pc__portrait-media">
                <MomoHero variant="gate" />
              </div>
              <img
                className="welcome-pc__portrait-frame"
                src={WELCOME_MOMO_FRAME}
                alt=""
                aria-hidden
                decoding="async"
              />
            </div>
            <div className="welcome-pc__stage-cta">
              <TooltipGuide
                storageKey="welcome-start-v2"
                placement="right"
                offsetX={-69}
                offsetY={-51}
                imageSrc={MOMO_TOOLTIP}
                imageAlt="모모"
                message="시작해보자냥!"
              >
                <button
                  type="button"
                  className="btn-welcome-primary welcome-pc__start"
                  onClick={onStart}
                >
                  검수 시작하기
                </button>
              </TooltipGuide>
              <p className="welcome-pc__steps-note welcome-pc__steps-note--stage">
                시크릿 창에서 작업 시 복원 · 저장이 되지 않습니다
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
