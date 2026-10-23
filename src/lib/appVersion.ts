import { useEffect, useState } from 'react';
import { registerPlugin } from '@capacitor/core';
import { isAndroidApp } from './nativeLayout';

declare const __APP_VERSION__: string;

const nativeLayout = registerPlugin<{ getVersion(): Promise<{ versionName: string }> }>('NativeLayout');

/** Installed package version in the APK; the build-time package.json version on the web. */
export function useAppVersion() {
  const [version, setVersion] = useState(__APP_VERSION__);
  useEffect(() => {
    if (!isAndroidApp) return;
    void nativeLayout.getVersion().then(result => { if (result?.versionName) setVersion(result.versionName); }).catch(() => undefined);
  }, []);
  return version;
}
