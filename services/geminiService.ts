
import { HalalStatus, ScanResult, Language } from "../types";
import { Capacitor } from '@capacitor/core';
import { checkLocalHaram } from "./haramKeywords";

// ⚠️ هام: بعد رفع المشروع على Vercel، انسخ الرابط الجديد وضعه هنا بدلاً من الرابط القديم
// هذا الرابط يستخدم فقط عند بناء تطبيق Android (APK) لكي يتصل بالخادم
const VERCEL_PROJECT_URL = 'https://halal-al-scanner-4.vercel.app'; 

const getBaseUrl = () => {
  // 1. Native App (Android/iOS) -> Must use full URL
  if (Capacitor.isNativePlatform()) {
    return VERCEL_PROJECT_URL.replace(/\/$/, '');
  }

  // 2. Local Development (localhost or IP) -> Use full URL to hit remote backend
  // This solves the 404 error when running 'npm run dev' and trying to scan
  if (typeof window !== 'undefined') {
     const host = window.location.hostname;
     if (host === 'localhost' || host.startsWith('192.168') || host.startsWith('127.0') || host.startsWith('10.')) {
        // Optional: You can change this to http://localhost:3000/api if running backend locally
        console.log("Local Dev detected: Using remote API", VERCEL_PROJECT_URL);
        return VERCEL_PROJECT_URL.replace(/\/$/, '');
     }
  }

  // 3. Production Web (running on Vercel) -> Use relative path
  // This ensures the web app always works on whatever domain it is deployed to
  return '';
};

// Helper: Wait function for backoff
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Fetch with Auto-Retry Logic for Slow Internet
const fetchWithRetry = async (url: string, options: RequestInit, signal?: AbortSignal, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, { ...options, signal });
      
      // If success, return immediately
      if (response.ok) return response;

      // If Server Timeout (504) or Service Unavailable (503), Retry
      if ([502, 503, 504].includes(response.status)) {
         if (i < retries) {
             console.log(`Server busy/timeout (${response.status}). Retrying attempt ${i + 1}...`);
             await wait(1500 * (i + 1)); // Backoff: 1.5s, 3s
             continue;
         }
      }
      
      // For other HTTP errors (400, 403, 500), return response to be handled by caller
      return response;

    } catch (err: any) {
      // Do NOT retry if user cancelled manually
      if (err.name === 'AbortError') throw err;
      
      // Retry on Network Errors (Failed to fetch) - Common with slow internet
      if (i < retries && (err.message.includes('Failed to fetch') || err.message.includes('Network'))) {
         console.log(`Network connection failed. Retrying attempt ${i + 1}...`);
         await wait(2000 * (i + 1)); // Aggressive Backoff: 2s, 4s
         continue;
      }
      
      // If retries exhausted, throw the error
      if (i === retries) throw err;
    }
  }
  throw new Error("FAILED_AFTER_RETRIES");
};

// Helper to downscale image if dimensions exceed limits (Client Side Processing)
const downscaleImageIfNeeded = (base64Str: string, maxWidth: number, maxHeight: number): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const width = img.width;
      const height = img.height;

      if (width <= maxWidth && height <= maxHeight) {
        resolve(base64Str);
        return;
      }

      const ratio = Math.min(maxWidth / width, maxHeight / height);
      const newWidth = Math.round(width * ratio);
      const newHeight = Math.round(height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const analyzeImage = async (
  base64Images: string[], 
  userId?: string,
  _enhance: boolean = false,
  enableImageDownscaling: boolean = false,
  language: Language = 'ar',
  signal?: AbortSignal
): Promise<ScanResult> => {
  
  try {
    // 1. Client-Side Optimization (Resize/Process)
    const processedImages = await Promise.all(base64Images.map(async (img) => {
      let processed = img;
      if (enableImageDownscaling) {
        processed = await downscaleImageIfNeeded(processed, 1500, 1500);
      }
      return processed.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
    }));

    // 2. Call our Secure Backend Proxy with Retry
    const baseUrl = getBaseUrl();
    const endpoint = `${baseUrl}/api/analyze`;
    
    console.log("Connecting to backend:", endpoint);
    
    // Use our new fetchWithRetry helper
    const response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId || 'anonymous',
            'x-language': language
        },
        body: JSON.stringify({
            images: processedImages
        })
    }, signal, 2); // 2 retries = 3 total attempts

    if (!response.ok) {
        // Handle Timeout specifically
        if (response.status === 504) {
            throw new Error("TIMEOUT_ERROR");
        }

        let errorMessage = `Server Error: ${response.status}`;
        
        try {
            const errData = await response.json();
            if (errData.error === 'CONFIGURATION_ERROR') {
                 throw new Error("CONFIGURATION_ERROR");
            }
            if (response.status === 403 && (errData.error === 'LIMIT_REACHED')) {
                throw new Error("LIMIT_REACHED"); 
            }
            if (errData.error || errData.message) {
                errorMessage = errData.message || errData.error;
            }
        } catch (parseError) {
            // If JSON parsing fails (e.g. Vercel 500 HTML page), keep generic error
            console.warn("Could not parse error response JSON", parseError);
        }
        
        throw new Error(errorMessage);
    }

    const result = await response.json();
    return result as ScanResult;

  } catch (error: any) {
    // If aborted, rethrow so the caller knows it was cancelled
    if (error.name === 'AbortError') throw error;

    console.error("Error analyzing image:", error);
    if (error.message === "LIMIT_REACHED") throw error;
    
    // Localize Error Messages based on requested language
    const isAr = language === 'ar';
    let userMessage = isAr ? "حدث خطأ غير متوقع. حاول مرة أخرى." : "An unexpected error occurred. Please try again.";
    
    if (error.message === "CONFIGURATION_ERROR") {
        userMessage = isAr 
          ? "خطأ: مفتاح API غير موجود في إعدادات Vercel." 
          : "Error: API Key missing in Vercel settings.";
    }
    else if (error.message === "TIMEOUT_ERROR") {
        userMessage = isAr
          ? "استغرق الخادم وقتاً طويلاً. يرجى المحاولة بصورة واحدة فقط أو بدقة أقل."
          : "Server timeout. Please try with fewer images or lower quality.";
    }
    else if (error.message.includes("Server Error") || error.message.includes("Failed to fetch") || error.message.includes("Network")) {
        // This is the message for slow internet
        userMessage = isAr
          ? "الإنترنت ضعيف أو غير مستقر. يرجى التحقق من الشبكة والمحاولة مرة أخرى."
          : "Unstable internet connection. Please check your network and try again.";
    }

    return {
      status: HalalStatus.NON_FOOD,
      reason: userMessage,
      ingredientsDetected: [],
      confidence: 0, 
    };
  }
};

export const analyzeText = async (
  text: string, 
  userId?: string,
  language: Language = 'ar',
  signal?: AbortSignal
): Promise<ScanResult> => {
  
  // --- FAST LOCAL CHECK ---
  // If the text contains known Haram ingredients, return immediately without API call.
  // This is faster and works offline (for manual input).
  const localResult = checkLocalHaram(text);
  if (localResult) {
    console.log("Local Haram Match Found:", localResult);
    return {
      status: HalalStatus.HARAM,
      reason: language === 'ar' 
        ? "تم اكتشاف مكونات محرمة واضحة في النص." 
        : "Clear Haram ingredients detected in the text.",
      ingredientsDetected: localResult.detected,
      confidence: 100
    };
  }

  try {
    const baseUrl = getBaseUrl();
    const endpoint = `${baseUrl}/api/analyze`;

    const response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId || 'anonymous',
            'x-language': language
        },
        body: JSON.stringify({
            text: text
        })
    }, signal, 2);

    if (!response.ok) {
        if (response.status === 504) {
            throw new Error("TIMEOUT_ERROR");
        }

        let errorMessage = `Server Error: ${response.status}`;
        try {
            const errData = await response.json();
            if (errData.error === 'CONFIGURATION_ERROR') {
                 throw new Error("CONFIGURATION_ERROR");
            }
            if (response.status === 403 && (errData.error === 'LIMIT_REACHED')) {
                throw new Error("LIMIT_REACHED"); 
            }
            if (errData.error || errData.message) {
                errorMessage = errData.message || errData.error;
            }
        } catch (e) {}
        
        throw new Error(errorMessage);
    }

    const result = await response.json();
    return result as ScanResult;

  } catch (error: any) {
    if (error.name === 'AbortError') throw error;

    console.error("Error analyzing text:", error);
    if (error.message === "LIMIT_REACHED") throw error;
    
    const isAr = language === 'ar';
    let userMessage = isAr ? "حدث خطأ غير متوقع. حاول مرة أخرى." : "An unexpected error occurred. Please try again.";

    if (error.message === "CONFIGURATION_ERROR") {
         userMessage = isAr 
          ? "خطأ: مفتاح API غير موجود في إعدادات Vercel." 
          : "Error: API Key missing in Vercel settings.";
    }
    else if (error.message === "TIMEOUT_ERROR") {
        userMessage = isAr ? "استغرق الخادم وقتاً طويلاً. يرجى المحاولة مرة أخرى." : "Server timeout. Please try again.";
    }
    else if (error.message.includes("Server Error") || error.message.includes("Failed to fetch") || error.message.includes("Network")) {
         userMessage = isAr 
            ? "الإنترنت ضعيف أو غير مستقر. يرجى التحقق من الشبكة والمحاولة مرة أخرى."
            : "Unstable internet connection. Please check your network and try again.";
    }

    return {
      status: HalalStatus.NON_FOOD,
      reason: userMessage,
      ingredientsDetected: [],
      confidence: 0, 
    };
  }
};
