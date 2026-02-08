
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.halalscanner.ai', 
  appName: 'Halal Scanner',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Removed specific hostname to allow local loading from internal assets which is more stable
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
      serverClientId: "565514314234-9ae9k1bf0hhubkacivkuvpu01duqfthv.apps.googleusercontent.com",
      forceCodeForRefreshToken: false,
    }
  }
};

export default config;
