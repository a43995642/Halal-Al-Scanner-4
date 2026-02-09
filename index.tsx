import React, { Component, ReactNode, ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Removed explicit public state declaration to avoid conflict with React.Component
  // public state: ErrorBoundaryState;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical App Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-950 p-6 text-center" dir="rtl">
          <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl max-w-sm w-full">
            <h1 className="text-xl font-bold text-white mb-4 font-sans">حدث خطأ في التشغيل</h1>
            <p className="text-gray-400 mb-6 text-sm">{this.state.error?.message || "مشكلة في تحميل المكونات"}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-emerald-600 text-white w-full py-3 rounded-xl font-bold"
            >
              إعادة محاولة التشغيل
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
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
} else {
  console.error("Fatal: Root element not found");
}