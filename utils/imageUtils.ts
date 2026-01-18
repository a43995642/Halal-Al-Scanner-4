
// 1. AI PIPELINE (Aggressive OCR Optimization)
// This generates the "ugly" but machine-readable version.
export const createAIOptimizedImage = (base64Str: string, maxWidth = 2000, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // High Res for AI (Keep it as large as reasonable)
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // --- THE AI "MAGIC SAUCE" FILTER ---
        // 1. grayscale(100%): Removes color noise (chromatic aberration) which confuses OCR.
        // 2. contrast(1.5): Aggressively pulls text from background (makes darks darker, lights lighter).
        // 3. brightness(1.1): Compensates for the darkening effect of high contrast.
        // 4. saturate(0): Redundant with grayscale, but ensures no color artifacts.
        ctx.filter = 'grayscale(100%) contrast(1.5) brightness(1.1)';
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Return High Quality JPEG for the AI
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

// 2. USER PIPELINE (Aesthetic Optimization - Optional)
// This ensures the thumbnails looking nice. Currently, passing through RAW is best for speed.
export const optimizeImageForDisplay = (base64Str: string): Promise<string> => {
   // We can add slight compression here for memory management if needed, 
   // but for now, we return raw to keep it snappy.
   return Promise.resolve(base64Str);
};
