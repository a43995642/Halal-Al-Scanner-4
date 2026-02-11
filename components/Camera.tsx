import React, { useRef, useState, useEffect } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useLanguage } from '../contexts/LanguageContext';

interface CameraProps {
  onCapture: (imageSrc: string, isMultiShot?: boolean) => void;
  onClose: () => void;
}

export const Camera: React.FC<CameraProps> = ({ onCapture, onClose }) => {
  const { t, language } = useLanguage();
  const { 
    videoRef, 
    error, 
    isCapturing, 
    captureImage,
    openNativeCamera,
    hasTorch,
    isTorchOn,
    toggleTorch,
    zoom,
    minZoom,
    maxZoom,
    supportsZoom,
    setZoomLevel
  } = useCamera();

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressHandled = useRef(false);
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  
  // Coach Marks State
  const [showCoachMarks, setShowCoachMarks] = useState(false);

  useEffect(() => {
    // Check if user has seen the coach marks before
    const hasSeen = localStorage.getItem('halalScanner_cameraCoachMarks');
    if (!hasSeen) {
      // Delay slightly to let camera initialize visually
      const timer = setTimeout(() => setShowCoachMarks(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissCoachMarks = () => {
    localStorage.setItem('halalScanner_cameraCoachMarks', 'true');
    setShowCoachMarks(false);
  };

  const LONG_PRESS_DURATION = 800;

  const handlePressStart = (_e: React.TouchEvent | React.MouseEvent) => {
    // Note: We allow capture even if coach marks are shown, to reduce friction.
    // But if they are shown, we dismiss them on first interaction.
    if (showCoachMarks) {
        dismissCoachMarks();
    }
    
    isLongPressHandled.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPressHandled.current = true;
      // Pass true for isMultiShot
      captureImage((src) => onCapture(src, true), false); 
      
      if (navigator.vibrate) navigator.vibrate([15, 30]);
      setShowAddedToast(true);
      setTimeout(() => setShowAddedToast(false), 2000);
    }, LONG_PRESS_DURATION);
  };

  const handlePressEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (e.type === 'touchend') e.preventDefault(); 
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }

    if (!isLongPressHandled.current) {
      // Short press: Capture and pass false for isMultiShot
      captureImage((src) => {
        onCapture(src, false);
      }, true); 
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-center items-center animate-fade-in" dir="ltr">
      <style>{`
        video::-webkit-media-controls { display: none !important; }
        .no-select { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
        /* Vertical Slider Customization */
        input[type=range][orient=vertical] {
            writing-mode: bt-lr; /* IE */
            -webkit-appearance: slider-vertical; /* WebKit */
            width: 8px;
            height: 100%;
            padding: 0 5px;
        }
      `}</style>

      {/* Point 3: Very Light Visual Flash (10% opacity) */}
      <div 
        className={`absolute inset-0 bg-white pointer-events-none z-30 transition-opacity duration-100 ease-out ${isCapturing ? 'opacity-10' : 'opacity-0'}`} 
      />

      <div className={`absolute top-24 left-1/2 transform -translate-x-1/2 z-40 transition-all duration-300 ${showAddedToast ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div className="bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-sm bg-opacity-90 border border-white/20">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
             <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
           </svg>
           <span className="font-bold text-sm">{t.imgAdded}</span>
        </div>
      </div>

      {error ? (
        <div className="text-white p-6 text-center max-w-sm bg-gray-900 rounded-3xl mx-4 shadow-2xl border border-gray-700 animate-slide-up z-40" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <div className="w-16 h-16 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2 text-white">{t.cameraErrorTitle}</h3>
          <p className="mb-6 font-medium leading-relaxed text-gray-400 text-sm">{error}</p>
          <button onClick={() => openNativeCamera((src) => onCapture(src, false))} className="bg-emerald-600 text-white w-full py-4 rounded-xl font-bold hover:bg-emerald-700 transition mb-3 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 text-lg">
            {t.useNativeCamera}
          </button>
          <button onClick={onClose} className="bg-white/10 text-white w-full py-3 rounded-xl font-bold hover:bg-white/20 transition">{t.close}</button>
        </div>
      ) : (
        <div className="relative w-full h-full flex flex-col bg-black">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover transition-opacity duration-300 pointer-events-none ${isVideoReady ? 'opacity-100' : 'opacity-0'}`}
              onPlaying={() => setIsVideoReady(true)}
            />
            
            {/* Top Bar Controls */}
            <div className="absolute top-[env(safe-area-inset-top)] left-0 right-0 p-4 mt-2 z-20 flex justify-between items-start px-6">
               {hasTorch ? (
                 <button onClick={toggleTorch} className={`p-3 rounded-full backdrop-blur-md transition active:scale-90 ${isTorchOn ? 'bg-yellow-400 text-yellow-900' : 'bg-black/30 text-white'}`}>
                   {isTorchOn ? (
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" /></svg>
                   ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                   )}
                 </button>
               ) : <div className="w-12"></div>}

               <button onClick={onClose} className="text-white p-3 rounded-full bg-black/30 backdrop-blur-md hover:bg-black/50 transition active:scale-90">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Viewfinder Corners */}
            <div className={`absolute inset-0 pointer-events-none flex items-center justify-center transition-opacity duration-200 ${isCapturing ? 'opacity-0' : 'opacity-100'}`}>
               <div className="w-72 h-72 rounded-3xl relative">
                   <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-500 rounded-tl-2xl -mt-1 -ml-1 shadow-sm"></div>
                   <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-500 rounded-tr-2xl -mt-1 -mr-1 shadow-sm"></div>
                   <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-500 rounded-bl-2xl -mb-1 -ml-1 shadow-sm"></div>
                   <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-500 rounded-br-2xl -mb-1 -mr-1 shadow-sm"></div>
               </div>
            </div>

            {/* ZOOM SLIDER (Vertical) */}
            {supportsZoom && maxZoom > 1 && (
                <div className="absolute right-6 top-1/2 transform -translate-y-1/2 h-48 z-20 flex flex-col items-center gap-2 bg-black/30 backdrop-blur-md rounded-full py-4 border border-white/10">
                    <span className="text-[10px] font-bold text-white mb-1">{maxZoom}x</span>
                    <input 
                        type="range" 
                        min={minZoom} 
                        max={maxZoom} 
                        step="0.1" 
                        value={zoom} 
                        onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                        className="w-2 appearance-none bg-white/20 rounded-full h-full outline-none accent-emerald-500 cursor-pointer"
                        style={{ writingMode: 'vertical-lr', direction: 'ltr' }} 
                    />
                    <span className="text-[10px] font-bold text-white mt-1">1x</span>
                </div>
            )}
            
            {/* Coach Marks */}
            {showCoachMarks && (
               <div 
                 className="absolute bottom-[160px] left-4 right-4 z-[60] bg-black/80 backdrop-blur-md rounded-2xl p-5 border border-white/10 shadow-2xl animate-slide-up"
                 dir={language === 'ar' ? 'rtl' : 'ltr'}
               >
                 <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-emerald-400">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.25-3.75a.75.75 0 011.5 0V9a.75.75 0 01-1.5 0v-.75zm0 2.625a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5z" clipRule="evenodd" />
                       </svg>
                       {t.cameraTips}
                    </h3>
                    <button onClick={dismissCoachMarks} className="text-white/50 hover:text-white">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                       </svg>
                    </button>
                 </div>

                 <ul className="space-y-3 text-sm text-white/90">
                    <li className="flex gap-3 items-center">
                       <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <div className="w-3 h-3 bg-white rounded-full"></div>
                       </div>
                       <span>{t.coachTapTitle}</span>
                    </li>
                    <li className="flex gap-3 items-center">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-emerald-500/30">
                          <div className="w-4 h-4 bg-emerald-400 rounded-full animate-pulse"></div>
                       </div>
                       <span>{t.coachHoldTitle}</span>
                    </li>
                    <li className="flex gap-3 items-center">
                       <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                          </svg>
                       </div>
                       <span>{t.coachAnglesTitle}</span>
                    </li>
                 </ul>

                 <button 
                   onClick={dismissCoachMarks}
                   className="w-full mt-5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition text-white font-bold py-3 rounded-xl text-sm shadow-lg shadow-emerald-900/20"
                 >
                    {t.gotIt}
                 </button>
               </div>
            )}

            {/* Bottom Capture Area */}
            <div className="absolute bottom-0 left-0 right-0 p-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] flex flex-col justify-center items-center z-10 space-y-3">
              <div className="relative">
                 {/* Visual Pulse Ring to highlight the button when onboarding is active */}
                 {showCoachMarks && (
                    <div className="absolute inset-[-10px] rounded-full border-4 border-emerald-400/60 opacity-75 animate-ping pointer-events-none"></div>
                 )}
                 
                 <button 
                  onMouseDown={handlePressStart}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={handlePressStart}
                  onTouchEnd={handlePressEnd}
                  disabled={isCapturing}
                  className={`relative w-20 h-20 rounded-full border-[5px] flex items-center justify-center transition-all shadow-2xl backdrop-blur-sm group no-select z-20
                    ${isCapturing 
                      ? 'border-white/50 bg-white/40 scale-95' 
                      : 'border-white/30 bg-white/20 hover:bg-white/30 active:scale-95'
                    }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className={`w-16 h-16 rounded-full bg-white transition-all duration-200 ${isCapturing ? 'scale-75 opacity-80' : 'group-active:scale-90'}`}></div>
                </button>
              </div>
              
              <p className={`text-white/60 text-xs font-medium text-center drop-shadow-md transition-opacity duration-300 ${showCoachMarks ? 'opacity-0' : 'opacity-100'}`}>{t.captureHint}</p>
            </div>
            
        </div>
      )}
    </div>
  );
};