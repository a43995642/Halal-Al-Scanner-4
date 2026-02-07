
import { createClient } from '@supabase/supabase-js';

// Get Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase Keys are missing! Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in Vercel or .env');
}

// Cast to any to avoid TypeScript errors with mismatching supabase-js versions
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
}) as any;
