import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { startSync } from './data/sync';
import { applyTheme, usePrefs } from './ui/i18n';
import './ui/styles.css';

applyTheme(usePrefs.getState().theme);
document.documentElement.lang = usePrefs.getState().lang;

if (import.meta.env.PROD && !import.meta.env.VITE_PREVIEW) registerSW({ immediate: true });
// Persistent storage so Android does not evict the offline cache under storage pressure.
void navigator.storage?.persist?.();
startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
