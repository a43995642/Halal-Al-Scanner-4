import React, { useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ScanHistoryItem, HalalStatus } from '../types';

interface HistoryModalProps {
  history: ScanHistoryItem[];
  onClose: () => void;
  onLoadItem: (item: ScanHistoryItem) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ history, onClose, onLoadItem }) => {
  const { t, language } = useLanguage();

  const groupedHistory = useMemo(() => {
    const groups: { [key: string]: ScanHistoryItem[] } = {
      today: [],
      yesterday: [],
      older: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();

    history.forEach(item => {
      const itemDate = new Date(item.date).setHours(0, 0, 0, 0);
      if (itemDate === today) {
        groups.today.push(item);
      } else if (itemDate === yesterday) {
        groups.yesterday.push(item);
      } else {
        groups.older.push(item);
      }
    });

    return groups;
  }, [history]);

  const renderGroup = (title: string, items: ScanHistoryItem[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <h4 className="text-xs font-bold text-gray-500 mb-3 px-2 uppercase tracking-wider sticky top-0 bg-[#1e1e1e]/95 backdrop-blur-sm py-2 z-10">
          {title}
        </h4>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} onClick={() => onLoadItem(item)} className="bg-black/20 p-3 rounded-2xl shadow-sm border border-white/5 active:scale-[0.98] transition cursor-pointer flex justify-between items-center gap-4 hover:bg-white/5 hover:border-emerald-500/30 group">
              <div className="flex items-center gap-4 flex-grow overflow-hidden">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="Product" className="w-14 h-14 rounded-xl object-cover bg-white/5 border border-white/10 shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-grow">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${item.result.status === HalalStatus.HALAL ? 'bg-emerald-500/20 text-emerald-400' : item.result.status === HalalStatus.HARAM ? 'bg-red-500/20 text-red-400' : item.result.status === HalalStatus.DOUBTFUL ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {item.result.status === HalalStatus.HALAL ? t.statusHalal : item.result.status === HalalStatus.HARAM ? t.statusHaram : item.result.status === HalalStatus.DOUBTFUL ? t.statusDoubtful : t.statusNonFood}
                        </span>
                        <span className="text-[10px] text-gray-600">
                           {new Date(item.date).toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {hour: '2-digit', minute:'2-digit'})}
                        </span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-1 leading-relaxed group-hover:text-gray-300 transition-colors">
                      {item.result.reason.substring(0, 50)}...
                    </p>
                  </div>
              </div>
              <div className="text-gray-600 group-hover:text-emerald-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-4 h-4 ${language === 'ar' ? 'rotate-180' : ''}`}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[55] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-[#1e1e1e] rounded-t-3xl sm:rounded-3xl w-full max-w-md h-[85vh] flex flex-col shadow-2xl border border-white/10 animate-slide-up">
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
        
        <div className="overflow-y-auto flex-grow p-4 custom-scrollbar">
          {history.length === 0 ? (
             <div className="text-center text-gray-500 py-20 flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 opacity-20 mb-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                <p>{t.noHistory}</p>
             </div>
          ) : (
            <>
              {renderGroup(language === 'ar' ? 'اليوم' : 'Today', groupedHistory.today)}
              {renderGroup(language === 'ar' ? 'الأمس' : 'Yesterday', groupedHistory.yesterday)}
              {renderGroup(language === 'ar' ? 'الأقدم' : 'Older', groupedHistory.older)}
            </>
          )}
        </div>
      </div>
    </div>
  );
};