/** Share in-flight loading; a failed download must remain retryable. */
export function lazyModule<T>(loader: () => Promise<T>) {
  let current: T | undefined;
  let pending: Promise<T> | undefined;
  return {
    get current() { return current; },
    load(): Promise<T> {
      if (current !== undefined) return Promise.resolve(current);
      return pending ??= Promise.resolve().then(loader).then(value => {
        current = value;
        return value;
      }, error => {
        pending = undefined;
        throw error;
      });
    },
  };
}
