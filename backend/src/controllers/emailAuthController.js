const { randomUUID } = require('node:crypto')
const bcrypt = require('bcryptjs')
const pool = require('../config/db')
const { clearSessionCookie, createSession, sessionCookie, SESSION_DAYS } = require('../services/authSessionService')
const BCRYPT_ROUNDS = 12

function safeErrorMessage(error) {
	return String(error?.message || 'Unknown error')
		.replace(/\b(password|passwd|token|secret|api[-_ ]?key)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;)]*)/gi, '$1$2[redacted]')
		.slice(0, 500)
}

function validateRegistration(body) {
	const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : ''
	const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : ''
	const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
	const password = typeof body.password === 'string' ? body.password : ''
	const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''
	const phone = typeof body.phone === 'string' && body.phone.trim() ? body.phone.trim() : null
	if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80) {
		throw Object.assign(new Error('Enter your first and last name'), { status: 400 })
	}
	if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw Object.assign(new Error('Enter a valid email address'), { status: 400 })
	}
	if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
		throw Object.assign(new Error('Password must be at least 8 characters and no more than 72 bytes'), { status: 400 })
	}
	if (password !== confirmPassword) {
		throw Object.assign(new Error('Passwords do not match'), { status: 400 })
	}
	if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) {
		throw Object.assign(new Error('Enter a valid contact number'), { status: 400 })
	}
	return { firstName, lastName, email, password, phone }
}

function publicUser(row) {
	return {
		id: row.id,
		email: row.email,
		full_name: row.full_name || row.email,
		phone: row.phone ?? null,
		avatar_url: row.avatar_url ?? null,
		preferred_language: row.preferred_language || 'en',
		role: row.role || 'farmer',
	}
}

function createAuthController({ db = pool, passwordHasher = bcrypt, logger = console } = {}) {
	async function register(req, res) {
		let connection
		let stage = 'validate registration'
		try {
			const { firstName, lastName, email, password, phone } = validateRegistration(req.body || {})
			stage = 'hash password'
			const passwordHash = await passwordHasher.hash(password, BCRYPT_ROUNDS)
			stage = 'acquire database connection'
			connection = await db.getConnection()
			stage = 'begin transaction'
			await connection.beginTransaction()
			const userId = randomUUID()
			stage = 'insert user'
			await connection.execute(
				`INSERT INTO users (id, email, password_hash, status) VALUES (?, ?, ?, 'active')`,
				[userId, email, passwordHash],
			)
			const fullName = `${firstName} ${lastName}`
			stage = 'insert profile'
			await connection.execute(
				'INSERT INTO profiles (id, full_name, phone) VALUES (?, ?, ?)',
				[userId, fullName, phone],
			)
			stage = 'create database session'
			const { token, csrfToken } = await createSession(connection, userId, req)
			stage = 'commit transaction'
			await connection.commit()
			stage = 'set session cookie'
			res.setHeader('Set-Cookie', sessionCookie(token, SESSION_DAYS * 24 * 60 * 60))
			return res.status(201).json({
				success: true,
				user: { id: userId, email, full_name: fullName, phone, avatar_url: null, preferred_language: 'en', role: 'farmer' },
				csrfToken,
			})
		} catch (error) {
			if (connection) await connection.rollback().catch(() => {})
			if (error.status) return res.status(error.status).json({ success: false, message: error.message })
			if (error.code === 'ER_DUP_ENTRY') {
				const message = String(error.message).includes('uq_profiles_phone')
					? 'This contact number is already associated with another account'
					: 'An account with this email already exists'
				return res.status(409).json({ success: false, message })
			}
			logger.error?.('Account registration failed', {
				stage,
				code: error.code || null,
				errno: Number.isInteger(error.errno) ? error.errno : null,
				sqlState: error.sqlState || null,
				message: safeErrorMessage(error),
			})
			return res.status(500).json({ success: false, message: 'Unable to create account right now' })
		} finally {
			connection?.release()
		}
	}

	async function login(req, res) {
		let connection
		try {
			const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
			const password = typeof req.body?.password === 'string' ? req.body.password : ''
			if (!email || email.length > 254 || !password) {
				return res.status(401).json({ success: false, message: 'Invalid email or password' })
			}
			const [rows] = await db.execute(
				`SELECT u.id, u.email, u.password_hash, u.status,
					p.full_name, p.phone, p.avatar_url, p.preferred_language, p.role
				 FROM users u LEFT JOIN profiles p ON p.id = u.id
				 WHERE u.email = ? LIMIT 1`,
				[email],
			)
			const user = rows[0]
			if (!user || user.status !== 'active' || !user.password_hash
				|| !await passwordHasher.compare(password, user.password_hash)) {
				return res.status(401).json({ success: false, message: 'Invalid email or password' })
			}
			connection = await db.getConnection()
			await connection.beginTransaction()
			await connection.execute('UPDATE users SET last_login_at = CURRENT_TIMESTAMP(6) WHERE id = ?', [user.id])
			const { token, csrfToken } = await createSession(connection, user.id, req)
			await connection.commit()
			res.setHeader('Set-Cookie', sessionCookie(token, SESSION_DAYS * 24 * 60 * 60))
			return res.json({ success: true, user: publicUser(user), csrfToken })
		} catch {
			if (connection) await connection.rollback().catch(() => {})
			return res.status(500).json({ success: false, message: 'Unable to sign in right now' })
		} finally {
			connection?.release()
		}
	}

	async function logout(req, res) {
		try {
			await db.execute(
				'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND revoked_at IS NULL',
				[req.authSession.id],
			)
			res.setHeader('Set-Cookie', clearSessionCookie())
			return res.json({ success: true })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to sign out right now' })
		}
	}

	async function getCurrentUser(req, res) {
		return res.json({
			success: true,
			user: publicUser(req.authUser),
			csrfToken: req.authSession.csrfToken,
		})
	}

	async function saveProfile(req, res) {
		const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : ''
		const phoneWasProvided = Object.hasOwn(req.body || {}, 'phone')
		const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : null
		const preferredLanguage = req.body?.preferredLanguage
		if (fullName && (fullName.length > 255 || !fullName.trim())) {
			return res.status(400).json({ success: false, message: 'Enter a valid name' })
		}
		if (phoneWasProvided && phone && !/^\+[1-9]\d{6,14}$/.test(phone)) {
			return res.status(400).json({ success: false, message: 'Enter a valid contact number' })
		}
		if (preferredLanguage !== undefined && !['en', 'hi'].includes(preferredLanguage)) {			return res.status(400).json({ success: false, message: 'Choose a supported language' })
		}
		if (!fullName && !phoneWasProvided && preferredLanguage === undefined) {
			return res.status(400).json({ success: false, message: 'Enter your first and last name' })
		}
		try {
			const nextName = fullName || req.authUser.full_name || req.authUser.email
			const nextPhone = phoneWasProvided ? (phone || null) : req.authUser.phone
			const nextLanguage = preferredLanguage || req.authUser.preferred_language || 'en'
			await db.execute(
				'UPDATE profiles SET full_name = ?, phone = ?, preferred_language = ? WHERE id = ?',
				[nextName, nextPhone, nextLanguage, req.authUser.id],
			)
			const [rows] = await db.execute(
				`SELECT u.id, u.email, p.full_name, p.phone, p.avatar_url, p.preferred_language, p.role
				 FROM users u LEFT JOIN profiles p ON p.id = u.id WHERE u.id = ? LIMIT 1`,
				[req.authUser.id],
			)
			if (!rows[0]) return res.status(404).json({ success: false, message: 'Profile not found' })
			return res.json({ success: true, user: publicUser(rows[0]) })
		} catch (error) {
			if (error.code === 'ER_DUP_ENTRY') {
				return res.status(409).json({ success: false, message: 'This contact number is already associated with another account' })
			}
			return res.status(500).json({ success: false, message: 'Unable to save your profile right now' })
		}
	}

	return { register, login, logout, getCurrentUser, saveProfile }
}

module.exports = { createAuthController }