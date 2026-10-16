import { useEffect, useState } from 'react'
import { Check, QrCode } from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/useAuth.js'

function AdminSettings({ content }) {
	const { csrfToken } = useAuth()
	const [upiId, setUpiId] = useState('')
	const [qrUrl, setQrUrl] = useState('')
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	useEffect(() => {
		let active = true
		api.adminPaymentSettings().then((response) => {
			if (!active) return
			setUpiId(response.upi_id || '')
			setQrUrl(response.qr_url || '')
		}).catch((requestError) => { if (active) setError(requestError.message) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [])

	async function save(event) {
		event.preventDefault()
		setBusy(true)
		setError('')
		setNotice('')
		try {
			await api.saveAdminPaymentSettings({ upi_id: upiId, qr_url: qrUrl }, csrfToken)
			setNotice(content.settingsSaved)
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setBusy(false)
		}
	}

	if (loading) return <section className="dashboard-loading"><span className="loading-ring" />{content.loading}</section>
	return <div className="admin-settings-page">
		<header className="page-intro-row"><div><p className="section-kicker">{content.accountSettings}</p><h1>{content.adminSettingsTitle}</h1><p>{content.adminSettingsIntro}</p></div></header>
		<section className="settings-panel">
			<div className="settings-panel-heading"><span><QrCode size={21} /></span><div><h2>{content.upiPaymentSettings}</h2><p>{content.upiPaymentSettingsHelp}</p></div></div>
			<form className="settings-form" onSubmit={save}>
				<label>{content.upiId}<input value={upiId} onChange={(event) => setUpiId(event.target.value)} required maxLength="160" autoComplete="off" /></label>
				<label>{content.qrImageUrl}<input type="url" value={qrUrl} onChange={(event) => setQrUrl(event.target.value)} placeholder="https://…" /></label>
				{qrUrl && <img className="settings-qr-preview" src={qrUrl} alt={content.qrPreview} />}
				{error && <p className="form-message" role="alert">{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}
				<button className="button button-primary compact-button" disabled={busy} type="submit">{busy ? content.loading : content.savePaymentSettings}<Check size={16} /></button>
			</form>
		</section>
	</div>
}

export default AdminSettings