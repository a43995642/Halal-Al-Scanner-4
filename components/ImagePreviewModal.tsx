
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface ImagePreviewModalProps {
  images: string[];
  onDelete: (index: number) => void;
  onClose: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ images, onDelete, onClose }) => {
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
       {/* Lightened gradient for natural viewing */}
       <div className="absolute top-0 left-0 right-0 z-20 p-4 pt-[calc(env(safe-area-inset-top)+1rem)] flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
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
                {/* Displaying User Version (Pretty) */}
                <img src={img} alt={`Captured ${idx}`} className="max-w-full max-h-full object-contain p-2" />
             </div>
          ))}
       </div>

       {/* Lightened bottom gradient */}
       <div className="absolute bottom-0 left-0 right-0 z-20 p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col gap-5 items-center">
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
