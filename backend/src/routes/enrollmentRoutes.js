const express = require('express')
const { createEnrollmentController } = require('../controllers/enrollmentController')
const { createAuthMiddleware } = require('../middleware/authMiddleware')

const router = express.Router()
const controller = createEnrollmentController()
const { requireAuth } = createAuthMiddleware()

router.get('/', requireAuth, controller.listMyLearning)
router.get('/:enrollmentId', requireAuth, controller.getLearningContent)

module.exports = router