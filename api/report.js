
import { createClient } from '@supabase/supabase-js';

// Configuration from Env
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY; 

export default async function handler(request, response) {
  // CORS Setup
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
      return response.status(500).json({ error: 'Server DB Configuration Missing' });
  }

  try {
    const { userId, originalText, aiResult, userCorrection, userNotes } = request.body;
    
    // Initialize Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert Report
    const { data, error } = await supabase
      .from('reports')
      .insert([
        { 
          user_id: userId === 'anonymous' ? null : userId,
          original_text: originalText,
          ai_result: aiResult,
          user_correction: userCorrection,
          user_notes: userNotes
        }
      ]);

    if (error) {
       console.error("Supabase Error:", error);
       throw error;
    }

    return response.status(200).json({ success: true });

  } catch (error) {
    console.error("Reporting Error:", error);
    return response.status(500).json({ error: 'Failed to save report' });
  }
}
