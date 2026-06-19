/**
 * 뷰포트 960px 기준 PC·모바일 완전 분리 렌더 (이 worktree는 pc만 유지보수).
 * props를 WelcomePcScreen 또는 WelcomeMoScreen에 그대로 전달.
 * App과 MainScreen 사이의 「대문」 단일 진입점.
 */
import { useEffect, useState } from 'react';
import WelcomePcScreen from './pc/WelcomePcScreen.jsx';
import WelcomeMoScreen from './mobile/WelcomeMoScreen.jsx';

const MOBILE_MQ = '(max-width: 960px)';

export default function WelcomeScreen(props) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (isMobile) {
    return <WelcomeMoScreen {...props} />;
  }

  return <WelcomePcScreen {...props} />;
}
