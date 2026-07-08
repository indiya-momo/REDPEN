import { useState } from 'react';
import AppDialogHost from '../../components/AppDialogHost.jsx';
import { WorkHistoryPanelMock } from './WorkHistoryPanelMock.jsx';
import {
  MOCK_WORK_HISTORY_ONE_SESSION,
  MOCK_WORK_HISTORY_SESSIONS,
  MOCK_WORK_HISTORY_TWO_SESSIONS,
} from './mockWorkHistoryData.js';
import './work-history-prototype.css';

/** @typedef {'three' | 'two' | 'one'} MockVariant */

const VARIANTS = /** @type {const} */ ([
  { id: 'three', label: '검수 3회 (꺾은선)' },
  { id: 'two', label: '검수 2회' },
  { id: 'one', label: '검수 1회 (점만)' },
]);

/**
 * DEV: ?window=work-history-mock
 */
export default function WorkHistoryPrototypeScreen() {
  const [variant, setVariant] = useState(/** @type {MockVariant} */ ('three'));

  const sessions =
    variant === 'one'
      ? MOCK_WORK_HISTORY_ONE_SESSION
      : variant === 'two'
        ? MOCK_WORK_HISTORY_TWO_SESSIONS
        : MOCK_WORK_HISTORY_SESSIONS;

  return (
    <>
      <div className="work-history-proto">
        <p className="work-history-proto__banner">
          DEV 목업 — 맞춤법 2행 · 표기 통일(4분류+최근1회) · 본·보조 sparkline
        </p>
        <div className="work-history-proto__shell">
          <nav aria-label="설정 메뉴 (목업)">
            <ul className="work-history-proto__nav">
              <li>
                <span className="work-history-proto__nav-item">프로젝트 정보</span>
              </li>
              <li>
                <span className="work-history-proto__nav-item work-history-proto__nav-item--spelling">
                  맞춤법
                </span>
              </li>
              <li>
                <span className="work-history-proto__nav-item work-history-proto__nav-item--consistency">
                  표기 통일
                </span>
              </li>
              <li>
                <span className="work-history-proto__nav-item work-history-proto__nav-item--auxiliary">
                  본용언 + 보조용언
                </span>
              </li>
              <li>
                <span className="work-history-proto__nav-item work-history-proto__nav-item--actions work-history-proto__nav-item--active">
                  작업 이력
                </span>
              </li>
            </ul>
          </nav>

          <div className="work-history-proto__main">
            <div className="work-history-proto__switcher">
              {VARIANTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`work-history-proto__switch${
                    variant === item.id ? ' work-history-proto__switch--active' : ''
                  }`}
                  onClick={() => setVariant(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <WorkHistoryPanelMock sessions={sessions} />
          </div>
        </div>
      </div>
      <AppDialogHost />
    </>
  );
}
