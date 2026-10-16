const API_BASE = import.meta.env.VITE_API_URL
	|| `${window.location.protocol}//${window.location.hostname}:5000`
const NORMALIZED_API_BASE = API_BASE.replace(/\/+$/, '')

async function request(path, options = {}) {
	const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
	const response = await fetch(`${NORMALIZED_API_BASE}${path}`, {
		...options,
		credentials: 'include',
		headers: {
			...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
			...options.headers,
		},
	})
	const payload = await response.json().catch(() => ({}))
	if (!response.ok) {
		throw Object.assign(new Error(payload.message || 'Something went wrong'), {
			status: response.status,
			orderId: payload.orderId,
			retryAfterSeconds: payload.retryAfterSeconds,
			attemptsRemaining: payload.attemptsRemaining,
		})
	}
	return payload
}

async function requestImage(path) {
	const response = await fetch(`${NORMALIZED_API_BASE}${path}`, { credentials: 'include' })
	if (!response.ok) {
		const payload = await response.json().catch(() => ({}))
		throw Object.assign(new Error(payload.message || 'Unable to load image'), { status: response.status })
	}
	return URL.createObjectURL(await response.blob())
}

function queryString(values = {}) {
	const params = new URLSearchParams()
	for (const [key, value] of Object.entries(values)) if (value) params.set(key, value)
	const text = params.toString()
	return text ? `?${text}` : ''
}

export const api = {
	request,
	register: (details) => request('/api/auth/register', {
		method: 'POST',
		body: JSON.stringify(details),
	}),
	login: (credentials) => request('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify(credentials),
	}),
	logout: (csrfToken) => request('/api/auth/logout', {
		method: 'POST',
		headers: { 'X-CSRF-Token': csrfToken },
	}),
	saveProfile: (profile, csrfToken) => request('/api/auth/profile', {
		method: 'POST',
		headers: { 'X-CSRF-Token': csrfToken },
		body: JSON.stringify(profile),
	}),
	me: () => request('/api/auth/me'),
	googleOAuthUrl: `${NORMALIZED_API_BASE}/api/auth/google`,
	updateProfile: (profile, csrfToken) => request('/api/auth/profile', {
		method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: JSON.stringify(profile),
	}),
	courses: (filters) => request(`/api/courses${queryString(filters)}`),
	course: (slug) => request(`/api/courses/${encodeURIComponent(slug)}`),
	dashboard: () => request('/api/dashboard'),
	orders: () => request('/api/orders'),
	createOrder: (courseId, csrfToken) => request('/api/orders', {
		method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ courseId }),
	}),
	submitPayment: (orderId, formData, csrfToken) => request(`/api/orders/${encodeURIComponent(orderId)}/payment`, {
		method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: formData,
	}),
	paymentSettings: () => request('/api/payment-settings'),
	myLearning: () => request('/api/learning'),
	learning: (enrollmentId) => request(`/api/learning/${encodeURIComponent(enrollmentId)}`),
	markLessonAccessed: (enrollmentId, lessonId, csrfToken) => request(`/api/learning/${encodeURIComponent(enrollmentId)}/lessons/${encodeURIComponent(lessonId)}/access`, {
		method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: JSON.stringify({}),
	}),
	completeLesson: (enrollmentId, lessonId, csrfToken) => request(`/api/learning/${encodeURIComponent(enrollmentId)}/lessons/${encodeURIComponent(lessonId)}/complete`, {
		method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: JSON.stringify({}),
	}),
	saveLessonPlayback: (enrollmentId, lessonId, positionSeconds, csrfToken) => request(`/api/learning/${encodeURIComponent(enrollmentId)}/lessons/${encodeURIComponent(lessonId)}/playback`, {
		method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ positionSeconds }),
	}),
	certificates: () => request('/api/certificates'),
	certificate: (number) => request(`/api/certificates/${encodeURIComponent(number)}`),
	verifyCertificate: (number) => request(`/api/certificates/verify/${encodeURIComponent(number)}`),
	adminPayments: () => request('/api/admin/payments'),
	adminOverview: () => request('/api/admin/overview'),
	adminCreateVideoLesson: (courseId, lesson, csrfToken) => request(`/api/admin/courses/${encodeURIComponent(courseId)}/lessons`, {
		method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: JSON.stringify(lesson),
	}),
	reviewPayment: (orderId, decision, note, csrfToken, paymentReceivedConfirmed = false) => request(`/api/admin/payments/${encodeURIComponent(orderId)}/review`, {
		method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ decision, note, paymentReceivedConfirmed }),
	}),
	adminPaymentSettings: () => request('/api/admin/payment-settings'),
	saveAdminPaymentSettings: (settings, csrfToken) => request('/api/admin/payment-settings', {
		method: 'PUT', headers: { 'X-CSRF-Token': csrfToken }, body: JSON.stringify(settings),
	}),
	adminPaymentProof: (orderId) => requestImage(`/api/admin/payments/${encodeURIComponent(orderId)}/proof`),
}
