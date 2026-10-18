const DEFAULT_FRONTEND_ORIGINS = [
	'https://kisan-pathshala.vercel.app',
	'http://localhost:5173',
	'http://localhost:5174',
	'http://127.0.0.1:5173',
	'http://127.0.0.1:5174',
]

function normalizeOrigin(value) {
	if (typeof value !== 'string') return null
	try {
		const url = new URL(value.trim())
		if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
		return url.origin
	} catch {
		return null
	}
}

function getAllowedOrigins() {
	return new Set([
		...DEFAULT_FRONTEND_ORIGINS,
		normalizeOrigin(process.env.FRONTEND_URL),
	].filter(Boolean))
}

module.exports = { getAllowedOrigins, normalizeOrigin }