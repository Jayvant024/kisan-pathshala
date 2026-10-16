const { randomUUID } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const pool = require('../config/db')

const proofDirectory = path.resolve(__dirname, '../../private_uploads/payment-proofs')
const fileTypes = {
	'image/jpeg': { extension: '.jpg', signature: (buffer) => buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
	'image/png': { extension: '.png', signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
	'image/webp': { extension: '.webp', signature: (buffer) => buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' },
}

function createOrderController({ db = pool, fileStore = fs } = {}) {
	async function createOrder(req, res) {
		const courseId = typeof req.body?.courseId === 'string' ? req.body.courseId : ''
		if (!courseId) return res.status(400).json({ success: false, message: 'Choose a course to continue' })
		let connection
		try {
			connection = await db.getConnection()
			await connection.beginTransaction()
			const [courses] = await connection.execute(
				`SELECT id, slug, price_paise, gst_percent FROM courses
				 WHERE id = ? AND status = 'published' LIMIT 1 FOR UPDATE`,
				[courseId],
			)
			const course = courses[0]
			if (!course || Number(course.price_paise) <= 0) {
				await connection.rollback()
				return res.status(404).json({ success: false, message: 'Course is not available for purchase' })
			}
			const [enrollments] = await connection.execute(
				'SELECT id, status FROM enrollments WHERE user_id = ? AND course_id = ? LIMIT 1 FOR UPDATE',
				[req.authUser.id, course.id],
			)
			if (enrollments[0]) {
				await connection.rollback()
				const message = enrollments[0].status === 'active' ? 'You already have access to this course' : 'An enrollment already exists for this course'
				return res.status(409).json({ success: false, message })
			}
			const [existingOrders] = await connection.execute(
				`SELECT id FROM orders WHERE user_id = ? AND course_id = ?
				 AND payment_status IN ('pending', 'submitted') LIMIT 1`,
				[req.authUser.id, course.id],
			)
			if (existingOrders[0]) {
				await connection.rollback()
				return res.status(409).json({ success: false, message: 'A payment for this course is already awaiting review', orderId: existingOrders[0].id })
			}
			const amountPaise = Math.round(Number(course.price_paise) * (1 + Number(course.gst_percent) / 100))
			const orderId = randomUUID()
			await connection.execute(
				`INSERT INTO orders (id, user_id, course_id, amount_paise, currency, payment_method, payment_status)
				 VALUES (?, ?, ?, ?, 'INR', 'upi', 'pending')`,
				[orderId, req.authUser.id, course.id, amountPaise],
			)
			await connection.commit()
			return res.status(201).json({ success: true, order: { id: orderId, course_id: course.id, amount_paise: amountPaise, payment_status: 'pending' } })
		} catch (error) {
			if (connection) await connection.rollback().catch(() => {})
			if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'A purchase record already exists for this course' })
			return res.status(500).json({ success: false, message: 'Unable to start checkout right now' })
		} finally {
			connection?.release()
		}
	}

	async function submitPayment(req, res) {
		const utr = typeof req.body?.utr === 'string' ? req.body.utr.trim().toUpperCase() : ''
		if (!/^[A-Z0-9-]{6,32}$/.test(utr)) return res.status(400).json({ success: false, message: 'Enter a valid UTR or transaction reference' })
		let proofName = null
		let proofPath = null
		if (req.file) {
			const type = fileTypes[req.file.mimetype]
			if (!type || !type.signature(req.file.buffer)) {
				return res.status(400).json({ success: false, message: 'The screenshot file contents do not match an accepted image type' })
			}
			proofName = `${randomUUID()}${type.extension}`
			proofPath = path.join(proofDirectory, proofName)
		}
		let connection
		try {
			connection = await db.getConnection()
			await connection.beginTransaction()
			const [rows] = await connection.execute(
				`SELECT id, payment_status FROM orders
				 WHERE id = ? AND user_id = ? LIMIT 1 FOR UPDATE`,
				[req.params.orderId, req.authUser.id],
			)
			const order = rows[0]
			if (!order || !['pending', 'rejected'].includes(order.payment_status)) {
				await connection.rollback()
				return res.status(order ? 409 : 404).json({ success: false, message: order ? 'This payment cannot be resubmitted' : 'Payment not found' })
			}
			if (req.file) {
				await fileStore.mkdir(proofDirectory, { recursive: true })
				await fileStore.writeFile(proofPath, req.file.buffer, { flag: 'wx', mode: 0o600 })
			}
			await connection.execute(
				`UPDATE orders SET payment_status = 'submitted', upi_utr = ?, utr_submitted_at = CURRENT_TIMESTAMP(6),
					payment_screenshot_path = COALESCE(?, payment_screenshot_path),
					reviewed_by = NULL, reviewed_by_role = NULL, reviewed_at = NULL, review_note = NULL
				 WHERE id = ? AND user_id = ?`,
				[utr, proofName, order.id, req.authUser.id],
			)
			await connection.commit()
			return res.json({ success: true, order: { id: order.id, payment_status: 'submitted', utr, has_screenshot: Boolean(req.file) } })
		} catch (error) {
			if (connection) await connection.rollback().catch(() => {})
			if (proofPath) await fileStore.unlink(proofPath).catch(() => {})
			if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'That transaction reference has already been submitted' })
			return res.status(500).json({ success: false, message: 'Unable to submit payment details right now' })
		} finally {
			connection?.release()
		}
	}

	async function listMyOrders(req, res) {
		try {
			const [orders] = await db.execute(
				`SELECT o.id, o.course_id, e.id AS enrollment_id, c.slug AS course_slug, c.title_en, c.title_hi,
					o.amount_paise, o.currency, o.payment_status, o.upi_utr, o.utr_submitted_at,
					o.review_note, (o.payment_screenshot_path IS NOT NULL) AS has_screenshot,
					o.created_at, o.updated_at
				 FROM orders o JOIN courses c ON c.id = o.course_id
				 LEFT JOIN enrollments e ON e.order_id = o.id
				 WHERE o.user_id = ? ORDER BY o.created_at DESC`,
				[req.authUser.id],
			)
			return res.json({ success: true, orders })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load payment history right now' })
		}
	}

	async function getPaymentSettings(_req, res) {
		try {
			const [rows] = await db.execute("SELECT setting_value FROM admin_settings WHERE setting_key = 'payment_upi' LIMIT 1")
			let settings = rows[0]?.setting_value || {}
			if (typeof settings === 'string') {
				try { settings = JSON.parse(settings) } catch { settings = {} }
			}
			return res.json({ success: true, configured: Boolean(settings.upi_id), upi_id: settings.upi_id || '', qr_url: settings.qr_url || '' })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load payment instructions right now' })
		}
	}

	return { createOrder, submitPayment, listMyOrders, getPaymentSettings }
}

module.exports = { createOrderController }