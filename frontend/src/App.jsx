import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Today from './pages/Today';

// Today is the landing screen and stays eager; the heavier, chart-bearing
// screens are code-split so the first paint on the phone is fast.
const History = lazy(() => import('./pages/History'));
const Insights = lazy(() => import('./pages/Insights'));
const Settings = lazy(() => import('./pages/Settings'));

function PageFallback() {
  return (
    <div className="space-y-3 pt-2">
      <div className="card h-28 animate-pulse" />
      <div className="card h-48 animate-pulse" />
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-md px-3">
        <Header />
        <main className="pb-28 pt-1">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/history" element={<History />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Today />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
