
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { HalalStatus, ScanResult } from '../types';
import { Capacitor } from '@capacitor/core';

// Reusing URL logic from geminiService to ensure consistency
const VERCEL_PROJECT_URL = 'https://halal-al-scanner-4.vercel.app'; 
const getBaseUrl = () => {
  if (Capacitor.isNativePlatform()) return VERCEL_PROJECT_URL.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
     const host = window.location.hostname;
     if (host === 'localhost' || host.startsWith('192.168') || host.startsWith('10.')) {
        return VERCEL_PROJECT_URL.replace(/\/$/, '');
     }
  }
  return '';
};

interface CorrectionModalProps {
  onClose: () => void;
  result: ScanResult;
  analyzedText?: string | null;
  userId?: string | null;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({ onClose, result, analyzedText, userId }) => {
  const { t, language } = useLanguage();
  const [selectedStatus, setSelectedStatus] = useState<HalalStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async () => {
    if (!selectedStatus) return;
    
    setIsSending(true);
    
    try {
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/api/report`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId,
                originalText: analyzedText || result.reason, // Fallback to reason if raw text missing
                aiResult: result,
                userCorrection: selectedStatus,
                userNotes: notes
            })
        });
        
        if (response.ok) {
            alert(t.reportSent);
            onClose();
        } else {
            throw new Error('Failed to send');
        }
    } catch (e) {
        alert(t.connectionError);
    } finally {
        setIsSending(false);
    }
  };

  const statusOptions = [
    { value: HalalStatus.HALAL, label: t.statusHalal, color: 'bg-emerald-500', border: 'border-emerald-500' },
    { value: HalalStatus.HARAM, label: t.statusHaram, color: 'bg-red-500', border: 'border-red-500' },
    { value: HalalStatus.DOUBTFUL, label: t.statusDoubtful, color: 'bg-amber-500', border: 'border-amber-500' },
    { value: HalalStatus.NON_FOOD, label: t.statusNonFood, color: 'bg-gray-500', border: 'border-gray-500' },
  ];

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-t-3xl sm:rounded-3xl w-full max-w-md flex flex-col shadow-2xl border border-white/10 animate-slide-up">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 rounded-t-3xl">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
             <div className="p-2 bg-blue-500/20 rounded-full text-blue-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
                </svg>
             </div>
             {t.reportTitle}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
           <p className="text-gray-400 text-sm text-center">{t.reportDesc}</p>
           
           <div>
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase px-1">{t.correctStatus}</label>
              <div className="grid grid-cols-2 gap-3">
                 {statusOptions.map((opt) => (
                    <button
                       key={opt.value}
                       onClick={() => setSelectedStatus(opt.value)}
                       className={`p-3 rounded-xl border font-bold text-sm transition flex items-center justify-center gap-2 ${
                          selectedStatus === opt.value 
                             ? `${opt.color} text-white ${opt.border} shadow-lg scale-[1.02]` 
                             : 'bg-black/40 border-white/10 text-gray-400 hover:bg-white/5'
                       }`}
                    >
                       {selectedStatus === opt.value && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                             <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                       )}
                       {opt.label}
                    </button>
                 ))}
              </div>
           </div>

           <div>
              <label className="block text-xs font-bold text-gray-500 mb-2 uppercase px-1">{t.notes}</label>
              <textarea
                 value={notes}
                 onChange={(e) => setNotes(e.target.value)}
                 className="w-full h-24 bg-black/50 border border-white/10 rounded-xl p-3 text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none resize-none text-sm"
                 placeholder={t.notesPlaceholder}
              />
           </div>

           <button 
             onClick={handleSubmit}
             disabled={!selectedStatus || isSending}
             className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-blue-900/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
           >
             {isSending ? (
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
             ) : (
                 <>
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-5 h-5 ${language === 'ar' ? 'rotate-180' : ''}`}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                   </svg>
                   {t.sendReport}
                 </>
             )}
           </button>
        </div>
      </div>
    </div>
  );
};
