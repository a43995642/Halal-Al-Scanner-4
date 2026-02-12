import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

interface AuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onSuccess }) => {
  const { t, dir, language } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // الحالة لعرض شاشة "تم إرسال الإيميل" بدلاً من التنبيهات المزعجة
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Helper to get the correct redirect URL
  const getRedirectUrl = () => {
      if (Capacitor.isNativePlatform()) {
          return 'io.halalscanner.ai://login-callback';
      }
      // In development or web
      return window.location.origin;
  };

  // --- HANDLE MISSING CONFIGURATION (GUEST MODE) ---
  if (!isSupabaseConfigured) {
    return (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir={dir}>
          <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm shadow-2xl border border-white/10 animate-slide-up p-8 text-center relative overflow-hidden">
             
             <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white p-2"
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
             </button>

             <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
             </div>
             
             <h3 className="text-xl font-bold text-white mb-3">
                {language === 'ar' ? 'الخدمة السحابية غير مفعلة' : 'Cloud Service Not Configured'}
             </h3>
             
             <p className="text-gray-400 text-sm mb-8 leading-relaxed">
               {language === 'ar' 
                 ? "لم يتم ربط قاعدة البيانات (Supabase) بهذا التطبيق بعد. يمكنك استخدام جميع ميزات الفحص والذكاء الاصطناعي كزائر بدون تسجيل."
                 : "The database (Supabase) is not connected yet. You can still use all scanning and AI features as a guest."}
             </p>

             <button 
                onClick={onClose} 
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
             >
               {language === 'ar' ? 'متابعة كزائر' : 'Continue as Guest'}
             </button>
          </div>
        </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Basic Validation
    if (!email.includes('@')) {
      setError(t.invalidEmail);
      setIsLoading(false);
      return;
    }
    if (password.length < 6) {
      setError(t.weakPassword);
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // --- LOGIN FLOW ---
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        
        onSuccess();
        onClose();
      } else {
        // --- SIGN UP FLOW ---
        const redirectUrl = getRedirectUrl();
        console.log('Signing up with redirect to:', redirectUrl);

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl
          }
        });
        
        if (signUpError) throw signUpError;

        // التحقق مما إذا تم إنشاء الجلسة فوراً
        if (data.session) {
             onSuccess();
             onClose();
        } else {
             // تم إنشاء الحساب ولكن يتطلب تفعيل الإيميل
             setShowEmailSent(true);
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let msg = err.message;
      if (msg.includes('User already registered')) msg = language === 'ar' ? 'هذا البريد مسجل مسبقاً، حاول تسجيل الدخول.' : 'User already registered. Please sign in.';
      else if (msg.includes('Invalid login credentials')) msg = language === 'ar' ? 'بيانات الدخول غير صحيحة.' : 'Invalid email or password.';
      else if (msg.includes('Failed to fetch')) msg = language === 'ar' ? 'تعذر الاتصال بالخادم. تحقق من الإنترنت أو إعدادات قاعدة البيانات.' : 'Connection failed. Check internet or DB config.';
      
      setError(msg || t.unexpectedError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      if (Capacitor.isNativePlatform()) {
        // 1. Try Native Google Auth First (Requires SHA-1 configured)
        try {
            const googleUser = await GoogleAuth.signIn();
            const idToken = googleUser.authentication.idToken;

            if (!idToken) throw new Error('No ID Token returned from Google.');

            const { error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: idToken,
            });

            if (error) throw error;
            onSuccess();
            onClose();
            return; // Success, exit function
        } catch (nativeErr) {
            console.warn("Native Google Auth failed, falling back to Web OAuth:", nativeErr);
            // If Native fails (e.g. SHA-1 mismatch), fall through to Web OAuth below
        }
      }

      // 2. Web OAuth Fallback (Opens Browser Safely to avoid 403 disallowed_useragent)
      const redirectUrl = getRedirectUrl();
      console.log("Starting OAuth with redirect:", redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
           redirectTo: redirectUrl,
           queryParams: { access_type: 'offline', prompt: 'consent' },
           skipBrowserRedirect: true // CRITICAL: Prevent Supabase from trying to open in WebView
        }
      });
      
      if (error) throw error;
      
      // Manually open the URL in Chrome Custom Tabs (Allowed User Agent)
      if (data?.url) {
         await Browser.open({ url: data.url });
         // We close the modal, assuming the app will handle the redirect via Deep Link in App.tsx
         onClose(); 
      }
      
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      let msg = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
      if (msg.includes('closed') || msg.includes('cancelled')) return;
      setError(msg.length > 100 ? msg.substring(0, 100) + '...' : msg);
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
        const redirectUrl = getRedirectUrl();

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
            options: {
                emailRedirectTo: redirectUrl
            }
        });

        if (error) throw error;
        alert(t.emailResent);
    } catch (e: any) {
        let msg = e.message;
        if (msg.includes("Rate limit")) msg = language === 'ar' ? "الرجاء الانتظار قليلاً قبل إعادة المحاولة." : "Please wait before retrying.";
        alert(msg);
    } finally {
        setIsResending(false);
    }
  };

  // --- Success View (Check Email UI) ---
  if (showEmailSent) {
    return (
        <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir={dir}>
          <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm shadow-2xl border border-white/10 animate-slide-up p-8 text-center relative overflow-hidden">
             
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-400"></div>

             <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(16,185,129,0.2)] border border-emerald-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
             </div>
             
             <h3 className="text-xl font-bold text-white mb-3">{t.signupSuccess}</h3>
             
             <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/5 text-sm text-gray-300 leading-relaxed">
               {language === 'ar' 
                 ? <>تم إرسال رابط التفعيل إلى: <br/><span className="text-emerald-400 font-bold">{email}</span></>
                 : <>Verification link sent to: <br/><span className="text-emerald-400 font-bold">{email}</span></>}
             </div>

             <p className="text-gray-400 text-xs mb-8 leading-relaxed">
               {language === 'ar' 
                 ? "يرجى التحقق من بريدك الوارد (أو البريد المهمل/Spam) والضغط على الرابط للدخول تلقائياً للتطبيق."
                 : "Please check your inbox (or Spam folder) and click the link to automatically log in to the app."}
             </p>

             <div className="flex flex-col gap-3">
                 <button 
                    onClick={() => { setShowEmailSent(false); setIsLogin(true); }} 
                    className="w-full bg-white text-black font-bold py-3.5 rounded-xl transition hover:bg-gray-200"
                 >
                   {language === 'ar' ? 'فهمت، العودة لتسجيل الدخول' : 'Got it, Back to Login'}
                 </button>
                 
                 <button 
                    onClick={handleResendEmail} 
                    disabled={isResending}
                    className="text-emerald-400 text-xs font-bold py-2 hover:text-emerald-300 disabled:opacity-50"
                 >
                   {isResending ? t.resending : t.resendEmail}
                 </button>
             </div>
          </div>
        </div>
    );
  }

  // --- Main Auth Form ---
  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir={dir}>
      <div className="bg-[#1e1e1e] rounded-3xl w-full max-w-sm shadow-2xl border border-white/10 animate-slide-up flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
           <h3 className="font-bold text-white text-lg flex items-center gap-2">
             <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
             </div>
             {isLogin ? t.signIn : t.signUp}
           </h3>
           <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
           </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-gray-400 text-sm leading-relaxed text-center">
            {t.authDesc}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
             <div>
               <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">{t.email}</label>
               <input 
                 type="email" 
                 name="email"
                 autoComplete="email"
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white placeholder-gray-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition"
                 placeholder="name@example.com"
                 required 
               />
             </div>
             
             <div>
               <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase">{t.password}</label>
               <input 
                 type="password"
                 name="password"
                 autoComplete={isLogin ? "current-password" : "new-password"}
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white placeholder-gray-600 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition"
                 placeholder="••••••••"
                 required 
               />
             </div>

             {error && (
               <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl text-center whitespace-pre-wrap leading-relaxed break-words animate-fade-in">
                 {error}
               </div>
             )}

             <button 
               type="submit" 
               disabled={isLoading}
               className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-900/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             >
               {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
               {isLoading ? (isLogin ? t.loggingIn : t.signingUp) : (isLogin ? t.signIn : t.signUp)}
             </button>
          </form>
          
          <div className="flex items-center gap-3">
             <div className="h-px bg-white/10 flex-grow"></div>
             <span className="text-gray-500 text-xs font-bold">{t.or}</span>
             <div className="h-px bg-white/10 flex-grow"></div>
          </div>

          <div className="space-y-3">
            <button onClick={handleGoogleLogin} className="w-full bg-white text-black font-bold py-3 rounded-xl transition hover:bg-gray-100 flex items-center justify-center gap-2">
               <svg className="w-5 h-5" viewBox="0 0 24 24">
                 <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                 <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                 <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                 <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
               </svg>
               {t.continueWithGoogle}
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-gray-400 text-sm">
              {isLogin ? t.dontHaveAccount : t.alreadyHaveAccount}{' '}
              <button 
                onClick={() => setIsLogin(!isLogin)} 
                className="text-emerald-400 hover:text-emerald-300 font-bold underline decoration-emerald-500/30 underline-offset-4"
              >
                {isLogin ? t.signUp : t.signIn}
              </button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};