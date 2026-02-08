
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, TranslationDictionary } from '../types';
import ar from '../locales/ar';
import en from '../locales/en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationDictionary;
  isLoading: boolean;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children?: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
     if (typeof localStorage !== 'undefined' && localStorage.getItem('halalScannerLang')) {
        return localStorage.getItem('halalScannerLang') as Language;
     }
     return 'ar';
  });
  
  // FIX: Use static dictionaries instead of dynamic imports to prevent WSOD on Android
  const t = language === 'ar' ? ar : en;
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
      // Update DOM attributes for global styling
      document.documentElement.setAttribute('lang', language);
      document.documentElement.setAttribute('dir', dir);
      localStorage.setItem('halalScannerLang', language);
  }, [language, dir]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  // No loading state needed with static imports
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isLoading: false, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
