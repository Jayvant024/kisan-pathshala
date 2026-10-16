import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Play } from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/useAuth.js'
import YouTubePlayer from '../components/common/YouTubePlayer.jsx'

function Learning({ content, language }) {
	const enrollmentId = window.location.pathname.split('/').filter(Boolean).at(-1)
	const params = new URLSearchParams(window.location.search)
	const requestedLesson = params.get('lesson')
	const { csrfToken } = useAuth()
	const [learning, setLearning] = useState(null)
	const [selectedLessonId, setSelectedLessonId] = useState(requestedLesson || '')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [certificate, setCertificate] = useState('')
	const playbackSaving = useRef(false)

	useEffect(() => {
		let active = true
		api.learning(enrollmentId).then((response) => {
			if (!active) return
			setLearning(response)
			const allLessons = (response.modules || []).flatMap((module) => module.lessons || [])
			const preferredLesson = allLessons.find((lesson) => lesson.id === requestedLesson)
				|| allLessons.find((lesson) => !lesson.is_completed)
				|| allLessons[0]
			setSelectedLessonId((current) => current || preferredLesson?.id || '')
		}).catch((requestError) => { if (active) setError(requestError.message) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [enrollmentId, requestedLesson])

	const lessons = useMemo(() => (learning?.modules || []).flatMap((module) => module.lessons || []), [learning])
	const selectedIndex = lessons.findIndex((lesson) => lesson.id === selectedLessonId)
	const lesson = selectedIndex >= 0 ? lessons[selectedIndex] : null
	const titleFor = (item, english, hindi) => language === 'hi' ? item[hindi] || item[english] : item[english] || item[hindi]

	async function chooseLesson(id) {
		setSelectedLessonId(id)
		setError('')
		try {	
			await api.markLessonAccessed(enrollmentId, id, csrfToken)
		} catch (requestError) {
			setError(requestError.message)
		}
	}

	async function completeLesson() {
		if (!lesson) return
		setSaving(true)
		setError('')
		try {
			const response = await api.completeLesson(enrollmentId, lesson.id, csrfToken)
			setLearning((current) => ({
				...current,
				modules: current.modules.map((module) => ({
					...module,
					lessons: module.lessons.map((item) => item.id === lesson.id ? { ...item, is_completed: true } : item),
				})),
			}))
			if (response.certificate_number) setCertificate(response.certificate_number)
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setSaving(false)
		}
	}

	async function savePlayback(positionSeconds) {
		if (!lesson || playbackSaving.current) return
		playbackSaving.current = true
		try {
			const response = await api.saveLessonPlayback(enrollmentId, lesson.id, positionSeconds, csrfToken)
			setLearning((current) => ({
				...current,
				modules: current.modules.map((module) => ({
					...module,
					lessons: module.lessons.map((item) => item.id === lesson.id
						? { ...item, ...response.progress }
						: item),
				})),
			}))
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			playbackSaving.current = false
		}
	}

	if (loading) return <section className="dashboard-loading"><span className="loading-ring" />{content.loading}</section>
	if (error && !learning) return <section className="page-error" role="alert">{error}<a href="/my-learning">{content.backToLearning}</a></section>
	if (!learning) return null

	return (
		<div className="lesson-player-page">
			<a className="back-link" href="/my-learning"><ArrowLeft size={16} />{content.backToLearning}</a>
			<div className="lesson-player-heading"><div><p className="section-kicker">{content.myLearningTitle}</p><h1>{language === 'hi' ? learning.enrollment.title_hi : learning.enrollment.title_en}</h1></div><span className="lesson-count-pill">{lessons.filter((item) => item.is_completed).length} / {lessons.length} {content.lessons}</span></div>
			<div className="lesson-player-layout">
				<aside className="lesson-outline"><div className="lesson-outline-title"><h2>{content.courseOutline}</h2><span>{learning.modules.length}</span></div>
					{learning.modules.map((module, moduleIndex) => <section className="lesson-module" key={module.id}>
						<h3><span>{String(moduleIndex + 1).padStart(2, '0')}</span>{titleFor(module, 'title_en', 'title_hi')}</h3>
						{module.lessons.map((item) => <button key={item.id} className={`lesson-outline-item${item.id === selectedLessonId ? ' selected' : ''}`} onClick={() => chooseLesson(item.id)} type="button">
							{item.is_completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}<span>{titleFor(item, 'title_en', 'title_hi')}</span>{item.duration_minutes ? <small>{item.duration_minutes}m</small> : null}
						</button>)}
					</section>)}
				</aside>
				<article className="lesson-content-panel">
					{lesson ? <>
						<div className="lesson-content-kicker"><span>{lesson.content_type}</span>{lesson.duration_minutes ? <span>{lesson.duration_minutes} {content.minutes}</span> : null}</div>
						<h2>{titleFor(lesson, 'title_en', 'title_hi')}</h2>
						{(language === 'hi' ? lesson.description_hi : lesson.description_en) && <p className="lesson-description">{titleFor(lesson, 'description_en', 'description_hi')}</p>}
						{lesson.content_type === 'video' && lesson.content_url
							? <YouTubePlayer key={lesson.id} videoUrl={lesson.content_url} initialPosition={lesson.playback_seconds} content={content} onPosition={savePlayback} />
							: <div className="lesson-article">{titleFor(lesson, 'content_en', 'content_hi') || content.lessonContentUnavailable}</div>}
						{error && <p className="form-message" role="alert">{error}</p>}
						<div className="lesson-actions">
							<button className="button button-secondary compact-button" disabled={selectedIndex <= 0} onClick={() => chooseLesson(lessons[selectedIndex - 1]?.id)} type="button"><ChevronLeft size={16} />{content.previousLesson}</button>
							{lesson.is_completed ? <span className="lesson-complete-label"><Check size={16} />{content.lessonCompleted}</span> : <button className="button button-primary compact-button" onClick={completeLesson} disabled={saving} type="button">{saving ? content.loading : content.markComplete}<Check size={16} /></button>}
							<button className="button button-secondary compact-button" disabled={selectedIndex < 0 || selectedIndex >= lessons.length - 1} onClick={() => chooseLesson(lessons[selectedIndex + 1]?.id)} type="button">{content.nextLesson}<ChevronRight size={16} /></button>
						</div>
						{certificate && <p className="form-notice" role="status">{content.certificateEarned} <a href={`/certificates/${encodeURIComponent(certificate)}`}>{certificate}</a></p>}
					</> : <div className="empty-state"><span className="empty-state-icon"><Play size={20} /></span><p>{content.syllabusComingSoon}</p></div>}
				</article>
			</div>
		</div>
	)
}

export default Learning