const express = require('express')
const { createProgressController } = require('../controllers/progressController')
const { createAuthMiddleware } = require('../middleware/authMiddleware')

const router = express.Router()
const controller = createProgressController()
const { requireAuth, requireCsrf, requireTrustedOrigin } = createAuthMiddleware()

router.post('/:enrollmentId/lessons/:lessonId/access', requireAuth, requireTrustedOrigin, requireCsrf, controller.markAccessed)
router.post('/:enrollmentId/lessons/:lessonId/playback', requireAuth, requireTrustedOrigin, requireCsrf, controller.savePlayback)
router.post('/:enrollmentId/lessons/:lessonId/complete', requireAuth, requireTrustedOrigin, requireCsrf, controller.completeLesson)

module.exports = router