import { useRef } from "react";

/**
 * usePersistFn instead of useCallback to reduce cognitive load
 */
export function usePersistFn<Args extends unknown[], Return>(
  fn: (...args: Args) => Return
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const persistFn = useRef<((...args: Args) => Return) | null>(null);
  if (!persistFn.current) {
    persistFn.current = function (this: unknown, ...args) {
      return fnRef.current!.apply(this, args);
    };
  }

  return persistFn.current;
}
