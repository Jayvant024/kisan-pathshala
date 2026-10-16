import { useEffect } from 'react'
import { useAuth } from '../context/useAuth.js'

function LoadingRoute({ content }) {
	return <section className="auth-section"><p className="auth-intro">{content.working}</p></section>
}

export function ProtectedRoute({ children, content }) {
	const { session, authLoading } = useAuth()

	useEffect(() => {
		if (!authLoading && !session) window.location.replace('/login')
	}, [authLoading, session])

	if (authLoading) return <LoadingRoute content={content} />
	if (!session) return <LoadingRoute content={content} />
	return children
}

export function GuestRoute({ children, content }) {
	const { session, authLoading, profile } = useAuth()

	useEffect(() => {
		if (!authLoading && session) window.location.replace(profile?.role === 'admin' ? '/admin' : '/dashboard')
	}, [authLoading, session, profile])

	if (authLoading) return <LoadingRoute content={content} />
	if (session) return <LoadingRoute content={content} />
	return children
}

export function DashboardRoute({ children, content }) {
	const { session, authLoading, profile } = useAuth()

	useEffect(() => {
		if (!authLoading && !session) window.location.replace('/login')
		else if (!authLoading && profile?.role === 'admin') window.location.replace('/admin')
	}, [authLoading, session, profile])

	if (authLoading || !session || profile?.role === 'admin') return <LoadingRoute content={content} />
	return children
}

export function AdminRoute({ children, content }) {
	const { session, authLoading, profile } = useAuth()

	useEffect(() => {
		if (!authLoading && !session) window.location.replace('/login')
		else if (session && !authLoading && profile?.role !== 'admin') window.location.replace('/dashboard')
	}, [authLoading, session, profile])

	if (authLoading) return <LoadingRoute content={content} />
	if (!session || profile?.role !== 'admin') return <LoadingRoute content={content} />
	return children
}
