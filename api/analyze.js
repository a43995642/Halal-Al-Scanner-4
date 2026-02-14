
// Vercel Serverless Function
// This runs on the server. The API Key is SAFE here.

import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from '@supabase/supabase-js';

// Configuration from Environment Variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
// Use SERVICE_ROLE_KEY for admin privileges (bypasses RLS to write scan counts safely)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

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
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-user-id, x-language'
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { images, text } = request.body;
    const userId = request.headers['x-user-id'];
    const language = request.headers['x-language'] || 'ar'; // Default to Arabic

    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error("Server missing API Key");
      return response.status(500).json({ 
        error: 'CONFIGURATION_ERROR', 
        message: 'Missing Google API Key in environment.' 
      });
    }

    // Check User Stats if Supabase is configured
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

    // Enhanced System Instructions for Gemini 3 Flash
    let systemInstruction = "";
    
    if (language === 'en') {
        systemInstruction = `
        You are an expert Islamic food auditor (OCR & Analysis).
        Output: JSON ONLY. No Markdown code blocks.
        Task:
        1. Extract ALL ingredient text visible in the images.
        2. Analyze each ingredient against Halal standards.
        3. Halal Rules:
           - HARAM: Pork, Lard, Alcohol/Ethanol, Carmine/Cochineal (E120), Shellac, L-Cysteine (human/hair source).
           - HALAL: Plant based, Water, Salt, Fish, Vegetables.
           - DOUBTFUL: Gelatin (unless specified Beef/Halal), E471, Whey/Rennet (unless specified microbial/vegetable), Glycerin (unless vegetable).
        4. If the image is NOT a food product or ingredients list, set status to 'NON_FOOD'.
        5. "ingredientsDetected": List ingredients VERBATIM (exact spelling/order as on label). Do not summarize.
        `;
    } else {
        systemInstruction = `
        أنت خبير تدقيق غذائي إسلامي ومختص في قراءة النصوص (OCR).
        المخرج: JSON فقط. لا تستخدم علامات Markdown.
        المهمة:
        1. استخراج جميع نصوص المكونات الظاهرة في الصور.
        2. تحليل كل مكون بناءً على معايير الحلال.
        3. قواعد الحلال:
           - حرام: خنزير، دهن خنزير (Lard)، كحول/إيثانول، كارمين/دودة القرمز (E120)، شيلات، سيستين (L-Cysteine).
           - حلال: نباتي، ماء، ملح، سمك، خضروات.
           - مشتبه به: جيلاتين (غير محدد المصدر)، E471، مصل اللبن/منفحة (غير نباتية)، جلسرين (غير نباتي).
        4. إذا لم تكن الصورة لمنتج غذائي، اجعل الحالة 'NON_FOOD'.
        5. قائمة "ingredientsDetected": انسخ المكونات حرفياً (نفس الإملاء والترتيب). لا تلخص النص.
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

    // Increment scan count if user is logged in and Supabase is active
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
