
import { HalalStatus } from '../types';

// Helper for ingredients style
export const getIngredientStyle = (status: HalalStatus, isOverlay: boolean = false) => {
  if (isOverlay) {
    switch(status) {
      case HalalStatus.HARAM: 
        return "bg-red-900 border-red-500 text-white font-bold ring-2 ring-red-500/50 shadow-lg";
      case HalalStatus.DOUBTFUL: 
        return "bg-amber-900 border-amber-500 text-white font-bold ring-2 ring-amber-500/50 shadow-lg";
      default: 
        // High contrast black background for safe/detected ingredients
        return "bg-black border-white/30 text-white font-bold shadow-lg ring-1 ring-white/10";
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
