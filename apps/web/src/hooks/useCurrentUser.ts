'use client';

import { useCallback, useEffect, useReducer } from 'react';
import type { AuthControllerMeResponse } from '@devbrain/api/client';
import { fetchCurrentUser } from '@/lib/auth';

type State = {
  user: AuthControllerMeResponse | null;
  loading: boolean;
  error: Error | null;
};

type Action =
  | { type: 'START' }
  | { type: 'SUCCESS'; user: AuthControllerMeResponse | null }
  | { type: 'FAILURE'; error: Error };

const initialState: State = { user: null, loading: true, error: null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START':
      return { user: state.user, loading: true, error: null };
    case 'SUCCESS':
      return { user: action.user, loading: false, error: null };
    case 'FAILURE':
      return { user: null, loading: false, error: action.error };
  }
}

export function useCurrentUser() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refetch = useCallback(async () => {
    dispatch({ type: 'START' });
    try {
      const u = await fetchCurrentUser();
      dispatch({ type: 'SUCCESS', user: u });
    } catch (e) {
      dispatch({ type: 'FAILURE', error: e instanceof Error ? e : new Error(String(e)) });
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}