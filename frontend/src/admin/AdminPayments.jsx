import { useEffect, useState } from 'react'
import { Check, Image, RefreshCw, X } from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/useAuth.js'
import VerifyPaymentButton from './VerifyPaymentButton.jsx'

const money = (paise) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(paise || 0) / 100)

function statusLabel(status, content) {
	if (status === 'verified') return content.accessGranted
	if (status === 'rejected') return content.paymentRejected
	if (status === 'submitted') return content.paymentSubmittedStatus
	return content.paymentPending
}

function AdminPayments({ content, language }) {
	const { csrfToken } = useAuth()
	const [orders, setOrders] = useState([])
	const [proofUrls, setProofUrls] = useState({})
	const [notes, setNotes] = useState({})
	const [loading, setLoading] = useState(true)
	const [busyOrder, setBusyOrder] = useState('')
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	async function refresh() {
		const response = await api.adminPayments()
		setOrders(response.orders || [])
	}

	useEffect(() => {
		let active = true
		const generatedUrls = []
		api.adminPayments().then(async (response) => {
			if (!active) return
			const rows = response.orders || []
			setOrders(rows)
			const proofs = await Promise.all(rows.filter((row) => row.has_screenshot).map(async (row) => {
				try {
					const url = await api.adminPaymentProof(row.id)
					generatedUrls.push(url)
					return [row.id, url]
				} catch { return [row.id, ''] }
			}))
			if (active) setProofUrls(Object.fromEntries(proofs.filter(([, url]) => url)))
		}).catch((requestError) => { if (active) setError(requestError.message) })
			.finally(() => { if (active) setLoading(false) })
		return () => {
			active = false
			generatedUrls.forEach((url) => URL.revokeObjectURL(url))
		}
	}, [])

	async function review(orderId, decision) {
		const note = notes[orderId]?.trim() || ''
		if (decision === 'rejected' && !note) {
			setError(content.rejectionReasonRequired)
			return
		}
		if (decision === 'rejected' && !window.confirm(content.confirmRejection)) return
		setBusyOrder(orderId)
		setError('')
		setNotice('')
		try {
			await api.reviewPayment(orderId, decision, note, csrfToken)
			setNotice(content.paymentRejectedMessage)
			const imageUrl = proofUrls[orderId]
			if (imageUrl) URL.revokeObjectURL(imageUrl)
			setProofUrls((current) => { const next = { ...current }; delete next[orderId]; return next })
			await refresh()
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setBusyOrder('')
		}
	}

	if (loading) return <section className="dashboard-loading"><span className="loading-ring" />{content.loading}</section>

	return (
		<div className="admin-payments-page">
			<header className="page-intro-row"><div><p className="section-kicker">{content.adminQueueKicker}</p><h1>{content.adminPaymentsTitle}</h1><p>{content.adminPaymentsIntro}</p></div><button className="icon-button" aria-label={content.refresh} onClick={() => { setLoading(true); refresh().catch((e) => setError(e.message)).finally(() => setLoading(false)) }} type="button"><RefreshCw size={17} /></button></header>
			{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="page-error" role="alert">{error}</p>}
			{orders.length ? <div className="admin-payment-list">{orders.map((order) => <article className="admin-payment-card" key={order.id}>
				<div className="admin-payment-heading"><div><span className={`status-pill status-${order.payment_status}`}>{statusLabel(order.payment_status, content)}</span><h2>{language === 'hi' ? order.title_hi : order.title_en}</h2><p>{order.student_name} · {order.email}</p></div><strong>{money(order.amount_paise)}</strong></div>
				<div className="admin-payment-facts"><span><small>{content.utr}</small><strong>{order.upi_utr || '—'}</strong></span><span><small>{content.submittedAt}</small><strong>{order.utr_submitted_at ? new Date(order.utr_submitted_at).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN') : '—'}</strong></span></div>
				{proofUrls[order.id] && <a className="payment-proof-link" href={proofUrls[order.id]} target="_blank" rel="noreferrer"><Image size={17} />{content.viewScreenshot}</a>}
				{['pending', 'submitted'].includes(order.payment_status) ? <div className="review-actions">
					<label>{content.rejectionReason}<input value={notes[order.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [order.id]: event.target.value }))} maxLength="2000" placeholder={content.rejectionReasonPlaceholder} /></label>
					<div><button className="button button-secondary compact-button reject-button" disabled={Boolean(busyOrder)} onClick={() => review(order.id, 'rejected')} type="button"><X size={16} />{busyOrder === order.id ? content.loading : content.reject}</button><VerifyPaymentButton order={order} content={content} language={language} disabled={Boolean(busyOrder)} onVerified={() => { setNotice(content.paymentApproved); refresh().catch((requestError) => setError(requestError.message)) }} /></div>
				</div> : <div className="review-actions"><span className={`status-pill status-${order.payment_status}`}>{statusLabel(order.payment_status, content)}</span></div>}
			</article>)}</div> : <div className="empty-state page-empty"><span className="empty-state-icon"><Check size={22} /></span><strong>{content.noPendingReviews}</strong><p>{content.reviewsClear}</p></div>}
		</div>
	)
}

export default AdminPayments