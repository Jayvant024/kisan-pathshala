import { useEffect, useState } from 'react'
import { ArrowRight, Clock3, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { api } from '../services/api.js'
import VerifyPaymentButton from './VerifyPaymentButton.jsx'

const money = (paise) => new Intl.NumberFormat('en-IN', {
	style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(paise || 0) / 100)

function AdminDashboard({ content, language }) {
	const [overview, setOverview] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	useEffect(() => {
		let active = true
		let inFlight = false
		let hasOverview = false
		async function refresh() {
			if (inFlight || document.visibilityState === 'hidden') return
			inFlight = true
			try {
				const response = await api.adminOverview()
				if (active) { setOverview(response); setError(''); hasOverview = true }
			} catch (requestError) {
				if (active && !hasOverview) setError(requestError.message)
			} finally {
				inFlight = false
				if (active) setLoading(false)
			}
		}
		refresh()
		const timer = window.setInterval(refresh, 15000)
		const onVisibilityChange = () => { if (document.visibilityState === 'visible') refresh() }
		document.addEventListener('visibilitychange', onVisibilityChange)
		return () => {
			active = false
			window.clearInterval(timer)
			document.removeEventListener('visibilitychange', onVisibilityChange)
		}
	}, [])

	if (loading && !overview) return <section className="dashboard-loading"><span className="loading-ring" />{content.loading}</section>
	if (error && !overview) return <section className="page-error" role="alert">{error}</section>

	const users = overview?.users || []
	const orders = overview?.orders || []
	const submittedCount = orders.filter((order) => order.payment_status === 'submitted').length
	const pendingCount = orders.filter((order) => order.payment_status === 'pending').length
	const nameFor = (order) => language === 'hi' ? order.title_hi : order.title_en
	const statusFor = (status) => status === 'submitted' ? content.paymentSubmittedStatus : content.paymentPending
	function markApproved(orderId) {
		setOverview((current) => ({
			...current,
			orders: current.orders.map((order) => order.id === orderId ? { ...order, payment_status: 'verified' } : order),
		}))
	}

	return (
		<div className="admin-overview-page">
			<header className="page-intro-row">
				<div><p className="section-kicker">{content.administration}</p><h1>{content.adminOverviewTitle}</h1><p>{content.adminOverviewIntro}</p></div>
				<button className="icon-button" aria-label={content.refresh} onClick={() => { setLoading(true); api.adminOverview().then(setOverview).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false)) }} type="button"><RefreshCw size={17} /></button>
			</header>
			{error && <p className="page-error" role="alert">{error}</p>}
			<div className="admin-overview-stats">
				<article><span><Users size={18} /></span><div><small>{content.registeredUsers}</small><strong>{overview?.stats?.registered_users ?? users.length}</strong></div></article>
				<article><span><ShieldCheck size={18} /></span><div><small>{content.paymentsToReview}</small><strong>{submittedCount}</strong></div></article>
				<article><span><Clock3 size={18} /></span><div><small>{content.ordersAwaitingPayment}</small><strong>{pendingCount}</strong></div></article>
			</div>
			<section className="admin-overview-section">
				<div className="section-heading"><div><span className="section-kicker">{content.adminQueueKicker}</span><h2>{content.adminCourseOrders}</h2></div><a className="subtle-link" href="/admin/payments">{content.adminPaymentsTitle}<ArrowRight size={15} /></a></div>
				{orders.length ? <div className="admin-order-list">{orders.map((order) => <article className="admin-order-row" key={order.id}>
					<div className="admin-order-main"><strong>{order.customer_name}</strong><span>{order.email}</span><small>{nameFor(order)}</small></div>
					<div className="admin-order-amount"><strong>{money(order.amount_paise)}</strong><span className={`admin-order-status status-${order.payment_status}`}>{statusFor(order.payment_status)}</span></div>
					<VerifyPaymentButton order={order} content={content} language={language} onVerified={markApproved} />
				</article>)}</div> : <div className="admin-overview-empty"><ShieldCheck size={20} /><span>{content.noOpenOrders}</span></div>}
			</section>
			<section className="admin-overview-section">
				<div className="section-heading"><div><span className="section-kicker">{content.registeredUsers}</span><h2>{content.recentAccounts}</h2></div></div>
				{users.length ? <div className="admin-users-table-wrap"><table className="admin-users-table">
					<thead><tr><th>{content.adminCustomer}</th><th>{content.adminEmail}</th><th>{content.accountRole}</th><th>{content.joinedOn}</th></tr></thead>
					<tbody>{users.map((user) => <tr key={user.id}><td>{user.full_name || user.email}</td><td>{user.email}</td><td><span className={`admin-role-label${user.role === 'admin' ? ' is-admin' : ''}`}>{user.role === 'admin' ? content.administrator : content.learner}</span></td><td>{user.created_at ? new Date(user.created_at).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN') : '—'}</td></tr>)}</tbody>
				</table></div> : <div className="admin-overview-empty"><Users size={20} /><span>{content.noRegisteredUsers}</span></div>}
			</section>
		</div>
	)
}

export default AdminDashboard
