
import { createClient } from '@supabase/supabase-js';

// Configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(request, response) {
  // 1. Dynamic CORS
  const origin = request.headers.origin;
  
  if (origin && (
      origin.includes('localhost') || 
      origin.includes('capacitor://') || 
      origin.includes('.vercel.app')
  )) {
    response.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // UPDATED to scanner-4
    response.setHeader('Access-Control-Allow-Origin', 'https://halal-al-scanner-4.vercel.app');
  }

  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return response.status(500).json({ error: 'Server Misconfiguration: Missing Service Key' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { userId, plan } = request.body;

    if (!userId) {
      return response.status(400).json({ error: 'Missing userId' });
    }

    const { data, error } = await supabase
      .from('user_stats')
      .upsert({ 
        id: userId, 
        is_premium: true,
      }, { onConflict: 'id' })
      .select();

    if (error) throw error;

    return response.status(200).json({ success: true, message: 'Upgraded successfully', data });

  } catch (error) {
    console.error("Subscription Error:", error);
    return response.status(500).json({ error: 'Upgrade Failed', details: error.message });
  }
}
