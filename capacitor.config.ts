import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.family.ai.assistant',
  appName: 'AuraFamily',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'aura-family-hub-2cgg5gpa7a-nw.a.run.app',
    cleartext: true,
  },
};

export default config;
