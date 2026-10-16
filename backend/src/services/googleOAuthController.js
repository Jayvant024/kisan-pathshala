const { createHash, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto')
const { OAuth2Client } = require('google-auth-library')
const pool = require('../config/db')
const { createSession, hashToken, sessionCookie } = require('./authSessionService')

const OAUTH_STATE_COOKIE = 'kp_google_state'
const OAUTH_STATE_SECONDS = 600

function readCookie(req, name) {
	for (const item of (req.headers.cookie || '').split(';')) {
		const separator = item.indexOf('=')
		if (separator >= 0 && item.slice(0, separator).trim() === name) return item.slice(separator + 1).trim()
	}
	return null
}

function secureEqual(left, right) {
	if (typeof left !== 'string' || typeof right !== 'string') return false
	const leftBuffer = Buffer.from(left)
	const rightBuffer = Buffer.from(right)
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function stateCookie(state, maxAge = OAUTH_STATE_SECONDS) {
	const parts = [
		`${OAUTH_STATE_COOKIE}=${state}`,
		'Path=/api/auth/google',
		`Max-Age=${maxAge}`,
		'HttpOnly',
		'SameSite=Lax',
	]
	if (process.env.NODE_ENV === 'production') parts.push('Secure')
	return parts.join('; ')
}

function oauthStateCookieClear() {
	const parts = [
		`${OAUTH_STATE_COOKIE}=`,
		'Path=/api/auth/google',
		'Max-Age=0',
		'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
		'HttpOnly',
		'SameSite=Lax',
	]
	if (process.env.NODE_ENV === 'production') parts.push('Secure')
	return parts.join('; ')
}

function createGoogleOAuthController({
	db = pool,
	oauthClient,
	clientId = process.env.GOOGLE_CLIENT_ID,
	clientSecret = process.env.GOOGLE_CLIENT_SECRET,
	redirectUri = process.env.GOOGLE_REDIRECT_URI,
	frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173',
} = {}) {
	let cachedClient = oauthClient
	function getClient() {
		if (!clientId || !clientSecret || !redirectUri) return null
		cachedClient ||= new OAuth2Client(clientId, clientSecret, redirectUri)
		return cachedClient
	}

	function frontendRedirect(path, result) {
		const target = new URL(path, frontendUrl)
		if (result) target.searchParams.set('oauth', result)
		return target.toString()
	}

	function finishFailure(res, result = 'google_failed') {
		res.setHeader('Set-Cookie', oauthStateCookieClear())
		return res.redirect(303, frontendRedirect('/login', result))
	}

	async function start(req, res) {
		const client = getClient()
		if (!client) return res.status(503).json({ success: false, message: 'Google sign-in is not configured' })
		let connection
		try {
			const state = randomBytes(32).toString('base64url')
			const nonce = randomBytes(32).toString('base64url')
			const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync()
			connection = await db.getConnection()
			await connection.execute(
				'DELETE FROM oauth_states WHERE expires_at <= CURRENT_TIMESTAMP(6)',
			)
			await connection.execute(
				`INSERT INTO oauth_states (state_hash, nonce_hash, code_verifier, expires_at)
				 VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP(6), INTERVAL 10 MINUTE))`,
				[hashToken(state), hashToken(nonce), codeVerifier],
			)
			const authorizationUrl = client.generateAuthUrl({
				response_type: 'code',
				redirect_uri: redirectUri,
				access_type: 'online',
				prompt: 'select_account',
				scope: ['openid', 'email', 'profile'],
				state,
				nonce,
				code_challenge: codeChallenge,
				code_challenge_method: 'S256',
			})
			res.setHeader('Set-Cookie', stateCookie(state))
			return res.redirect(302, authorizationUrl)
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to start Google sign-in' })
		} finally {
			connection?.release()
		}
	}

	async function consumeState(state, stateCookieValue) {
		if (!secureEqual(state, stateCookieValue)) return null
		const stateHash = hashToken(state)
		const connection = await db.getConnection()
		try {
			await connection.beginTransaction()
			const [rows] = await connection.execute(
				`SELECT nonce_hash, code_verifier FROM oauth_states
				 WHERE state_hash = ? AND expires_at > CURRENT_TIMESTAMP(6)
				 FOR UPDATE`,
				[stateHash],
			)
			if (!rows[0]) {
				await connection.rollback()
				return null
			}
			const [result] = await connection.execute(
				`DELETE FROM oauth_states
				 WHERE state_hash = ? AND expires_at > CURRENT_TIMESTAMP(6)`,
				[stateHash],
			)
			if (result.affectedRows !== 1) {
				await connection.rollback()
				return null
			}
			await connection.commit()
			return rows[0]
		} catch (error) {
			await connection.rollback().catch(() => {})
			throw error
		} finally {
			connection.release()
		}
	}

	function validateGoogleClaims(payload, nonceHash) {
		const audienceMatches = Array.isArray(payload?.aud)
			? payload.aud.includes(clientId)
			: payload?.aud === clientId
		const now = Math.floor(Date.now() / 1000)
		if (!payload || !['https://accounts.google.com', 'accounts.google.com'].includes(payload.iss)
			|| !audienceMatches || (Array.isArray(payload.aud) && payload.azp !== clientId)
			|| !Number.isFinite(payload.exp) || payload.exp <= now
			|| payload.email_verified !== true || typeof payload.sub !== 'string' || !payload.sub
			|| typeof payload.email !== 'string' || payload.email.length > 254
			|| typeof payload.nonce !== 'string' || !timingSafeEqual(hashToken(payload.nonce), nonceHash)) {
			throw new Error('Invalid Google identity token')
		}
		return {
			subject: payload.sub,
			email: payload.email.trim().toLowerCase(),
			fullName: String(payload.name || payload.email).trim().slice(0, 255),
			avatarUrl: (() => {
				try {
					const picture = new URL(payload.picture)
					return picture.protocol === 'https:' && (picture.hostname === 'googleusercontent.com' || picture.hostname.endsWith('.googleusercontent.com'))
						? picture.toString().slice(0, 1024)
						: null
				} catch {
					return null
				}
			})(),
		}
	}

	async function callback(req, res) {
		const state = typeof req.query.state === 'string' ? req.query.state : ''
		const stateCookieValue = readCookie(req, OAUTH_STATE_COOKIE)
		if (!state || !stateCookieValue) return finishFailure(res, 'google_failed')

		let oauthState
		try {
			oauthState = await consumeState(state, stateCookieValue)
		} catch {
			return finishFailure(res, 'google_failed')
		}
		if (!oauthState) return finishFailure(res, 'google_failed')
		if (req.query.error) return finishFailure(res, 'google_cancelled')

		const client = getClient()
		const code = typeof req.query.code === 'string' ? req.query.code : ''
		if (!client || !code) return finishFailure(res, 'google_failed')

		let connection
		try {
			const { tokens } = await client.getToken({ code, codeVerifier: oauthState.code_verifier, redirect_uri: redirectUri })
			if (!tokens.id_token) return finishFailure(res, 'google_failed')
			const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId })
			const identity = validateGoogleClaims(ticket.getPayload(), oauthState.nonce_hash)

			connection = await db.getConnection()
			await connection.beginTransaction()
			const [linkedRows] = await connection.execute(
				`SELECT u.id, u.email, u.status, p.full_name, p.phone, p.preferred_language, p.role
				 FROM oauth_identities oi
				 JOIN users u ON u.id = oi.user_id
				 LEFT JOIN profiles p ON p.id = u.id
				 WHERE oi.provider = 'google' AND oi.provider_subject = ? LIMIT 1 FOR UPDATE`,
				[identity.subject],
			)

			let user = linkedRows[0]
			if (!user) {
				const [emailRows] = await connection.execute(
					'SELECT id FROM users WHERE email = ? LIMIT 1 FOR UPDATE',
					[identity.email],
				)
				if (emailRows[0]) {
					await connection.rollback()
					return finishFailure(res, 'account_exists')
				}
				const userId = randomUUID()
				await connection.execute(
					`INSERT INTO users (id, email, password_hash, email_verified_at, status)
					 VALUES (?, ?, NULL, CURRENT_TIMESTAMP(6), 'active')`,
					[userId, identity.email],
				)
				await connection.execute(
					'INSERT INTO profiles (id, full_name, phone, avatar_url) VALUES (?, ?, NULL, ?)',
					[userId, identity.fullName, identity.avatarUrl],
				)
				await connection.execute(
					`INSERT INTO oauth_identities
						(id, user_id, provider, provider_subject, provider_email, provider_email_verified)
					 VALUES (?, ?, 'google', ?, ?, TRUE)`,
					[randomUUID(), userId, identity.subject, identity.email],
				)
				user = {
					id: userId,
					email: identity.email,
					status: 'active',
					full_name: identity.fullName,
					phone: null,
					avatar_url: identity.avatarUrl,
					preferred_language: 'en',
					role: 'farmer',
				}
			} else {
				if (user.status !== 'active') {
					await connection.rollback()
					return finishFailure(res, 'google_failed')
				}
				await connection.execute(
					`UPDATE oauth_identities SET provider_email = ?, provider_email_verified = TRUE
					 WHERE provider = 'google' AND provider_subject = ?`,
					[identity.email, identity.subject],
				)
				if (identity.avatarUrl) {
					await connection.execute('UPDATE profiles SET avatar_url = ? WHERE id = ?', [identity.avatarUrl, user.id])
				}
			}

			await connection.execute('UPDATE users SET last_login_at = CURRENT_TIMESTAMP(6) WHERE id = ?', [user.id])
			const { token } = await createSession(connection, user.id, req)
			await connection.commit()
			res.setHeader('Set-Cookie', [sessionCookie(token), oauthStateCookieClear()])
			return res.redirect(303, frontendRedirect('/auth/callback'))
		} catch (error) {
			if (connection) await connection.rollback().catch(() => {})
			if (error.code === 'ER_DUP_ENTRY') return finishFailure(res, 'account_exists')
			return finishFailure(res, 'google_failed')
		} finally {
			connection?.release()
		}
	}

	return { start, callback }
}

module.exports = { createGoogleOAuthController }