import { useState } from 'react'
import { Check, UserRound } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'

function Profile({ content, language, onLanguageChange }) {
	const { user, profile, updateProfile } = useAuth()
	const [fullName, setFullName] = useState(profile?.full_name || '')
	const [phone, setPhone] = useState(profile?.phone || '')
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')
	const [busy, setBusy] = useState(false)

	async function submit(event) {
		event.preventDefault()
		setBusy(true)
		setError('')
		setNotice('')
		try {
			await updateProfile({ fullName, phone, preferredLanguage: language })
			setNotice(content.profileSaved)
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="profile-page">
			<header className="page-intro-row"><div><p className="section-kicker">{content.accountSettings}</p><h1>{content.profileTitle}</h1><p>{content.profileIntro}</p></div></header>
			<section className="profile-settings-panel">
				<div className="profile-summary"><span className="profile-large-avatar"><UserRound size={25} /></span><div><strong>{profile?.full_name || user?.email}</strong><span>{user?.email}</span></div></div>
				<form className="settings-form" onSubmit={submit}>
					<label>{content.fullName}<input required maxLength="255" value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
					<label>{content.phoneOptional}<input autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" /></label>
					<label>{content.languagePreference}<select value={language} onChange={(event) => onLanguageChange(event.target.value)}><option value="en">English</option><option value="hi">हिन्दी</option></select></label>
					{error && <p className="form-message" role="alert">{error}</p>}
					{notice && <p className="form-notice" role="status">{notice}</p>}
					<button className="button button-primary compact-button" disabled={busy} type="submit">{busy ? content.loading : content.saveChanges}<Check size={16} /></button>
				</form>
			</section>
		</div>
	)
}

export default Profile