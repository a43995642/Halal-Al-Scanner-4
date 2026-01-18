
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface BarcodeModalProps {
  onClose: () => void;
  onSearch: (barcode: string) => void;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({ onClose, onSearch }) => {
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
