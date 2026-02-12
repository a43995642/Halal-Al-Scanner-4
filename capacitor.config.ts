
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
      // استبدل هذا بـ Web Client ID الخاص بك من Google Cloud Console
      // يجب أن يطابق Client ID المستخدم في إعدادات Supabase Google Auth
      serverClientId: "YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    }
  }
};

export default config;
