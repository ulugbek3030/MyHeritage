import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{padding:24,color:'#fafafa'}}>Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
};
