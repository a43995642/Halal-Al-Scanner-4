import { createClient } from '@supabase/supabase-js';

// Get Environment Variables
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Helper to validate URL structure to prevent createClient from throwing synchronous errors
const isValidUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Check if configuration is valid
export const isSupabaseConfigured = isValidUrl(envUrl) && !!envKey;

// Fallback to dummy values if keys are missing to prevent "supabaseUrl is required" crash
// This ensures the app boots up even if .env is missing (runs in Guest/Offline mode)
const supabaseUrl = isSupabaseConfigured ? envUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = envKey || 'placeholder-key';

if (!isSupabaseConfigured) {
  console.warn('⚠️ Supabase Keys are missing or invalid! App running in offline/demo mode. Auth features will be disabled.');
}

// Cast to any to avoid TypeScript errors with mismatching supabase-js versions
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Disable URL detection if using placeholder to prevent redirect loops or errors
    detectSessionInUrl: isSupabaseConfigured,
  }
}) as any;