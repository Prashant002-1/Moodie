/**
 * ProtectedRoute Component
 * 
 * Route wrapper that enforces user authentication requirements.
 * Redirects unauthenticated users to a fallback path and shows loading
 * state while checking authentication status.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { LoadingSpinner } from './index';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

/**
 * ProtectedRoute component that guards routes requiring authentication.
 * @param children - Components to render when user is authenticated
 * @param fallbackPath - Path to redirect to when user is not authenticated
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallbackPath = '/signin'
}) => {
  const { user, loading, sessionError, refreshSession, deletionReceipt } = useUser();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return <LoadingSpinner message="Checking your session" />;
  }

  if (sessionError) return <div className="page page--narrow"><div className="empty" role="alert"><p>{sessionError}</p><button className="btn btn--secondary" onClick={() => void refreshSession()}>Retry</button></div></div>;

  // If not authenticated, don't render children
  if (!user) {
    return <Navigate replace to={deletionReceipt ? '/account-deleted' : fallbackPath} state={{ from: location.pathname + location.search + location.hash }} />;
  }

  // A new account chooses how Moodie works before anything else. Strict null:
  // an older server that does not report the choice never traps the person here.
  if (user.ai_mode === null && location.pathname !== '/welcome') {
    return <Navigate replace to="/welcome" state={{ from: location.pathname + location.search + location.hash }} />;
  }

  // If authenticated, render children
  return <>{children}</>;
};

export default ProtectedRoute;
