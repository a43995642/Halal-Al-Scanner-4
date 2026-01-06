
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { PurchaseService } from '../services/purchaseService';
import { Capacitor } from '@capacitor/core';

interface SubscriptionModalProps {
  onSubscribe: () => void;
  onClose: () => void;
  isLimitReached: boolean;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ onSubscribe, onClose, isLimitReached: _isLimitReached }) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'lifetime'>('lifetime');
  const [offerings, setOfferings] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { t, language: lang } = useLanguage();

  useEffect(() => {
    const loadProducts = async () => {
      if (Capacitor.isNativePlatform()) {
        const offs = await PurchaseService.getOfferings();
        setOfferings(offs);
      }
    };
    loadProducts();
  }, []);

  const handlePurchase = async () => {
    setIsLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // IDs must match what you configured in RevenueCat Dashboard
        // e.g., 'halal_monthly' and 'halal_lifetime'
        // If offerings are not ready yet, we can't purchase
        if (!offerings || !offerings.current) {
            alert("Products not loaded yet. Please check connection.");
            setIsLoading(false);
            return;
        }

        const pkg = selectedPlan === 'monthly' 
           ? offerings.current.monthly 
           : offerings.current.lifetime;

        if (pkg) {
           const success = await PurchaseService.purchasePackage(pkg);
           if (success) {
               onSubscribe();
               onClose();
               alert(t.activated);
           }
        } else {
           alert("Package not found in offerings.");
        }
      } else {
        // Fallback for Web Testing
        alert("Payments only work on real devices.");
      }
    } catch (e) {
      console.error(e);
      // alert("Purchase cancelled or failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    setIsLoading(true);
    try {
      const restored = await PurchaseService.restorePurchases();
      if (restored) {
        onSubscribe();
        onClose();
        alert(t.activated);
      } else {
        alert("No active subscription found to restore.");
      }
    } catch (e) {
      console.error(e);
      alert("Restore failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Dynamic Prices (or fallback to static text)
  const monthlyPrice = offerings?.current?.monthly?.product?.priceString || t.monthlyPrice;
  const lifetimePrice = offerings?.current?.lifetime?.product?.priceString || t.lifetimePrice;

  return (
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-t-3xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-slide-up relative flex flex-col h-full sm:h-auto max-h-[100vh] sm:max-h-[90vh] border border-white/10">
        
        {/* Hero Header */}
        <div className="bg-gradient-to-b from-emerald-600 to-emerald-800 p-8 pb-10 text-center relative overflow-hidden shrink-0">
           {/* Close Button */}
           <button 
             onClick={onClose}
             className={`absolute top-6 ${lang === 'ar' ? 'right-6' : 'left-6'} p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition z-20 backdrop-blur-md`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
               <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>

           <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
           
           <div className="relative z-10 flex flex-col items-center">
             <div className="w-20 h-20 bg-white/10 rounded-3xl flex items-center justify-center mb-4 backdrop-blur-md border border-white/20 shadow-xl">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white drop-shadow-md">
                    <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 00-.584.859 6.753 6.753 0 006.138 5.6 6.73 6.73 0 002.743 1.346A6.707 6.707 0 019.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 00-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 00.75-.75 2.25 2.25 0 00-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 01-1.612-3.13 6.73 6.73 0 002.743-1.347 6.753 6.753 0 006.139-5.6.75.75 0 00-.585-.858 47.077 47.077 0 00-3.07-.543V2.62a.75.75 0 00-.658-.744 49.22 49.22 0 00-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 00-.657.744zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 013.16 5.337a45.6 45.6 0 012.006-.343v.256zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 01-2.863 3.207 6.72 6.72 0 00.857-3.294z" clipRule="evenodd" />
                  </svg>
                </div>
             </div>
             <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
               {t.subTitlePro}
             </h2>
             <p className="text-emerald-100 text-sm font-medium opacity-90 max-w-xs mx-auto">
               {t.subDesc}
             </p>
           </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-grow bg-[#1e1e1e] custom-scrollbar">
          <div className="p-6 space-y-6">
            
            {/* Features */}
            <div className="space-y-3">
              {/* Feature 1 */}
              <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{t.featureSpeed}</h4>
                  <p className="text-xs text-gray-400">{t.featureSpeedDesc}</p>
                </div>
              </div>
              
              {/* Feature 2 */}
              <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                 <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{t.featureUnlimited}</h4>
                  <p className="text-xs text-gray-400">{t.featureUnlimitedDesc}</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-center gap-4 bg-black/20 p-4 rounded-2xl border border-white/5">
                 <div className="w-10 h-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{t.featureSupport}</h4>
                  <p className="text-xs text-gray-400">{t.featureSupportDesc}</p>
                </div>
              </div>
            </div>

            {/* Plans */}
            <div>
              <h3 className="font-bold text-white text-sm mb-3 px-1">{t.choosePlan}</h3>
              <div className="space-y-3">
                {/* Monthly */}
                <div 
                  onClick={() => setSelectedPlan('monthly')}
                  className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedPlan === 'monthly' 
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : 'border-white/10 bg-black/20 hover:bg-black/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedPlan === 'monthly' ? 'border-emerald-500 bg-emerald-500' : 'border-gray-500'}`}>
                      {selectedPlan === 'monthly' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                    <div>
                      <span className="font-bold text-white block text-sm">{t.monthlyPlan}</span>
                      <span className="text-xs text-gray-400">{t.monthlyDesc}</span>
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="font-bold text-emerald-400 text-lg">{monthlyPrice}</span>
                    <span className="text-[10px] text-gray-500 block">/ {t.month}</span>
                  </div>
                </div>

                {/* Lifetime */}
                <div 
                  onClick={() => setSelectedPlan('lifetime')}
                  className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedPlan === 'lifetime' 
                      ? 'border-amber-500 bg-amber-500/10' 
                      : 'border-white/10 bg-black/20 hover:bg-black/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedPlan === 'lifetime' ? 'border-amber-500 bg-amber-500' : 'border-gray-500'}`}>
                       {selectedPlan === 'lifetime' && <div className="w-2 h-2 bg-white rounded-full"></div>}
                    </div>
                    <div>
                      <span className="font-bold text-white block text-sm">{t.lifetimePlan}</span>
                      <span className="text-xs text-gray-400">{t.lifetimeDesc}</span>
                    </div>
                  </div>
                  <div className="text-end flex flex-col items-end">
                     <div className="bg-amber-500 text-amber-950 text-[9px] font-bold px-1.5 py-0.5 rounded-md mb-1 inline-block uppercase">{t.bestValue}</div>
                    <span className="font-bold text-amber-400 text-lg">{lifetimePrice}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <div className="p-6 bg-[#1e1e1e] border-t border-white/5 shrink-0 z-20 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
           <button 
              onClick={handlePurchase}
              disabled={isLoading}
              className={`w-full py-4 font-bold text-lg rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                selectedPlan === 'lifetime' 
                ? 'bg-amber-500 hover:bg-amber-400 text-amber-950 shadow-amber-900/20' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
              } ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
            >
              {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>
                    {selectedPlan === 'lifetime' ? t.buyLifetime : t.subscribeNow}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${lang === 'ar' ? 'rotate-180' : ''}`}>
                     <path fillRule="evenodd" d="M12.97 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
            
            <div className="flex justify-center items-center mt-4 text-[10px] text-gray-500 gap-4 font-medium">
              <button onClick={handleRestore} disabled={isLoading} className="hover:text-gray-300 transition">{t.restorePurchases}</button>
              <span className="w-px h-3 bg-white/10"></span>
              <button className="hover:text-gray-300 transition">{t.termsOfUse}</button>
              <span className="w-px h-3 bg-white/10"></span>
              <button className="hover:text-gray-300 transition">{t.privacyPolicy}</button>
            </div>
        </div>
      </div>
    </div>
  );
};
