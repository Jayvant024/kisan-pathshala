const test = require('node:test')
const assert = require('node:assert/strict')
const { once } = require('node:events')
const app = require('../src/app')
const { createAuthMiddleware } = require('../src/middleware/authMiddleware')
const { clearSessionCookie, sessionCookie } = require('../src/services/authSessionService')

async function withServer(run) {
	const server = app.listen(0, '127.0.0.1')
	await once(server, 'listening')
	try {
		await run(`http://127.0.0.1:${server.address().port}`)
	} finally {
		server.close()
	}
}

test('credentialed auth requests allow the configured localhost:5174 origin', async () => {
	await withServer(async (base) => {
		const response = await fetch(`${base}/api/auth/me`, {
			headers: { Origin: 'http://localhost:5174' },
		})

		assert.equal(response.status, 401)
		assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5174')
		assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
	})
})

test('credentialed auth requests allow the deployed Vercel origin', async () => {
	await withServer(async (base) => {
		const response = await fetch(`${base}/api/auth/me`, {
			headers: { Origin: 'https://kisan-pathshala.vercel.app' },
		})

		assert.equal(response.status, 401)
		assert.equal(response.headers.get('access-control-allow-origin'), 'https://kisan-pathshala.vercel.app')
		assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
	})
})

test('registration preflight succeeds for credentialed JSON and CSRF headers', async () => {
	await withServer(async (base) => {
		const response = await fetch(`${base}/api/auth/register`, {
			method: 'OPTIONS',
			headers: {
				Origin: 'http://localhost:5174',
				'Access-Control-Request-Method': 'POST',
				'Access-Control-Request-Headers': 'content-type,x-csrf-token',
			},
		})

		assert.equal(response.status, 204)
		assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5174')
		assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
		assert.match(response.headers.get('access-control-allow-methods'), /POST/i)
		assert.match(response.headers.get('access-control-allow-headers'), /content-type/i)
		assert.match(response.headers.get('access-control-allow-headers'), /x-csrf-token/i)
	})
})

test('production registration preflight completes before auth middleware', async () => {
	await withServer(async (base) => {
		const response = await fetch(`${base}/api/auth/register`, {
			method: 'OPTIONS',
			headers: {
				Origin: 'https://kisan-pathshala.vercel.app',
				'Access-Control-Request-Method': 'POST',
				'Access-Control-Request-Headers': 'content-type',
			},
		})

		assert.equal(response.status, 204)
		assert.equal(response.headers.get('access-control-allow-origin'), 'https://kisan-pathshala.vercel.app')
		assert.equal(response.headers.get('access-control-allow-credentials'), 'true')
		assert.match(response.headers.get('access-control-allow-methods'), /POST/i)
	})
})

test('trusted-origin protection accepts port 5174 and still rejects unlisted origins', () => {
	const { requireTrustedOrigin } = createAuthMiddleware({ db: {} })
	const allowedResponse = {
		statusCode: 200,
		status(code) { this.statusCode = code; return this },
		json() {},
	}
	let allowedNext = false
	requireTrustedOrigin({ get: () => 'http://localhost:5174' }, allowedResponse, () => { allowedNext = true })
	assert.equal(allowedNext, true)

	const blockedResponse = {
		statusCode: 200,
		status(code) { this.statusCode = code; return this },
		json() {},
	}
	let blockedNext = false
	requireTrustedOrigin({ get: () => 'https://unlisted.example' }, blockedResponse, () => { blockedNext = true })
	assert.equal(blockedNext, false)
	assert.equal(blockedResponse.statusCode, 403)
})

test('trusted-origin protection accepts the production frontend only', () => {
	const { requireTrustedOrigin } = createAuthMiddleware({ db: {} })
	const allowedResponse = {
		statusCode: 200,
		status(code) { this.statusCode = code; return this },
		json() {},
	}
	let allowedNext = false
	requireTrustedOrigin({ get: () => 'https://kisan-pathshala.vercel.app' }, allowedResponse, () => { allowedNext = true })
	assert.equal(allowedNext, true)

	const blockedResponse = {
		statusCode: 200,
		status(code) { this.statusCode = code; return this },
		json() {},
	}
	let blockedNext = false
	requireTrustedOrigin({ get: () => 'https://preview-kisan.vercel.app' }, blockedResponse, () => { blockedNext = true })
	assert.equal(blockedNext, false)
	assert.equal(blockedResponse.statusCode, 403)
})

test('cross-site session cookies use SameSite=None and Secure only in production', () => {
	const previousNodeEnv = process.env.NODE_ENV
	try {
		process.env.NODE_ENV = 'production'
		assert.match(sessionCookie('test-token'), /SameSite=None/)
		assert.match(sessionCookie('test-token'), /; Secure/)
		assert.match(clearSessionCookie(), /SameSite=None/)
		assert.match(clearSessionCookie(), /; Secure/)

		process.env.NODE_ENV = 'development'
		assert.match(sessionCookie('test-token'), /SameSite=Lax/)
		assert.doesNotMatch(sessionCookie('test-token'), /; Secure/)
	} finally {
		if (previousNodeEnv === undefined) delete process.env.NODE_ENV
		else process.env.NODE_ENV = previousNodeEnv
	}
})