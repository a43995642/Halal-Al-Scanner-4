
// Vercel Serverless Function
// This runs on the server. The API Key is SAFE here.

import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// Configuration from Environment Variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use SERVICE_ROLE_KEY for admin privileges (bypasses RLS to write scan counts safely)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// MINIMUM ALLOWED VERSION
// أي نسخة تطبيق لا ترسل هذا الإصدار أو أعلى سيتم رفضها فوراً
const MIN_APP_VERSION = "2.2.0";

// Initialize Supabase Admin Client
// We use a try-catch or safe init to prevent crash on module load if keys are missing
let supabase;
try {
    if (supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
    }
} catch (e) {
    console.error("Failed to init Supabase client:", e);
}

export default async function handler(request, response) {
  // 1. permissive CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-user-id, x-language, x-app-version, x-ingredient-language'
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // --- KILL SWITCH LOGIC ---
    // Check for App Version Header
    const appVersion = request.headers['x-app-version'];
    
    // إذا لم يرسل التطبيق رقم الإصدار (النسخ القديمة) أو كان الإصدار قديماً
    if (!appVersion || appVersion < MIN_APP_VERSION) {
        return response.status(426).json({ 
            error: 'UPDATE_REQUIRED', 
            message: 'هذه النسخة من التطبيق قديمة وتوقفت عن العمل. يرجى تحديث التطبيق أو التواصل مع المطور.',
            reason: 'Deprecated API Version'
        });
    }
    // -------------------------

    const { images, text } = request.body;
    const userId = request.headers['x-user-id'];
    const language = request.headers['x-language'] || 'ar'; // Default to Arabic
    const ingredientMode = request.headers['x-ingredient-language'] || 'app'; // 'app' (translated) or 'original'
    
    // Commercial Mode: Use Developer Key Only
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error("Server missing API Key");
      return response.status(500).json({ 
        error: 'CONFIGURATION_ERROR', 
        message: 'Missing Google API Key in environment.' 
      });
    }

    // Check User Stats
    // Always check quota since custom keys are no longer allowed
    if (userId && userId !== 'anonymous' && supabase) {
        try {
            const { data: userStats, error: dbError } = await supabase
              .from('user_stats')
              .select('scan_count, is_premium')
              .eq('id', userId)
              .single();
            
            let currentCount = 0;
            let isPremium = false;

            if (userStats) {
                currentCount = userStats.scan_count;
                isPremium = userStats.is_premium;
            } 
            
            if (!isPremium && currentCount >= 20 && !dbError) {
                 return response.status(403).json({ error: 'LIMIT_REACHED', message: 'Upgrade required' });
            }
        } catch (dbEx) {
            console.warn("Database check failed, proceeding:", dbEx);
        }
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Determine Translation Instruction based on preference
    let translationInstruction = "";
    if (ingredientMode === 'original') {
        translationInstruction = "EXTRACT INGREDIENT NAMES EXACTLY AS THEY APPEAR ON THE PACKAGE. DO NOT TRANSLATE THEM. If multiple languages are present, prefer English, but keep raw spelling.";
    } else {
        // Translate to App Language
        if (language === 'ar') {
            translationInstruction = "TRANSLATE ALL INGREDIENT NAMES TO ARABIC.";
        } else {
            translationInstruction = "TRANSLATE ALL INGREDIENT NAMES TO ENGLISH.";
        }
    }

    // Enhanced System Instructions for Robust Error Handling
    let systemInstruction = "";
    
    if (language === 'en') {
        systemInstruction = `
        You are an expert Islamic food auditor (OCR & Analysis).
        
        **CRITICAL: PRE-ANALYSIS IMAGE CHECKS**
        Before analyzing ingredients, check the image quality. If any of the following are true, STOP and return the specific status/reason immediately.
        
        1. **Blurry/Unreadable**: If text is too blurry to extract confidently.
           -> Status: "DOUBTFUL", Reason: "The image is blurry. Please hold the camera steady and try again."
        2. **Too Dark/Glare**: If lighting obscures the text.
           -> Status: "DOUBTFUL", Reason: "Lighting is poor or there is glare on the text. Please adjust lighting."
        3. **Cut-off Text**: If the ingredients list is cut off or incomplete.
           -> Status: "DOUBTFUL", Reason: "The ingredients list seems cut off. Please capture the full list."
        4. **Not Food/Ingredients**: If the image is a person, car, scenery, or a random object with no food context.
           -> Status: "NON_FOOD", Reason: "This does not look like a food product or ingredients list."
        5. **No Text Found**: If the image is clear but contains no readable text.
           -> Status: "DOUBTFUL", Reason: "No readable text found. Please ensure the ingredients are visible."

        **ONLY IF IMAGE IS CLEAR:**
        1. Extract ALL ingredient text.
        2. ${translationInstruction}
        3. Analyze against Halal standards.
        4. Rules:
           - HARAM: Pork, Lard, Alcohol/Ethanol, Carmine/E120, Shellac, L-Cysteine (human/hair).
           - HALAL: Plant-based, Water, Salt, Fish, Vegetables.
           - DOUBTFUL: Gelatin (unspecified), E471, Whey/Rennet (unspecified), Glycerin (unspecified).
        
        Output: JSON ONLY. No Markdown.
        "ingredientsDetected": List ingredients based on the translation instruction.
        `;
    } else {
        systemInstruction = `
        أنت خبير تدقيق غذائي إسلامي ومختص في قراءة النصوص (OCR).

        **هام جداً: فحص جودة الصورة أولاً**
        قبل تحليل المكونات، افحص الصورة. إذا وجدت أي مشكلة، توقف وأرجع الحالة والسبب فوراً:

        1. **صورة غير واضحة (Blurry)**: إذا كان النص مشوشاً جداً.
           -> الحالة: "DOUBTFUL"، السبب: "الصورة غير واضحة. يرجى تثبيت اليد والمحاولة مرة أخرى."
        2. **إضاءة سيئة/انعكاس (Glare)**: إذا كان هناك انعكاس ضوء يحجب النص.
           -> الحالة: "DOUBTFUL"، السبب: "الإضاءة قوية جداً أو هناك انعكاس يحجب النص. يرجى تعديل الزاوية."
        3. **نص مقطوع**: إذا كانت قائمة المكونات غير كاملة.
           -> الحالة: "DOUBTFUL"، السبب: "قائمة المكونات مقطوعة. يرجى تصوير القائمة كاملة."
        4. **ليس طعاماً**: إذا كانت الصورة لشخص، سيارة، أو منظر طبيعي.
           -> الحالة: "NON_FOOD"، السبب: "لا يبدو أن هذه الصورة لمنتج غذائي."
        5. **لا يوجد نص**: إذا كانت الصورة واضحة ولكن لا تحتوي على نص.
           -> الحالة: "DOUBTFUL"، السبب: "لم يتم العثور على نص مقروء. تأكد من ظهور المكونات."

        **فقط إذا كانت الصورة واضحة:**
        1. استخرج جميع المكونات.
        2. ${translationInstruction}
        3. حللها حسب معايير الحلال.
        4. القواعد:
           - حرام: خنزير، دهن خنزير، كحول، كارمين (E120)، شيلات، سيستين (شعر).
           - حلال: نباتي، ماء، سمك.
           - مشتبه: جيلاتين (غير محدد)، E471، مصل لبن/منفحة (غير نباتي).

        المخرج: JSON فقط.
        `;
    }

    const parts = [];

    if (images && Array.isArray(images) && images.length > 0) {
        images.forEach(img => {
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: img
                }
            });
        });
    }

    if (text) {
        parts.push({ text: `Analysis Request: Please evaluate this ingredient list: \n${text}` });
    }

    // Explicitly request JSON structure in the prompt as well to reinforce the schema
    parts.push({ text: "Return valid JSON object strictly matching the schema. No markdown." });

    if (parts.length <= 1) { 
         return response.status(400).json({ error: 'No content provided' });
    }

    const modelResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: parts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
             type: Type.OBJECT,
             properties: {
               status: { type: Type.STRING, enum: ["HALAL", "HARAM", "DOUBTFUL", "NON_FOOD"] },
               reason: { type: Type.STRING },
               ingredientsDetected: { 
                 type: Type.ARRAY, 
                 items: { 
                    type: Type.OBJECT, 
                    properties: { 
                        name: {type: Type.STRING}, 
                        status: {type: Type.STRING, enum: ["HALAL", "HARAM", "DOUBTFUL", "UNKNOWN"]} 
                    }
                 } 
               },
               confidence: { type: Type.INTEGER }
             }
        }
      },
    });

    if (!modelResponse || !modelResponse.text) {
        throw new Error("Empty response from AI");
    }

    let result;
    try {
        // Double cleanup just in case Gemini sends markdown despite instructions
        const cleanText = modelResponse.text.replace(/```json/g, '').replace(/```/g, '').trim();
        result = JSON.parse(cleanText);
    } catch (e) {
        console.warn("Failed to parse AI response:", modelResponse.text);
        // Fallback result instead of 500 error
        result = { 
            status: "DOUBTFUL", 
            reason: language === 'ar' ? "حدث خطأ في قراءة الاستجابة. يرجى المحاولة مرة أخرى." : "Error parsing AI response. Please try again.", 
            ingredientsDetected: [], 
            confidence: 0 
        };
    }

    // Increment scan count 
    if (userId && userId !== 'anonymous' && supabase) {
       try {
           await supabase.rpc('increment_scan_count', { row_id: userId });
       } catch (statsErr) {
           console.error("Failed to update stats", statsErr);
       }
    }

    return response.status(200).json(result);

  } catch (error) {
    console.error("Backend Error:", error);
    return response.status(500).json({ 
        error: 'Internal Server Error', 
        details: error.message
    });
  }
}
