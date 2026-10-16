const { randomBytes, randomUUID } = require('node:crypto')
const pool = require('../config/db')

function createProgressController({ db = pool } = {}) {
	async function validateEnrollmentLesson(connection, userId, enrollmentId, lessonId) {
		const [rows] = await connection.execute(
			`SELECT e.id AS enrollment_id, e.course_id, e.status, l.id AS lesson_id, l.content_type
			 FROM enrollments e
			 JOIN course_modules cm ON cm.course_id = e.course_id
			 JOIN lessons l ON l.module_id = cm.id
			 WHERE e.id = ? AND e.user_id = ? AND l.id = ? AND l.is_published = TRUE
			 LIMIT 1 FOR UPDATE`,
			[enrollmentId, userId, lessonId],
		)
		if (!rows[0]) return { error: 'Lesson not found in this enrollment', status: 404 }
		if (rows[0].status !== 'active') return { error: 'Enrollment is not active', status: 403 }
		return { enrollment: rows[0] }
	}

	async function savePlayback(req, res) {
		const positionSeconds = Number(req.body?.positionSeconds)
		if (!Number.isSafeInteger(positionSeconds) || positionSeconds < 0 || positionSeconds > 36000) {
			return res.status(400).json({ success: false, message: 'Video position is invalid' })
		}
		let connection
		try {
			connection = await db.getConnection()
			await connection.beginTransaction()
			const checked = await validateEnrollmentLesson(connection, req.authUser.id, req.params.enrollmentId, req.params.lessonId)
			if (checked.error) {
				await connection.rollback()
				return res.status(checked.status).json({ success: false, message: checked.error })
			}
			const { enrollment } = checked
			if (enrollment.content_type !== 'video') {
				await connection.rollback()
				return res.status(400).json({ success: false, message: 'Playback progress is only available for video lessons' })
			}
			await connection.execute(
				`INSERT INTO lesson_progress (id, user_id, lesson_id, playback_seconds)
				 VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE playback_seconds = VALUES(playback_seconds)`,
				[randomUUID(), req.authUser.id, req.params.lessonId, positionSeconds],
			)
			const [progressRows] = await connection.execute(
				`SELECT is_completed
				 FROM lesson_progress WHERE user_id = ? AND lesson_id = ? LIMIT 1 FOR UPDATE`,
				[req.authUser.id, req.params.lessonId],
			)
			await connection.execute(
				'UPDATE enrollments SET last_accessed_lesson_id = ?, last_accessed_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND user_id = ?',
				[req.params.lessonId, enrollment.enrollment_id, req.authUser.id],
			)
			await connection.commit()
			return res.json({
				success: true,
				progress: {
					playback_seconds: positionSeconds,
					is_completed: Boolean(progressRows[0]?.is_completed),
				},
			})
		} catch {
			if (connection) await connection.rollback().catch(() => {})
			return res.status(500).json({ success: false, message: 'Unable to save video progress right now' })
		} finally {
			connection?.release()
		}
	}

	async function markAccessed(req, res) {
		let connection
		try {
			connection = await db.getConnection()
			await connection.beginTransaction()
			const checked = await validateEnrollmentLesson(connection, req.authUser.id, req.params.enrollmentId, req.params.lessonId)
			if (checked.error) {
				await connection.rollback()
				return res.status(checked.status).json({ success: false, message: checked.error })
			}
			await connection.execute(
				'UPDATE enrollments SET last_accessed_lesson_id = ?, last_accessed_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND user_id = ?',
				[req.params.lessonId, req.params.enrollmentId, req.authUser.id],
			)
			await connection.commit()
			return res.json({ success: true })
		} catch {
			if (connection) await connection.rollback().catch(() => {})
			return res.status(500).json({ success: false, message: 'Unable to save lesson position' })
		} finally {
			connection?.release()
		}
	}

	async function completeLesson(req, res) {
		let connection
		try {
			connection = await db.getConnection()
			await connection.beginTransaction()
			const checked = await validateEnrollmentLesson(connection, req.authUser.id, req.params.enrollmentId, req.params.lessonId)
			if (checked.error) {
				await connection.rollback()
				return res.status(checked.status).json({ success: false, message: checked.error })
			}
			const { enrollment } = checked
			await connection.execute(
				`INSERT INTO lesson_progress (id, user_id, lesson_id, is_completed, completed_at)
				 VALUES (?, ?, ?, TRUE, CURRENT_TIMESTAMP(6))
				 ON DUPLICATE KEY UPDATE is_completed = TRUE, completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP(6))`,
				[randomUUID(), req.authUser.id, req.params.lessonId],
			)
			await connection.execute(
				'UPDATE enrollments SET last_accessed_lesson_id = ?, last_accessed_at = CURRENT_TIMESTAMP(6) WHERE id = ? AND user_id = ?',
				[req.params.lessonId, enrollment.enrollment_id, req.authUser.id],
			)
			const [counts] = await connection.execute(
				`SELECT COUNT(*) AS total_lessons,
					COUNT(DISTINCT CASE WHEN lp.is_completed = TRUE THEN l.id END) AS completed_lessons
				 FROM course_modules cm JOIN lessons l ON l.module_id = cm.id AND l.is_published = TRUE
				 LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
				 WHERE cm.course_id = ?`,
				[req.authUser.id, enrollment.course_id],
			)
			const total = Number(counts[0].total_lessons)
			const completed = Number(counts[0].completed_lessons)
			let certificate = null
			if (total > 0 && completed >= total) {
				const certificateId = randomUUID()
				const certificateNumber = `KP-${randomBytes(8).toString('hex').toUpperCase()}`
				await connection.execute(
					`INSERT INTO certificates (id, enrollment_id, user_id, course_id, certificate_number)
					 VALUES (?, ?, ?, ?, ?)
					 ON DUPLICATE KEY UPDATE certificate_number = certificate_number`,
					[certificateId, enrollment.enrollment_id, req.authUser.id, enrollment.course_id, certificateNumber],
				)
				const [certificates] = await connection.execute(
					'SELECT certificate_number FROM certificates WHERE enrollment_id = ? LIMIT 1',
					[enrollment.enrollment_id],
				)
				certificate = certificates[0]?.certificate_number || null
			}
			await connection.commit()
			return res.json({
				success: true,
				progress: { completed_lessons: completed, total_lessons: total, percent: total ? Math.round(completed / total * 100) : 0 },
				certificate_number: certificate,
			})
		} catch {
			if (connection) await connection.rollback().catch(() => {})
			return res.status(500).json({ success: false, message: 'Unable to save lesson progress right now' })
		} finally {
			connection?.release()
		}
	}

	return { markAccessed, savePlayback, completeLesson }
}

module.exports = { createProgressController }