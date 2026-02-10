import React, { useState, useEffect, useRef } from 'react';
import { StatusBadge } from './components/StatusBadge';
import { SubscriptionModal } from './components/SubscriptionModal';
import { OnboardingModal } from './components/OnboardingModal';
import { PrivacyModal } from './components/PrivacyModal'; 
import { TermsModal } from './components/TermsModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { CorrectionModal } from './components/CorrectionModal'; 
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { BarcodeModal } from './components/BarcodeModal';
import { HistoryModal } from './components/HistoryModal';
import { TextInputModal } from './components/TextInputModal';

import { analyzeImage, analyzeText } from './services/geminiService';
import { fetchProductByBarcode } from './services/openFoodFacts';
import { ScanResult, ScanHistoryItem, HalalStatus } from './types';
import { secureStorage } from './utils/secureStorage';
import { createAIOptimizedImage, optimizeImageForDisplay } from './utils/imageUtils';
import { getIngredientStyle } from './utils/styleUtils';
import { vibrate } from './utils/haptics';
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
  
  const [showAuthSuccess, setShowAuthSuccess] = useState(false);

  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  
  // New Loading State for Auth Initialization
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const { language, t } = useLanguage();
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
    PurchaseService.initialize();
  }, []);
  
  useEffect(() => {
    let backButtonListener: any;
    const setupBackButton = async () => {
      backButtonListener = await CapacitorApp.addListener('backButton', () => {
        const s = stateRef.current;
        if (s.showOnboarding) { CapacitorApp.exitApp(); return; }
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
          setResult(null); setAnalyzedTextContent(null); setError(null); setIsLoading(false); setImages([]); return;
        }
        if (s.images.length > 0 && !s.isLoading) { setImages([]); return; }
        CapacitorApp.exitApp();
      });
    };
    setupBackButton();
    return () => { if (backButtonListener) backButtonListener.remove(); };
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isLoading && images.length > 1) {
       interval = setInterval(() => { setCurrentPreviewIndex((prev) => (prev + 1) % images.length); }, 1500); 
    } else { setCurrentPreviewIndex(0); }
    return () => { if (interval) clearInterval(interval); };
  }, [isLoading, images.length]);

  // Helper functions used in auth logic
  const fetchUserStats = async (uid: string) => { 
    const { data } = await supabase.from('user_stats').select('scan_count, is_premium').eq('id', uid).single(); 
    if (data) { 
        setScanCount(data.scan_count); 
        if (!Capacitor.isNativePlatform()) { 
            setIsPremium(data.is_premium); 
            secureStorage.setItem('isPremium', data.is_premium); 
        } 
    } 
  };

  useEffect(() => {
    // 1. Init Google Auth
    try { GoogleAuth.initialize({ clientId: WEB_CLIENT_ID, scopes: ['profile', 'email'], grantOfflineAccess: false }); } catch (e) {}
    
    // 2. Load Local Data
    const accepted = localStorage.getItem('halalScannerTermsAccepted');
    if (accepted !== 'true') setShowOnboarding(true);
    const savedHistory = localStorage.getItem('halalScannerHistory');
    if (savedHistory) { try { setHistory(JSON.parse(savedHistory)); } catch (e) {} }
    
    // 3. Auth Logic with Loading State & Timeout Protection
    let mounted = true;
    const initAuth = async () => {
        try {
            // Safety: If auth takes longer than 5s, proceed as guest to prevent white screen
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Auth Timeout")), 5000));
            const authPromise = supabase.auth.getSession();
            
            // Race the auth check against the timeout
            const { data } = await Promise.race([authPromise, timeout]) as any;

            if (mounted && data?.session?.user) {
                setUserId(data.session.user.id);
                // Background fetch stats, don't block
                fetchUserStats(data.session.user.id).catch(console.error);
            }
        } catch (e) {
            console.warn("Auth initialization skipped (timeout or error):", e);
        } finally {
            if (mounted) setIsAuthLoading(false); // CRITICAL: Stop loading even if auth fails
        }
    };
    initAuth();

    // 4. Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        if (!mounted) return;
        if (session?.user) {
            setUserId(session.user.id);
            fetchUserStats(session.user.id).catch(console.error);
        } else {
            setUserId(null);
            setScanCount(0);
            setIsPremium(false);
        }
        setIsAuthLoading(false); // Ensure loading stops on change too
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);
  
  // Helper functions
  const showToast = (msg: string) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 3000); };
  const saveToHistory = (scanResult: ScanResult, thumbnail?: string) => { const newItem: ScanHistoryItem = { id: Date.now().toString(), date: Date.now(), result: scanResult, thumbnail }; const updatedHistory = [newItem, ...history].slice(0, 30); setHistory(updatedHistory); localStorage.setItem('halalScannerHistory', JSON.stringify(updatedHistory)); };
  
  const handleCaptureClick = () => {
    if (result) { resetApp(); return; }
    if (isCapturing) return;
    if (isLoading) return;
    if (!isPremium && scanCount >= FREE_SCANS_LIMIT) { setShowSubscriptionModal(true); return; }
    if (images.length >= MAX_IMAGES_PER_SCAN) { showToast(t.maxImages); return; }
    captureImage((src) => { const newImages = [...images, src]; setImages(newImages); vibrate(50); showToast(t.imgAdded); }, false);
  };

  const handleAnalyze = async () => {
    if (images.length === 0 || isLoading) return;
    
    // Quick Internet Check
    if (!navigator.onLine) {
        showToast(language === 'ar' ? "لا يوجد اتصال بالإنترنت" : "No Internet Connection");
        return;
    }

    setIsLoading(true); setError(null); setAnalyzedTextContent(null); setProgress(5); setCurrentPreviewIndex(0);
    const controller = new AbortController(); abortControllerRef.current = controller;
    try {
      // 1. AI PRE-PROCESSING PIPELINE
      // Create separate high-contrast versions for the OCR
      const width = useLowQuality ? 1024 : 2000;
      const quality = useLowQuality ? 0.7 : 0.85;
      
      const aiReadyImages = await Promise.all(images.map(img => createAIOptimizedImage(img, width, quality)));
      
      setProgress(40); progressInterval.current = setInterval(() => { setProgress(prev => (prev >= 90 ? 90 : prev + 2)); }, 200);
      
      // Analyze the AI-optimized images
      const scanResult = await analyzeImage(aiReadyImages, userId || undefined, true, true, language, controller.signal);
      
      clearInterval(progressInterval.current as any); setProgress(100);
      
      if (scanResult.confidence === 0) { 
          setError(scanResult.reason); 
      } else { 
          vibrate([50, 100]); 
          setResult(scanResult); 
          if (userId) await fetchUserStats(userId); 
          
          // Save small thumbnail for history (use the nice User version for thumb)
          optimizeImageForDisplay(images[0]).then(img => {
              // Create a tiny thumb
               const imgObj = new Image();
               imgObj.src = img;
               imgObj.onload = () => {
                   const c = document.createElement('canvas');
                   c.width = 300;
                   c.height = (imgObj.height * 300) / imgObj.width;
                   c.getContext('2d')?.drawImage(imgObj, 0, 0, 300, c.height);
                   saveToHistory(scanResult, c.toDataURL('image/jpeg', 0.6));
               };
          }).catch(() => saveToHistory(scanResult)); 
      }
    } catch (err: any) { if (err.name === 'AbortError') return; setError(t.unexpectedError); } finally { setIsLoading(false); abortControllerRef.current = null; }
  };

  const resetApp = () => { setImages([]); setResult(null); setAnalyzedTextContent(null); setError(null); setIsLoading(false); };
  const removeImage = (index: number) => { setImages(prev => prev.filter((_, i) => i !== index)); vibrate(20); if (images.length <= 1) setShowPreviewModal(false); };
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading) return;
    if (e.target.files && e.target.files.length > 0) {
      let files = Array.from(e.target.files) as File[];
      const remainingSlots = MAX_IMAGES_PER_SCAN - images.length;
      if (remainingSlots <= 0) { showToast(t.maxImages); e.target.value = ''; return; }
      if (files.length > remainingSlots) { showToast(t.maxImages); files = files.slice(0, remainingSlots); }
      const newImages: string[] = [];
      for (const file of files) { const reader = new FileReader(); const promise = new Promise<string>((resolve) => { reader.onloadend = () => resolve(reader.result as string); }); reader.readAsDataURL(file); newImages.push(await promise); }
      setImages(prev => [...prev, ...newImages]); vibrate(50); e.target.value = '';
    }
  };

  const handleBarcodeSearch = async (barcode: string) => {
    setShowBarcodeModal(false); setIsLoading(true); setResult(null); setImages([]); setAnalyzedTextContent(t.searching);
    try {
      const product = await fetchProductByBarcode(barcode);
      if (!product) throw new Error("PRODUCT_NOT_FOUND");
      const ingredients = language === 'ar' ? (product.ingredients_text_ar || product.ingredients_text) : (product.ingredients_text_en || product.ingredients_text);
      if (!ingredients) { setResult({ status: HalalStatus.DOUBTFUL, reason: "Product found but ingredients list is missing.", ingredientsDetected: [], confidence: 100 }); setIsLoading(false); return; }
      const finalText = `${t.barcodeTitle}: ${product.product_name || ''}\n\n${ingredients}`; handleAnalyzeText(finalText);
    } catch (err) { setError(t.barcodeNotFound); setIsLoading(false); }
  };

  const handleAnalyzeText = async (text: string) => {
    setShowTextModal(false); setIsLoading(true); setResult(null); setImages([]); setAnalyzedTextContent(text);
    const controller = new AbortController(); abortControllerRef.current = controller;
    try { const scanResult = await analyzeText(text, userId || undefined, language, controller.signal); setResult(scanResult); saveToHistory(scanResult); } catch (err) { setError(t.unexpectedError); } finally { setIsLoading(false); }
  };

  const handleSubscribe = async () => { const isPro = await PurchaseService.checkSubscriptionStatus(); setIsPremium(isPro); };

  // --- LOADING SCREEN ---
  // This replaces the HTML loader once React mounts, preventing the "dead" state.
  if (isAuthLoading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50 flex-col">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-white text-sm font-medium animate-pulse">{t.analyzingDeep || "Starting System..."}</p>
      </div>
    );
  }

  // --- RENDER ---
  return (
    <div className="fixed inset-0 bg-black text-white font-sans flex flex-col overflow-hidden">

      {/* Modals */}
      {showOnboarding && <OnboardingModal onFinish={() => { localStorage.setItem('halalScannerTermsAccepted', 'true'); setShowOnboarding(false); }} />}
      {showHistory && <HistoryModal history={history} onClose={() => setShowHistory(false)} onLoadItem={(item) => { setResult(item.result); setImages(item.thumbnail ? [item.thumbnail] : []); setShowHistory(false); }} />}
      {showTextModal && <TextInputModal onClose={() => setShowTextModal(false)} onAnalyze={handleAnalyzeText} />}
      {showBarcodeModal && <BarcodeModal onClose={() => setShowBarcodeModal(false)} onSearch={handleBarcodeSearch} />}
      {showPreviewModal && <ImagePreviewModal images={images} onDelete={removeImage} onClose={() => setShowPreviewModal(false)} />}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={() => { setShowAuthModal(false); setShowAuthSuccess(true); fetchUserStats(userId || ''); setTimeout(() => setShowAuthSuccess(false), 4000); }} />}
      
      {showCorrectionModal && result && (
         <CorrectionModal onClose={() => setShowCorrectionModal(false)} result={result} analyzedText={analyzedTextContent} userId={userId} />
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

      {/* Auth Success Modal */}
      {showAuthSuccess && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
            <div className="bg-[#1e1e1e] w-full max-w-sm p-8 rounded-3xl border border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.15)] text-center animate-slide-up relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500"></div>
                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-12 h-12"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">{t.authSuccessTitle}</h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-8">{t.authSuccessDesc}</p>
                <button onClick={() => setShowAuthSuccess(false)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-900/20 active:scale-[0.98]">{t.startScanning}</button>
            </div>
        </div>
      )}

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
         
         {/* Viewfinder Corners Overlay - CLEAN (No Laser) */}
         {!result && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-80 overflow-hidden">
               <div className="relative w-64 h-64 sm:w-80 sm:h-80 transition-all duration-300">
                   {/* Clean Corners */}
                   <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-emerald-500 rounded-tl-3xl shadow-sm"></div>
                   <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-emerald-500 rounded-tr-3xl shadow-sm"></div>
                   <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-emerald-500 rounded-bl-3xl shadow-sm"></div>
                   <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-emerald-500 rounded-br-3xl shadow-sm"></div>
                   
                   {/* Optional: Subtle center guide */}
                   <div className="absolute top-1/2 left-1/2 w-4 h-4 -ml-2 -mt-2 border border-white/30 rounded-full"></div>
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
         {/* Settings Button */}
         <button onClick={() => setShowSettings(true)} className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:bg-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
         </button>

         {/* Manual Input Button */}
         <button onClick={() => setShowTextModal(true)} className="w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white active:bg-white/20">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
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
               <button onClick={() => { if (abortControllerRef.current) abortControllerRef.current.abort(); setIsLoading(false); setImages([]); }} className="text-xs text-gray-400 hover:text-white underline decoration-gray-500 underline-offset-4">{t.cancel}</button>
            </div>
         )}
         {/* Results and Error UI... */}
         {!isLoading && result && (
            <div className="w-full max-w-sm pointer-events-auto animate-fade-in flex flex-col gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <StatusBadge status={result.status} />
                {/* BLACK BACKGROUND HERE */}
                <div className="bg-black backdrop-blur-md p-5 rounded-2xl border-2 border-white/30 shadow-2xl">
                    <h3 className="text-white font-bold mb-2 flex items-center gap-2 text-lg">{t.resultTitle} {result.confidence && <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">{result.confidence}%</span>}</h3>
                    <p className="text-white text-base leading-relaxed font-medium">{result.reason}</p>
                </div>
                <div className="flex justify-center">
                   <button onClick={() => setShowCorrectionModal(true)} className="text-gray-400 text-xs flex items-center gap-1.5 hover:text-white transition bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" /></svg>
                      {t.reportError}
                   </button>
                </div>
                {result.ingredientsDetected.length > 0 && <div className="flex flex-wrap gap-2 justify-center">{result.ingredientsDetected.map((ing, idx) => (<span key={idx} className={`text-xs rounded border ${getIngredientStyle(ing.status, true)}`}>{ing.name}</span>))}</div>}
            </div>
         )}
         {!isLoading && error && (
            <div className="w-full max-w-sm bg-red-900/90 backdrop-blur-md p-4 rounded-xl border border-red-500/50 text-white text-center pointer-events-auto">
               <p className="font-bold mb-1">{t.analysisFailed}</p> <p className="text-sm opacity-80">{error}</p> <button onClick={resetApp} className="mt-3 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm transition">{t.retry}</button>
            </div>
         )}
      </div>

      {/* --- LAYER 4: BOTTOM BAR --- */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 pb-[calc(env(safe-area-inset-bottom)+2rem)] transition-all duration-500 ease-in-out ${(isFocusMode && !result) || isLoading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
         <div className="flex flex-col gap-6 px-6 max-w-md mx-auto">
            <div className="flex justify-between items-center relative pointer-events-auto">
               {/* LEFT: Gallery OR Preview */}
               <div className="flex flex-col items-center gap-1 w-20">
                  {!isLoading && !result && (
                    <>
                      {images.length > 0 ? (
                         <button 
                           onClick={() => setShowPreviewModal(true)} 
                           className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 border-white/50 transition shadow-lg active:scale-95`}
                         >
                            <img src={images[images.length - 1]} alt="Last Captured" className="w-full h-full object-cover" />
                            {/* REMOVED: Dark overlay <span className="absolute inset-0 bg-black/10"></span> */}
                            <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-1 rounded-bl-md">
                               {images.length}
                            </div>
                         </button>
                      ) : (
                         <label className={`w-12 h-12 rounded-full flex items-center justify-center transition border border-white/10 cursor-pointer active:scale-90 ${isFocusMode ? 'bg-black/40 backdrop-blur-md hover:bg-black/60' : 'bg-[#2c2c2c] hover:bg-[#3d3d3d]'}`}>
                            <input type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" disabled={!isPremium && scanCount >= FREE_SCANS_LIMIT} />
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                         </label>
                      )}
                      <span className={`text-[10px] font-medium transition-opacity duration-300 ${isFocusMode ? 'opacity-0' : 'text-gray-400'}`}>{images.length > 0 ? t.selectedImages : t.btnGallery}</span>
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
                  {!isLoading && !result && (
                    <>
                      {images.length > 0 ? (
                         <>
                            <button onClick={handleAnalyze} className={`w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center active:scale-90 transition shadow-lg shadow-emerald-500/30 animate-fade-in`}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            </button>
                            <span className={`text-[10px] font-bold transition-opacity duration-300 ${isFocusMode ? 'opacity-0' : 'text-emerald-400'}`}>{t.scanImagesBtn}</span>
                         </>
                      ) : (
                         <>
                            <button onClick={() => setShowBarcodeModal(true)} className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-90 transition border border-white/10 ${isFocusMode ? 'bg-black/40 backdrop-blur-md hover:bg-black/60' : 'bg-[#2c2c2c] hover:bg-[#3d3d3d]'}`}>
                                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" /></svg>
                            </button>
                            <span className={`text-[10px] font-medium transition-opacity duration-300 ${isFocusMode ? 'opacity-0' : 'text-gray-400'}`}>{t.btnBarcode}</span>
                         </>
                      )}
                    </>
                  )}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

export default App;