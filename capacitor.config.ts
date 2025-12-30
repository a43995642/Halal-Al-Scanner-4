
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ⚠️ IMPORTANT FOR PLAY STORE: 
  // Package Name (Application ID)
  // If you change this, you must run: npx cap sync
  appId: 'io.halalscanner.ai', 
  appName: 'Halal Scanner',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost' // Ensures origin is https://localhost
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
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
      // ✅ CRITICAL: This MUST be the "Web Client ID" from Google Cloud Console.
      // Do NOT use the Android Client ID here.
      // Web Client ID usually ends with "...apps.googleusercontent.com"
      serverClientId: "772072434808-6gr30mgjfg5mn5mapmha31l8ooda84ud.apps.googleusercontent.com",
      
      // ⚠️ Changed to false to prevent issues with authorization codes. We only need the idToken.
      forceCodeForRefreshToken: false,
    }
  }
};

export default config;
