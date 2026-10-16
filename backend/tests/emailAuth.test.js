const test = require('node:test')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const express = require('express')
const { once } = require('node:events')
const bcrypt = require('bcryptjs')
const { createAuthRouter } = require('../src/routes/authRoutes')
const { createAuthMiddleware } = require('../src/middleware/authMiddleware')

function createFakeDatabase() {
	const users = new Map()
	const profiles = new Map()
	const sessions = new Map()
	const sessionIds = new Map()

	async function execute(sql, values = []) {
		const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
		if (statement.startsWith('select u.id, u.email, u.password_hash, u.status')) {
			const user = users.get(values[0])
			if (!user) return [[], []]
			const profile = profiles.get(user.id) || {}
			return [[{ ...user, ...profile }], []]
		}
		if (statement.startsWith('select s.id as session_id')) {
			const session = sessions.get(values[0].toString('hex'))
			if (!session || session.revoked || session.expiresAt <= new Date()) return [[], []]
			const user = [...users.values()].find((entry) => entry.id === session.userId)
			if (!user || user.status !== 'active') return [[], []]
			return [[{
				session_id: session.id,
				csrf_token_hash: session.csrfTokenHash,
				...user,
				...(profiles.get(user.id) || {}),
			}], []]
		}
		if (statement.startsWith('update sessions set revoked_at')) {
			const session = sessionIds.get(values[0])
			if (session) session.revoked = true
			return [{ affectedRows: session ? 1 : 0 }, []]
		}
		throw new Error(`Unexpected database query: ${statement}`)
	}

	const pool = {
		execute,
		async getConnection() {
			return {
				async beginTransaction() {},
				async commit() {},
				async rollback() {},
				release() {},
				async execute(sql, values = []) {
					const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
					if (statement.startsWith('insert into users')) {
						const [id, email, passwordHash] = values
						if (users.has(email)) {
							throw Object.assign(new Error("Duplicate entry for key 'uq_users_email'"), { code: 'ER_DUP_ENTRY' })
						}
						const user = { id, email, password_hash: passwordHash, status: 'active' }
						users.set(email, user)
						return [{ affectedRows: 1 }, []]
					}
					if (statement.startsWith('insert into profiles')) {
						const [id, fullName, phone] = values
						profiles.set(id, { id, full_name: fullName, phone, preferred_language: 'en', role: 'farmer' })
						return [{ affectedRows: 1 }, []]
					}
					if (statement.startsWith('insert into sessions')) {
						const [id, userId, tokenHash, csrfTokenHash, userAgent] = values
						const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
						const session = { id, userId, tokenHash, csrfTokenHash, expiresAt, userAgent, revoked: false }
						sessions.set(tokenHash.toString('hex'), session)
						sessionIds.set(id, session)
						return [{ affectedRows: 1 }, []]
					}
					if (statement.startsWith('update users set last_login_at')) return [{ affectedRows: 1 }, []]
					throw new Error(`Unexpected connection query: ${statement}`)
				},
			}
		},
	}
	return { pool, users, profiles, sessions }
}

function createTestApp(dependencies) {
	const app = express()
	app.use(express.json())
	app.use('/api/auth', createAuthRouter(dependencies))
	return app
}

async function withServer(app, run) {
	const server = app.listen(0)
	await once(server, 'listening')
	try {
		await run(`http://127.0.0.1:${server.address().port}`)
	} finally {
		server.close()
	}
}

const trustedHeaders = {
	Origin: 'http://localhost:5173',
	'Content-Type': 'application/json',
}

test('registration validates confirmation and transactionally creates a hashed user, profile, and session', async (t) => {
	const database = createFakeDatabase()
	const app = createTestApp({ db: database.pool })
	await withServer(app, async (base) => {
		const mismatch = await fetch(`${base}/api/auth/register`, {
			method: 'POST', headers: trustedHeaders,
			body: JSON.stringify({ firstName: 'Asha', lastName: 'Farmer', email: 'asha@example.com', password: 'safe-password', confirmPassword: 'different' }),
		})
		assert.equal(mismatch.status, 400)
		assert.equal(database.users.size, 0)

		const response = await fetch(`${base}/api/auth/register`, {
			method: 'POST', headers: trustedHeaders,
			body: JSON.stringify({ firstName: 'Asha', lastName: 'Farmer', email: 'ASHA@example.com', password: 'safe-password', confirmPassword: 'safe-password', role: 'admin' }),
		})
		assert.equal(response.status, 201)
		const body = await response.json()
		assert.equal(body.user.email, 'asha@example.com')
		assert.equal(body.user.full_name, 'Asha Farmer')
		assert.equal(body.user.role, 'farmer')
		const storedPasswordHash = database.users.get('asha@example.com').password_hash
		assert.notEqual(storedPasswordHash, 'safe-password')
		assert.equal(await bcrypt.compare('safe-password', storedPasswordHash), true)
		assert.equal(database.profiles.get(body.user.id).phone, null)
		assert.equal(database.profiles.get(body.user.id).role, 'farmer')
		assert.equal(database.sessions.size, 1)
		assert.match(response.headers.get('set-cookie'), /^kp_session=[A-Za-z0-9_-]+;.*HttpOnly/)
		const cookieToken = response.headers.get('set-cookie').match(/^kp_session=([^;]+)/)[1]
		assert.deepEqual(
			[...database.sessions.values()][0].tokenHash,
			createHash('sha256').update(cookieToken).digest(),
		)
		assert.equal([...database.sessions.values()][0].csrfTokenHash.length, 32)

		const duplicate = await fetch(`${base}/api/auth/register`, {
			method: 'POST', headers: trustedHeaders,
			body: JSON.stringify({ firstName: 'Asha', lastName: 'Farmer', email: 'asha@example.com', password: 'safe-password', confirmPassword: 'safe-password' }),
		})
		assert.equal(duplicate.status, 409)
	})
})

test('login uses generic credential errors; authenticated me and CSRF-protected logout work', async () => {
	const database = createFakeDatabase()
	const app = createTestApp({ db: database.pool })
	await withServer(app, async (base) => {
		await fetch(`${base}/api/auth/register`, {
			method: 'POST', headers: trustedHeaders,
			body: JSON.stringify({ firstName: 'Asha', lastName: 'Farmer', email: 'asha@example.com', password: 'safe-password', confirmPassword: 'safe-password' }),
		})

		const denied = await fetch(`${base}/api/auth/login`, {
			method: 'POST', headers: trustedHeaders,
			body: JSON.stringify({ email: 'asha@example.com', password: 'wrong-password' }),
		})
		assert.equal(denied.status, 401)
		assert.equal((await denied.json()).message, 'Invalid email or password')

		const login = await fetch(`${base}/api/auth/login`, {
			method: 'POST', headers: trustedHeaders,
			body: JSON.stringify({ email: 'ASHA@example.com', password: 'safe-password' }),
		})
		assert.equal(login.status, 200)
		const sessionCookie = login.headers.get('set-cookie').split(';')[0]
		const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: sessionCookie } })
		assert.equal(me.status, 200)
		const meBody = await me.json()
		assert.equal(meBody.user.email, 'asha@example.com')
		assert.equal(typeof meBody.csrfToken, 'string')

		const csrfDenied = await fetch(`${base}/api/auth/logout`, {
			method: 'POST', headers: { ...trustedHeaders, Cookie: sessionCookie, 'X-CSRF-Token': 'incorrect' },
		})
		assert.equal(csrfDenied.status, 403)

		const logout = await fetch(`${base}/api/auth/logout`, {
			method: 'POST', headers: { ...trustedHeaders, Cookie: sessionCookie, 'X-CSRF-Token': meBody.csrfToken },
		})
		assert.equal(logout.status, 200)
		assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
		const revoked = await fetch(`${base}/api/auth/me`, { headers: { Cookie: sessionCookie } })
		assert.equal(revoked.status, 401)
	})
})

test('protected current-user endpoint rejects missing session cookies', async () => {
	const database = createFakeDatabase()
	const app = createTestApp({ db: database.pool })
	await withServer(app, async (base) => {
		const response = await fetch(`${base}/api/auth/me`)
		assert.equal(response.status, 401)
	})
})

test('admin middleware enforces the role loaded from the database profile', async () => {
	const database = createFakeDatabase()
	const app = createTestApp({ db: database.pool })
	const { requireAuth, requireAdmin } = createAuthMiddleware({ db: database.pool })
	app.get('/api/admin-check', requireAuth, requireAdmin, (_req, res) => res.json({ success: true }))
	await withServer(app, async (base) => {
		const registration = await fetch(`${base}/api/auth/register`, {
			method: 'POST', headers: trustedHeaders,
			body: JSON.stringify({ firstName: 'Asha', lastName: 'Farmer', email: 'asha@example.com', password: 'safe-password', confirmPassword: 'safe-password' }),
		})
		const sessionCookie = registration.headers.get('set-cookie').split(';')[0]
		const farmerMe = await fetch(`${base}/api/auth/me`, { headers: { Cookie: sessionCookie } })
		assert.equal((await farmerMe.json()).user.role, 'farmer')
		const farmerResponse = await fetch(`${base}/api/admin-check`, { headers: { Cookie: sessionCookie } })
		assert.equal(farmerResponse.status, 403)

		const userId = (await registration.json()).user.id
		database.profiles.get(userId).role = 'admin'
		const adminMe = await fetch(`${base}/api/auth/me`, { headers: { Cookie: sessionCookie } })
		assert.equal((await adminMe.json()).user.role, 'admin')
		const adminResponse = await fetch(`${base}/api/admin-check`, { headers: { Cookie: sessionCookie } })
		assert.equal(adminResponse.status, 200)
	})
})