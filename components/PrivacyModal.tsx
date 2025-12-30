
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface PrivacyModalProps {
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ onClose }) => {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-slide-up flex flex-col max-h-[80vh] border border-white/10">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <h2 className="text-xl font-bold text-white">{t.privacyTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar">
           <div className="prose prose-invert text-sm text-gray-300 whitespace-pre-line leading-relaxed">
             {t.privacyContent}
           </div>
        </div>
        
        <div className="p-6 border-t border-white/5 bg-white/5">
           <button 
             onClick={onClose}
             className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/20"
           >
             {t.closeBtn}
           </button>
        </div>
      </div>
    </div>
  );
};
