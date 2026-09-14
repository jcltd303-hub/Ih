import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fishfrenzy.arcade',
  appName: 'Fish Frenzy',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Haptics: {},
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0a0f1d',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0f1d'
    }
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#0a0f1d',
    preferredContentMode: 'mobile'
  },
  android: {
    backgroundColor: '#0a0f1d',
    allowMixedContent: false
  }
};

export default config;
