
import React, { useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface ImageEditorProps {
  imageSrc: string;
  onConfirm: (editedImage: string) => void;
  onCancel: () => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageSrc, onConfirm, onCancel }) => {
  const { t, language } = useLanguage();
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset position when rotation changes
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startPos.current = { x: clientX - position.x, y: clientY - position.y };
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault(); // Prevent scrolling while dragging
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setPosition({
      x: clientX - startPos.current.x,
      y: clientY - startPos.current.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleSave = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    const container = containerRef.current;

    if (!ctx || !img || !container) return;

    // We want to crop what is visible in the container (the "crop box")
    // The container is the "viewfinder"
    const containerRect = container.getBoundingClientRect();
    
    // Set canvas size to the crop box size (high resolution)
    canvas.width = containerRect.width * 2; // 2x for better quality
    canvas.height = containerRect.height * 2;

    // Draw background
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate transforms
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(position.x * 2, position.y * 2); // 2x to match canvas scale

    // Draw image centered
    // We draw the image centered on the transformed origin
    ctx.drawImage(
        img, 
        -img.naturalWidth / 2, 
        -img.naturalHeight / 2
    );

    onConfirm(canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col animate-fade-in" style={{ touchAction: 'none' }}>
      
      {/* Header */}
      <div className="p-4 flex justify-between items-center bg-black/50 backdrop-blur-md z-10 absolute top-0 left-0 right-0">
         <button onClick={onCancel} className="text-white font-bold text-sm px-3 py-2 rounded-lg hover:bg-white/10">
            {t.cancel}
         </button>
         <h3 className="text-white font-bold">{t.cropTitle}</h3>
         <button onClick={() => { setPosition({x:0, y:0}); setScale(1); setRotation(0); }} className="text-yellow-400 text-xs font-bold">
            {t.reset}
         </button>
      </div>

      {/* Workspace */}
      <div className="flex-grow flex items-center justify-center relative overflow-hidden bg-gray-900">
         
         {/* Crop Overlay Guide (Fixed Center Box) */}
         <div 
            ref={containerRef}
            className="relative w-full max-w-sm aspect-square border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] z-10 pointer-events-none rounded-sm"
         >
            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30"></div>
            <div className="absolute bottom-1/3 left-0 right-0 h-px bg-white/30"></div>
            <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30"></div>
            <div className="absolute right-1/3 top-0 bottom-0 w-px bg-white/30"></div>
         </div>

         {/* Draggable Image */}
         <div 
            className="absolute inset-0 flex items-center justify-center cursor-move"
            onMouseDown={handleTouchStart}
            onMouseMove={handleTouchMove}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
         >
            <img 
              ref={imageRef}
              src={imageSrc} 
              alt="Edit" 
              className="max-w-none max-h-none transition-transform duration-100 ease-linear origin-center"
              style={{ 
                transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${scale})`,
                width: '100%', // Initial fit
                height: 'auto'
              }}
              draggable={false}
            />
         </div>
         
         <div className="absolute bottom-32 left-0 right-0 flex justify-center z-20 pointer-events-none">
            <p className="text-white/50 text-xs bg-black/40 px-2 py-1 rounded backdrop-blur">
               {language === 'ar' ? 'اسحب لتحريك الصورة داخل الإطار' : 'Drag to pan image inside crop box'}
            </p>
         </div>
      </div>

      {/* Footer Controls */}
      <div className="bg-gray-900 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] flex flex-col gap-4 z-20 border-t border-gray-800">
         
         {/* Zoom Slider */}
         <div className="flex items-center gap-3 px-4">
            <span className="text-white/70 text-xs">−</span>
            <input 
              type="range" 
              min="0.5" 
              max="3" 
              step="0.1" 
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-white/70 text-xs">+</span>
         </div>

         <div className="flex justify-between items-center">
            <button 
              onClick={handleRotate}
              className="flex flex-col items-center gap-1 text-white/80 hover:text-white px-4"
            >
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
               </svg>
               <span className="text-[10px]">{t.rotate}</span>
            </button>

            <button 
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-10 rounded-2xl shadow-lg active:scale-95 transition"
            >
               {t.confirm}
            </button>
         </div>
      </div>
    </div>
  );
};
