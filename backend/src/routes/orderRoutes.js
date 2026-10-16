const express = require('express')
const { createOrderController } = require('../controllers/orderController')
const { createAuthMiddleware } = require('../middleware/authMiddleware')
const { optionalPaymentScreenshot } = require('../middleware/paymentUpload')

const router = express.Router()
const controller = createOrderController()
const { requireAuth, requireCsrf, requireTrustedOrigin } = createAuthMiddleware()

router.get('/payment-settings', controller.getPaymentSettings)
router.get('/orders', requireAuth, controller.listMyOrders)
router.post('/orders', requireAuth, requireTrustedOrigin, requireCsrf, controller.createOrder)
router.post('/orders/:orderId/payment', requireAuth, requireTrustedOrigin, requireCsrf, optionalPaymentScreenshot, controller.submitPayment)

module.exports = router