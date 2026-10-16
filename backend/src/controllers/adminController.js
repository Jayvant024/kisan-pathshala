const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const pool = require('../config/db')

const proofDirectory = path.resolve(__dirname, '../../private_uploads/payment-proofs')

function readSettingsValue(value) {
	if (value && typeof value === 'object') return value
	if (typeof value === 'string') {
		try { return JSON.parse(value) } catch { return {} }
	}
	return {}
}

function normalizeYouTubeUrl(value) {
	if (typeof value !== 'string') return null
	try {
		const url = new URL(value.trim())
		const host = url.hostname.replace(/^www\./, '').toLowerCase()
		let videoId = ''
		if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || ''
		else if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
			videoId = url.searchParams.get('v')
				|| url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]
				|| ''
		}
		if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
		return `https://www.youtube.com/watch?v=${videoId}`
	} catch {
		return null
	}
}

function createAdminController({ db = pool } = {}) {
	async function getOverview(_req, res) {
		try {
			const [users] = await db.execute(
				`SELECT u.id, u.email, p.full_name, p.phone, p.role, u.created_at
				 FROM users u LEFT JOIN profiles p ON p.id = u.id
			 ORDER BY u.created_at DESC LIMIT 100`,
			)
			const [userCounts] = await db.execute('SELECT COUNT(*) AS registered_users FROM users')
			const [orders] = await db.execute(
				`SELECT o.id, o.user_id, COALESCE(p.full_name, u.email) AS customer_name,
					u.email, c.slug AS course_slug, c.title_en, c.title_hi,
					o.amount_paise, o.payment_status, o.upi_utr, o.utr_submitted_at, o.created_at
				 FROM orders o JOIN users u ON u.id = o.user_id
				 LEFT JOIN profiles p ON p.id = u.id JOIN courses c ON c.id = o.course_id
				 WHERE o.payment_status IN ('pending', 'submitted')
				 ORDER BY FIELD(o.payment_status, 'submitted', 'pending'), o.created_at ASC LIMIT 200`,
			)
			return res.json({
				success: true,
				users,
				orders,
				stats: { registered_users: Number(userCounts[0]?.registered_users || 0) },
			})
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load the administration dashboard right now' })
		}
	}

	async function listPayments(_req, res) {
		try {
			const [orders] = await db.execute(
				`SELECT o.id, o.user_id, p.full_name AS student_name, u.email,
					c.slug AS course_slug, c.title_en, c.title_hi, o.amount_paise,
					o.payment_status, o.upi_utr, o.utr_submitted_at,
					(o.payment_screenshot_path IS NOT NULL) AS has_screenshot, o.created_at
				 FROM orders o JOIN users u ON u.id = o.user_id
				 JOIN profiles p ON p.id = u.id JOIN courses c ON c.id = o.course_id
				 WHERE o.payment_status IN ('pending', 'submitted', 'verified', 'rejected')
				 ORDER BY FIELD(o.payment_status, 'submitted', 'pending', 'verified', 'rejected'), o.created_at DESC LIMIT 200`,
			)
			return res.json({ success: true, orders })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load payment reviews right now' })
		}
	}

	async function createVideoLesson(req, res) {
		const titleEn = typeof req.body?.title_en === 'string' ? req.body.title_en.trim() : ''
		const titleHi = typeof req.body?.title_hi === 'string' ? req.body.title_hi.trim() : ''
		const descriptionEn = typeof req.body?.description_en === 'string' ? req.body.description_en.trim() : ''
		const descriptionHi = typeof req.body?.description_hi === 'string' ? req.body.description_hi.trim() : ''
		const youtubeUrl = normalizeYouTubeUrl(req.body?.youtube_url)
		const durationMinutes = Number(req.body?.duration_minutes)
		const moduleId = typeof req.body?.module_id === 'string' ? req.body.module_id : ''
		let moduleTitleEn = typeof req.body?.module_title_en === 'string' ? req.body.module_title_en.trim() : ''
		let moduleTitleHi = typeof req.body?.module_title_hi === 'string' ? req.body.module_title_hi.trim() : ''
		if (!titleEn || titleEn.length > 255 || !titleHi || titleHi.length > 255
			|| descriptionEn.length > 2000 || descriptionHi.length > 2000
			|| !youtubeUrl || !Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) {
			return res.status(400).json({ success: false, message: 'Enter bilingual lesson titles, a valid YouTube URL, and a duration from 1 to 600 minutes' })
		}
		if (moduleTitleEn.length > 255 || moduleTitleHi.length > 255) {
			return res.status(400).json({ success: false, message: 'Module titles cannot exceed 255 characters' })
		}
		let connection
		try {
			connection = await db.getConnection()
			await connection.beginTransaction()
			const [courses] = await connection.execute(
				`SELECT id, title_en, title_hi FROM courses
				 WHERE id = ? AND status = 'published' LIMIT 1 FOR UPDATE`,
				[req.params.courseId],
			)
			const course = courses[0]
			if (!course) {
				await connection.rollback()
				return res.status(404).json({ success: false, message: 'Published course not found' })
			}
			let module
			if (moduleId) {
				const [modules] = await connection.execute(
					'SELECT id, title_en, title_hi FROM course_modules WHERE id = ? AND course_id = ? LIMIT 1 FOR UPDATE',
					[moduleId, course.id],
				)
				module = modules[0]
				if (!module) {
					await connection.rollback()
					return res.status(404).json({ success: false, message: 'Course module not found' })
				}
			} else {
				if (!moduleTitleEn) moduleTitleEn = course.title_en
				if (!moduleTitleHi) moduleTitleHi = course.title_hi
				const [orders] = await connection.execute(
					'SELECT COALESCE(MAX(display_order), -1) AS max_order FROM course_modules WHERE course_id = ?',
					[course.id],
				)
				module = { id: randomUUID(), title_en: moduleTitleEn, title_hi: moduleTitleHi }
				await connection.execute(
					`INSERT INTO course_modules (id, course_id, title_en, title_hi, display_order)
					 VALUES (?, ?, ?, ?, ?)`,
					[module.id, course.id, moduleTitleEn, moduleTitleHi, Number(orders[0]?.max_order ?? -1) + 1],
				)
			}
			const [lessonOrders] = await connection.execute(
				'SELECT COALESCE(MAX(display_order), -1) AS max_order FROM lessons WHERE module_id = ?',
				[module.id],
			)
			const lesson = {
				id: randomUUID(),
				module_id: module.id,
				title_en: titleEn,
				title_hi: titleHi,
				content_type: 'video',
				content_url: youtubeUrl,
				duration_minutes: durationMinutes,
				is_published: true,
			}
			await connection.execute(
				`INSERT INTO lessons (
					id, module_id, title_en, title_hi, description_en, description_hi,
					content_en, content_hi, content_type, content_url, duration_minutes, display_order, is_published
				) VALUES (?, ?, ?, ?, ?, ?, '', '', 'video', ?, ?, ?, TRUE)`,
				[lesson.id, module.id, titleEn, titleHi, descriptionEn, descriptionHi,
					youtubeUrl, durationMinutes, Number(lessonOrders[0]?.max_order ?? -1) + 1],
			)
			await connection.commit()
			return res.status(201).json({ success: true, module, lesson })
		} catch {
			if (connection) await connection.rollback().catch(() => {})
			return res.status(500).json({ success: false, message: 'Unable to add this video lesson right now' })
		} finally {
			connection?.release()
		}
	}

	async function reviewPayment(req, res) {
		const decision = req.body?.decision
		const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 2000) : ''
		if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'Choose approve or reject' })
		if (decision === 'approved' && req.body?.paymentReceivedConfirmed !== true) {
			return res.status(400).json({ success: false, message: 'Confirm that payment was received before granting course access' })
		}
		if (decision === 'rejected' && !note) return res.status(400).json({ success: false, message: 'Enter a reason for rejection' })
		let connection
		try {
			connection = await db.getConnection()
			await connection.beginTransaction()
			const [rows] = await connection.execute(
				`SELECT id, user_id, course_id, payment_status FROM orders WHERE id = ? LIMIT 1 FOR UPDATE`,
				[req.params.orderId],
			)
			const order = rows[0]
			if (!order) {
				await connection.rollback()
				return res.status(404).json({ success: false, message: 'Payment not found' })
			}
			if (!['pending', 'submitted'].includes(order.payment_status)) {
				await connection.rollback()
				return res.status(409).json({ success: false, message: 'This payment has already been reviewed or cannot be reviewed yet' })
			}
			const status = decision === 'approved' ? 'verified' : 'rejected'
			await connection.execute(
				`UPDATE orders SET payment_status = ?, reviewed_by = ?, reviewed_by_role = 'admin',
					reviewed_at = CURRENT_TIMESTAMP(6), review_note = ? WHERE id = ?`,
				[status, req.authUser.id, decision === 'rejected' ? note : null, order.id],
			)
			await connection.execute(
				'INSERT INTO payment_review_events (id, order_id, reviewer_id, decision, review_note) VALUES (?, ?, ?, ?, ?)',
				[randomUUID(), order.id, req.authUser.id, decision,
					decision === 'rejected' ? note : 'Admin confirmed payment receipt in UPI or bank app'],
			)
			if (decision === 'approved') {
				const [enrollments] = await connection.execute(
					'SELECT id, status FROM enrollments WHERE order_id = ? LIMIT 1 FOR UPDATE',
					[order.id],
				)
				if (enrollments[0]?.status === 'active') {
					await connection.rollback()
					return res.status(409).json({ success: false, message: 'This order already has an active enrollment' })
				}
				if (enrollments[0] && enrollments[0].status !== 'pending') {
					await connection.rollback()
					return res.status(409).json({ success: false, message: 'This order cannot activate its existing enrollment' })
				}
				if (enrollments[0]) {
					await connection.execute(
						`UPDATE enrollments SET status = 'active', activated_by = ?, activated_by_role = 'admin',
							activated_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND status = 'pending'`,
						[req.authUser.id, enrollments[0].id],
					)
				} else {
					await connection.execute(
						`INSERT INTO enrollments (id, user_id, course_id, order_id, status, activated_by, activated_by_role, activated_at)
						 VALUES (?, ?, ?, ?, 'active', ?, 'admin', CURRENT_TIMESTAMP(6))`,
						[randomUUID(), order.user_id, order.course_id, order.id, req.authUser.id],
					)
				}
			}
			await connection.commit()
			return res.json({ success: true, payment_status: status })
		} catch (error) {
			if (connection) await connection.rollback().catch(() => {})
			if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'An enrollment or review already exists for this payment' })
			return res.status(500).json({ success: false, message: 'Unable to update this payment right now' })
		} finally {
			connection?.release()
		}
	}

	async function getPaymentProof(req, res) {
		try {
			const [rows] = await db.execute('SELECT payment_screenshot_path FROM orders WHERE id = ? LIMIT 1', [req.params.orderId])
			const filename = rows[0]?.payment_screenshot_path
			if (!filename) return res.status(404).json({ success: false, message: 'No payment screenshot was uploaded' })
			const safeName = path.basename(filename)
			const absolutePath = path.join(proofDirectory, safeName)
			if (!absolutePath.startsWith(`${proofDirectory}${path.sep}`) || !fs.existsSync(absolutePath)) {
				return res.status(404).json({ success: false, message: 'Payment screenshot is unavailable' })
			}
			res.setHeader('Cache-Control', 'private, no-store')
			return res.sendFile(absolutePath)
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load payment screenshot' })
		}
	}

	async function getPaymentSettings(_req, res) {
		try {
			const [rows] = await db.execute("SELECT setting_value FROM admin_settings WHERE setting_key = 'payment_upi' LIMIT 1")
			const settings = readSettingsValue(rows[0]?.setting_value)
			return res.json({ success: true, upi_id: settings.upi_id || '', qr_url: settings.qr_url || '' })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load payment settings' })
		}
	}

	async function savePaymentSettings(req, res) {
		const upiId = typeof req.body?.upi_id === 'string' ? req.body.upi_id.trim() : ''
		const qrUrl = typeof req.body?.qr_url === 'string' ? req.body.qr_url.trim() : ''
		if (!/^[A-Za-z0-9._-]{2,100}@[A-Za-z0-9.-]{2,64}$/.test(upiId)) {
			return res.status(400).json({ success: false, message: 'Enter a valid UPI ID' })
		}
		if (qrUrl) {
			try {
				if (new URL(qrUrl).protocol !== 'https:') throw new Error('HTTPS is required')
			} catch {
				return res.status(400).json({ success: false, message: 'QR image URL must be a valid HTTPS URL' })
			}
		}
		try {
			await db.execute(
				`INSERT INTO admin_settings (setting_key, setting_value, updated_by)
				 VALUES ('payment_upi', JSON_OBJECT('upi_id', ?, 'qr_url', ?), ?)
				 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`,
				[upiId, qrUrl, req.authUser.id],
			)
			return res.json({ success: true, upi_id: upiId, qr_url: qrUrl })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to save payment settings' })
		}
	}

	return { getOverview, listPayments, createVideoLesson, reviewPayment, getPaymentProof, getPaymentSettings, savePaymentSettings }
}

module.exports = { createAdminController }
