import { HalalStatus, ScanResult, Language } from "../types";
import { Capacitor } from '@capacitor/core';
import { checkLocalHaram } from "./haramKeywords";

// ⚠️ الرابط المباشر للخادم (للأندرويد)
const VERCEL_PROJECT_URL = 'https://halal-al-scanner-4.vercel.app'; 

const getBaseUrl = () => {
  // 1. إذا كان التطبيق يعمل على الأندرويد، استخدم رابط السيرفر فوراً
  if (Capacitor.isNativePlatform()) {
    return VERCEL_PROJECT_URL.replace(/\/$/, '');
  }

  // 2. إذا كنا في وضع التطوير المحلي، استخدم الرابط أيضاً لتجنب أخطاء البروكسي
  if (typeof window !== 'undefined') {
     const host = window.location.hostname;
     if (host === 'localhost' || host.startsWith('192.168') || host.startsWith('10.')) {
        console.log("Local Dev detected: Using remote API");
        return VERCEL_PROJECT_URL.replace(/\/$/, '');
     }
  }

  // 3. إذا كان موقع ويب عادي، استخدم المسار النسبي
  return '';
};

// وظيفة انتظار (لإعادة المحاولة)
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// وظيفة ذكية للاتصال بالإنترنت مع إعادة المحاولة في حال ضعف الشبكة
const fetchWithRetry = async (url: string, options: RequestInit, signal?: AbortSignal, retries = 2) => {
  // Network Check
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
     throw new Error("NO_INTERNET");
  }

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, { ...options, signal });
      if (response.ok) return response;

      // إعادة المحاولة في حالة أخطاء السيرفر (50x)
      if ([502, 503, 504].includes(response.status)) {
         if (i < retries) {
             await wait(1500 * (i + 1)); 
             continue;
         }
      }
      return response;

    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      
      // إعادة المحاولة في حالة انقطاع النت
      if (i < retries && (err.message.includes('Failed to fetch') || err.message.includes('Network'))) {
         console.log(`Network retry ${i + 1}...`);
         await wait(2000 * (i + 1));
         continue;
      }
      if (i === retries) throw err;
    }
  }
  throw new Error("FAILED_AFTER_RETRIES");
};

// وظيفة ضغط الصور (تستخدم معالج الهاتف لتصغير الصورة قبل الإرسال)
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
      // ضغط الجودة إلى 85% لتقليل استهلاك البيانات
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
    // 1. معالجة الصور داخل الهاتف (Native Optimization)
    const processedImages = await Promise.all(base64Images.map(async (img) => {
      let processed = img;
      // دائماً قم بضغط الصور على الموبايل
      if (enableImageDownscaling || Capacitor.isNativePlatform()) {
        processed = await downscaleImageIfNeeded(processed, 1500, 1500);
      }
      return processed.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
    }));

    // 2. الإرسال للسيرفر
    const baseUrl = getBaseUrl();
    const endpoint = `${baseUrl}/api/analyze`;
    
    console.log("Connecting to:", endpoint);
    
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
    }, signal, 2); 

    if (!response.ok) {
        if (response.status === 504) throw new Error("TIMEOUT_ERROR");
        let errorMessage = `Server Error: ${response.status}`;
        try {
            const errData = await response.json();
            if (response.status === 403 && errData.error === 'LIMIT_REACHED') throw new Error("LIMIT_REACHED"); 
            if (errData.error || errData.message) errorMessage = errData.message || errData.error;
        } catch (e) {}
        throw new Error(errorMessage);
    }

    const result = await response.json();
    return result as ScanResult;

  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    if (error.message === "LIMIT_REACHED") throw error;
    
    const isAr = language === 'ar';
    let userMessage = isAr ? "حدث خطأ غير متوقع." : "Unexpected error.";
    
    if (error.message === "NO_INTERNET") {
        userMessage = isAr
          ? "لا يوجد اتصال بالإنترنت. يرجى التحقق من الشبكة."
          : "No internet connection. Please check your network.";
    }
    else if (error.message === "TIMEOUT_ERROR") {
        userMessage = isAr
          ? "الخادم مشغول. حاول مرة أخرى أو قلل عدد الصور."
          : "Server timeout. Try fewer images.";
    }
    else if (error.message.includes("Failed to fetch") || error.message.includes("Network")) {
        userMessage = isAr
          ? "تأكد من اتصال الإنترنت وحاول مجدداً."
          : "Check your internet connection.";
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

    const response = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId || 'anonymous',
            'x-language': language
        },
        body: JSON.stringify({ text: text })
    }, signal, 2);

    if (!response.ok) throw new Error(`Server Error: ${response.status}`);
    const result = await response.json();
    return result as ScanResult;

  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    
    const isAr = language === 'ar';
    let userMessage = isAr ? "تأكد من اتصال الإنترنت." : "Check internet connection.";
    
    if (error.message === "NO_INTERNET") {
        userMessage = isAr ? "لا يوجد اتصال بالإنترنت." : "No internet connection.";
    }

    return {
      status: HalalStatus.NON_FOOD,
      reason: userMessage,
      ingredientsDetected: [],
      confidence: 0, 
    };
  }
};