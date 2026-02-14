
import { Purchases, PurchasesOfferings, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { secureStorage } from '../utils/secureStorage';

// استرداد المفتاح من متغيرات البيئة
const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY || 'goog_PLACEHOLDER';

export const PurchaseService = {
  
  async initialize() {
    if (!Capacitor.isNativePlatform()) {
        console.warn("RevenueCat only works on Native Devices (Android/iOS)");
        return;
    }

    // التحقق من صحة المفتاح قبل البدء
    if (!REVENUECAT_API_KEY || REVENUECAT_API_KEY.includes('PLACEHOLDER')) {
        console.error("🚨 CRITICAL: VITE_REVENUECAT_PUBLIC_KEY is not set in .env file!");
        console.error("Subscriptions will NOT work. Please add your RevenueCat Public API Key.");
        return;
    }

    try {
      if (Capacitor.getPlatform() === 'android') {
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      }
      
      // في الإنتاج، نقلل مستوى السجلات لتجنب تسريب المعلومات
      await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
      
      // التحقق من حالة الاشتراك عند البدء
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
      
      // تأكد من أن المعرف 'pro_access' يطابق ما قمت بإنشائه في لوحة تحكم RevenueCat
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
         // إذا انتهى الاشتراك
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
        
        // تحديث التخزين المحلي الآمن
        secureStorage.setItem('isPremium', isPro);
        
        return isPro;
     } catch (e) {
        return false;
     }
  },
  
  // ربط المستخدم في RevenueCat (مفيد إذا سجل الدخول عبر Supabase)
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
