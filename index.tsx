
import React, { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';

// --- FAIL-SAFE: Privacy Page Redirect ---
// If React loads on the privacy path, it means the Service Worker or Routing messed up.
// We force a hard reload bypassing the Service Worker.
if (window.location.pathname.includes('privacy.html') || window.location.pathname === '/privacy') {
  console.warn("SPA loaded on privacy page. Redirecting to static file...");
  
  // Unregister SW to fix the root cause for next time
  if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for(let registration of registrations) {
              registration.unregister();
          }
      });
  }

  // If we are already in a loop, stop
  if (!window.location.search.includes('v=')) {
     // Force network fetch by appending a timestamp
     window.location.href = '/privacy.html?v=' + Date.now();
  } else {
     // If still failing, just show a basic fallback in document body
     document.body.innerHTML = '<div style="padding:20px;text-align:center;"><h1>Privacy Policy Loading...</h1><a href="/privacy.html?v=' + Date.now() + '">Click here if not redirected</a></div>';
  }
  // Stop React from mounting
  throw new Error("Redirecting to Privacy Policy"); 
}
// ----------------------------------------

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Simple Error Boundary Component to prevent white screen
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6 text-center" dir="rtl">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-sm w-full border dark:border-slate-800">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-600 dark:text-red-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
                </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2 font-sans">عذراً، حدث خطأ</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6 font-sans text-sm">واجه التطبيق مشكلة غير متوقعة. يرجى إعادة التشغيل.</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white w-full py-3 rounded-xl font-bold font-sans transition"
            >
              إعادة التحميل
            </button>
            {this.state.error && (
              <details className="mt-4 text-left text-xs text-gray-400 overflow-hidden">
                <summary className="cursor-pointer mb-1">تفاصيل الخطأ</summary>
                <pre className="bg-gray-100 dark:bg-slate-800 p-2 rounded overflow-auto max-h-20">{this.state.error.message}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    // Fix: Explicitly cast 'this' to access props safely to avoid TS error
    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
