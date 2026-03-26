/**
 * Realtime utilities for debounced invalidation.
 */

const pendingInvalidations = new Map<string, ReturnType<typeof setTimeout>>();

/** Cancel a pending invalidation by key */
export function cancelPendingInvalidation(key: string): void {
  const timer = pendingInvalidations.get(key);
  if (timer) {
    clearTimeout(timer);
    pendingInvalidations.delete(key);
  }
}

/** Schedule an invalidation with debounce */
export function schedulePendingInvalidation(
  key: string,
  callback: () => void,
  delayMs: number = 5000
): void {
  cancelPendingInvalidation(key);
  const timer = setTimeout(() => {
    pendingInvalidations.delete(key);
    callback();
  }, delayMs);
  pendingInvalidations.set(key, timer);
}
