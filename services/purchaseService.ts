
import { Purchases, PurchasesOfferings, LOG_LEVEL, CustomerInfo, Package, PURCHASE_TYPE } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';
import { secureStorage } from '../utils/secureStorage';

// معرف الصلاحية في RevenueCat
const ENTITLEMENT_ID = 'pro_access';

// استرداد المفتاح من متغيرات البيئة
const REVENUECAT_API_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;

export const PurchaseService = {
  
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
      // 1. تكوين SDK
      if (Capacitor.getPlatform() === 'android') {
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      }
      
      // 2. إعداد مستوى السجلات (Verbose مفيد أثناء التطوير)
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      
      // 3. إضافة مستمع لتحديثات العميل (يحدث حالة البريميوم فورياً عند الشراء أو الاستعادة)
      Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
          this.updateLocalStatus(info);
      });

      // 4. التحقق الأولي
      await this.checkSubscriptionStatus();
      
    } catch (error) {
      console.error("RevenueCat Init Error:", error);
    }
  },

  // عرض Paywall الجاهز (Native UI)
  async presentPaywall(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
        const paywallResult = await Purchases.presentPaywall({
            displayCloseButton: true
        });
        
        // التحقق مما إذا قام المستخدم بالشراء
        if (paywallResult === "NOT_PRESENTED") {
             // Paywall didn't show (maybe network error or no config)
             return false;
        }
        
        // التحقق من الحالة بعد إغلاق الـ Paywall
        return await this.checkSubscriptionStatus();
    } catch (e) {
        console.error("Error presenting paywall:", e);
        return false;
    }
  },

  // عرض Customer Center (إدارة الاشتراكات)
  async presentCustomerCenter() {
      if (!Capacitor.isNativePlatform()) return;
      try {
          // محاولة عرض مركز العملاء الأصلي إذا كان مدعوماً
          await Purchases.presentCustomerCenter();
      } catch (e) {
          console.warn("Customer Center not supported or configured, falling back to manage subscriptions.", e);
          // Fallback: فتح صفحة إدارة الاشتراكات في المتجر
          try {
             // @ts-ignore - some versions use different method names
             await Purchases.manageSubscriptions(); 
          } catch (err) {
             console.error("Failed to open subscription management", err);
          }
      }
  },

  // جلب العروض المتاحة (للاستخدام اليدوي في الويب أو Fallback)
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

  // تنفيذ عملية الشراء (حزمة محددة)
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

  // استعادة المشتريات السابقة
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

  // التحقق من الحالة الحالية
  async checkSubscriptionStatus(): Promise<boolean> {
     if (!Capacitor.isNativePlatform()) {
         // Mock logic for web testing: Check local storage
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
  
  // دالة مساعدة لتحديث التخزين المحلي بناءً على معلومات RevenueCat
  updateLocalStatus(info: CustomerInfo): boolean {
      const isPro = typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined";
      console.log(`💎 Subscription Status: ${isPro ? 'PREMIUM' : 'FREE'}`);
      
      // حفظ الحالة محلياً لتجنب التأخير في فتح التطبيق
      secureStorage.setItem('isPremium', isPro);
      
      // إرسال حدث مخصص لتحديث واجهة المستخدم فوراً
      window.dispatchEvent(new CustomEvent('subscription-changed', { detail: { isPremium: isPro } }));
      
      return isPro;
  },

  // ربط معرف المستخدم (عند تسجيل الدخول في التطبيق)
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
