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

// وظيفة ضغط الصور (تستخدم معالج الهاتف لتصغير الصورة قبل الإرسال)
const downscaleImageIfNeeded = (base64Str: string, maxWidth: number, maxHeight: number, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const width = img.width;
      const height = img.height;

      if (width <= maxWidth && height <= maxHeight) {
        // If dimensions are ok, just return. 
        // Note: We might want to re-compress if quality is strict, but keeping orig is faster if size OK.
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
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
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
        // --- ADAPTIVE COMPRESSION STRATEGY ---
        // Attempt 0: High Quality (1500px, 85%) - Good for OCR
        // Attempt 1: Medium Quality (1024px, 70%) - Faster, less data
        // Attempt 2: Low Quality (800px, 60%) - Last resort for bad connection
        
        let targetWidth = 1500;
        let targetQuality = 0.85;

        if (attempt === 1) {
            targetWidth = 1024;
            targetQuality = 0.7;
            console.log("Retry 1: Compressing images to 1024px/70%...");
        } else if (attempt === 2) {
            targetWidth = 800;
            targetQuality = 0.6;
            console.log("Retry 2: Aggressive compression to 800px/60%...");
        }

        // 1. Process images locally
        const processedImages = await Promise.all(base64Images.map(async (img) => {
            let processed = img;
            if (enableImageDownscaling || Capacitor.isNativePlatform() || attempt > 0) {
                processed = await downscaleImageIfNeeded(processed, targetWidth, targetWidth, targetQuality);
            }
            return processed.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");
        }));

        // 2. Send to Server
        const baseUrl = getBaseUrl();
        const endpoint = `${baseUrl}/api/analyze`;
        
        console.log(`Connecting to: ${endpoint} (Attempt ${attempt + 1})`);
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId || 'anonymous',
                'x-language': language
            },
            body: JSON.stringify({
                images: processedImages
            }),
            signal: signal
        });

        if (!response.ok) {
            // Handle specific HTTP errors that shouldn't be retried
            if (response.status === 403) {
                 const errData = await response.json().catch(() => ({}));
                 if (errData.error === 'LIMIT_REACHED') throw new Error("LIMIT_REACHED");
            }
            
            // If it's a server error (500) or timeout (504), we retry
            if (response.status >= 500) {
                throw new Error(`Server Error ${response.status}`);
            }
            
            // Client error (400) usually means bad payload, maybe too big? Retry with compression might help.
            throw new Error(`HTTP Error ${response.status}`);
        }

        const result = await response.json();
        return result as ScanResult;

    } catch (error: any) {
        if (error.name === 'AbortError') throw error;
        if (error.message === "LIMIT_REACHED") throw error;

        // Last attempt failed? Throw final error to UI
        if (attempt === MAX_RETRIES) {
             const isAr = language === 'ar';
             let userMessage = isAr ? "حدث خطأ غير متوقع." : "Unexpected error.";
            
             if (error.message.includes("NO_INTERNET") || !navigator.onLine) {
                 userMessage = isAr
                   ? "لا يوجد اتصال بالإنترنت. يرجى التحقق من الشبكة."
                   : "No internet connection. Please check your network.";
             } else if (error.message.includes("TIMEOUT_ERROR") || error.message.includes("504")) {
                 userMessage = isAr
                   ? "الخادم مشغول. حاول مرة أخرى أو قلل عدد الصور."
                   : "Server timeout. Try fewer images.";
             } else {
                 userMessage = isAr 
                    ? "تعذر الاتصال بالخادم. تأكد من الإنترنت." 
                    : "Connection failed. Check internet.";
             }

             return {
               status: HalalStatus.NON_FOOD,
               reason: userMessage,
               ingredientsDetected: [],
               confidence: 0, 
             };
        }
        
        // Wait before next retry
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

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId || 'anonymous',
            'x-language': language
        },
        body: JSON.stringify({ text: text }),
        signal
    });

    if (!response.ok) throw new Error(`Server Error: ${response.status}`);
    const result = await response.json();
    return result as ScanResult;

  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    
    const isAr = language === 'ar';
    let userMessage = isAr ? "تأكد من اتصال الإنترنت." : "Check internet connection.";
    
    if (!navigator.onLine) {
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