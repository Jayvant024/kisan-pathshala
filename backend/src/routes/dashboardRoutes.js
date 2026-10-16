const express = require('express')
const { createDashboardController } = require('../controllers/dashboardController')
const { createAuthMiddleware } = require('../middleware/authMiddleware')

const router = express.Router()
const controller = createDashboardController()
const { requireAuth } = createAuthMiddleware()

router.get('/', requireAuth, controller.getOverview)

module.exports = router