import { Capacitor } from '@capacitor/core';

// In native Capacitor environment, default to production API if not overridden by env.
// In web environment, default to empty string so it uses relative paths (compatible with dev server and same-origin web deployment).
const DEFAULT_ONLINE_API = 'https://english-word-master.vercel.app';

export const API_BASE_URL: string =
  ((import.meta as any).env?.VITE_API_BASE_URL as string) ||
  (Capacitor.isNativePlatform() ? DEFAULT_ONLINE_API : '');

export function getApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
