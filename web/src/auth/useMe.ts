import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ApiError, fetchMe } from '../api';
import { useAuth } from './AuthProvider';

export function useMe() {
  const { token, endSession } = useAuth();

  const query = useQuery({
    // The token is in the key: after a change of account, the cached profile of the previous one never shows.
    queryKey: ['me', token],
    queryFn: () => fetchMe(token!),
    enabled: token !== null,
  });

  // A 401 means the token expired or the account no longer exists.
  const { error } = query;
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) endSession();
  }, [error, endSession]);

  return query;
}
