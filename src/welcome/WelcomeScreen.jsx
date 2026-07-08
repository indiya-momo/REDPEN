/**
 * 뷰포트 960px 기준 PC·모바일 완전 분리 렌더 (이 worktree는 pc만 유지보수).
 * props를 WelcomePcScreen 또는 WelcomeMoScreen에 그대로 전달.
 * App과 MainScreen 사이의 「대문」 단일 진입점.
 */
import { useEffect, useState } from 'react';
import WelcomePcScreen from './pc/WelcomePcScreen.jsx';
import WelcomeMoScreen from './mobile/WelcomeMoScreen.jsx';

import { WELCOME_MOBILE_MQ } from '../lib/welcomeViewport.js';
/** PC worktree dev: 좁은 Cursor 브라우저 패널에서도 welcome-pc 유지 (모바일은 별도 worktree) */
const DEV_FORCE_PC = import.meta.env.DEV;

export default function WelcomeScreen(props) {
  const [isMobile, setIsMobile] = useState(
    () =>
      !DEV_FORCE_PC &&
      typeof window !== 'undefined' &&
      window.matchMedia(WELCOME_MOBILE_MQ).matches,
  );

  useEffect(() => {
    if (DEV_FORCE_PC) return undefined;
    const mq = window.matchMedia(WELCOME_MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (isMobile) {
    return <WelcomeMoScreen {...props} />;
  }

  return <WelcomePcScreen {...props} />;
}
