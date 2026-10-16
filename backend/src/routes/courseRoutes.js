const express = require('express')
const { createCourseController } = require('../controllers/courseController')

const router = express.Router()
const controller = createCourseController()

router.get('/', controller.listCourses)
router.get('/:slug', controller.getCourse)

module.exports = router