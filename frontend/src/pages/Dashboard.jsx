import { useEffect, useState } from 'react'
import { ArrowRight, Award, BookOpen, CircleDollarSign, Compass, Leaf, Sprout } from 'lucide-react'
import { api } from '../services/api.js'

const money = (paise) => new Intl.NumberFormat('en-IN', {
	style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(paise || 0) / 100)

function Dashboard({ content, language }) {
	const [overview, setOverview] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		let inFlight = false
		let hasOverview = false
		async function refresh() {
			if (inFlight || document.visibilityState === 'hidden') return
			inFlight = true
			try {
				const response = await api.dashboard()
				if (active) { setOverview(response); setError(''); hasOverview = true }
			} catch (requestError) {
				if (active && !hasOverview) setError(requestError.message)
			} finally {
				inFlight = false
				if (active) setLoading(false)
			}
		}
		const onVisibilityChange = () => { if (document.visibilityState === 'visible') refresh() }
		refresh()
		const timer = window.setInterval(refresh, 15000)
		document.addEventListener('visibilitychange', onVisibilityChange)
		return () => {
			active = false
			window.clearInterval(timer)
			document.removeEventListener('visibilitychange', onVisibilityChange)
		}
	}, [])

	if (loading) return <section className="dashboard-loading" aria-label={content.loading}><span className="loading-ring" /><span>{content.loading}</span></section>
	if (error) return <section className="page-error" role="alert">{error}</section>

	const stats = overview?.stats || {}
	const resume = overview?.continue_learning
	const recommendationImage = overview?.recommended_courses?.[0]?.thumbnail_url
	const heroImage = resume?.thumbnail_url || recommendationImage
	const greetingName = overview?.user?.full_name || overview?.user?.email || content.studentFallback
	const statCards = [
		{ label: content.stats.enrolled, value: stats.enrolled_courses || 0, icon: BookOpen, tone: 'green' },
		{ label: content.stats.inProgress, value: stats.courses_in_progress || 0, icon: Sprout, tone: 'lime' },
		{ label: content.stats.completed, value: stats.courses_completed || 0, icon: Award, tone: 'gold' },
		{ label: content.stats.pending, value: stats.pending_payments || 0, icon: CircleDollarSign, tone: 'blue' },
	]

	return (
		<div className="overview-page">
			<section className="welcome-banner">
				{heroImage && <img className="welcome-banner-image" src={heroImage} alt="" />}
				<div className="welcome-banner-wash" />
				<div className="welcome-banner-content">
					<p className="banner-kicker"><Leaf size={15} /> {content.dashboardEyebrow}</p>
					<h1>{content.greeting} {greetingName.split(' ')[0]}</h1>
					<p>{content.dashboardWelcome}</p>
					<a className="banner-action" href="/courses">{content.exploreCourses}<ArrowRight size={16} /></a>
				</div>
				<div className="banner-mark" aria-hidden="true"><span>KP</span><small>GROW WITH KNOWLEDGE</small></div>
			</section>

			<section className="stat-grid" aria-label={content.dashboardStatsLabel}>
				{statCards.map(({ label, value, icon: Icon, tone }) => <article className={`stat-card stat-${tone}`} key={label}>
					<span className="stat-icon"><Icon size={19} strokeWidth={1.8} /></span>
					<div><span className="stat-label">{label}</span><strong>{value}</strong></div>
				</article>)}
			</section>

			<div className="overview-columns">
				<section className="overview-panel continue-panel">
					<div className="section-heading">
						<div><span className="section-kicker">{content.keepMomentum}</span><h2>{content.continueLearning}</h2></div>
						<a className="subtle-link" href="/my-learning">{content.viewAll}<ArrowRight size={15} /></a>
					</div>
					{resume ? <article className="continue-card">
						<div className="continue-image-wrap">
							{resume.thumbnail_url ? <img src={resume.thumbnail_url} alt="" /> : <div className="course-image-placeholder"><Sprout size={30} /></div>}
							<span>{content.resumeLesson}</span>
						</div>
						<div className="continue-card-copy">
							<p>{language === 'hi' ? resume.title_hi : resume.title_en}</p>
							<h3>{language === 'hi' ? resume.lesson_title_hi : resume.lesson_title_en}</h3>
							<a className="button button-primary compact-button" href={`/learning/${resume.enrollment_id}?lesson=${encodeURIComponent(resume.lesson_id)}`}>
								{content.continueNow}<ArrowRight size={15} />
							</a>
						</div>
					</article> : <div className="empty-state empty-state-continue">
						<span className="empty-state-icon"><BookOpen size={22} /></span>
						<strong>{content.nothingToResume}</strong>
						<p>{content.startCourseNudge}</p>
						<a href="/courses" className="subtle-link">{content.browseCatalog}<ArrowRight size={15} /></a>
					</div>}
				</section>

				<section className="overview-panel recent-panel">
					<div className="section-heading">
						<div><span className="section-kicker">{content.yourActivity}</span><h2>{content.recentLearning}</h2></div>
					</div>
					{overview?.recently_accessed?.length ? <div className="recent-list">
						{overview.recently_accessed.map((item) => <a className="recent-row" href={`/learning/${item.enrollment_id}`} key={item.enrollment_id}>
							<span className="recent-row-icon"><BookOpen size={17} /></span>
							<span className="recent-row-copy"><strong>{language === 'hi' ? item.lesson_title_hi : item.lesson_title_en}</strong><small>{language === 'hi' ? item.title_hi : item.title_en}</small></span>
							<span className="recent-percent">{item.last_accessed_at ? new Date(item.last_accessed_at).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN') : ''}</span>
						</a>)}
					</div> : <div className="empty-state compact-empty"><span className="empty-state-icon"><Compass size={21} /></span><p>{content.noRecentActivity}</p></div>}
				</section>
			</div>

			<section className="recommended-section">
				<div className="section-heading">
					<div><span className="section-kicker">{content.cultivateSkills}</span><h2>{content.recommendedCourses}</h2></div>
					<a className="subtle-link" href="/courses">{content.exploreAll}<ArrowRight size={15} /></a>
				</div>
				{overview?.recommended_courses?.length ? <div className="course-card-grid">
					{overview.recommended_courses.slice(0, 3).map((course) => <a className="mini-course-card" href={`/courses/${course.slug}`} key={course.id}>
						<div className="mini-course-image">
							{course.thumbnail_url ? <img src={course.thumbnail_url} alt="" loading="lazy" /> : <div className="course-image-placeholder"><Sprout size={32} /></div>}
							<span>{language === 'hi' ? course.category_hi || course.category : course.category}</span>
						</div>
						<div className="mini-course-copy">
							<h3>{language === 'hi' ? course.title_hi : course.title_en}</h3>
							<p>{language === 'hi' ? course.description_hi : course.description_en}</p>
							<div><strong>{money(course.total_paise)}</strong><span>{content.viewDetails}<ArrowRight size={14} /></span></div>
						</div>
					</a>)}
				</div> : <div className="empty-state"><span className="empty-state-icon"><Sprout size={22} /></span><strong>{content.catalogEmpty}</strong><p>{content.catalogEmptyHelp}</p></div>}
			</section>
		</div>
	)
}

export default Dashboard