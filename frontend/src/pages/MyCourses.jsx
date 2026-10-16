import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, Sprout } from 'lucide-react'
import { api } from '../services/api.js'

function MyCourses({ content, language }) {
	const [courses, setCourses] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		api.myLearning().then((response) => { if (active) setCourses(response.courses || []) })
			.catch((requestError) => { if (active) setError(requestError.message) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [])

	return (
		<div className="learning-list-page">
			<header className="page-intro-row"><div><p className="section-kicker">{content.yourProgress}</p><h1>{content.myLearningTitle}</h1><p>{content.myLearningIntro}</p></div></header>
			{error && <p className="page-error" role="alert">{error}</p>}
			{loading ? <div className="course-card-grid">{[1, 2].map((item) => <div className="course-skeleton" key={item} />)}</div>
				: courses.length ? <div className="learning-course-list">
					{courses.map((course) => <article className="learning-course-card" key={course.enrollment_id}>
						<div className="learning-course-image">{course.thumbnail_url ? <img src={course.thumbnail_url} alt="" /> : <span><Sprout size={32} /></span>}</div>
						<div className="learning-course-info">
							<p className="section-kicker">{content.verifiedEnrollment}</p>
							<h2>{language === 'hi' ? course.title_hi : course.title_en}</h2>
							<p>{language === 'hi' ? course.description_hi : course.description_en}</p>
							<div className="progress-meta"><span>{course.completed_lessons} / {course.total_lessons} {content.completedLessons}</span><strong>{course.progress_percent}%</strong></div>
							<div className="progress-track"><span style={{ width: `${course.progress_percent}%` }} /></div>
						</div>
						<a className="button button-primary compact-button" href={`/learning/${course.enrollment_id}`}>{content.continueCourse}<ArrowRight size={15} /></a>
					</article>)}
				</div> : <div className="empty-state page-empty"><span className="empty-state-icon"><BookOpen size={23} /></span><strong>{content.noEnrollments}</strong><p>{content.noEnrollmentsHelp}</p><a className="button button-primary compact-button" href="/courses">{content.exploreCourses}<ArrowRight size={15} /></a></div>}
		</div>
	)
}

export default MyCourses