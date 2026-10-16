const test = require('node:test')
const assert = require('node:assert/strict')
const express = require('express')
const { once } = require('node:events')
const { createGoogleOAuthController } = require('../src/services/googleOAuthController')

function createOAuthDatabase() {
	const users = new Map()
	const profiles = new Map()
	const identities = new Map()
	const states = new Map()
	const sessions = new Map()

	function query(sql, values = []) {
		const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
		if (statement.startsWith('delete from oauth_states where state_hash')) {
			const state = states.get(values[0].toString('hex'))
			if (!state || state.consumed) return [{ affectedRows: 0 }, []]
			state.consumed = true
			return [{ affectedRows: 1 }, []]
		}
		if (statement.startsWith('delete from oauth_states')) return [{ affectedRows: 0 }, []]
		if (statement.startsWith('insert into oauth_states')) {
			const [stateHash, nonceHash, codeVerifier] = values
			states.set(stateHash.toString('hex'), {
				nonce_hash: nonceHash,
				code_verifier: codeVerifier,
				consumed: false,
			})
			return [{ affectedRows: 1 }, []]
		}
		if (statement.startsWith('select nonce_hash, code_verifier from oauth_states')) {
			const state = states.get(values[0].toString('hex'))
			return [[state && !state.consumed ? state : undefined].filter(Boolean), []]
		}
		if (statement.startsWith('select u.id, u.email, u.status, p.full_name')) {
			const linked = identities.get(values[0])
			if (!linked) return [[], []]
			const user = users.get(linked.userId)
			return [[{ ...user, ...(profiles.get(user.id) || {}) }], []]
		}
		if (statement.startsWith('select id from users where email')) {
			const user = [...users.values()].find((entry) => entry.email === values[0])
			return [user ? [{ id: user.id }] : [], []]
		}
		if (statement.startsWith('insert into users')) {
			const [id, email] = values
			if ([...users.values()].some((user) => user.email === email)) {
				throw Object.assign(new Error("Duplicate entry for key 'uq_users_email'"), { code: 'ER_DUP_ENTRY' })
			}
			users.set(id, { id, email, status: 'active', password_hash: null })
			return [{ affectedRows: 1 }, []]
		}
		if (statement.startsWith('insert into profiles')) {
			const [id, fullName] = values
			profiles.set(id, { id, full_name: fullName, phone: null, preferred_language: 'en', role: 'farmer' })
			return [{ affectedRows: 1 }, []]
		}
		if (statement.startsWith('insert into oauth_identities')) {
			const [, userId, subject, email] = values
			if (identities.has(subject)) {
				throw Object.assign(new Error("Duplicate entry for key 'uq_oauth_provider_subject'"), { code: 'ER_DUP_ENTRY' })
			}
			identities.set(subject, { userId, email })
			return [{ affectedRows: 1 }, []]
		}
		if (statement.startsWith('update oauth_identities set')) {
			const [email, subject] = values
			const identity = identities.get(subject)
			if (identity) identity.email = email
			return [{ affectedRows: identity ? 1 : 0 }, []]
		}
		if (statement.startsWith('update users set last_login_at')) return [{ affectedRows: 1 }, []]
		if (statement.startsWith('insert into sessions')) {
			const [id, userId, tokenHash] = values
			sessions.set(tokenHash.toString('hex'), { id, userId })
			return [{ affectedRows: 1 }, []]
		}
		throw new Error(`Unexpected OAuth SQL: ${statement}`)
	}

	const pool = {
		async getConnection() {
			return {
				async beginTransaction() {},
				async commit() {},
				async rollback() {},
				release() {},
				execute: async (sql, values) => query(sql, values),
			}
		},
	}
	return { pool, users, profiles, identities, states, sessions }
}

function createFakeGoogleClient({ invalidToken = false } = {}) {
	const client = {
		lastAuthorizationOptions: null,
		exchangeCalls: 0,
		async generateCodeVerifierAsync() {
			return { codeVerifier: 'test-pkce-verifier', codeChallenge: 'test-pkce-challenge' }
		},
		generateAuthUrl(options) {
			this.lastAuthorizationOptions = options
			const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
			for (const [key, value] of Object.entries(options)) {
				url.searchParams.set(key, Array.isArray(value) ? value.join(' ') : String(value))
			}
			return url.toString()
		},
		async getToken({ code, codeVerifier }) {
			this.exchangeCalls += 1
			assert.equal(code, 'test-authorization-code')
			assert.equal(codeVerifier, 'test-pkce-verifier')
			return { tokens: { id_token: 'test-id-token' } }
		},
		async verifyIdToken({ idToken, audience }) {
			assert.equal(idToken, 'test-id-token')
			assert.equal(audience, 'test-google-client-id')
			if (invalidToken) throw new Error('Invalid signature')
			return {
				getPayload: () => ({
					iss: 'https://accounts.google.com',
					aud: 'test-google-client-id',
					exp: Math.floor(Date.now() / 1000) + 300,
					email_verified: true,
					sub: 'google-subject-123',
					email: 'farmer@example.com',
					name: 'Asha Farmer',
					nonce: this.lastAuthorizationOptions.nonce,
				}),
			}
		},
	}
	return client
}

async function withOAuthServer(database, googleClient, run) {
	const app = express()
	const controller = createGoogleOAuthController({
		db: database.pool,
		oauthClient: googleClient,
		clientId: 'test-google-client-id',
		clientSecret: 'test-only-secret',
		redirectUri: 'http://localhost:5000/api/auth/google/callback',
		frontendUrl: 'http://localhost:5173',
	})
	app.get('/api/auth/google', controller.start)
	app.get('/api/auth/google/callback', controller.callback)
	const server = app.listen(0)
	await once(server, 'listening')
	try {
		await run(`http://127.0.0.1:${server.address().port}`)
	} finally {
		server.close()
	}
}

async function beginOAuth(base, client) {
	const response = await fetch(`${base}/api/auth/google`, { redirect: 'manual' })
	assert.equal(response.status, 302)
	const authorizationUrl = new URL(response.headers.get('location'))
	assert.equal(authorizationUrl.searchParams.get('code_challenge'), 'test-pkce-challenge')
	assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256')
	assert.equal(authorizationUrl.searchParams.get('redirect_uri'), 'http://localhost:5000/api/auth/google/callback')
	const cookie = response.headers.get('set-cookie').match(/^kp_google_state=([^;]+)/)[1]
	return { state: client.lastAuthorizationOptions.state, cookie }
}

async function finishOAuth(base, flow, queryState = flow.state) {
	const url = new URL('/api/auth/google/callback', base)
	url.searchParams.set('state', queryState)
	url.searchParams.set('code', 'test-authorization-code')
	return fetch(url, { headers: { Cookie: `kp_google_state=${flow.cookie}` }, redirect: 'manual' })
}

test('valid Google authorization creates a user, profile, provider identity, and MySQL session', async () => {
	const database = createOAuthDatabase()
	const client = createFakeGoogleClient()
	await withOAuthServer(database, client, async (base) => {
		const flow = await beginOAuth(base, client)
		const response = await finishOAuth(base, flow)
		assert.equal(response.status, 303)
		assert.equal(response.headers.get('location'), 'http://localhost:5173/auth/callback')
		assert.equal(database.users.size, 1)
		assert.equal(database.profiles.get([...database.users.keys()][0]).full_name, 'Asha Farmer')
		assert.equal(database.identities.get('google-subject-123').email, 'farmer@example.com')
		assert.equal(database.sessions.size, 1)
		assert.match(response.headers.get('set-cookie'), /kp_session=.*HttpOnly/)
		assert.match(response.headers.get('set-cookie'), /kp_google_state=.*Max-Age=0/)
	})
})

test('invalid or browser-unbound OAuth state is rejected before code exchange', async () => {
	const database = createOAuthDatabase()
	const client = createFakeGoogleClient()
	await withOAuthServer(database, client, async (base) => {
		const flow = await beginOAuth(base, client)
		const response = await finishOAuth(base, flow, 'tampered-state')
		assert.equal(response.status, 303)
		assert.match(response.headers.get('location'), /oauth=google_failed/)
		assert.equal(client.exchangeCalls, 0)
		assert.equal(database.users.size, 0)
	})
})

test('invalid Google ID token is rejected and creates no account or session', async () => {
	const database = createOAuthDatabase()
	const client = createFakeGoogleClient({ invalidToken: true })
	await withOAuthServer(database, client, async (base) => {
		const flow = await beginOAuth(base, client)
		const response = await finishOAuth(base, flow)
		assert.equal(response.status, 303)
		assert.match(response.headers.get('location'), /oauth=google_failed/)
		assert.equal(database.users.size, 0)
		assert.equal(database.sessions.size, 0)
	})
})

test('duplicate callback cannot consume the same one-time state twice', async () => {
	const database = createOAuthDatabase()
	const client = createFakeGoogleClient()
	await withOAuthServer(database, client, async (base) => {
		const flow = await beginOAuth(base, client)
		const success = await finishOAuth(base, flow)
		assert.equal(success.status, 303)
		const replay = await finishOAuth(base, flow)
		assert.match(replay.headers.get('location'), /oauth=google_failed/)
		assert.equal(client.exchangeCalls, 1)
		assert.equal(database.users.size, 1)
	})
})

test('an already linked Google subject signs into its existing MySQL account', async () => {
	const database = createOAuthDatabase()
	database.users.set('existing-user-id', { id: 'existing-user-id', email: 'old-email@example.com', status: 'active' })
	database.profiles.set('existing-user-id', { id: 'existing-user-id', full_name: 'Existing Farmer', phone: null, role: 'farmer' })
	database.identities.set('google-subject-123', { userId: 'existing-user-id', email: 'old-email@example.com' })
	const client = createFakeGoogleClient()
	await withOAuthServer(database, client, async (base) => {
		const flow = await beginOAuth(base, client)
		const response = await finishOAuth(base, flow)
		assert.equal(response.status, 303)
		assert.equal(database.users.size, 1)
		assert.equal([...database.sessions.values()][0].userId, 'existing-user-id')
		assert.equal(database.identities.get('google-subject-123').email, 'farmer@example.com')
	})
})

test('matching email without a linked provider subject is never auto-merged', async () => {
	const database = createOAuthDatabase()
	database.users.set('password-user-id', { id: 'password-user-id', email: 'farmer@example.com', status: 'active' })
	const client = createFakeGoogleClient()
	await withOAuthServer(database, client, async (base) => {
		const flow = await beginOAuth(base, client)
		const response = await finishOAuth(base, flow)
		assert.equal(response.status, 303)
		assert.equal(response.headers.get('location'), 'http://localhost:5173/login?oauth=account_exists')
		assert.equal(database.users.size, 1)
		assert.equal(database.identities.size, 0)
		assert.equal(database.sessions.size, 0)
	})
})