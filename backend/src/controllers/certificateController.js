const pool = require('../config/db')

const ELIGIBLE_CERTIFICATE_FILTER = `
	EXISTS (
		SELECT 1 FROM course_modules cm JOIN lessons l ON l.module_id = cm.id
		WHERE cm.course_id = ce.course_id AND l.is_published = TRUE
	)
	AND NOT EXISTS (
		SELECT 1 FROM course_modules cm JOIN lessons l ON l.module_id = cm.id
		LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ce.user_id
		WHERE cm.course_id = ce.course_id AND l.is_published = TRUE
			AND COALESCE(lp.is_completed, FALSE) = FALSE
	)`

function createCertificateController({ db = pool } = {}) {
	async function listMine(req, res) {
		try {
			const [certificates] = await db.execute(
				`SELECT ce.id, ce.certificate_number, ce.issued_at, ce.revoked_at,
					c.slug AS course_slug, c.title_en AS course_title_en, c.title_hi AS course_title_hi,
					p.full_name AS student_name
				 FROM certificates ce
				 JOIN courses c ON c.id = ce.course_id
				 JOIN profiles p ON p.id = ce.user_id
				 JOIN enrollments e ON e.id = ce.enrollment_id AND e.status = 'active'
				 WHERE ce.user_id = ? AND ${ELIGIBLE_CERTIFICATE_FILTER}
				 ORDER BY ce.issued_at DESC`,
				[req.authUser.id],
			)
			return res.json({ success: true, certificates })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load certificates right now' })
		}
	}

	async function getMine(req, res) {
		try {
			const [rows] = await db.execute(
				`SELECT ce.id, ce.certificate_number, ce.issued_at, ce.revoked_at,
					c.title_en AS course_title_en, c.title_hi AS course_title_hi, p.full_name AS student_name
				 FROM certificates ce JOIN courses c ON c.id = ce.course_id
				 JOIN profiles p ON p.id = ce.user_id
				 JOIN enrollments e ON e.id = ce.enrollment_id AND e.status = 'active'
				 WHERE ce.certificate_number = ? AND ce.user_id = ?
					AND ${ELIGIBLE_CERTIFICATE_FILTER} LIMIT 1`,
				[req.params.certificateNumber, req.authUser.id],
			)
			if (!rows[0]) return res.status(404).json({ success: false, message: 'Certificate not found' })
			return res.json({ success: true, certificate: rows[0] })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to load this certificate right now' })
		}
	}

	async function verifyPublic(req, res) {
		try {
			const [rows] = await db.execute(
				`SELECT ce.certificate_number, ce.issued_at, ce.revoked_at,
					c.title_en AS course_title_en, c.title_hi AS course_title_hi,
					p.full_name AS student_name
				 FROM certificates ce JOIN courses c ON c.id = ce.course_id
				 JOIN profiles p ON p.id = ce.user_id
				 JOIN enrollments e ON e.id = ce.enrollment_id AND e.status = 'active'
				 WHERE ce.certificate_number = ? AND ${ELIGIBLE_CERTIFICATE_FILTER} LIMIT 1`,
				[req.params.certificateNumber],
			)
			if (!rows[0]) return res.status(404).json({ success: true, valid: false })
			return res.json({ success: true, valid: !rows[0].revoked_at, certificate: rows[0] })
		} catch {
			return res.status(500).json({ success: false, message: 'Unable to verify certificate right now' })
		}
	}

	return { listMine, getMine, verifyPublic }
}

module.exports = { createCertificateController }
