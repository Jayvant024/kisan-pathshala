import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Check, CirclePlay, Plus, RefreshCw } from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/useAuth.js'

function AdminCourses({ content, language }) {
	const { csrfToken } = useAuth()
	const [courses, setCourses] = useState([])
	const [selectedSlug, setSelectedSlug] = useState('')
	const [modules, setModules] = useState([])
	const [moduleId, setModuleId] = useState('')
	const [moduleTitleEn, setModuleTitleEn] = useState('')
	const [moduleTitleHi, setModuleTitleHi] = useState('')
	const [titleEn, setTitleEn] = useState('')
	const [titleHi, setTitleHi] = useState('')
	const [descriptionEn, setDescriptionEn] = useState('')
	const [descriptionHi, setDescriptionHi] = useState('')
	const [youtubeUrl, setYoutubeUrl] = useState('')
	const [durationMinutes, setDurationMinutes] = useState('')
	const [loadingCourses, setLoadingCourses] = useState(true)
	const [loadingModules, setLoadingModules] = useState(false)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const selectedCourse = useMemo(() => courses.find((course) => course.slug === selectedSlug), [courses, selectedSlug])

	useEffect(() => {
		let active = true
		api.courses().then((response) => {
			if (!active) return
			setCourses(response.courses || [])
			setLoadingModules(Boolean(response.courses?.length))
			setSelectedSlug(response.courses?.[0]?.slug || '')
		}).catch((requestError) => { if (active) setError(requestError.message) })
			.finally(() => { if (active) setLoadingCourses(false) })
		return () => { active = false }
	}, [])

	useEffect(() => {
		if (!selectedSlug) return undefined
		let active = true
		api.course(selectedSlug).then((response) => {
			if (active) setModules(response.modules || [])
		}).catch((requestError) => { if (active) setError(requestError.message) })
			.finally(() => { if (active) setLoadingModules(false) })
		return () => { active = false }
	}, [selectedSlug])

	async function refreshModules() {
		if (!selectedSlug) return
		const response = await api.course(selectedSlug)
		setModules(response.modules || [])
	}

	async function submit(event) {
		event.preventDefault()
		if (!selectedCourse) return
		setSaving(true)
		setError('')
		setNotice('')
		try {
			const response = await api.adminCreateVideoLesson(selectedCourse.id, {
				module_id: moduleId || undefined,
				module_title_en: moduleTitleEn,
				module_title_hi: moduleTitleHi,
				title_en: titleEn,
				title_hi: titleHi,
				description_en: descriptionEn,
				description_hi: descriptionHi,
				youtube_url: youtubeUrl,
				duration_minutes: Number(durationMinutes),
			}, csrfToken)
			if (!moduleId) setModuleId(response.module.id)
			setNotice(content.videoLessonAdded)
			setTitleEn('')
			setTitleHi('')
			setDescriptionEn('')
			setDescriptionHi('')
			setYoutubeUrl('')
			setDurationMinutes('')
			await refreshModules()
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setSaving(false)
		}
	}

	if (loadingCourses) return <section className="dashboard-loading"><span className="loading-ring" />{content.loading}</section>

	return (
		<div className="admin-courses-page">
			<header className="page-intro-row"><div><p className="section-kicker">{content.administration}</p><h1>{content.adminCoursesTitle}</h1><p>{content.adminCoursesIntro}</p></div><button className="icon-button" aria-label={content.refresh} disabled={!selectedSlug || loadingModules} onClick={() => { setLoadingModules(true); refreshModules().catch((requestError) => setError(requestError.message)).finally(() => setLoadingModules(false)) }} type="button"><RefreshCw size={17} /></button></header>
			{error && <p className="page-error" role="alert">{error}</p>}
			{notice && <p className="form-notice" role="status">{notice}</p>}
			{!courses.length ? <div className="empty-state page-empty"><span className="empty-state-icon"><BookOpen size={22} /></span><strong>{content.noPublishedCourses}</strong></div> : <div className="admin-course-editor">
				<section className="admin-course-syllabus">
					<label>{content.choosePublishedCourse}<select value={selectedSlug} onChange={(event) => { setSelectedSlug(event.target.value); setModules([]); setModuleId(''); setLoadingModules(true) }}>{courses.map((course) => <option key={course.id} value={course.slug}>{language === 'hi' ? course.title_hi : course.title_en}</option>)}</select></label>
					{loadingModules ? <p className="admin-course-hint">{content.loading}</p> : modules.length ? <div className="admin-module-list">{modules.map((module) => <article key={module.id}><span><BookOpen size={16} /></span><div><strong>{language === 'hi' ? module.title_hi : module.title_en}</strong><small>{module.lesson_count} {content.lessons}</small></div></article>)}</div> : <p className="admin-course-hint">{content.noModulesYet}</p>}
				</section>
				<form className="admin-course-form" onSubmit={submit}>
					<div className="section-heading"><div><span className="section-kicker">{content.videoLessonSetup}</span><h2>{content.addVideoLesson}</h2></div><CirclePlay size={20} /></div>
					{modules.length > 0 && <label>{content.chooseModule}<select value={moduleId} onChange={(event) => setModuleId(event.target.value)}><option value="">{content.chooseModule}</option>{modules.map((module) => <option key={module.id} value={module.id}>{language === 'hi' ? module.title_hi : module.title_en}</option>)}</select></label>}
					{!moduleId && <div className="admin-course-form-grid"><label>{content.newModuleTitleEnglish}<input maxLength="255" value={moduleTitleEn} onChange={(event) => setModuleTitleEn(event.target.value)} placeholder={selectedCourse?.title_en} /></label><label>{content.newModuleTitleHindi}<input maxLength="255" value={moduleTitleHi} onChange={(event) => setModuleTitleHi(event.target.value)} placeholder={selectedCourse?.title_hi} /></label></div>}
					<div className="admin-course-form-grid"><label>{content.lessonTitleEnglish}<input required maxLength="255" value={titleEn} onChange={(event) => setTitleEn(event.target.value)} /></label><label>{content.lessonTitleHindi}<input required maxLength="255" value={titleHi} onChange={(event) => setTitleHi(event.target.value)} /></label></div>
					<div className="admin-course-form-grid"><label>{content.lessonDescriptionEnglish}<textarea maxLength="2000" rows="3" value={descriptionEn} onChange={(event) => setDescriptionEn(event.target.value)} /></label><label>{content.lessonDescriptionHindi}<textarea maxLength="2000" rows="3" value={descriptionHi} onChange={(event) => setDescriptionHi(event.target.value)} /></label></div>
					<div className="admin-course-form-grid admin-video-fields"><label>{content.youtubeVideoUrl}<input required type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label><label>{content.videoDurationMinutes}<input required type="number" min="1" max="600" step="1" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} /></label></div>
					<button className="button button-primary compact-button" disabled={saving || !selectedCourse} type="submit"><Plus size={16} />{saving ? content.loading : content.addVideoLesson}<Check size={16} /></button>
				</form>
			</div>}
		</div>
	)
}

export default AdminCourses
