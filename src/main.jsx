import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initAnalytics } from './lib/analytics.js';
import './styles/fonts.css';
import './index.css';
import './styles/main-screen.css';
import './styles/momo-room-mobile.css';
void initAnalytics();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
