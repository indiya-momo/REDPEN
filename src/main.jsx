import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import { waitForAnalyticsReady } from './lib/analytics.js';
import './styles/fonts.css';
import './index.css';
import './styles/main-screen.css'; // work-guide tooltip UI (save/mypage)
import './styles/work-guide-tooltip-shift.css';
import './styles/momo-room-mobile.css';
void waitForAnalyticsReady();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
