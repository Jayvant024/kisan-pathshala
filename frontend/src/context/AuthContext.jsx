import { useEffect, useState } from 'react'
import { api } from '../services/api.js'
import { AuthContext } from './authContext.js'

export function AuthProvider({ children }) {
	const [session, setSession] = useState(null)
	const [authLoading, setAuthLoading] = useState(true)
	const [profile, setProfile] = useState(null)
	const [profileLoading, setProfileLoading] = useState(true)
	const [profileError, setProfileError] = useState('')
	const [csrfToken, setCsrfToken] = useState('')
	async function refreshUser() {
		setAuthLoading(true)
		setProfileLoading(true)
		setProfileError('')
		try {
			const response = await api.me()
			setSession({ user: response.user })
			setProfile(response.user)
			setCsrfToken(response.csrfToken || '')
			return response.user
		} catch (error) {
			setSession(null)
			setProfile(null)
			setCsrfToken('')
			if (error.status !== 401) setProfileError(error.message)
			throw error
		} finally {
			setAuthLoading(false)
			setProfileLoading(false)
		}
	}
	function clearAuthState() {
		setSession(null)
		setProfile(null)
		setCsrfToken('')
		setProfileError('')
	}
	async function updateProfile(details) {
		const response = await api.updateProfile(details, csrfToken)
		setProfile(response.user)
		setSession({ user: response.user })
		return response.user
	}

	useEffect(() => {
		let active = true
		api.me()
			.then((response) => {
				if (!active) return
				setSession({ user: response.user })
				setProfile(response.user)
				setCsrfToken(response.csrfToken || '')
			})
			.catch((error) => {
				if (!active) return
				setSession(null)
				setProfile(null)
				setCsrfToken('')
				if (error.status !== 401) setProfileError(error.message)
			})
			.finally(() => {
				if (!active) return
				setAuthLoading(false)
				setProfileLoading(false)
			})
		return () => { active = false }
	}, [])

	return (
		<AuthContext.Provider value={{ session, user: session?.user || null, authLoading, profile, profileLoading, profileError, csrfToken, updateProfile, refreshUser, clearAuthState }}>
			{children}
		</AuthContext.Provider>
	)
}
