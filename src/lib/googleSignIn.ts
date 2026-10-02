const PRODUCTION_HOST = 'english-word-master.vercel.app';

export function webAuthDomain(hostname: string | undefined, native: boolean, defaultDomain: string): string {
  return !native && hostname === PRODUCTION_HOST ? PRODUCTION_HOST : defaultDomain;
}

export async function signInWithPopupFallback<T>(popup: () => Promise<T>, redirect: () => Promise<never>): Promise<T> {
  try {
    return await popup();
  } catch (error) {
    if ((error as { code?: string })?.code !== 'auth/popup-blocked') throw error;
    return redirect();
  }
}
