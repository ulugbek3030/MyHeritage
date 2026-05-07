import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { TreesListPage } from './pages/TreesListPage';
import { TreeViewPage } from './pages/TreeViewPage';
import { FullTreePage } from './pages/FullTreePage';
import { CalendarPage } from './pages/CalendarPage';
import { SharedTreePage } from './pages/SharedTreePage';

export const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/share/:token" element={<SharedTreePage />} />
        <Route path="/" element={<ProtectedRoute><TreesListPage /></ProtectedRoute>} />
        <Route path="/trees/:treeId" element={<ProtectedRoute><TreeViewPage /></ProtectedRoute>} />
        <Route path="/trees/:treeId/full" element={<ProtectedRoute><FullTreePage /></ProtectedRoute>} />
        <Route path="/trees/:treeId/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);
