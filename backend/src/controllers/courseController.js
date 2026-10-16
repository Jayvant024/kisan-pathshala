const pool = require('../config/db')

function createCourseController({ db = pool } = {}) {
	async function listCourses(req, res) {
		const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : ''
		const category = typeof req.query.category === 'string' ? req.query.category.trim().slice(0, 120) : ''
		const sort = req.query.sort
		const orderBy = sort === 'price-asc'
			? 'c.price_paise ASC, c.display_order ASC'
			: sort === 'price-desc'
				? 'c.price_paise DESC, c.display_order ASC'
				: sort === 'title'
					? 'c.title_en ASC'
					: 'c.display_order ASC, c.created_at ASC'
		const filters = ["c.status = 'published'"]
		const values = []
		if (search) {
			const escaped = search.replace(/[\\%_]/g, '\\$&')
			filters.push('(c.title_en LIKE ? OR c.title_hi LIKE ? OR c.description_en LIKE ? OR c.description_hi LIKE ?)')
			values.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`, `%${escaped}%`)
		}
		if (category) {
			filters.push('c.category = ?')
			values.push(category)
		}
		try {
			const [courses] = await db.execute(
				`SELECT c.id, c.slug, c.title_en, c.title_hi, c.description_en, c.description_hi,
					c.category, c.level, c.price_paise, c.gst_percent, c.thumbnail_url,
					c.instructor_name, c.display_order,
					CAST(ROUND(c.price_paise * (1 + c.gst_percent / 100)) AS UNSIGNED) AS total_paise,
					(SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = c.id) AS module_count,
					(SELECT COUNT(*) FROM lessons l JOIN course_modules cm ON cm.id = l.module_id
					 WHERE cm.course_id = c.id AND l.is_published = TRUE) AS lesson_count
				 FROM courses c WHERE ${filters.join(' AND ')} ORDER BY ${orderBy}`,
				values,
			)
			const [categories] = await db.execute(
				"SELECT DISTINCT category FROM courses WHERE status = 'published' AND category IS NOT NULL ORDER BY category",
			)
			return res.json({ success: true, courses, categories: categories.map((row) => row.category) })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load courses right now' })
		}
	}

	async function getCourse(req, res) {
		try {
			const [rows] = await db.execute(
				`SELECT c.id, c.slug, c.title_en, c.title_hi, c.description_en, c.description_hi,
					c.category, c.level, c.price_paise, c.gst_percent, c.thumbnail_url,
					c.instructor_name, c.display_order,
					CAST(ROUND(c.price_paise * (1 + c.gst_percent / 100)) AS UNSIGNED) AS total_paise
				 FROM courses c WHERE c.slug = ? AND c.status = 'published' LIMIT 1`,
				[req.params.slug],
			)
			if (!rows[0]) return res.status(404).json({ success: false, message: 'Course not found' })
			const course = rows[0]
			const [modules] = await db.execute(
				`SELECT cm.id, cm.title_en, cm.title_hi, cm.description_en, cm.description_hi,
					cm.display_order,
					COUNT(l.id) AS lesson_count,
					COALESCE(SUM(l.duration_minutes), 0) AS duration_minutes
				 FROM course_modules cm
				 LEFT JOIN lessons l ON l.module_id = cm.id AND l.is_published = TRUE
				 WHERE cm.course_id = ?
				 GROUP BY cm.id, cm.title_en, cm.title_hi, cm.description_en, cm.description_hi, cm.display_order
				 ORDER BY cm.display_order`,
				[course.id],
			)
			return res.json({ success: true, course, modules })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load course details right now' })
		}
	}

	return { listCourses, getCourse }
}

module.exports = { createCourseController }
