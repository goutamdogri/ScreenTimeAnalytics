import { useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface AsyncResult<T> extends AsyncState<T> {
  reload: () => void;
  setData: (data: T | null) => void;
}

export function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Runs `asyncFn` whenever `deps` change and exposes its result. The function
 * is recalled by identity each render but only executed on dependency change.
 */
export function useAsync<T>(asyncFn: () => Promise<T>, deps: unknown[]): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [reloadKey, setReloadKey] = useState(0);
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, data: null, error: null, loading: true }));
    fnRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, error: messageOf(err), loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [...deps, reloadKey]);

  return {
    ...state,
    reload: () => setReloadKey((k) => k + 1),
    setData: (data) => setState((prev) => ({ ...prev, data })),
  };
}
