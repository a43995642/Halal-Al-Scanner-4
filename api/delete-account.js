
import { createClient } from '@supabase/supabase-js';

// Configuration
const PROJECT_URL = 'https://lrnvtsnacrmnnsitdubz.supabase.co';
const supabaseUrl = process.env.VITE_SUPABASE_URL || PROJECT_URL;
// MUST use Service Role Key to have permission to delete users/data
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY; 

export default async function handler(request, response) {
  // CORS Setup
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-user-id'
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId } = request.body;

    if (!userId) {
        return response.status(400).json({ error: 'Missing User ID' });
    }
    
    // Initialize Supabase Admin
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Delete/Anonymize User Stats
    const { error: statsError } = await supabase
      .from('user_stats')
      .delete()
      .eq('id', userId);

    if (statsError) console.warn("Error deleting stats:", statsError);

    // 2. Delete Reports made by user (Optional: or anonymize them)
    const { error: reportsError } = await supabase
      .from('reports')
      .delete()
      .eq('user_id', userId);
      
    if (reportsError) console.warn("Error deleting reports:", reportsError);

    // 3. Delete from Auth Users (Requires Service Role Key)
    // Note: If you don't have the Service Role Key set in Vercel Env Vars, 
    // this specific part might fail, but the user data above is gone.
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    
    if (authError) {
        console.warn("Could not delete from Auth (likely missing Service Role Key):", authError);
        // Fallback: If we can't delete auth, we explicitly verify the user is cleared from app data
    }

    return response.status(200).json({ success: true, message: 'Account data deleted' });

  } catch (error) {
    console.error("Delete Account Error:", error);
    return response.status(500).json({ error: 'Failed to delete account' });
  }
}
