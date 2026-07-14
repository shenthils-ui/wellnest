import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AppProvider } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Keep the installed PWA up to date automatically.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Catches any render-time error below so a bug in one screen can't
        white-screen the whole app — important since this runs for a
        non-technical user with no way to "check the console." */}
    <ErrorBoundary>
      {/* basename follows the deploy path (e.g. /wellnest/ on GitHub Pages) */}
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
