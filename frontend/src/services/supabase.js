import { createClient } from '@supabase/supabase-js'

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseUrl = configuredSupabaseUrl
	?.trim()
	.replace(/\/(?:rest\/v1|auth\/v1)\/?$/i, '')
	.replace(/\/+$/, '')

export const supabase = supabaseUrl && supabaseAnonKey
	? createClient(supabaseUrl, supabaseAnonKey, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: true,
		},
	})
	: null

export function requireSupabase() {
	if (!supabase) {
		throw new Error('Supabase email sign-in is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env.local.')
	}
	return supabase
}