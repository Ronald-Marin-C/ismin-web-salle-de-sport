import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';

interface RequireReferentProps {
  children: ReactNode;
}

/** Shows `children` to a referent only. It only hides the page: the API checks the role on every request. */
export const RequireReferent = ({ children }: RequireReferentProps) => {
  const { user } = useAuth();

  if (user?.role !== 'referent') {
    return (
      <section className="page">
        <p className="notice">Page réservée aux référents.</p>
      </section>
    );
  }
  return children;
};
