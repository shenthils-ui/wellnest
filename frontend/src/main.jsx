import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { AppProvider } from './context/AppContext';
import './index.css';

// Keep the installed PWA up to date automatically.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* basename follows the deploy path (e.g. /wellnest/ on GitHub Pages) */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
