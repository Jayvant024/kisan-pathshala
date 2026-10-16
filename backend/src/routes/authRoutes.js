const express = require('express')
const { createAuthController } = require('../controllers/emailAuthController')
const { createAuthMiddleware } = require('../middleware/authMiddleware')
const { createGoogleOAuthController } = require('../services/googleOAuthController')

function createAuthRouter(dependencies = {}) {
	const router = express.Router()
	const authController = createAuthController(dependencies)
	const { requireAuth, requireCsrf, requireTrustedOrigin } = createAuthMiddleware(dependencies)
	const googleOAuthController = createGoogleOAuthController(dependencies)

router.get('/google', googleOAuthController.start)
router.get('/google/callback', googleOAuthController.callback)
router.post('/register', requireTrustedOrigin, authController.register)
router.post('/login', requireTrustedOrigin, authController.login)
router.post('/logout', requireAuth, requireTrustedOrigin, requireCsrf, authController.logout)
router.get('/me', requireAuth, authController.getCurrentUser)
router.post('/profile', requireAuth, requireTrustedOrigin, requireCsrf, authController.saveProfile)

return router
}

const router = createAuthRouter()
router.createAuthRouter = createAuthRouter
module.exports = router
