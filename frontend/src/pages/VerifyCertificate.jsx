import { useState } from 'react'
import { BadgeCheck, Search, ShieldAlert } from 'lucide-react'
import { api } from '../services/api.js'

function VerifyCertificate({ content, language }) {
	const initialNumber = new URLSearchParams(window.location.search).get('number') || ''
	const [number, setNumber] = useState(initialNumber)
	const [certificate, setCertificate] = useState(null)
	const [notFound, setNotFound] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	async function verify(event) {
		event.preventDefault()
		setLoading(true)
		setError('')
		setNotFound(false)
		setCertificate(null)
		try {
			const response = await api.verifyCertificate(number.trim())
			if (response.valid) setCertificate(response.certificate)
			else setNotFound(true)
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setLoading(false)
		}
	}

	return (
		<section className="verify-page">
			<div className="verify-card"><span className="verify-card-icon"><BadgeCheck size={23} /></span><p className="section-kicker">{content.publicVerification}</p><h1>{content.verifyCertificate}</h1><p>{content.verifyCertificateHelp}</p>
				<form className="verify-form" onSubmit={verify}><label>{content.certificateNumber}<span><input value={number} onChange={(event) => setNumber(event.target.value)} required /><button className="button button-primary compact-button" disabled={loading} type="submit"><Search size={16} />{loading ? content.loading : content.verify}</button></span></label></form>
				{error && <p className="form-message" role="alert">{error}</p>}
				{notFound && <p className="form-message" role="status">{content.certificateNotFound}</p>}
				{certificate && <div className="verification-result"><BadgeCheck size={20} /><div><strong>{content.certificateValid}</strong><span>{certificate.student_name} · {language === 'hi' ? certificate.course_title_hi : certificate.course_title_en}</span><small>{content.certificateNumber}: {certificate.certificate_number}</small></div></div>}
				{certificate?.revoked_at && <p className="form-message"><ShieldAlert size={16} />{content.certificateRevoked}</p>}
			</div>
		</section>
	)
}

export default VerifyCertificate