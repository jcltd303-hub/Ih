import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fishfrenzy.arcade',
  appName: 'Fish Frenzy',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Haptics: {}
  }
};

export default config;
