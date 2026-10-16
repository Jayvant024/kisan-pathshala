const test = require('node:test')
const assert = require('node:assert/strict')
const { createEnrollmentController } = require('../src/controllers/enrollmentController')
const { createProgressController } = require('../src/controllers/progressController')
const { createOrderController } = require('../src/controllers/orderController')
const { createAdminController } = require('../src/controllers/adminController')

function createResponse() {
	return {
		statusCode: 200,
		body: null,
		status(code) {
			this.statusCode = code
			return this
		},
		json(body) {
			this.body = body
			return this
		},
	}
}

test('learning content rejects another user before loading lesson data', async () => {
	const queries = []
	const controller = createEnrollmentController({
		db: {
			async execute(sql, values) {
				queries.push({ sql, values })
				return [[{ id: 'enrollment-1', user_id: 'owner-1', course_id: 'course-1', status: 'active' }], []]
			},
		},
	})
	const response = createResponse()

	await controller.getLearningContent({
		params: { enrollmentId: 'enrollment-1' },
		authUser: { id: 'other-user', role: 'farmer' },
	}, response)

	assert.equal(response.statusCode, 403)
	assert.equal(queries.length, 1)
	assert.equal(response.body.success, false)
})

test('learning content returns lessons only for the active enrollment owner', async () => {
	const queries = []
	const controller = createEnrollmentController({
		db: {
			async execute(sql, values) {
				queries.push({ sql, values })
				if (queries.length === 1) {
					return [[{ id: 'enrollment-1', user_id: 'owner-1', course_id: 'course-1', status: 'active' }], []]
				}
				return [[{
					module_id: 'module-1',
					module_title_en: 'Soil health',
					module_title_hi: 'मिट्टी का स्वास्थ्य',
					lesson_id: 'lesson-1',
					lesson_title_en: 'Test your soil',
					lesson_title_hi: 'मिट्टी की जांच करें',
					content_en: 'Lesson content',
					content_hi: 'पाठ सामग्री',
					is_completed: 0,
				}], []]
			},
		},
	})
	const response = createResponse()

	await controller.getLearningContent({
		params: { enrollmentId: 'enrollment-1' },
		authUser: { id: 'owner-1', role: 'farmer' },
	}, response)

	assert.equal(response.statusCode, 200)
	assert.equal(response.body.modules[0].lessons[0].content_en, 'Lesson content')
	assert.deepEqual(queries[1].values, ['owner-1', 'course-1'])
})

test('pending enrollment remains locked until admin activation', async () => {
	const controller = createEnrollmentController({
		db: { async execute() { return [[{ id: 'enrollment-1', user_id: 'owner-1', course_id: 'course-1', status: 'pending' }], []] } },
	})
	const response = createResponse()

	await controller.getLearningContent({ params: { enrollmentId: 'enrollment-1' }, authUser: { id: 'owner-1', role: 'farmer' } }, response)

	assert.equal(response.statusCode, 403)
	assert.equal(response.body.message, 'This enrollment is not active')
})

test('lesson progress rejects lessons outside the signed-in user enrollment', async () => {
	const statements = []
	const transactionEvents = []
	const connection = {
		async beginTransaction() { transactionEvents.push('begin') },
		async commit() { transactionEvents.push('commit') },
		async rollback() { transactionEvents.push('rollback') },
		release() {},
		async execute(sql, values) {
			statements.push({ sql, values })
			return [[], []]
		},
	}
	const controller = createProgressController({ db: { async getConnection() { return connection } } })
	const response = createResponse()

	await controller.completeLesson({
		params: { enrollmentId: 'enrollment-1', lessonId: 'lesson-1' },
		authUser: { id: 'other-user' },
	}, response)

	assert.equal(response.statusCode, 404)
	assert.deepEqual(transactionEvents, ['begin', 'rollback'])
	assert.equal(statements.length, 1)
	assert.deepEqual(statements[0].values, ['enrollment-1', 'other-user', 'lesson-1'])
})

test('completing the final lesson records progress and returns its certificate', async () => {
	const statements = []
	const transactionEvents = []
	const connection = {
		async beginTransaction() { transactionEvents.push('begin') },
		async commit() { transactionEvents.push('commit') },
		async rollback() { transactionEvents.push('rollback') },
		release() {},
		async execute(sql, values) {
			const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
			statements.push({ statement, values })
			if (statement.startsWith('select e.id as enrollment_id')) {
				return [[{ enrollment_id: 'enrollment-1', course_id: 'course-1', status: 'active', lesson_id: 'lesson-1' }], []]
			}
			if (statement.startsWith('select count(*) as total_lessons')) {
				return [[{ total_lessons: 1, completed_lessons: 1 }], []]
			}
			if (statement.startsWith('select certificate_number')) return [[{ certificate_number: 'KP-TEST-123' }], []]
			return [{ affectedRows: 1 }, []]
		},
	}
	const controller = createProgressController({ db: { async getConnection() { return connection } } })
	const response = createResponse()

	await controller.completeLesson({
		params: { enrollmentId: 'enrollment-1', lessonId: 'lesson-1' },
		authUser: { id: 'owner-1' },
	}, response)

	assert.equal(response.statusCode, 200)
	assert.equal(response.body.progress.percent, 100)
	assert.equal(response.body.certificate_number, 'KP-TEST-123')
	assert.deepEqual(transactionEvents, ['begin', 'commit'])
	assert.ok(statements.some(({ statement }) => statement.startsWith('insert into lesson_progress')))
	assert.ok(statements.some(({ statement }) => statement.startsWith('insert into certificates')))
})

test('video lesson completion does not require a playback-duration milestone', async () => {
	const statements = []
	const transactionEvents = []
	const connection = {
		async beginTransaction() { transactionEvents.push('begin') },
		async commit() { transactionEvents.push('commit') },
		async rollback() { transactionEvents.push('rollback') },
		release() {},
		async execute(sql, values) {
			const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
			statements.push({ statement, values })
			if (statement.startsWith('select e.id as enrollment_id')) {
				return [[{
					enrollment_id: 'enrollment-1', course_id: 'course-1', status: 'active',
					lesson_id: 'lesson-1', content_type: 'video', duration_minutes: 10,
				}], []]
			}
			if (statement.startsWith('select count(*) as total_lessons')) return [[{ total_lessons: 1, completed_lessons: 1 }], []]
			if (statement.startsWith('select certificate_number')) return [[{ certificate_number: 'KP-EARLY-VIDEO' }], []]
			return [{ affectedRows: 1 }, []]
		},
	}
	const controller = createProgressController({ db: { async getConnection() { return connection } } })
	const response = createResponse()

	await controller.completeLesson({
		params: { enrollmentId: 'enrollment-1', lessonId: 'lesson-1' },
		authUser: { id: 'owner-1' },
	}, response)

	assert.equal(response.statusCode, 200)
	assert.equal(response.body.progress.percent, 100)
	assert.equal(response.body.certificate_number, 'KP-EARLY-VIDEO')
	assert.deepEqual(transactionEvents, ['begin', 'commit'])
	assert.ok(statements.some(({ statement }) => statement.startsWith('insert into lesson_progress')))
	assert.ok(statements.some(({ statement }) => statement.startsWith('insert into certificates')))
})

test('video playback persists an owner-scoped resume position', async () => {
	const statements = []
	const connection = {
		async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
		async execute(sql, values) {
			const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
			statements.push({ statement, values })
			if (statement.startsWith('select e.id as enrollment_id')) {
				return [[{ enrollment_id: 'enrollment-1', course_id: 'course-1', status: 'active', lesson_id: 'lesson-1', content_type: 'video', duration_minutes: 10 }], []]
			}
			if (statement.startsWith('select is_completed')) return [[{ is_completed: 0 }], []]
			return [{ affectedRows: 1 }, []]
		},
	}
	const controller = createProgressController({ db: { async getConnection() { return connection } } })
	const response = createResponse()

	await controller.savePlayback({
		params: { enrollmentId: 'enrollment-1', lessonId: 'lesson-1' },
		body: { positionSeconds: 15 },
		authUser: { id: 'owner-1' },
	}, response)

	assert.equal(response.statusCode, 200)
	assert.equal(response.body.progress.playback_seconds, 15)
	assert.equal(response.body.progress.is_completed, false)
	const savedPosition = statements.find(({ statement }) => statement.startsWith('insert into lesson_progress'))
	assert.equal(savedPosition.values[3], 15)
	assert.deepEqual(statements[0].values, ['enrollment-1', 'owner-1', 'lesson-1'])
})

test('course checkout creates a pending order from the database price and authenticated user', async () => {
	const statements = []
	const connection = {
		async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
		async execute(sql, values) {
			const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
			statements.push({ statement, values })
			if (statement.startsWith('select id, slug, price_paise')) return [[{ id: 'course-1', slug: 'soil', price_paise: 10000, gst_percent: 18 }], []]
			if (statement.startsWith('select id, status from enrollments')) return [[], []]
			if (statement.startsWith('select id from orders')) return [[], []]
			return [{ affectedRows: 1 }, []]
		},
	}
	const controller = createOrderController({ db: { async getConnection() { return connection } } })
	const response = createResponse()

	await controller.createOrder({ body: { courseId: 'course-1', amountPaise: 1, userId: 'attacker' }, authUser: { id: 'customer-1' } }, response)

	assert.equal(response.statusCode, 201)
	assert.equal(response.body.order.amount_paise, 11800)
	assert.equal(response.body.order.payment_status, 'pending')
	assert.deepEqual(statements.at(-1).values.slice(1), ['customer-1', 'course-1', 11800])
})

test('admin approval updates the order and creates one active enrollment transactionally', async () => {
	const statements = []
	const transactionEvents = []
	const connection = {
		async beginTransaction() { transactionEvents.push('begin') },
		async commit() { transactionEvents.push('commit') },
		async rollback() { transactionEvents.push('rollback') },
		release() {},
		async execute(sql, values) {
			const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
			statements.push({ statement, values })
			if (statement.startsWith('select id, user_id, course_id, payment_status')) {
				return [[{ id: 'order-1', user_id: 'customer-1', course_id: 'course-1', payment_status: 'submitted' }], []]
			}
			if (statement.startsWith('select id, status from enrollments')) return [[], []]
			return [{ affectedRows: 1 }, []]
		},
	}
	const controller = createAdminController({ db: { async getConnection() { return connection } } })
	const response = createResponse()

	await controller.reviewPayment({ params: { orderId: 'order-1' }, body: { decision: 'approved', paymentReceivedConfirmed: true }, authUser: { id: 'admin-1' } }, response)

	assert.equal(response.statusCode, 200)
	assert.equal(response.body.payment_status, 'verified')
	assert.deepEqual(transactionEvents, ['begin', 'commit'])
	assert.ok(statements.some(({ statement }) => statement.startsWith('insert into enrollments')))
	assert.equal(statements.find(({ statement }) => statement.startsWith('insert into enrollments')).values[1], 'customer-1')
})

test('admin approval requires explicit confirmation that payment was received', async () => {
	let connectionRequested = false
	const response = createResponse()
	await createAdminController({ db: { async getConnection() { connectionRequested = true; throw new Error('should not connect') } } }).reviewPayment(
		{ params: { orderId: 'order-1' }, body: { decision: 'approved' }, authUser: { id: 'admin-1' } },
		response,
	)

	assert.equal(response.statusCode, 400)
	assert.equal(connectionRequested, false)
})

test('admin can verify an unpaid-details pending order and grant only its selected course', async () => {
	const statements = []
	const transactionEvents = []
	const connection = {
		async beginTransaction() { transactionEvents.push('begin') },
		async commit() { transactionEvents.push('commit') },
		async rollback() { transactionEvents.push('rollback') },
		release() {},
		async execute(sql, values) {
			const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
			statements.push({ statement, values })
			if (statement.startsWith('select id, user_id, course_id, payment_status')) {
				return [[{ id: 'order-pending', user_id: 'customer-1', course_id: 'course-7', payment_status: 'pending' }], []]
			}
			if (statement.startsWith('select id, status from enrollments')) return [[], []]
			return [{ affectedRows: 1 }, []]
		},
	}
	const response = createResponse()

	await createAdminController({ db: { async getConnection() { return connection } } }).reviewPayment(
		{ params: { orderId: 'order-pending' }, body: { decision: 'approved', paymentReceivedConfirmed: true }, authUser: { id: 'admin-1' } },
		response,
	)

	assert.equal(response.statusCode, 200)
	assert.equal(response.body.payment_status, 'verified')
	assert.deepEqual(transactionEvents, ['begin', 'commit'])
	const enrollment = statements.find(({ statement }) => statement.startsWith('insert into enrollments'))
	assert.ok(enrollment)
	assert.deepEqual(enrollment.values.slice(1, 4), ['customer-1', 'course-7', 'order-pending'])
})

test('admin approval activates an existing pending enrollment instead of duplicating it', async () => {
	const statements = []
	const connection = {
		async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
		async execute(sql, values) {
			const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
			statements.push({ statement, values })
			if (statement.startsWith('select id, user_id, course_id, payment_status')) {
				return [[{ id: 'order-1', user_id: 'customer-1', course_id: 'course-1', payment_status: 'submitted' }], []]
			}
			if (statement.startsWith('select id, status from enrollments')) return [[{ id: 'enrollment-1', status: 'pending' }], []]
			return [{ affectedRows: 1 }, []]
		},
	}
	const response = createResponse()
	await createAdminController({ db: { async getConnection() { return connection } } }).reviewPayment(
		{ params: { orderId: 'order-1' }, body: { decision: 'approved', paymentReceivedConfirmed: true }, authUser: { id: 'admin-1' } },
		response,
	)

	assert.equal(response.statusCode, 200)
	assert.ok(statements.some(({ statement }) => statement.startsWith('update enrollments set status = \'active\'')))
	assert.equal(statements.some(({ statement }) => statement.startsWith('insert into enrollments')), false)
})

test('admin rejection leaves the course locked and repeated approval is rejected', async () => {
	const createConnection = (paymentStatus) => {
		const statements = []
		const events = []
		return {
			statements,
			events,
			async beginTransaction() { events.push('begin') },
			async commit() { events.push('commit') },
			async rollback() { events.push('rollback') },
			release() {},
			async execute(sql) {
				const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
				statements.push(statement)
				if (statement.startsWith('select id, user_id, course_id, payment_status')) {
					return [[{ id: 'order-1', user_id: 'customer-1', course_id: 'course-1', payment_status: paymentStatus }], []]
				}
				return [[], []]
			},
		}
	}
	const rejectedConnection = createConnection('submitted')
	const rejectedResponse = createResponse()
	await createAdminController({ db: { async getConnection() { return rejectedConnection } } }).reviewPayment(
		{ params: { orderId: 'order-1' }, body: { decision: 'rejected', note: 'UTR does not match' }, authUser: { id: 'admin-1' } },
		rejectedResponse,
	)
	assert.equal(rejectedResponse.body.payment_status, 'rejected')
	assert.equal(rejectedConnection.statements.some((statement) => statement.startsWith('insert into enrollments')), false)
	assert.deepEqual(rejectedConnection.events, ['begin', 'commit'])

	const pendingConnection = createConnection('pending')
	const pendingResponse = createResponse()
	await createAdminController({ db: { async getConnection() { return pendingConnection } } }).reviewPayment(
		{ params: { orderId: 'order-1' }, body: { decision: 'rejected', note: 'Payment not received' }, authUser: { id: 'admin-1' } },
		pendingResponse,
	)
	assert.equal(pendingResponse.body.payment_status, 'rejected')
	assert.equal(pendingConnection.statements.some((statement) => statement.startsWith('insert into enrollments')), false)
	assert.deepEqual(pendingConnection.events, ['begin', 'commit'])

	const duplicateConnection = createConnection('verified')
	const duplicateResponse = createResponse()
	await createAdminController({ db: { async getConnection() { return duplicateConnection } } }).reviewPayment(
		{ params: { orderId: 'order-1' }, body: { decision: 'approved', paymentReceivedConfirmed: true }, authUser: { id: 'admin-1' } },
		duplicateResponse,
	)
	assert.equal(duplicateResponse.statusCode, 409)
	assert.deepEqual(duplicateConnection.events, ['begin', 'rollback'])
})

test('admin lesson authoring stores only validated YouTube videos in the existing lesson tables', async () => {
	const statements = []
	const connection = {
		async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
		async execute(sql, values) {
			const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
			statements.push({ statement, values })
			if (statement.startsWith('select id, title_en, title_hi')) {
				return [[{ id: 'course-1', title_en: 'Soil care', title_hi: 'मिट्टी की देखभाल', description_en: '', description_hi: '' }], []]
			}
			if (statement.startsWith('select coalesce(max(display_order)')) return [[{ next_order: 0 }], []]
			return [{ affectedRows: 1 }, []]
		},
	}
	const response = createResponse()
	await createAdminController({ db: { async getConnection() { return connection } } }).createVideoLesson({
		params: { courseId: 'course-1' },
		body: { title_en: 'Build healthy soil', title_hi: 'स्वस्थ मिट्टी बनाएँ', youtube_url: 'https://youtu.be/AbCdEf12345', duration_minutes: 12 },
	}, response)

	assert.equal(response.statusCode, 201)
	assert.equal(response.body.lesson.content_url, 'https://www.youtube.com/watch?v=AbCdEf12345')
	assert.ok(statements.some(({ statement, values }) => statement.startsWith('insert into lessons')
		&& statement.includes("'video'")
		&& values.includes('https://www.youtube.com/watch?v=AbCdEf12345')))
})

test('admin lesson authoring rejects non-YouTube URLs before opening a database transaction', async () => {
	let connectionRequested = false
	const response = createResponse()
	await createAdminController({ db: { async getConnection() { connectionRequested = true; throw new Error('should not connect') } } }).createVideoLesson({
		params: { courseId: 'course-1' },
		body: { title_en: 'Lesson', title_hi: 'पाठ', youtube_url: 'https://example.com/video', duration_minutes: 12 },
	}, response)

	assert.equal(response.statusCode, 400)
	assert.equal(connectionRequested, false)
})

test('certificate issuance waits for every published lesson to be complete', async () => {
	const statements = []
	const connection = {
		async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
		async execute(sql) {
			const statement = sql.replace(/\s+/g, ' ').trim().toLowerCase()
			statements.push(statement)
			if (statement.startsWith('select e.id as enrollment_id')) {
				return [[{ enrollment_id: 'enrollment-1', course_id: 'course-1', status: 'active', lesson_id: 'lesson-1', content_type: 'article' }], []]
			}
			if (statement.startsWith('select count(*) as total_lessons')) return [[{ total_lessons: 2, completed_lessons: 1 }], []]
			return [{ affectedRows: 1 }, []]
		},
	}
	const controller = createProgressController({ db: { async getConnection() { return connection } } })
	const response = createResponse()
	await controller.completeLesson({
		params: { enrollmentId: 'enrollment-1', lessonId: 'lesson-1' },
		authUser: { id: 'owner-1' },
	}, response)

	assert.equal(response.statusCode, 200)
	assert.equal(response.body.progress.percent, 50)
	assert.equal(response.body.certificate_number, null)
	assert.equal(statements.some((statement) => statement.startsWith('insert into certificates')), false)
})