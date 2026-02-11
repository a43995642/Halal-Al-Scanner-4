import { HalalStatus, ScanResult, Language } from "../types";
import { Capacitor } from '@capacitor/core';
import { checkLocalHaram } from "./haramKeywords";

// ⚠️ الرابط المباشر للخادم (للأندرويد)
const VERCEL_PROJECT_URL = 'https://halal-al-scanner-4.vercel.app'; 

const getBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    return VERCEL_PROJECT_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
     const host = window.location.hostname;
     if (host === 'localhost' || host.startsWith('192.168') || host.startsWith('10.')) {
        return VERCEL_PROJECT_URL.replace(/\/$/, '');
     }
  }
  return '';
};

// وظيفة انتظار
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const downscaleImageIfNeeded = (base64Str: string, maxWidth: number, maxHeight: number, quality = 0.85): Promise<string> => {
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
      if (!ctx) { resolve(base64Str); return; }
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

// ⚠️ Strict Timeout to prevent hanging
const fetchWithTimeout = async (resource: RequestInfo, options: RequestInit & { timeout?: number } = {}) => {
  const { timeout = 25000 } = options; // 25 seconds max
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  // If user provided a signal (e.g. from UI cancel), link it
  if (options.signal) {
     options.signal.addEventListener('abort', () => {
        clearTimeout(id);
        controller.abort();
     });
  }

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

export const analyzeImage = async (
  base64Images: string[], 
  userId?: string,
  _enhance: boolean = false,
  enableImageDownscaling: boolean = true,
  language: Language = 'ar',
  signal?: AbortSignal
): Promise<ScanResult> => {
  
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
        let targetWidth = 1500;
        let targetQuality = 0.85;

        if (attempt === 1) {
            targetWidth = 1024;
            targetQuality = 0.7;
        } else if (attempt === 2) {
            targetWidth = 800;
            targetQuality = 0.6;
        }

        const processedImages = await Promise.all(base64Images.map(async (img) => {
            let processed = img;
            if (enableImageDownscaling || Capacitor.isNativePlatform() || attempt > 0) {
                processed = await downscaleImageIfNeeded(processed, targetWidth, targetWidth, targetQuality);
            }
            return processed.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
        }));

        const baseUrl = getBaseUrl();
        const endpoint = `${baseUrl}/api/analyze`;
        
        // Use custom fetch with timeout
        const response = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId || 'anonymous',
                'x-language': language
            },
            body: JSON.stringify({
                images: processedImages
            }),
            signal: signal,
            timeout: attempt === 0 ? 20000 : 35000 // Increase timeout slightly on retries
        });

        if (!response.ok) {
            if (response.status === 403) {
                 const errData = await response.json().catch(() => ({}));
                 if (errData.error === 'LIMIT_REACHED') throw new Error("LIMIT_REACHED");
            }
            if (response.status >= 500) throw new Error(`Server Error ${response.status}`);
            throw new Error(`HTTP Error ${response.status}`);
        }

        const result = await response.json();
        return result as ScanResult;

    } catch (error: any) {
        if (error.name === 'AbortError') throw error; // User cancelled
        if (error.message === "LIMIT_REACHED") throw error;

        console.warn(`Attempt ${attempt} failed:`, error);

        if (attempt === MAX_RETRIES) {
             const isAr = language === 'ar';
             let userMessage = isAr ? "حدث خطأ غير متوقع." : "Unexpected error.";
            
             if (error.message.includes("NO_INTERNET") || !navigator.onLine) {
                 userMessage = isAr ? "لا يوجد اتصال بالإنترنت." : "No internet connection.";
             } else if (error.name === 'AbortError' || error.message.includes('aborted')) { // Handle timeout abort
                 userMessage = isAr ? "استغرق الخادم وقتاً طويلاً. حاول مرة أخرى." : "Server timed out. Try again.";
             } else {
                 userMessage = isAr ? "تعذر الاتصال بالخادم. تحقق من الإنترنت." : "Connection failed.";
             }

             return {
               status: HalalStatus.NON_FOOD,
               reason: userMessage,
               ingredientsDetected: [],
               confidence: 0, 
             };
        }
        await wait(1500 * (attempt + 1));
    }
  }
  throw new Error("Unexpected end of loop");
};

export const analyzeText = async (
  text: string, 
  userId?: string,
  language: Language = 'ar',
  signal?: AbortSignal
): Promise<ScanResult> => {
  const localResult = checkLocalHaram(text);
  if (localResult) {
    return {
      status: HalalStatus.HARAM,
      reason: language === 'ar' ? "تم اكتشاف مكونات محرمة في النص." : "Haram ingredients found in text.",
      ingredientsDetected: localResult.detected,
      confidence: 100
    };
  }

  try {
    const baseUrl = getBaseUrl();
    const endpoint = `${baseUrl}/api/analyze`;

    const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId || 'anonymous',
            'x-language': language
        },
        body: JSON.stringify({ text: text }),
        signal,
        timeout: 20000
    });

    if (!response.ok) throw new Error(`Server Error: ${response.status}`);
    const result = await response.json();
    return result as ScanResult;

  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    
    const isAr = language === 'ar';
    let userMessage = isAr ? "تأكد من اتصال الإنترنت." : "Check internet connection.";
    
    if (error.name === 'AbortError' || error.message.includes('aborted')) {
        userMessage = isAr ? "انتهت مهلة الاتصال." : "Request timed out.";
    }

    return {
      status: HalalStatus.NON_FOOD,
      reason: userMessage,
      ingredientsDetected: [],
      confidence: 0, 
    };
  }
};