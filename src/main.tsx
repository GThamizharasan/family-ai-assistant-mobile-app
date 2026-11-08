import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Google Maps Platform Two-Tier Demo Key Quota Defense
if (typeof window !== 'undefined') {
  (window as any).gm_authFailure = () => {
    window.dispatchEvent(
      new CustomEvent('gmp-quota-exceeded', {
        detail: { reason: 'gm_authFailure', message: 'Google Maps API authorization failed or quota limit reached.' },
      })
    );
  };

  window.addEventListener('error', (event) => {
    if (
      event.error?.name === 'OverQuotaMapError' ||
      (event.message && (event.message.includes('OverQuotaMapError') || event.message.includes('QuotaExceeded')))
    ) {
      window.dispatchEvent(
        new CustomEvent('gmp-quota-exceeded', {
          detail: { reason: 'OverQuotaMapError', message: 'Google Maps daily API quota limit reached.' },
        })
      );
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

