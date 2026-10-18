const DEFAULT_FRONTEND_ORIGINS = [
	'https://kisan-pathshala.vercel.app',
	'http://localhost:5173',
	'http://localhost:5174',
	'http://127.0.0.1:5173',
	'http://127.0.0.1:5174',
]

function getAllowedOrigins() {
	return new Set([
		process.env.FRONTEND_URL,
		...DEFAULT_FRONTEND_ORIGINS,
	].filter(Boolean))
}

module.exports = { getAllowedOrigins }