const express = require('express')
const cors = require('cors')
const { getAllowedOrigins } = require('./config/allowedOrigins')
const authRoutes = require('./routes/authRoutes')
const courseRoutes = require('./routes/courseRoutes')
const orderRoutes = require('./routes/orderRoutes')
const enrollmentRoutes = require('./routes/enrollmentRoutes')
const progressRoutes = require('./routes/progressRoutes')
const certificateRoutes = require('./routes/certificateRoutes')
const adminRoutes = require('./routes/adminRoutes')
const dashboardRoutes = require('./routes/dashboardRoutes')

const app = express()

const allowedOrigins = getAllowedOrigins()

app.use(cors({
	credentials: true,
	origin(origin, callback) {
		if (!origin || allowedOrigins.has(origin)) return callback(null, true)
		return callback(new Error('Origin is not allowed by CORS'))
	},
}))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api', orderRoutes)
app.use('/api/learning', enrollmentRoutes)
app.use('/api/learning', progressRoutes)
app.use('/api/certificates', certificateRoutes)
app.use('/api/admin', adminRoutes)

app.get('/api/health', (_req, res) => {
	res.json({
		success: true,
		message: 'Kisan Pathshala API is running',
	})
})

app.use((req, res) => {
	res.status(404).json({
		success: false,
		message: `Route not found: ${req.method} ${req.originalUrl}`,
	})
})

app.use((error, _req, res, _next) => {
	console.error(error)
	res.status(error.status || 500).json({
		success: false,
		message: error.status && error.status < 500 ? error.message : 'Internal server error',
	})
})

module.exports = app
