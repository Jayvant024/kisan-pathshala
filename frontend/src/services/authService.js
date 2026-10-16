import { api } from './api.js'

export async function signUpWithPassword({ email, password, confirmPassword, firstName, lastName, phone }) {
	return api.register({
		firstName,
		lastName,
		email: email.trim().toLowerCase(),
		password,
		confirmPassword,
		phone,
	})
}

export async function signInWithPassword({ email, password }) {
	return api.login({ email: email.trim().toLowerCase(), password })
}

export async function signInWithGoogle() {
	window.location.assign(api.googleOAuthUrl)
}

export async function getCurrentSession() {
	return api.me()
}

export async function signOut(csrfToken) {
	return api.logout(csrfToken)
}