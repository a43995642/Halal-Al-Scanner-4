
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface TextInputModalProps {
  onClose: () => void;
  onAnalyze: (text: string) => void;
}

export const TextInputModal: React.FC<TextInputModalProps> = ({ onClose, onAnalyze }) => {
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
