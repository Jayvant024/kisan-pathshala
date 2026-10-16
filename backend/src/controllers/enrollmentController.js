const pool = require('../config/db')

function createEnrollmentController({ db = pool } = {}) {
	async function listMyLearning(req, res) {
		try {
			const [rows] = await db.execute(
				`SELECT e.id AS enrollment_id, e.status, e.created_at, e.last_accessed_lesson_id,
					e.last_accessed_at, c.id AS course_id, c.slug, c.title_en, c.title_hi,
					c.description_en, c.description_hi, c.thumbnail_url,
					COUNT(DISTINCT CASE WHEN l.is_published = TRUE THEN l.id END) AS total_lessons,
					COUNT(DISTINCT CASE WHEN lp.is_completed = TRUE THEN lp.lesson_id END) AS completed_lessons
				 FROM enrollments e JOIN courses c ON c.id = e.course_id
				 LEFT JOIN course_modules cm ON cm.course_id = c.id
				 LEFT JOIN lessons l ON l.module_id = cm.id
				 LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = e.user_id
				 WHERE e.user_id = ? AND e.status = 'active'
				 GROUP BY e.id, e.status, e.created_at, e.last_accessed_lesson_id, e.last_accessed_at,
					c.id, c.slug, c.title_en, c.title_hi, c.description_en, c.description_hi, c.thumbnail_url
				 ORDER BY COALESCE(e.last_accessed_at, e.created_at) DESC`,
				[req.authUser.id],
			)
			return res.json({
				success: true,
				courses: rows.map((row) => ({
					...row,
					progress_percent: row.total_lessons ? Math.round(row.completed_lessons / row.total_lessons * 100) : 0,
				})),
			})
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load your learning list right now' })
		}
	}

	async function getLearningContent(req, res) {
		try {
			const [enrollments] = await db.execute(
				`SELECT e.id, e.user_id, e.course_id, e.status, e.last_accessed_lesson_id,
					c.slug, c.title_en, c.title_hi, c.thumbnail_url
				 FROM enrollments e JOIN courses c ON c.id = e.course_id
				 WHERE e.id = ? LIMIT 1`,
				[req.params.enrollmentId],
			)
			const enrollment = enrollments[0]
			if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' })
			if (enrollment.user_id !== req.authUser.id && req.authUser.role !== 'admin') {
				return res.status(403).json({ success: false, message: 'You do not have access to this course' })
			}
			if (enrollment.status !== 'active' && req.authUser.role !== 'admin') {
				return res.status(403).json({ success: false, message: 'This enrollment is not active' })
			}
			const [rows] = await db.execute(
				`SELECT cm.id AS module_id, cm.title_en AS module_title_en, cm.title_hi AS module_title_hi,
					cm.description_en AS module_description_en, cm.description_hi AS module_description_hi,
					cm.display_order AS module_order,
					l.id AS lesson_id, l.title_en AS lesson_title_en, l.title_hi AS lesson_title_hi,
					l.description_en AS lesson_description_en, l.description_hi AS lesson_description_hi,
					l.content_en, l.content_hi, l.content_type, l.content_url, l.duration_minutes,
					l.display_order AS lesson_order, COALESCE(lp.is_completed, FALSE) AS is_completed,
					COALESCE(lp.playback_seconds, 0) AS playback_seconds
				 FROM course_modules cm
			 LEFT JOIN lessons l ON l.module_id = cm.id AND l.is_published = TRUE
			 LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
			 WHERE cm.course_id = ? ORDER BY cm.display_order, l.display_order`,
				[enrollment.user_id, enrollment.course_id],
			)
			const modules = []
			const byModule = new Map()
			for (const row of rows) {
				let module = byModule.get(row.module_id)
				if (!module) {
					module = {
						id: row.module_id,
						title_en: row.module_title_en,
						title_hi: row.module_title_hi,
						description_en: row.module_description_en,
						description_hi: row.module_description_hi,
						lessons: [],
					}
					byModule.set(row.module_id, module)
					modules.push(module)
				}
				if (row.lesson_id) module.lessons.push({
					id: row.lesson_id,
					title_en: row.lesson_title_en,
					title_hi: row.lesson_title_hi,
					description_en: row.lesson_description_en,
					description_hi: row.lesson_description_hi,
					content_en: row.content_en,
					content_hi: row.content_hi,
					content_type: row.content_type,
					content_url: row.content_url,
					duration_minutes: row.duration_minutes,
					is_completed: Boolean(row.is_completed),
					playback_seconds: Number(row.playback_seconds || 0),
				})
			}
			return res.json({ success: true, enrollment, modules })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load course lessons right now' })
		}
	}

	return { listMyLearning, getLearningContent }
}

module.exports = { createEnrollmentController }