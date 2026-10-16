const { createClient } = require('@supabase/supabase-js')

const configuredUrl = process.env.SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!configuredUrl || !secretKey) {
	throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be configured')
}

const supabaseUrl = configuredUrl
	.replace(/\/rest\/v1\/?$/, '')
	.replace(/\/+$/, '')

const authOptions = {
	auth: {
		autoRefreshToken: false,
		persistSession: false,
		detectSessionInUrl: false,
	},
}

const supabase = createClient(supabaseUrl, secretKey, authOptions)

function createSessionClient() {
	return createClient(supabaseUrl, secretKey, authOptions)
}

module.exports = supabase
module.exports.createSessionClient = createSessionClient
