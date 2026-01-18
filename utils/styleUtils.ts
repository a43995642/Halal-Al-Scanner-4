
import { HalalStatus } from '../types';

// Helper for ingredients style
export const getIngredientStyle = (status: HalalStatus, isOverlay: boolean = false) => {
  if (isOverlay) {
    switch(status) {
      case HalalStatus.HARAM: 
        return "bg-red-700/95 border-red-600 text-white font-bold ring-2 ring-red-500/50 shadow-red-900/50";
      case HalalStatus.DOUBTFUL: 
        return "bg-amber-500/90 border-amber-400 text-white font-bold ring-2 ring-amber-500/50";
      default: 
        return "bg-white/20 border-white/20 text-white backdrop-blur-md";
    }
  } else {
    switch(status) {
      case HalalStatus.HARAM: 
        return "bg-red-700 text-white border-red-900 font-bold shadow-sm dark:border-red-600";
      case HalalStatus.DOUBTFUL: 
        return "bg-amber-50 text-amber-700 border-amber-200 font-bold dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700";
      default: 
        return "bg-white text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-300 dark:border-slate-700";
    }
  }
};
