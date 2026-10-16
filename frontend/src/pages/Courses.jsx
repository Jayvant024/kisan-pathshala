import { useEffect, useState } from 'react'
import { ArrowDownUp, Search, SlidersHorizontal, Sprout } from 'lucide-react'
import { api } from '../services/api.js'

const money = (paise) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(paise || 0) / 100)

function Courses({ content, language }) {
	const [courses, setCourses] = useState([])
	const [categories, setCategories] = useState([])
	const [search, setSearch] = useState('')
	const [category, setCategory] = useState('')
	const [sort, setSort] = useState('recommended')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		api.courses({ search: search.trim(), category, sort })
			.then((response) => {
				if (!active) return
				setCourses(response.courses || [])
				setCategories(response.categories || [])
				setError('')
			})
			.catch((requestError) => { if (active) setError(requestError.message) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [search, category, sort])

	return (
		<div className="catalog-page">
			<header className="page-intro-row">
				<div><p className="section-kicker">{content.learnByDoing}</p><h1>{content.catalogTitle}</h1><p>{content.catalogIntro}</p></div>
				<div className="catalog-count"><strong>{courses.length}</strong><span>{content.coursesAvailable}</span></div>
			</header>
			<div className="catalog-toolbar">
				<label className="catalog-search"><Search size={18} /><span className="visually-hidden">{content.searchCourses}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={content.searchCourses} /></label>
				<label className="filter-control"><SlidersHorizontal size={16} /><span className="visually-hidden">{content.category}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">{content.allCategories}</option>{categories.map((option) => <option key={option} value={option}>{content.categoryNames?.[option] || option}</option>)}</select></label>
				<label className="filter-control"><ArrowDownUp size={16} /><span className="visually-hidden">{content.sortBy}</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">{content.sortRecommended}</option><option value="price-asc">{content.priceLowToHigh}</option><option value="price-desc">{content.priceHighToLow}</option><option value="title">{content.sortName}</option></select></label>
			</div>
			{error && <p className="page-error" role="alert">{error}</p>}
			{loading ? <div className="course-card-grid">{[1, 2, 3].map((item) => <div className="course-skeleton" key={item} />)}</div>
				: courses.length ? <div className="course-card-grid catalog-grid">
					{courses.map((course) => <article className="catalog-card" key={course.id}>
						<a className="catalog-card-image" href={`/courses/${course.slug}`}>
							{course.thumbnail_url ? <img src={course.thumbnail_url} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : null}
							<span className="catalog-category">{content.categoryNames?.[course.category] || course.category}</span>
							{!course.thumbnail_url && <span className="image-fallback"><Sprout size={35} /></span>}
						</a>
						<div className="catalog-card-body">
							<div className="catalog-card-heading"><h2>{language === 'hi' ? course.title_hi : course.title_en}</h2><p>{language === 'en' ? course.title_hi : course.title_en}</p></div>
							<p className="catalog-description">{language === 'hi' ? course.description_hi || content.descriptionUnavailable : course.description_en || content.descriptionUnavailable}</p>
							<div className="catalog-meta"><span>{course.module_count} {content.modules}</span><span>{course.lesson_count} {content.lessons}</span><strong>{money(course.total_paise)}</strong></div>
							<a className="catalog-details-link" href={`/courses/${course.slug}`}>{content.viewDetails}<span aria-hidden="true">↗</span></a>
						</div>
					</article>)}
				</div> : <div className="empty-state catalog-empty"><span className="empty-state-icon"><Search size={22} /></span><strong>{content.noCoursesFound}</strong><p>{content.adjustSearch}</p></div>}
		</div>
	)
}

export default Courses