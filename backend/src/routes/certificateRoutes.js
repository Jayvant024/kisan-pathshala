const express = require('express')
const { createCertificateController } = require('../controllers/certificateController')
const { createAuthMiddleware } = require('../middleware/authMiddleware')

const router = express.Router()
const controller = createCertificateController()
const { requireAuth } = createAuthMiddleware()

router.get('/verify/:certificateNumber', controller.verifyPublic)
router.get('/', requireAuth, controller.listMine)
router.get('/:certificateNumber', requireAuth, controller.getMine)

module.exports = router