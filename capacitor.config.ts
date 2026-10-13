import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wordmaster.app',
  appName: 'English Word Master',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'disable'
    },
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
