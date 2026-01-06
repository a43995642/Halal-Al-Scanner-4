
import { Purchases, PurchasesOfferings, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { secureStorage } from '../utils/secureStorage';

// ⚠️ هام جداً للنشر:
// استبدل هذا المفتاح بمفتاح RevenueCat الحقيقي الخاص بـ Android من لوحة التحكم
// Get this from: https://app.revenuecat.com/ -> Project Settings -> API Keys
const REVENUECAT_API_KEY = 'goog_YOUR_REVENUECAT_API_KEY_HERE';

export interface SubscriptionPackage {
  identifier: string;
  product: {
    priceString: string;
    title: string;
    description: string;
  };
}

export const PurchaseService = {
  
  async initialize() {
    if (!Capacitor.isNativePlatform()) {
        console.warn("RevenueCat only works on Native Devices (Android/iOS)");
        return;
    }

    // Safety check for production
    if (REVENUECAT_API_KEY.includes('YOUR_REVENUECAT_API_KEY_HERE')) {
        console.error("🚨 CRITICAL: RevenueCat API Key is not set! Subscriptions will fail.");
        console.error("Please update services/purchaseService.ts with your actual key.");
    }

    try {
      if (Capacitor.getPlatform() === 'android') {
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      }
      
      // In production, you might want to reduce log level to WARN or ERROR
      await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
      
      // Check initial status
      await this.checkSubscriptionStatus();
      
    } catch (error) {
      console.error("RevenueCat Init Error:", error);
    }
  },

  async getOfferings(): Promise<PurchasesOfferings | null> {
     if (!Capacitor.isNativePlatform()) return null;
     try {
       const offerings = await Purchases.getOfferings();
       return offerings;
     } catch (e) {
       console.error("Error fetching offerings", e);
       return null;
     }
  },

  async purchasePackage(packageIdentifier: any): Promise<boolean> {
    try {
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageIdentifier });
      
      // Check for the entitlement identifier you created in RevenueCat dashboard (e.g. 'pro_access')
      if (customerInfo.entitlements.active['pro_access']) {
         secureStorage.setItem('isPremium', true);
         return true;
      }
    } catch (error: any) {
      if (!error.userCancelled) {
         console.error("Purchase Error:", error);
         throw error;
      }
    }
    return false;
  },

  async restorePurchases(): Promise<boolean> {
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active['pro_access']) {
         secureStorage.setItem('isPremium', true);
         return true;
      } else {
         // If restored but no active entitlement, user might be expired
         secureStorage.setItem('isPremium', false);
      }
    } catch (error) {
      console.error("Restore Error:", error);
      throw error;
    }
    return false;
  },

  async checkSubscriptionStatus(): Promise<boolean> {
     if (!Capacitor.isNativePlatform()) return false;
     
     try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        const isPro = typeof customerInfo.entitlements.active['pro_access'] !== "undefined";
        
        // Update Local Storage Securely
        secureStorage.setItem('isPremium', isPro);
        
        return isPro;
     } catch (e) {
        return false;
     }
  },
  
  // Identify user in RevenueCat (useful if they log in with Supabase)
  async logIn(userId: string) {
     if (Capacitor.isNativePlatform()) {
         await Purchases.logIn({ appUserID: userId });
     }
  },

  async logOut() {
      if (Capacitor.isNativePlatform()) {
          await Purchases.logOut();
      }
  }
};
