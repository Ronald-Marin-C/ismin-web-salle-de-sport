import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';

interface RequireAuthProps {
  children: ReactNode;
}

/** Shows the page to a logged-in user; otherwise sends to /login, which comes back here after the login. */
export const RequireAuth = ({ children }: RequireAuthProps) => {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    // replace: the protected page does not stay in the history, "Back" does not loop on it.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
};
