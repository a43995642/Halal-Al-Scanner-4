
// ... (imports remain the same)
import React, { useState, useEffect, useRef } from 'react';
import { StatusBadge } from './components/StatusBadge';
import { SubscriptionModal } from './components/SubscriptionModal';
import { OnboardingModal } from './components/OnboardingModal';
import { PrivacyModal } from './components/PrivacyModal'; 
import { TermsModal } from './components/TermsModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { CorrectionModal } from './components/CorrectionModal'; 
import { analyzeImage, analyzeText } from './services/geminiService';
import { fetchProductByBarcode } from './services/openFoodFacts';
import { ScanResult, ScanHistoryItem, HalalStatus } from './types';
import { secureStorage } from './utils/secureStorage';
import { supabase } from './lib/supabase';
import { useLanguage } from './contexts/LanguageContext';
import { useCamera } from './hooks/useCamera'; 
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { App as CapacitorApp } from '@capacitor/app'; 
import { Capacitor } from '@capacitor/core';
import { PurchaseService } from './services/purchaseService'; // Import RevenueCat Service

// Constants
const FREE_SCANS_LIMIT = 20; 
const MAX_IMAGES_PER_SCAN = 4; 
const WEB_CLIENT_ID = "565514314234-9ae9k1bf0hhubkacivkuvpu01duqfthv.apps.googleusercontent.com";

// Utility for Haptic Feedback
const vibrate = (pattern: number | number[] = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// Utility to compress images
const compressImage = (base64Str: string, maxWidth = 800, quality = 0.6): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

// Helper for ingredients style
const getIngredientStyle = (status: HalalStatus, isOverlay: boolean = false) => {
  if (isOverlay) {
    switch(status) {
      case HalalStatus.HARAM: 
        return "bg-red-700/95 border-red-600 text-white font-bold ring-2 ring-red-500/50 shadow-red-900/50";
      case HalalStatus.DOUBTFUL: 
        return "bg-amber-500/90 border-amber-400 text-white font-bold ring-2 ring-amber-500/50";
      default: 
        return "bg-white/20 border-white/20 text-white backdrop-blur-md";
    }
  } else {
    switch(status) {
      case HalalStatus.HARAM: 
        return "bg-red-700 text-white border-red-900 font-bold shadow-sm dark:border-red-600";
      case HalalStatus.DOUBTFUL: 
        return "bg-amber-50 text-amber-700 border-amber-200 font-bold dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700";
      default: 
        return "bg-white text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700";
    }
  }
};

// --- Modals (Barcode, History, Text, Preview) ---

const ImagePreviewModal = ({ images, onDelete, onClose }: { images: string[], onDelete: (index: number) => void, onClose: () => void }) => {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const width = e.currentTarget.offsetWidth;
    const index = Math.round(Math.abs(scrollLeft) / width);
    setCurrentIndex(index);
  };
  
  useEffect(() => {
    if (currentIndex >= images.length && images.length > 0) {
      setCurrentIndex(images.length - 1);
    }
  }, [images.length]);

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col animate-fade-in">
       <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
          <div className="pointer-events-auto bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
             <span className="text-white font-bold text-sm font-mono">{currentIndex + 1} / {images.length}</span>
          </div>
          <button onClick={onClose} className="pointer-events-auto p-2 bg-black/30 rounded-full hover:bg-black/50 transition text-white backdrop-blur-md border border-white/10">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
       </div>
       
       <div 
         className="flex-grow flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
         onScroll={handleScroll}
         dir="ltr" 
       >
          {images.map((img, idx) => (
             <div key={idx} className="w-full h-full flex-shrink-0 snap-center relative flex items-center justify-center bg-black">
                <img src={img} alt={`Captured ${idx}`} className="max-w-full max-h-full object-contain p-2" />
             </div>
          ))}
       </div>

       <div className="absolute bottom-0 left-0 right-0 z-20 p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col gap-5 items-center">
          <button 
             onClick={() => onDelete(currentIndex)} 
             className="bg-red-500/10 text-red-500 border border-red-500/30 p-3 rounded-full hover:bg-red-500 hover:text-white transition active:scale-95 backdrop-blur-md flex items-center gap-2 px-6"
           >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
           </button>

          <button onClick={onClose} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-emerald-700 transition shadow-lg shadow-emerald-900/30 active:scale-[0.98]">
             {t.confirm} ({images.length})
          </button>
       </div>
    </div>
  );
};

const BarcodeModal = ({ onClose, onSearch }: { onClose: () => void, onSearch: (barcode: string) => void }) => {
  const [barcode, setBarcode] = useState('');
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm shadow-2xl border border-white/10 animate-slide-up flex flex-col overflow-hidden">
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
           <h3 className="font-bold text-white flex items-center gap-3">
             <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>
             </div>
             {t.barcodeTitle}
           </h3>
           <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
        
        <div className="p-6">
           <div className="relative">
              <input 
                type="tel" 
                pattern="[0-9]*" 
                className="w-full bg-black/50 border border-white/10 rounded-2xl p-5 text-center text-2xl tracking-[0.2em] font-mono text-white placeholder-white/20 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition outline-none" 
                placeholder={t.barcodePlaceholder} 
                value={barcode} 
                onChange={(e) => setBarcode(e.target.value.replace(/[^0-9]/g, ''))} 
                autoFocus 
              />
              <div className="absolute inset-x-0 bottom-2 flex justify-center pointer-events-none">
                 <span className="text-[10px] text-gray-500 uppercase tracking-widest opacity-50">EAN-13 / UPC</span>
              </div>
           </div>
        </div>

        <div className="p-5 border-t border-white/5 bg-white/5">
           <button onClick={() => onSearch(barcode)} disabled={barcode.length < 3} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold transition shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
              {t.searchBtn}
           </button>
        </div>
      </div>
    </div>
  );
};

const HistoryModal = ({ history, onClose, onLoadItem }: { history: ScanHistoryItem[], onClose: () => void, onLoadItem: (item: ScanHistoryItem) => void }) => {
  const { t, language } = useLanguage();
  return (
    <div className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-t-3xl sm:rounded-3xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl border border-white/10 animate-slide-up">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 rounded-t-3xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            {t.historyTitle}
          </h2>
          <button onClick={onClose} className="w-8 h-8 bg-white/5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="overflow-y-auto flex-grow p-4 space-y-3 custom-scrollbar">
          {history.length === 0 ? (
             <div className="text-center text-gray-500 py-20 flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 opacity-20 mb-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                <p>{t.noHistory}</p>
             </div>
          ) : history.map((item) => (
              <div key={item.id} onClick={() => onLoadItem(item)} className="bg-black/20 p-3 rounded-2xl shadow-sm border border-white/5 active:scale-[0.98] transition cursor-pointer flex justify-between items-center gap-4 hover:bg-white/5 hover:border-emerald-500/30 group">
                <div className="flex items-center gap-4 flex-grow overflow-hidden">
                   {item.thumbnail ? (
                     <img src={item.thumbnail} alt="Product" className="w-16 h-16 rounded-xl object-cover bg-white/5 border border-white/10 shrink-0" />
                   ) : (
                     <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-gray-500">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
                     </div>
                   )}
                   <div className="min-w-0 flex-grow">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${item.result.status === HalalStatus.HALAL ? 'bg-emerald-500/20 text-emerald-400' : item.result.status === HalalStatus.HARAM ? 'bg-red-500/20 text-red-400' : item.result.status === HalalStatus.DOUBTFUL ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>
                            {item.result.status === HalalStatus.HALAL ? t.statusHalal : item.result.status === HalalStatus.HARAM ? t.statusHaram : item.result.status === HalalStatus.DOUBTFUL ? t.statusDoubtful : t.statusNonFood}
                          </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed group-hover:text-gray-300 transition-colors">{item.result.reason}</p>
                   </div>
                </div>
                <div className="text-gray-600 group-hover:text-emerald-500 transition-colors">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 ${language === 'ar' ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const TextInputModal = ({ onClose, onAnalyze }: { onClose: () => void, onAnalyze: (text: string) => void }) => {
  const [text, setText] = useState('');
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-md shadow-2xl border border-white/10 animate-slide-up flex flex-col overflow-hidden">
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
           <h3 className="font-bold text-white flex items-center gap-3">
             <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
             </div>
             {t.manualInputTitle}
           </h3>
           <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>
        
        <div className="p-6">
           <textarea 
             className="w-full h-40 bg-black/50 border border-white/10 rounded-2xl p-4 text-base focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none resize-none text-white placeholder-white/30 leading-relaxed custom-scrollbar" 
             placeholder={t.manualInputPlaceholder} 
             value={text} 
             onChange={(e) => setText(e.target.value)} 
             autoFocus 
           />
           <div className="mt-3 flex gap-2 items-start opacity-70">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <p className="text-xs text-gray-400 leading-tight">{t.manualInputHint}</p>
           </div>
        </div>

        <div className="p-5 border-t border-white/5 bg-white/5">
           <button onClick={() => onAnalyze(text)} disabled={!text.trim()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold transition shadow-lg shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 00-1.423 1.423z" /></svg>
              {t.analyzeTextBtn}
           </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [images, setImages] = useState<string[]>([]);
  const [showTextModal, setShowTextModal] = useState(false); 
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [analyzedTextContent, setAnalyzedTextContent] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const useLowQuality = false; 
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);

  const [isFocusMode, setIsFocusMode] = useState(false);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);

  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  
  const { language, setLanguage, t } = useLanguage();
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const { 
    videoRef, 
    isCapturing, 
    captureImage, 
    toggleTorch, 
    isTorchOn, 
    hasTorch 
  } = useCamera();

  const stateRef = useRef({
    showOnboarding, showPrivacy, showTerms, showSettings,
    showHistory, showSubscriptionModal, showAuthModal,
    showCorrectionModal, showTextModal, showBarcodeModal,
    showPreviewModal, result, images, isLoading
  });

  Object.assign(stateRef.current, {
    showOnboarding, showPrivacy, showTerms, showSettings,
    showHistory, showSubscriptionModal, showAuthModal,
    showCorrectionModal, showTextModal, showBarcodeModal,
    showPreviewModal, result, images, isLoading
  });

  useEffect(() => {
    document.documentElement.classList.add('dark');
    
    // Initialize RevenueCat on App Start
    PurchaseService.initialize();
  }, []);

  useEffect(() => {
    let backButtonListener: any;

    const setupBackButton = async () => {
      backButtonListener = await CapacitorApp.addListener('backButton', () => {
        const s = stateRef.current;
        
        if (s.showOnboarding) {
           CapacitorApp.exitApp();
           return;
        }

        if (s.showSubscriptionModal) { setShowSubscriptionModal(false); return; }
        if (s.showSettings) { setShowSettings(false); return; }
        if (s.showHistory) { setShowHistory(false); return; }
        if (s.showAuthModal) { setShowAuthModal(false); return; }
        if (s.showPrivacy) { setShowPrivacy(false); return; }
        if (s.showTerms) { setShowTerms(false); return; }
        if (s.showCorrectionModal) { setShowCorrectionModal(false); return; }
        if (s.showBarcodeModal) { setShowBarcodeModal(false); return; }
        if (s.showTextModal) { setShowTextModal(false); return; }
        if (s.showPreviewModal) { setShowPreviewModal(false); return; }

        if (s.result && !s.isLoading) {
          setResult(null);
          setAnalyzedTextContent(null);
          setError(null);
          setIsLoading(false);
          setImages([]);
          return;
        }

        if (s.images.length > 0 && !s.isLoading) {
           setImages([]);
           return;
        }

        CapacitorApp.exitApp();
      });
    };

    setupBackButton();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isLoading && images.length > 1) {
       interval = setInterval(() => {
          setCurrentPreviewIndex((prev) => (prev + 1) % images.length);
       }, 1500); 
    } else {
       setCurrentPreviewIndex(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isLoading, images.length]);

  useEffect(() => {
    try {
        GoogleAuth.initialize({
          clientId: WEB_CLIENT_ID,
          scopes: ['profile', 'email'],
          grantOfflineAccess: false,
        });
    } catch (e) {
        console.error("Google Auth Init Failed", e);
    }

    const accepted = localStorage.getItem('halalScannerTermsAccepted');
    if (accepted !== 'true') setShowOnboarding(true);

    const savedHistory = localStorage.getItem('halalScannerHistory');
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory);
      } catch (e) {}
    }

    const initSupabase = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        let uid = session?.user?.id;
        
        if (!uid) {
           const { data: anonData } = await (supabase.auth as any).signInAnonymously();
           uid = anonData?.user?.id;
        }

        if (uid) {
          setUserId(uid);
          await fetchUserStats(uid);
          // Sync with RevenueCat
          PurchaseService.logIn(uid);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
             const newUid = session?.user?.id;
             if (newUid) {
                 setUserId(newUid);
                 await fetchUserStats(newUid);
                 PurchaseService.logIn(newUid);
             } else {
                 setUserId(null);
                 PurchaseService.logOut();
             }
        });

        CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
            console.log('App deep link opened:', url);
            
            if (url.startsWith('io.halalscanner.ai://') || url.includes('login-callback')) {
                 const hashIndex = url.indexOf('#');
                 const queryIndex = url.indexOf('?');
                 
                 let paramsString = '';
                 
                 if (hashIndex !== -1) {
                     paramsString = url.substring(hashIndex + 1);
                 } else if (queryIndex !== -1) {
                     paramsString = url.substring(queryIndex + 1);
                 }
                 
                 if (paramsString) {
                     const params = new URLSearchParams(paramsString);
                     const accessToken = params.get('access_token');
                     const refreshToken = params.get('refresh_token');
                     
                     if (accessToken && refreshToken) {
                         const { data, error } = await supabase.auth.setSession({
                             access_token: accessToken,
                             refresh_token: refreshToken
                         });
                         
                         if (!error && data.session) {
                             setUserId(data.session.user.id);
                             await fetchUserStats(data.session.user.id);
                             setShowAuthModal(false);
                             showToast(t.loginSuccess);
                         } else {
                             console.error("Session set error:", error);
                         }
                     }
                 }
            }
        });

        return () => subscription.unsubscribe();

      } catch (err) {}
    };

    const cachedPremium = secureStorage.getItem<boolean>('isPremium', false);
    setIsPremium(cachedPremium);
    
    // Check RevenueCat status periodically
    PurchaseService.checkSubscriptionStatus().then(isPro => {
        setIsPremium(isPro);
    });

    initSupabase();

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const fetchUserStats = async (uid: string) => {
      const { data } = await supabase.from('user_stats').select('scan_count, is_premium').eq('id', uid).single();
      if (data) {
        setScanCount(data.scan_count);
        // We trust RevenueCat more than DB for premium status if on mobile
        if (!Capacitor.isNativePlatform()) {
            setIsPremium(data.is_premium);
            secureStorage.setItem('isPremium', data.is_premium);
        }
      }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const saveToHistory = (scanResult: ScanResult, thumbnail?: string) => {
     const newItem: ScanHistoryItem = { id: Date.now().toString(), date: Date.now(), result: scanResult, thumbnail };
     const updatedHistory = [newItem, ...history].slice(0, 30);
     setHistory(updatedHistory);
     localStorage.setItem('halalScannerHistory', JSON.stringify(updatedHistory));
  };

  // --- ACTIONS ---

  const handleCaptureClick = () => {
    if (result) {
        resetApp();
        return;
    }

    if (isCapturing) return;
    if (isLoading) return;
    
    // Check Limits
    if (!isPremium && scanCount >= FREE_SCANS_LIMIT) {
        setShowSubscriptionModal(true);
        return;
    }
    if (images.length >= MAX_IMAGES_PER_SCAN) {
        showToast(t.maxImages);
        return;
    }

    captureImage((src) => {
        const newImages = [...images, src];
        setImages(newImages);
        vibrate(50);
        showToast(t.imgAdded);
    }, false);
  };

  const handleAnalyze = async () => {
    if (images.length === 0 || isLoading) return;
    setIsLoading(true);
    setError(null);
    setAnalyzedTextContent(null);
    setProgress(5);
    setCurrentPreviewIndex(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      const quality = useLowQuality ? 0.6 : 0.8;
      const width = useLowQuality ? 800 : 1024;
      const compressedImages = await Promise.all(images.map(img => compressImage(img, width, quality)));
      
      setProgress(40);
      progressInterval.current = setInterval(() => {
        setProgress(prev => (prev >= 90 ? 90 : prev + 2));
      }, 200);

      const scanResult = await analyzeImage(compressedImages, userId || undefined, true, true, language, controller.signal);
      
      clearInterval(progressInterval.current as any);
      setProgress(100);
      
      if (scanResult.confidence === 0) {
         setError(scanResult.reason);
      } else {
         vibrate([50, 100]); 
         setResult(scanResult);
         if (userId) await fetchUserStats(userId);
         
         compressImage(compressedImages[0], 200, 0.6).then(thumb => saveToHistory(scanResult, thumb)).catch(() => saveToHistory(scanResult));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(t.unexpectedError);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const resetApp = () => {
    setImages([]);
    setResult(null);
    setAnalyzedTextContent(null);
    setError(null);
    setIsLoading(false);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    vibrate(20);
    if (images.length <= 1) setShowPreviewModal(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading) return;

    if (e.target.files && e.target.files.length > 0) {
      let files = Array.from(e.target.files) as File[];
      
      const remainingSlots = MAX_IMAGES_PER_SCAN - images.length;
      
      if (remainingSlots <= 0) {
         showToast(t.maxImages);
         e.target.value = '';
         return;
      }

      if (files.length > remainingSlots) {
         showToast(t.maxImages);
         files = files.slice(0, remainingSlots);
      }

      const newImages: string[] = [];
      for (const file of files) {
         const reader = new FileReader();
         const promise = new Promise<string>((resolve) => { reader.onloadend = () => resolve(reader.result as string); });
         reader.readAsDataURL(file);
         newImages.push(await promise);
      }
      setImages(prev => [...prev, ...newImages]);
      vibrate(50);
      e.target.value = '';
    }
  };

  const handleBarcodeSearch = async (barcode: string) => {
    setShowBarcodeModal(false);
    setIsLoading(true);
    setResult(null);
    setImages([]);
    setAnalyzedTextContent(t.searching);
    try {
      const product = await fetchProductByBarcode(barcode);
      if (!product) throw new Error("PRODUCT_NOT_FOUND");
      const ingredients = language === 'ar' ? (product.ingredients_text_ar || product.ingredients_text) : (product.ingredients_text_en || product.ingredients_text);
      if (!ingredients) {
         setResult({ status: HalalStatus.DOUBTFUL, reason: "Product found but ingredients list is missing.", ingredientsDetected: [], confidence: 100 });
         setIsLoading(false);
         return;
      }
      const finalText = `${t.barcodeTitle}: ${product.product_name || ''}\n\n${ingredients}`;
      handleAnalyzeText(finalText);
    } catch (err) {
       setError(t.barcodeNotFound);
       setIsLoading(false);
    }
  };

  const handleAnalyzeText = async (text: string) => {
    setShowTextModal(false);
    setIsLoading(true);
    setResult(null);
    setImages([]);
    setAnalyzedTextContent(text);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const scanResult = await analyzeText(text, userId || undefined, language, controller.signal);
      setResult(scanResult);
      saveToHistory(scanResult);
    } catch (err) {
       setError(t.unexpectedError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    // This will be handled inside SubscriptionModal via PurchaseService
    // But we need to update state if successful
    const isPro = await PurchaseService.checkSubscriptionStatus();
    setIsPremium(isPro);
  };

  // --- RENDER ---
  return (
    <div className="fixed inset-0 bg-black text-white font-sans flex flex-col overflow-hidden">
      {/* Modals */}
      {showOnboarding && <OnboardingModal onFinish={() => setShowOnboarding(false)} />}
      {showHistory && <HistoryModal history={history} onClose={() => setShowHistory(false)} onLoadItem={(item) => { setResult(item.result); setImages(item.thumbnail ? [item.thumbnail] : []); setShowHistory(false); }} />}
      {showTextModal && <TextInputModal onClose={() => setShowTextModal(false)} onAnalyze={handleAnalyzeText} />}
      {showBarcodeModal && <BarcodeModal onClose={() => setShowBarcodeModal(false)} onSearch={handleBarcodeSearch} />}
      {showPreviewModal && <ImagePreviewModal images={images} onDelete={removeImage} onClose={() => setShowPreviewModal(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={() => { setShowAuthModal(false); fetchUserStats(userId || ''); }} />}
      
      {showCorrectionModal && result && (
         <CorrectionModal 
            onClose={() => setShowCorrectionModal(false)} 
            result={result} 
            analyzedText={analyzedTextContent}
            userId={userId}
         />
      )}
      
      {showSettings && <SettingsModal 
          onClose={() => setShowSettings(false)} 
          onClearHistory={() => setHistory([])} 
          isPremium={isPremium} 
          onManageSubscription={() => { setShowSettings(false); setShowSubscriptionModal(true); }}
          onOpenAuth={() => { setShowAuthModal(true); }}
          onOpenPrivacy={() => { setShowSettings(false); setShowPrivacy(true); }}
          onOpenTerms={() => { setShowSettings(false); setShowTerms(true); }}
      />}
      {showSubscriptionModal && <SubscriptionModal onSubscribe={handleSubscribe} onClose={() => setShowSubscriptionModal(false)} isLimitReached={false} />}
      {toastMessage && <div className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-gray-900/90 text-white px-6 py-3 rounded-full shadow-xl z-[80] animate-fade-in text-sm font-medium backdrop-blur-sm border border-white/10">{toastMessage}</div>}

      {/* --- LAYER 1: VIDEO BACKGROUND --- */}
      <div 
        className="absolute inset-0 bg-black z-0" 
        onClick={() => !result && !isLoading && setIsFocusMode(prev => !prev)}
      >
         <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover transition-opacity duration-500 ${result || isLoading ? 'opacity-0' : 'opacity-100'}`} 
         />
         
         {/* Viewfinder Corners Overlay */}
         {!result && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-80">
               <div className="relative w-64 h-64 sm:w-80 sm:h-80 transition-all duration-300">
                   <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-emerald-500 rounded-tl-3xl shadow-sm"></div>
                   <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-emerald-500 rounded-tr-3xl shadow-sm"></div>
                   <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-emerald-500 rounded-bl-3xl shadow-sm"></div>
                   <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-emerald-500 rounded-br-3xl shadow-sm"></div>
               </div>
            </div>
         )}

         {(result || isLoading) && images.length > 0 && (
            <img 
              src={images[currentPreviewIndex]} 
              alt="Captured" 
              className="absolute inset-0 w-full h-full object-cover z-0 bg-black"
            />
         )}
         <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none z-10"></div>
      </div>

      {/* --- LAYER 2: FLOATING HEADER --- */}
      <div className={`absolute top-0 left-0 right-0 z-20 p-4 pt-[calc(env(safe-area-inset-top)+10px)] flex justify-between items-start transition-all duration-500 ease-in-out ${(isFocusMode && !result) || isLoading ? '-translate-y-32 opacity-0' : 'translate-y-0 opacity-100'}`}>
         <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:bg-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
         </button>

         {hasTorch && (
            <button onClick={toggleTorch} className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition active:bg-white/20 ${isTorchOn ? 'bg-yellow-400 text-yellow-900' : 'bg-black/30 text-white'}`}>
                {isTorchOn ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>}
            </button>
         )}

         <button onClick={() => setShowHistory(true)} className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:bg-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
         </button>
      </div>

      {/* --- LAYER 3: MIDDLE CONTENT --- */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none p-6 pb-48">
         {isLoading && (
            <div className="w-64 bg-black/80 backdrop-blur-xl rounded-2xl p-6 text-center border border-white/10 pointer-events-auto shadow-2xl">
               <div className="w-full bg-gray-700 rounded-full h-2 mb-4 overflow-hidden"><div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${progress}%` }}></div></div>
               <p className="text-emerald-400 font-bold animate-pulse text-sm mb-3">{t.analyzingDeep}</p>
               <button 
                 onClick={() => {
                     if (abortControllerRef.current) abortControllerRef.current.abort();
                     setIsLoading(false);
                     setImages([]); 
                 }}
                 className="text-xs text-gray-400 hover:text-white underline decoration-gray-500 underline-offset-4"
               >
                 {t.cancel}
               </button>
            </div>
         )}

         {!isLoading && result && (
            <div className="w-full max-w-sm pointer-events-auto animate-fade-in flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <StatusBadge status={result.status} />
                <div className="bg-[#1e1e1e]/90 backdrop-blur-md p-4 rounded-xl border border-white/10 shadow-xl">
                    <h3 className="text-white font-bold mb-2 flex items-center gap-2 text-lg">
                        {t.resultTitle} 
                        {result.confidence && <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">{result.confidence}%</span>}
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed">{result.reason}</p>
                </div>
                
                <div className="flex justify-center">
                   <button 
                      onClick={() => setShowCorrectionModal(true)}
                      className="text-gray-400 text-xs flex items-center gap-1.5 hover:text-white transition bg-black/40 px-3 py-1.5 rounded-full border border-white/5"
                   >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
                      </svg>
                      {t.reportError}
                   </button>
                </div>

                {result.ingredientsDetected.length > 0 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                        {result.ingredientsDetected.map((ing, idx) => (
                            <span key={idx} className={`text-xs px-2 py-1 rounded border ${getIngredientStyle(ing.status, true)}`}>{ing.name}</span>
                        ))}
                    </div>
                )}
            </div>
         )}

         {!isLoading && error && (
            <div className="w-full max-w-sm bg-red-900/90 backdrop-blur-md p-4 rounded-xl border border-red-500/50 text-white text-center pointer-events-auto">
               <p className="font-bold mb-1">{t.analysisFailed}</p>
               <p className="text-sm opacity-80">{error}</p>
               <button onClick={resetApp} className="mt-3 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm transition">{t.retry}</button>
            </div>
         )}
      </div>

      {/* --- LAYER 4: BOTTOM BAR --- */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 pt-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] transition-all duration-500 ease-in-out rounded-t-[2rem] border-t ${(isFocusMode && !result) || isLoading ? 'bg-transparent border-transparent shadow-none pointer-events-none' : 'bg-[#121212] shadow-[0_-5px_30px_rgba(0,0,0,0.8)] border-white/5'}`}>
         
         <div className="flex flex-col gap-6 px-6 max-w-md mx-auto">
            
            <div className="flex justify-between items-center relative pointer-events-auto">
               
               {/* LEFT: Gallery OR Preview */}
               <div className="flex flex-col items-center gap-1 w-20">
                  {!isLoading && (
                    <>
                      {images.length > 0 && !result ? (
                         <button 
                           onClick={() => setShowPreviewModal(true)} 
                           className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 border-white/50 transition shadow-lg active:scale-95`}
                         >
                            <img src={images[images.length - 1]} alt="Last Captured" className="w-full h-full object-cover" />
                            <span className="absolute inset-0 bg-black/10"></span>
                            <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-1 rounded-bl-md">
                               {images.length}
                            </div>
                         </button>
                      ) : (
                         <label className={`w-12 h-12 rounded-full flex items-center justify-center transition border border-white/10 cursor-pointer active:scale-90 ${isFocusMode && !result ? 'bg-black/40 backdrop-blur-md hover:bg-black/60' : 'bg-[#2c2c2c] hover:bg-[#3d3d3d]'}`}>
                            <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" disabled={!isPremium && scanCount >= FREE_SCANS_LIMIT} />
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                         </label>
                      )}
                      <span className={`text-[10px] font-medium transition-opacity duration-300 ${isFocusMode && !result ? 'opacity-0' : 'text-gray-400'}`}>{images.length > 0 && !result ? t.selectedImages : t.btnGallery}</span>
                    </>
                  )}
               </div>

               {/* CENTER: SHUTTER BUTTON */}
               <div className="relative -top-3">
                  {isLoading ? (
                      <div className="w-20 h-20 rounded-full border-[5px] border-white/10 bg-black/40 flex items-center justify-center backdrop-blur-md shadow-lg">
                           <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                  ) : result ? (
                     <button onClick={resetApp} className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-black"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                     </button>
                  ) : (
                     <button onClick={handleCaptureClick} className="w-20 h-20 rounded-full border-[5px] border-white/80 bg-white/10 flex items-center justify-center backdrop-blur-sm active:scale-95 transition hover:bg-white/20">
                        <div className="w-16 h-16 bg-white rounded-full pointer-events-none"></div>
                     </button>
                  )}
               </div>

               {/* RIGHT: Dynamic (Analyze OR Barcode) */}
               <div className="flex flex-col items-center gap-1 w-20">
                  {!isLoading && (
                    <>
                      {images.length > 0 && !result ? (
                         <>
                            <button 
                               onClick={handleAnalyze} 
                               className={`w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center active:scale-90 transition shadow-lg shadow-emerald-500/30 animate-fade-in`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                            </button>
                            <span className={`text-[10px] font-bold transition-opacity duration-300 ${isFocusMode && !result ? 'opacity-0' : 'text-emerald-400'}`}>{t.scanImagesBtn}</span>
                         </>
                      ) : (
                         <>
                            <button onClick={() => setShowBarcodeModal(true)} className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition border border-white/10 ${isFocusMode && !result ? 'bg-black/40 backdrop-blur-md hover:bg-black/60' : 'bg-[#2c2c2c] hover:bg-[#3d3d3d]'}`}>
                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>
                            </button>
                            <span className={`text-[10px] font-medium transition-opacity duration-300 ${isFocusMode && !result ? 'opacity-0' : 'text-gray-400'}`}>{t.btnBarcode}</span>
                         </>
                      )}
                    </>
                  )}
               </div>
            </div>

            <div className={`flex justify-between items-center bg-[#202020] rounded-2xl p-2 px-4 border border-white/5 transition-all duration-500 ease-in-out ${(isFocusMode && !result) || isLoading ? 'translate-y-20 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100 pointer-events-auto'}`}>
                <div className="flex bg-[#303030] rounded-xl p-1">
                    <button onClick={() => setLanguage('ar')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${language === 'ar' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}>العربية</button>
                    <button onClick={() => setLanguage('en')} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${language === 'en' ? 'bg-white text-black shadow-sm' : 'text-gray-400 hover:text-white'}`}>English</button>
                </div>

                <button onClick={() => setShowTextModal(true)} className="flex items-center gap-2 text-gray-300 hover:text-white transition px-2 py-2">
                    <span className="text-sm font-bold">{t.btnManual}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                </button>
            </div>

         </div>
      </div>
    </div>
  );
}

export default App;
