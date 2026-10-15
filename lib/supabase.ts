import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client-side supabase client (for use in components, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side supabase client with service role (for use in API routes, etc.)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)