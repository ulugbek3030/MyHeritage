import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { TreesListPage } from './pages/TreesListPage';
import { LoginPage } from './pages/LoginPage';
import { TreeViewPage } from './pages/TreeViewPage';
import { FullTreePage } from './pages/FullTreePage';
import { CalendarPage } from './pages/CalendarPage';
import { SharedTreePage } from './pages/SharedTreePage';
import { SubfamilyPage } from './pages/SubfamilyPage';
import { trackPageView } from './lib/metrika';

// SPA hit tracker — Metrika needs an explicit hit() on every client-side
// navigation since the script only auto-fires once on hard load.
const RouteTracker = () => {
  const loc = useLocation();
  useEffect(() => { trackPageView(loc.pathname + loc.search); }, [loc.pathname, loc.search]);
  return null;
};

export const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <RouteTracker />
      <Routes>
        <Route path="/share/:token" element={<SharedTreePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><TreesListPage /></ProtectedRoute>} />
        <Route path="/trees/:treeId" element={<ProtectedRoute><TreeViewPage /></ProtectedRoute>} />
        <Route path="/trees/:treeId/full" element={<ProtectedRoute><FullTreePage /></ProtectedRoute>} />
        <Route path="/trees/:treeId/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
        <Route path="/trees/:treeId/dive/:personId" element={<ProtectedRoute><SubfamilyPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);
