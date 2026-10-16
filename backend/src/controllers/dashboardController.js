const pool = require('../config/db')

function createDashboardController({ db = pool } = {}) {
	async function getOverview(req, res) {
		try {
			const [enrollments] = await db.execute(
				`SELECT e.id AS enrollment_id, e.status, e.created_at, e.last_accessed_lesson_id,
					e.last_accessed_at, c.id AS course_id, c.slug, c.title_en, c.title_hi,
					c.description_en, c.description_hi, c.thumbnail_url,
					COUNT(DISTINCT CASE WHEN l.is_published = TRUE THEN l.id END) AS total_lessons,
					COUNT(DISTINCT CASE WHEN lp.is_completed = TRUE THEN lp.lesson_id END) AS completed_lessons
				 FROM enrollments e JOIN courses c ON c.id = e.course_id
				 LEFT JOIN course_modules cm ON cm.course_id = c.id
				 LEFT JOIN lessons l ON l.module_id = cm.id
				 LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = e.user_id
				 WHERE e.user_id = ?
				 GROUP BY e.id, e.status, e.created_at, e.last_accessed_lesson_id, e.last_accessed_at,
					c.id, c.slug, c.title_en, c.title_hi, c.description_en, c.description_hi, c.thumbnail_url
				 ORDER BY COALESCE(e.last_accessed_at, e.created_at) DESC`,
				[req.authUser.id],
			)
			const [orders] = await db.execute(
				`SELECT COUNT(*) AS pending_payments FROM orders
				 WHERE user_id = ? AND payment_status IN ('pending', 'submitted')`,
				[req.authUser.id],
			)
			const courseSummaries = enrollments.map((row) => ({
				...row,
				progress_percent: row.total_lessons
					? Math.round((row.completed_lessons / row.total_lessons) * 100)
					: 0,
			}))
			const active = courseSummaries.filter((row) => row.status === 'active')
			const completed = active.filter((row) => row.total_lessons > 0 && row.completed_lessons >= row.total_lessons)
			const inProgress = active.filter((row) => !(row.total_lessons > 0 && row.completed_lessons >= row.total_lessons))
			const [continueRows] = await db.execute(
				`SELECT e.id AS enrollment_id, c.slug, c.title_en, c.title_hi, c.thumbnail_url,
					l.id AS lesson_id, l.title_en AS lesson_title_en, l.title_hi AS lesson_title_hi,
					e.last_accessed_at
				 FROM enrollments e JOIN courses c ON c.id = e.course_id
				 JOIN lessons l ON l.id = COALESCE(
					e.last_accessed_lesson_id,
					(SELECT l2.id FROM course_modules cm2 JOIN lessons l2 ON l2.module_id = cm2.id
					 WHERE cm2.course_id = e.course_id AND l2.is_published = TRUE
					 ORDER BY cm2.display_order, l2.display_order LIMIT 1)
				 )
				 WHERE e.user_id = ? AND e.status = 'active' AND l.is_published = TRUE
				 ORDER BY e.last_accessed_at DESC, e.created_at DESC LIMIT 1`,
				[req.authUser.id],
			)
			const [recommendations] = await db.execute(
				`SELECT c.id, c.slug, c.title_en, c.title_hi, c.description_en, c.description_hi,
					c.category, c.level, c.price_paise, c.gst_percent, c.thumbnail_url,
					CAST(ROUND(c.price_paise * (1 + c.gst_percent / 100)) AS UNSIGNED) AS total_paise
				 FROM courses c WHERE c.status = 'published'
					AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = ? AND e.course_id = c.id)
				 ORDER BY c.display_order LIMIT 4`,
				[req.authUser.id],
			)
			const [recent] = await db.execute(
				`SELECT e.id AS enrollment_id, c.slug, c.title_en, c.title_hi, c.thumbnail_url,
					l.id AS lesson_id, l.title_en AS lesson_title_en, l.title_hi AS lesson_title_hi,
					e.last_accessed_at
				 FROM enrollments e JOIN courses c ON c.id = e.course_id
				 JOIN lessons l ON l.id = e.last_accessed_lesson_id AND l.is_published = TRUE
				 WHERE e.user_id = ? AND e.status = 'active'
				 ORDER BY e.last_accessed_at DESC LIMIT 4`,
				[req.authUser.id],
			)
			return res.json({
				success: true,
				user: req.authUser,
				stats: {
					enrolled_courses: active.length,
					courses_in_progress: inProgress.length,
					courses_completed: completed.length,
					pending_payments: Number(orders[0]?.pending_payments || 0),
				},
				enrollments: courseSummaries,
				continue_learning: continueRows[0] || null,
				recently_accessed: recent,
				recommended_courses: recommendations,
			})
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load your dashboard right now' })
		}
	}
	return { getOverview }
}

module.exports = { createDashboardController }