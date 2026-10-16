const express = require('express')
const { createAdminController } = require('../controllers/adminController')
const { createAuthMiddleware } = require('../middleware/authMiddleware')

const router = express.Router()
const controller = createAdminController()
const { requireAuth, requireAdmin, requireCsrf, requireTrustedOrigin } = createAuthMiddleware()

router.use(requireAuth, requireAdmin)
router.get('/overview', controller.getOverview)
router.post('/courses/:courseId/lessons', requireTrustedOrigin, requireCsrf, controller.createVideoLesson)
router.get('/payments', controller.listPayments)
router.get('/payments/:orderId/proof', controller.getPaymentProof)
router.post('/payments/:orderId/review', requireTrustedOrigin, requireCsrf, controller.reviewPayment)
router.get('/payment-settings', controller.getPaymentSettings)
router.put('/payment-settings', requireTrustedOrigin, requireCsrf, controller.savePaymentSettings)

module.exports = router