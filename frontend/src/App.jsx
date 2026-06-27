import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import Today from './pages/Today';
import History from './pages/History';
import Insights from './pages/Insights';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-md px-3">
        <Header />
        <main className="pb-28 pt-1">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/history" element={<History />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Today />} />
          </Routes>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
