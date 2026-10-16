import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, GraduationCap, ShieldCheck } from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/useAuth.js'

const money = (paise) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(paise || 0) / 100)

function CourseDetails({ content, language }) {
	const { csrfToken } = useAuth()
	const slug = window.location.pathname.split('/').filter(Boolean).at(-1)
	const [course, setCourse] = useState(null)
	const [modules, setModules] = useState([])
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		api.course(slug).then((response) => {
			if (!active) return
			setCourse(response.course)
			setModules(response.modules || [])
		}).catch((requestError) => { if (active) setError(requestError.message) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [slug])

	async function purchase() {
		setBusy(true)
		setError('')
		try {
			const response = await api.createOrder(course.id, csrfToken)
			window.location.assign(`/payments?orderId=${encodeURIComponent(response.order.id)}`)
		} catch (requestError) {
			if (requestError.orderId) window.location.assign(`/payments?orderId=${encodeURIComponent(requestError.orderId)}`)
			else setError(requestError.message)
			setBusy(false)
		}
	}

	if (loading) return <section className="dashboard-loading"><span className="loading-ring" />{content.loading}</section>
	if (error && !course) return <section className="page-error" role="alert">{error}<a href="/courses">{content.backToCourses}</a></section>
	if (!course) return null
	const title = language === 'hi' ? course.title_hi : course.title_en
	const description = language === 'hi' ? course.description_hi : course.description_en
	const moduleCount = modules.length
	const lessonCount = modules.reduce((total, module) => total + Number(module.lesson_count || 0), 0)
	const duration = modules.reduce((total, module) => total + Number(module.duration_minutes || 0), 0)

	return (
		<div className="course-detail-page">
			<a className="back-link" href="/courses"><ArrowLeft size={16} />{content.backToCourses}</a>
			<section className="course-detail-hero">
				{course.thumbnail_url && <img className="course-detail-image" src={course.thumbnail_url} alt="" />}
				<div className="course-detail-overlay" />
				<div className="course-detail-hero-copy">
					<span className="course-category-pill">{content.categoryNames?.[course.category] || course.category}</span>
					<h1>{title}</h1>
					<p>{language === 'hi' ? course.title_en : course.title_hi}</p>
					<div className="course-detail-facts"><span><BookOpen size={16} />{moduleCount} {content.modules}</span><span><GraduationCap size={17} />{lessonCount} {content.lessons}</span>{duration > 0 && <span><Clock3 size={16} />{duration} {content.minutes}</span>}</div>
				</div>
			</section>
			<div className="course-detail-grid">
				<div className="course-detail-main">
					<section className="detail-section"><p className="section-kicker">{content.courseOverview}</p><h2>{content.whatYouWillLearn}</h2><p className="detail-description">{description || content.descriptionUnavailable}</p>
						<div className="benefit-list"><span><Check size={16} />{content.learnAtYourPace}</span><span><Check size={16} />{content.practicalSyllabus}</span><span><Check size={16} />{content.trackProgress}</span></div>
					</section>
					<section className="detail-section syllabus-section"><p className="section-kicker">{content.courseOutline}</p><h2>{content.syllabus}</h2>
						{modules.length ? <div className="syllabus-list">{modules.map((module, index) => <article className="syllabus-module" key={module.id}>
							<div className="syllabus-index">{String(index + 1).padStart(2, '0')}</div>
							<div><h3>{language === 'hi' ? module.title_hi : module.title_en}</h3><p>{language === 'hi' ? module.description_hi : module.description_en}</p><small>{module.lesson_count} {content.lessons}{module.duration_minutes ? ` · ${module.duration_minutes} ${content.minutes}` : ''}</small></div>
						</article>)}</div> : <div className="empty-state compact-empty"><span className="empty-state-icon"><BookOpen size={20} /></span><p>{content.syllabusComingSoon}</p></div>}
					</section>
					{course.instructor_name && <section className="detail-section instructor-section"><p className="section-kicker">{content.guidedLearning}</p><h2>{content.instructor}</h2><p>{course.instructor_name}</p></section>}
				</div>
				<aside className="purchase-panel">
					<div className="purchase-price"><span>{content.coursePrice}</span><strong>{money(course.total_paise)}</strong>{Number(course.gst_percent) > 0 && <small>{content.includesGst} ({course.gst_percent}%)</small>}</div>
					<div className="purchase-separator" />
					<span className="purchase-meta"><ShieldCheck size={16} />{content.payAfterChoosing}</span>
					{error && <p className="form-message" role="alert">{error}</p>}
					<button className="button button-primary purchase-button" onClick={purchase} disabled={busy} type="button">{busy ? content.loading : content.buyOrEnroll}<ArrowRight size={17} /></button>
					<p className="purchase-footnote">{content.unlockAfterVerification}</p>
				</aside>
			</div>
		</div>
	)
}

export default CourseDetails