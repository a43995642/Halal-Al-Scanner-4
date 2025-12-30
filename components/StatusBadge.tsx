
import React from 'react';
import { HalalStatus } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface StatusBadgeProps {
  status: HalalStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { t } = useLanguage();

  switch (status) {
    case HalalStatus.HALAL:
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-emerald-50 dark:bg-emerald-900/20 rounded-3xl border-4 border-emerald-500 dark:border-emerald-600 text-emerald-800 dark:text-emerald-100 mb-8 animate-fade-in shadow-lg">
          <div className="bg-emerald-100 dark:bg-emerald-800/50 p-4 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-24 h-24 text-emerald-600 dark:text-emerald-400">
              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.498 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.491 4.491 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-4xl font-extrabold tracking-wide">{t.statusHalal}</span>
          <span className="text-xl opacity-75 mt-1 font-semibold">{t.statusHalalSub}</span>
        </div>
      );
    case HalalStatus.HARAM:
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-700 dark:bg-red-800 rounded-3xl border-4 border-red-900 dark:border-red-950 text-white mb-8 animate-fade-in shadow-xl">
          <div className="bg-white/10 p-4 rounded-full mb-4 backdrop-blur-md">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-24 h-24 text-white">
               <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-4xl font-extrabold tracking-wide drop-shadow-md">{t.statusHaram}</span>
          <span className="text-xl opacity-100 mt-1 font-bold">{t.statusHaramSub}</span>
        </div>
      );
    case HalalStatus.DOUBTFUL:
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-3xl border-4 border-yellow-500 dark:border-yellow-600 text-yellow-900 dark:text-yellow-100 mb-8 animate-fade-in shadow-lg">
          <div className="bg-yellow-100 dark:bg-yellow-800/50 p-4 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-24 h-24 text-yellow-600 dark:text-yellow-400">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-4xl font-extrabold tracking-wide">{t.statusDoubtful}</span>
          <span className="text-xl opacity-75 mt-1 font-semibold">{t.statusDoubtfulSub}</span>
        </div>
      );
    case HalalStatus.NON_FOOD:
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-100 dark:bg-slate-800 rounded-3xl border-4 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-200 mb-8 animate-fade-in shadow-lg">
          <div className="bg-slate-200 dark:bg-slate-700 p-4 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-24 h-24 text-slate-500 dark:text-slate-400">
               <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <span className="text-3xl font-bold text-center">{t.statusNonFood}</span>
          <span className="text-xl opacity-75 mt-1 font-semibold text-center">{t.statusNonFoodSub}</span>
        </div>
      );
    default:
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-slate-800 rounded-3xl border-4 border-gray-300 dark:border-slate-700 text-gray-700 dark:text-gray-300 mb-8 animate-fade-in shadow-lg">
           <div className="bg-gray-200 dark:bg-slate-700 p-4 rounded-full mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-24 h-24 text-gray-500 dark:text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <span className="text-3xl font-bold text-center">{t.statusUnknown}</span>
          <span className="text-lg opacity-75 mt-1">{t.statusUnknownSub}</span>
        </div>
      );
  }
};
