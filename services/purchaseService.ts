
import { Purchases, PurchasesOfferings, LOG_LEVEL, CustomerInfo, Package } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { secureStorage } from '../utils/secureStorage';

// 1. Configuration
// Ensure this Entitlement ID matches exactly what you created in the RevenueCat Dashboard
const ENTITLEMENT_ID = 'pro_access'; // Or 'Halal Scanner Pro' if that's the Identifier

const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;

export const PurchaseService = {
  
  // --- INITIALIZATION ---
  async initialize() {
    if (!Capacitor.isNativePlatform()) {
        console.warn("RevenueCat works mainly on Native Devices. Using Mock Mode for Web.");
        return;
    }

    if (!REVENUECAT_API_KEY || REVENUECAT_API_KEY.includes('PLACEHOLDER')) {
        console.error("🚨 CRITICAL: RevenueCat Key missing in .env.local");
        return;
    }

    try {
      // Configure SDK
      if (Capacitor.getPlatform() === 'android') {
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      } else if (Capacitor.getPlatform() === 'ios') {
        // Add iOS key here if needed in future
        // await Purchases.configure({ apiKey: "ios_key_..." });
      }
      
      // Enable Debug Logs
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      
      // Listener for real-time updates (e.g. renewal, expiration outside app)
      Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
          this.updateLocalStatus(info);
      });

      // Initial Status Check
      await this.checkSubscriptionStatus();
      
    } catch (error) {
      console.error("RevenueCat Init Error:", error);
    }
  },

  // --- CORE FEATURES ---

  // 1. Present Native Paywall
  async presentPaywall(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    
    try {
        // Attempt to show the RevenueCat Native Paywall
        // Note: verify if your installed version supports 'presentPaywall'. 
        // If not, use the fallback modal.
        const paywallResult = await Purchases.presentPaywall({
            displayCloseButton: true
        });
        
        if (paywallResult === "NOT_PRESENTED") {
             return false;
        }
        
        // Re-check status after paywall closes
        return await this.checkSubscriptionStatus();
    } catch (e) {
        console.error("Error presenting paywall:", e);
        return false;
    }
  },

  // 2. Customer Center (Manage Subscriptions)
  async presentCustomerCenter() {
      if (!Capacitor.isNativePlatform()) return;
      try {
          // Use native customer center if available in this SDK version
          // @ts-ignore
          if (Purchases.presentCustomerCenter) {
             // @ts-ignore
             await Purchases.presentCustomerCenter();
          } else {
             // Fallback to platform subscription settings
             await Purchases.manageSubscriptions(); 
          }
      } catch (e) {
          console.warn("Customer Center/Manage Subscriptions failed", e);
      }
  },

  // 3. Get Offerings (For Custom UI Fallback)
  async getOfferings(): Promise<PurchasesOfferings | null> {
     if (!Capacitor.isNativePlatform()) return null;
     try {
       const offerings = await Purchases.getOfferings();
       if (offerings.current !== null) {
           return offerings;
       }
       console.warn("No current offering configured in RevenueCat dashboard.");
       return null;
     } catch (e) {
       console.error("Error fetching offerings", e);
       return null;
     }
  },

  // 4. Purchase Specific Package (For Custom UI)
  async purchasePackage(pkg: Package): Promise<boolean> {
    try {
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
      return this.updateLocalStatus(customerInfo);
    } catch (error: any) {
      if (error.userCancelled) {
         console.log("User cancelled purchase");
      } else {
         console.error("Purchase Error:", error);
      }
      throw error;
    }
  },

  // 5. Restore Purchases
  async restorePurchases(): Promise<boolean> {
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      const isActive = this.updateLocalStatus(customerInfo);
      return isActive;
    } catch (error) {
      console.error("Restore Error:", error);
      throw error;
    }
  },

  // 6. Check & Update Status
  async checkSubscriptionStatus(): Promise<boolean> {
     if (!Capacitor.isNativePlatform()) {
         // Web Fallback: Check local storage (mock)
         return secureStorage.getItem('isPremium', false);
     }
     
     try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        return this.updateLocalStatus(customerInfo);
     } catch (e) {
        console.error("Check Status Error", e);
        return false;
     }
  },
  
  // Helper: Update Local State based on RevenueCat Info
  updateLocalStatus(info: CustomerInfo): boolean {
      // Check if the specific entitlement is active
      const isPro = typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined";
      
      console.log(`💎 RevenueCat Status: ${isPro ? 'PRO ACTIVE' : 'FREE'}`);
      
      // Store locally to avoid async delays on app launch
      secureStorage.setItem('isPremium', isPro);
      
      // Dispatch event to update React Components immediately
      window.dispatchEvent(new CustomEvent('subscription-changed', { detail: { isPremium: isPro } }));
      
      return isPro;
  },

  // --- USER IDENTITY ---
  
  async logIn(userId: string) {
     if (Capacitor.isNativePlatform()) {
         await Purchases.logIn({ appUserID: userId });
         await this.checkSubscriptionStatus();
     }
  },

  async logOut() {
      if (Capacitor.isNativePlatform()) {
          await Purchases.logOut();
          secureStorage.setItem('isPremium', false);
          window.dispatchEvent(new CustomEvent('subscription-changed', { detail: { isPremium: false } }));
      }
  }
};
