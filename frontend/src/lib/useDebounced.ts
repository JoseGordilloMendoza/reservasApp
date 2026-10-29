import { useEffect, useState } from "react";

/** The value, but only once it has stopped changing for `delay` ms: one request per pause, not per letter. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
