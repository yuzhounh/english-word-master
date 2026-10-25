import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wordmaster.app',
  appName: 'English Word Master',
  webDir: 'dist',
  // Bridge logs include CapacitorHttp request headers, i.e. Firebase ID tokens; keep them out of logcat in every build.
  loggingBehavior: 'none',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'disable'
    },
    // The WebView's own network stack reuses connections (HTTP/2), so parallel Firestore reads in one sync
    // batch share a connection; the API and Firebase endpoints all allow cross-origin requests.
    CapacitorHttp: {
      enabled: false
    }
  }
};

export default config;
