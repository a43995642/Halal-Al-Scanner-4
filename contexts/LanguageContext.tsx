
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, TranslationDictionary } from '../types';

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
  
  const [t, setT] = useState<TranslationDictionary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadTranslations = async () => {
      setIsLoading(true);
      try {
        // Dynamic import based on language
        // Note: Vite will bundle these files as separate chunks
        const module = await import(`../locales/${language}.ts`);
        
        if (isMounted) {
          setT(module.default);
          
          // Update DOM attributes for global styling
          document.documentElement.setAttribute('lang', language);
          document.documentElement.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
          localStorage.setItem('halalScannerLang', language);
        }
      } catch (error) {
        console.error("Failed to load translations for", language, error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    loadTranslations();
    return () => { isMounted = false; };
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  // Show a minimal loader while the language file is being fetched (usually milliseconds)
  if (isLoading || !t) {
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex items-center justify-center z-[9999]">
         <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isLoading, dir: language === 'ar' ? 'rtl' : 'ltr' }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
