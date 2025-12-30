import { createClient } from '@supabase/supabase-js';

// Configuration
// We use the provided Project URL as a fallback to ensure connection works immediately.
const PROJECT_URL = 'https://lrnvtsnacrmnnsitdubz.supabase.co';

// The Anon Key provided by the user
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxybnZ0c25hY3Jtbm5zaXRkdWJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwODYyMTgsImV4cCI6MjA4MDY2MjIxOH0.BUdC_qXw5iPDnObA5SGAHgOfydzxSP2xro618o6wn0g';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || PROJECT_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

if (!supabaseAnonKey) {
  console.warn('⚠️ Supabase Anon Key is missing. Check your .env file.');
}

// Cast to any to avoid TypeScript errors with mismatching supabase-js versions
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
}) as any;