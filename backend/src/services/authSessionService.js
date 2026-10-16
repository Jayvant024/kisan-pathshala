const { createHash, createHmac, randomBytes, randomUUID } = require('node:crypto')

const SESSION_DAYS = 7
const SESSION_COOKIE = 'kp_session'

function hashToken(token) {
	return createHash('sha256').update(token).digest()
}

function sessionCsrfToken(sessionToken, sessionId) {
	return createHmac('sha256', sessionToken).update(`kisan-pathshala-csrf:${sessionId}`).digest('base64url')
}

function sessionCookie(token, maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60) {
	const parts = [
		`${SESSION_COOKIE}=${token}`,
		'Path=/',
		`Max-Age=${maxAgeSeconds}`,
		'HttpOnly',
		'SameSite=Lax',
	]
	if (process.env.NODE_ENV === 'production') parts.push('Secure')
	return parts.join('; ')
}

function clearSessionCookie() {
	const parts = [
		`${SESSION_COOKIE}=`,
		'Path=/',
		'Max-Age=0',
		'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
		'HttpOnly',
		'SameSite=Lax',
	]
	if (process.env.NODE_ENV === 'production') parts.push('Secure')
	return parts.join('; ')
}

async function createSession(connection, userId, req) {
	const token = randomBytes(32).toString('base64url')
	const sessionId = randomUUID()
	const csrfToken = sessionCsrfToken(token, sessionId)
	await connection.execute(
		`INSERT INTO sessions
			(id, user_id, token_hash, csrf_token_hash, expires_at, user_agent)
		 VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP(6), INTERVAL ${SESSION_DAYS} DAY), ?)`,
		[sessionId, userId, hashToken(token), hashToken(csrfToken), req.get('user-agent')?.slice(0, 512) || null],
	)
	return { token, csrfToken }
}

module.exports = {
	SESSION_COOKIE,
	SESSION_DAYS,
	clearSessionCookie,
	createSession,
	hashToken,
	sessionCookie,
	sessionCsrfToken,
}