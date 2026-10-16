import { useState } from 'react'
import { signInWithGoogle, signInWithPassword } from '../services/authService.js'
import { useAuth } from '../context/useAuth.js'
import { roleHomePath } from '../utils/authRouting.js'

function Login({ content }) {
	const { refreshUser } = useAuth()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [notice] = useState(() => {
		const params = new URLSearchParams(window.location.search)
		if (params.has('registered')) return content.registrationSuccess
		const oauthResult = params.get('oauth')
		if (oauthResult === 'account_exists') return content.googleAccountExists
		if (oauthResult === 'google_cancelled') return content.googleCancelled
		if (oauthResult === 'google_failed') return content.callbackError
		return ''
	})
	const [busy, setBusy] = useState(false)
	const [showPassword, setShowPassword] = useState(false)

	async function submit(event) {
		event.preventDefault()
		setError('')
		setBusy(true)
		try {
			await signInWithPassword({
				email,
				password,
				messages: content,
			})
			const user = await refreshUser()
			window.location.assign(roleHomePath(user))
		} catch (requestError) {
			setError(requestError.message)
		}
		setBusy(false)
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

	return (
		<section className="auth-section" aria-labelledby="auth-title">
			<div className="auth-panel auth-panel-narrow">
				<p className="eyebrow"><span aria-hidden="true">✳</span> Kisan Pathshala</p>
				<h1 id="auth-title">{content.loginTitle}</h1>
				<p className="auth-intro">{content.loginIntro}</p>
				{notice && <p className="form-notice" role="status">{notice}</p>}
				<form className="auth-form" onSubmit={submit}>
					<label>{content.email}
						<input autoComplete="email" maxLength="254" placeholder="name@example.com" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
					</label>
					<label>{content.password}
						<div className="password-input-row">
							<input autoComplete="current-password" required type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} />
							<button className="text-button" onClick={() => setShowPassword((visible) => !visible)} type="button">{showPassword ? content.hidePassword : content.showPassword}</button>
						</div>
					</label>
					{error && <p className="form-message" role="alert">{error}</p>}
					<button className="button button-primary auth-submit" disabled={busy} type="submit">
						{busy ? content.working : content.login}
					</button>
				</form>
				<div className="auth-divider"><span>{content.or}</span></div>
				<button className="google-button" disabled={busy} onClick={continueWithGoogle} type="button"><span className="google-mark" aria-hidden="true">G</span>{content.continueGoogle}</button>
				<p className="auth-switch">{content.noAccount} <a href="/register">{content.register}</a></p>
			</div>
		</section>
	)
}

export default Login
