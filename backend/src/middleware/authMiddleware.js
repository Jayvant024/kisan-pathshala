const { createHash, createHmac, timingSafeEqual } = require('node:crypto')
const pool = require('../config/db')
const { getAllowedOrigins } = require('../config/allowedOrigins')

const SESSION_COOKIE = 'kp_session'

function readCookie(req, name) {
	const cookieHeader = req.headers.cookie || ''
	for (const part of cookieHeader.split(';')) {
		const separator = part.indexOf('=')
		if (separator < 0) continue
		if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim()
	}
	return null
}

function createAuthMiddleware({ db = pool } = {}) {
	const allowedOrigins = getAllowedOrigins()

	async function requireAuth(req, res, next) {
		const token = readCookie(req, SESSION_COOKIE)
		if (!token) return res.status(401).json({ success: false, message: 'Please sign in to continue' })
		try {
			const tokenHash = createHash('sha256').update(token).digest()
			const [rows] = await db.execute(
				`SELECT s.id AS session_id, s.csrf_token_hash,
					u.id, u.email, u.status, p.full_name, p.phone, p.avatar_url, p.preferred_language, p.role
				 FROM sessions s
				 JOIN users u ON u.id = s.user_id
				 LEFT JOIN profiles p ON p.id = u.id
				 WHERE s.token_hash = ? AND s.revoked_at IS NULL
					AND s.expires_at > CURRENT_TIMESTAMP(6) AND u.status = 'active'
				 LIMIT 1`,
				[tokenHash],
			)
			if (!rows[0]) return res.status(401).json({ success: false, message: 'Your session is invalid or has expired' })
			const row = rows[0]
			const csrfToken = createHmac('sha256', token)
				.update(`kisan-pathshala-csrf:${row.session_id}`)
				.digest('base64url')
			req.authSession = { id: row.session_id, csrfTokenHash: row.csrf_token_hash, csrfToken }
			req.authUser = {
				id: row.id,
				email: row.email,
				status: row.status,
				full_name: row.full_name,
				phone: row.phone,
				avatar_url: row.avatar_url,
				preferred_language: row.preferred_language,
				role: row.role || 'farmer',
			}
			return next()
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to verify your session right now' })
		}
	}

	function requireAdmin(req, res, next) {
		if (req.authUser?.role !== 'admin') {
			return res.status(403).json({ success: false, message: 'Administrator access is required' })
		}
		return next()
	}

	function requireCsrf(req, res, next) {
		const token = req.get('x-csrf-token') || ''
		if (!token || !Buffer.isBuffer(req.authSession?.csrfTokenHash)) {
			return res.status(403).json({ success: false, message: 'CSRF validation failed' })
		}
		const suppliedHash = createHash('sha256').update(token).digest()
		if (!timingSafeEqual(suppliedHash, req.authSession.csrfTokenHash)) {
			return res.status(403).json({ success: false, message: 'CSRF validation failed' })
		}
		return next()
	}

	function requireTrustedOrigin(req, res, next) {
		const origin = req.get('origin')
		if (!origin || !allowedOrigins.has(origin)) {
			return res.status(403).json({ success: false, message: 'Request origin is not allowed' })
		}
		return next()
	}

	return { requireAuth, requireAdmin, requireCsrf, requireTrustedOrigin }
}

const middleware = createAuthMiddleware()
module.exports = { ...middleware, createAuthMiddleware }