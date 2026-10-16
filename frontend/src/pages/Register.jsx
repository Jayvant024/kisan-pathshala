import { useRef, useState } from 'react'
import { signInWithGoogle, signOut, signUpWithPassword } from '../services/authService.js'

function Register({ content }) {
	const [values, setValues] = useState({ countryCode: '+91' })
	const [error, setError] = useState('')
	const [busy, setBusy] = useState(false)
	const [showPassword, setShowPassword] = useState(false)
	const submitting = useRef(false)

	async function submit(event) {
		event.preventDefault()
		if (submitting.current) return
		setError('')
		const firstName = values.firstName.trim()
		const lastName = values.lastName.trim()
		const phoneDigits = (values.phone || '').replace(/\D/g, '')
		if (!firstName || !lastName) return setError(content.nameRequired)
		if ((values.countryCode === '+91' && phoneDigits.length !== 10) || phoneDigits.length < 7 || phoneDigits.length > 14) return setError(content.invalidPhone)
		if ((values.password || '').length < 8) return setError(content.passwordTooShort)
		if (values.password !== values.confirmPassword) return setError(content.passwordMismatch)
		submitting.current = true
		setBusy(true)
		try {
			const response = await signUpWithPassword({
				email: values.email,
				password: values.password,
				confirmPassword: values.confirmPassword,
				firstName,
				lastName,
				phone: `${values.countryCode}${phoneDigits}`,
				messages: content,
			})
			try {
				await signOut(response.csrfToken)
			} catch {
				window.location.assign('/dashboard')
				return
			}
			window.location.assign('/login?registered=1')
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			submitting.current = false
			setBusy(false)
		}
	}

	async function continueWithGoogle() {
		setError('')
		setBusy(true)
		try {
			await signInWithGoogle()
		} catch (requestError) {
			setError(requestError.message)
			setBusy(false)
		}
	}

	function update(field, value) {
		setError('')
		setValues((current) => ({ ...current, [field]: value }))
	}

	return (
		<section className="auth-section" aria-labelledby="auth-title">
			<div className="auth-panel">
				<p className="eyebrow"><span aria-hidden="true">✳</span> Kisan Pathshala</p>
				<h1 id="auth-title">{content.registerTitle}</h1>
				<p className="auth-intro">{content.registerIntro}</p>
				<form className="auth-form" onSubmit={submit}>
					<div className="form-row">
						<label>{content.firstName}<input autoComplete="given-name" maxLength="80" required value={values.firstName || ''} onChange={(event) => update('firstName', event.target.value)} /></label>
						<label>{content.lastName}<input autoComplete="family-name" maxLength="80" required value={values.lastName || ''} onChange={(event) => update('lastName', event.target.value)} /></label>
					</div>
					<label>{content.phone}
						<div className="phone-input-row">
							<select aria-label={content.countryCode} value={values.countryCode} onChange={(event) => update('countryCode', event.target.value)}>
								<option value="+91">India (+91)</option><option value="+1">United States (+1)</option><option value="+44">United Kingdom (+44)</option><option value="+977">Nepal (+977)</option><option value="+880">Bangladesh (+880)</option>
							</select>
							<input aria-label={content.phone} autoComplete="tel-national" inputMode="tel" maxLength="14" required type="tel" value={values.phone || ''} onChange={(event) => update('phone', event.target.value)} />
						</div>
					</label>
					<label>{content.email}<input autoComplete="email" maxLength="254" required type="email" value={values.email || ''} onChange={(event) => update('email', event.target.value)} /></label>
					<label>{content.password}
						<div className="password-input-row">
							<input autoComplete="new-password" minLength="8" required type={showPassword ? 'text' : 'password'} value={values.password || ''} onChange={(event) => update('password', event.target.value)} />
							<button className="text-button" onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? content.hidePassword : content.showPassword}</button>
						</div>
					</label>
					<label>{content.confirmPassword}<input autoComplete="new-password" minLength="8" required type={showPassword ? 'text' : 'password'} value={values.confirmPassword || ''} onChange={(event) => update('confirmPassword', event.target.value)} /></label>
					{error && <p className="form-message" role="alert">{error}</p>}
					<button className="button button-primary auth-submit" disabled={busy} type="submit">{busy ? content.working : content.createAccount}</button>
				</form>
				<div className="auth-divider"><span>{content.or}</span></div>
				<button className="google-button" disabled={busy} onClick={continueWithGoogle} type="button"><span className="google-mark" aria-hidden="true">G</span>{content.continueGoogle}</button>
				<p className="auth-switch">{content.haveAccount} <a href="/login">{content.login}</a></p>
			</div>
		</section>
	)
}

export default Register
