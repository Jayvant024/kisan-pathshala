const multer = require('multer')

const parser = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 8 },
	fileFilter(_req, file, callback) {
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
			return callback(new Error('Upload a JPG, PNG, or WEBP screenshot'))
		}
		return callback(null, true)
	},
})

function optionalPaymentScreenshot(req, res, next) {
	parser.single('screenshot')(req, res, (error) => {
		if (!error) return next()
		return res.status(400).json({ success: false, message: error.message || 'Invalid screenshot upload' })
	})
}

module.exports = { optionalPaymentScreenshot }