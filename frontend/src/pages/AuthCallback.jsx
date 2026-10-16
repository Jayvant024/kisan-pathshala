import { useEffect } from 'react'
import { useAuth } from '../context/useAuth.js'

function AuthCallback({ content }) {
	const { session, authLoading, profile } = useAuth()
	const oauthError = new URLSearchParams(window.location.search).get('error_description')
	const error = oauthError || (!authLoading && !session ? content.callbackError : '')

	useEffect(() => {
		if (!authLoading && session && !oauthError) window.location.replace(profile?.role === 'admin' ? '/admin' : '/dashboard')
	}, [authLoading, session, profile, oauthError])

	return (
		<section className="auth-section" aria-labelledby="auth-title">
			<div className="auth-panel auth-panel-narrow">
				<p className="eyebrow"><span aria-hidden="true">✳</span> Kisan Pathshala</p>
				<h1 id="auth-title">{content.working}</h1>
				{error && <><p className="form-message" role="alert">{error}</p><p className="auth-switch"><a href="/login">{content.login}</a></p></>}
			</div>
		</section>
	)
}

export default AuthCallback