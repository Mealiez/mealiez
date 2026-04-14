import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mealiez.app',
  appName: 'Mealiez',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    // During dev, point to local Next.js server
    // Comment this out for production build
    // url: 'http://192.168.x.x:3000'
  }
}

export default config
