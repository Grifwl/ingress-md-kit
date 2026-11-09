/**
 * Shared hooks of the admin screens.
 */
import { useEffect, useState } from 'preact/hooks';

/** State of an asynchronous load. */
export interface AsyncState<T> {
  data?: T;
  error?: unknown;
  loading: boolean;
}

/**
 * Loads data when the dependencies change. A response that arrives after
 * the dependencies have changed again is dropped, so a slow request can
 * never overwrite a newer screen.
 *
 * @param load - Performs the load.
 * @param deps - Values that trigger a new load.
 * @returns The state, and a function replacing the data after a local change.
 */
export function useAsync<T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> & { setData: (data: T) => void } {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });

  useEffect(() => {
    let active = true;
    setState({ loading: true });
    load().then(
      (data) => {
        if (active) setState({ data, loading: false });
      },
      (error: unknown) => {
        if (active) setState({ error, loading: false });
      },
    );
    return () => {
      active = false;
    };
    // The caller's dependency list stands in for those of `load`.
  }, deps);

  return { ...state, setData: (data) => setState({ data, loading: false }) };
}
