import { useEffect, useState } from 'react'
import { Award, ExternalLink, Printer, ShieldCheck } from 'lucide-react'
import { api } from '../services/api.js'

function Certificate({ content, language }) {
	const pathname = window.location.pathname.replace(/\/$/, '')
	const detailNumber = pathname.startsWith('/certificates/') ? decodeURIComponent(pathname.split('/').at(-1)) : ''
	const [certificates, setCertificates] = useState([])
	const [certificate, setCertificate] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		const request = detailNumber ? api.certificate(detailNumber) : api.certificates()
		request.then((response) => {
			if (!active) return
			if (detailNumber) setCertificate(response.certificate)
			else setCertificates(response.certificates || [])
		}).catch((requestError) => { if (active) setError(requestError.message) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [detailNumber])

	if (loading) return <section className="dashboard-loading"><span className="loading-ring" />{content.loading}</section>
	if (error) return <section className="page-error" role="alert">{error}</section>
	if (detailNumber && certificate) return (
		<div className="certificate-detail-page">
			<div className="certificate-toolbar no-print"><a className="back-link" href="/certificates">← {content.certificatesTitle}</a><button className="button button-secondary compact-button" onClick={() => window.print()} type="button"><Printer size={16} />{content.printCertificate}</button></div>
			<article className={`certificate-document${certificate.revoked_at ? ' certificate-revoked' : ''}`}>
				<div className="certificate-border">
					<p className="certificate-brand">किसान पाठशाला <span>KISAN PATHSHALA</span></p>
					<div className="certificate-emblem"><Award size={34} /></div>
					<p className="certificate-kicker">{content.certificateOfCompletion}</p>
					<h1>{content.certificateTitle}</h1>
					<p className="certificate-student-label">{content.presentedTo}</p>
					<h2>{certificate.student_name}</h2>
					<p className="certificate-body">{content.completedCourseText}</p>
					<h3>{language === 'hi' ? certificate.course_title_hi : certificate.course_title_en}</h3>
					<div className="certificate-footer-info"><span>{content.issuedOn}<strong>{new Date(certificate.issued_at).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN')}</strong></span><span>{content.certificateNumber}<strong>{certificate.certificate_number}</strong></span></div>
					{certificate.revoked_at && <strong className="revoked-stamp">{content.certificateRevoked}</strong>}
				</div>
			</article>
		</div>
	)
	return (
		<div className="certificates-page">
			<header className="page-intro-row"><div><p className="section-kicker">{content.earnedThroughLearning}</p><h1>{content.certificatesTitle}</h1><p>{content.certificatesIntro}</p></div></header>
			{certificates.length ? <div className="certificate-grid">{certificates.map((item) => <article className="certificate-card" key={item.id}>
				<div className="certificate-card-mark"><Award size={24} /></div><div className="certificate-card-content"><span className="verified-label"><ShieldCheck size={14} />{item.revoked_at ? content.certificateRevoked : content.certificateValid}</span><h2>{language === 'hi' ? item.course_title_hi : item.course_title_en}</h2><p>{content.issuedOn} {new Date(item.issued_at).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN')}</p><code>{item.certificate_number}</code><div className="certificate-card-actions"><a href={`/certificates/${encodeURIComponent(item.certificate_number)}`}>{content.viewCertificate}<ExternalLink size={14} /></a><a href={`/verify-certificate?number=${encodeURIComponent(item.certificate_number)}`}>{content.verifyCertificate}</a></div></div>
			</article>)}</div> : <div className="empty-state page-empty"><span className="empty-state-icon"><Award size={22} /></span><strong>{content.noCertificates}</strong><p>{content.noCertificatesHelp}</p><a href="/my-learning" className="subtle-link">{content.myLearningTitle}<ExternalLink size={14} /></a></div>}
		</div>
	)
}

export default Certificate