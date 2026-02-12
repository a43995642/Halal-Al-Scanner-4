
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.halalscanner.ai', 
  appName: 'Halal Scanner',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      "*.vercel.app",
      "*.supabase.co",
      "accounts.google.com",
      "world.openfoodfacts.org"
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#020617",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP", 
      showSpinner: false,
    },
    GoogleAuth: {
      scopes: ["profile", "email"],
      // تم تحديث المعرف بناءً على الصورة الخاصة بك
      serverClientId: "565514314234-9ae9k1bf0hhubkacivkuvpu01duqfthv.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    }
  }
};

export default config;
