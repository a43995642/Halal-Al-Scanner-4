
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ⚠️ IMPORTANT: Unique ID for the Play Store
  appId: 'io.halalscanner.ai', 
  appName: 'Halal Scanner',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'halal-al-scanner-4.vercel.app', // Critical for CORS
    cleartext: true,
    allowNavigation: [
      "*.vercel.app",
      "*.supabase.co",
      "accounts.google.com"
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#1e1e1e",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP", 
      showSpinner: false,
    },
    Keyboard: {
      resize: "body",
      style: "DARK",
      resizeOnFullScreen: true,
    },
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId: "565514314234-9ae9k1bf0hhubkacivkuvpu01duqfthv.apps.googleusercontent.com",
      forceCodeForRefreshToken: false,
    }
  }
};

export default config;
