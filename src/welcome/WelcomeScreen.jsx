import { useEffect, useState } from 'react';
import WelcomePcScreen from './pc/WelcomePcScreen.jsx';
import WelcomeMoScreen from './mobile/WelcomeMoScreen.jsx';

const MOBILE_MQ = '(max-width: 960px)';

/**
 * PC(welcome-pc) / 모바일(welcome-mo) — 완전 별도 화면. 960px 기준 전환.
 * @param {{ onStart: () => void, onOpenRoom: () => void }} props
 */
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
