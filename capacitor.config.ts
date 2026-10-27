import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.zhiya.education',
  appName: '智芽',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SpeechRecognition: {
      language: 'zh-CN',
      maxResults: 3,
      prompt: '请说出你想问的问题',
      partialResults: true,
      popup: false,
    },
  },
}

export default config
