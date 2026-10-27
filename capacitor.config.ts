import type { CapacitorConfig } from '@capacitor/cli'

const releaseBuild = process.env.VITE_NATIVE_RELEASE === '1'

const config: CapacitorConfig = {
  appId: 'com.zhiya.education',
  appName: '智芽',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: !releaseBuild,
  },
  android: {
    allowMixedContent: !releaseBuild,
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
