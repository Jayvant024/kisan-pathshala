import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock3, ExternalLink, ImagePlus, QrCode, RefreshCw } from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/useAuth.js'

const money = (paise) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(paise || 0) / 100)

function statusLabel(status, content) {
	if (status === 'verified') return content.paymentVerified
	if (status === 'rejected') return content.paymentRejected
	if (status === 'submitted') return content.paymentSubmittedStatus
	return content.paymentPending
}

function Payment({ content, language }) {
	const { csrfToken } = useAuth()
	const requestedOrderId = new URLSearchParams(window.location.search).get('orderId')
	const [orders, setOrders] = useState([])
	const [settings, setSettings] = useState(null)
	const [selectedOrderId, setSelectedOrderId] = useState(requestedOrderId || '')
	const [utr, setUtr] = useState('')
	const [screenshot, setScreenshot] = useState(null)
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState('')
	const [notice, setNotice] = useState('')

	async function loadPayments() {
		const [orderResponse, settingResponse] = await Promise.all([api.orders(), api.paymentSettings()])
		setOrders(orderResponse.orders || [])
		setSettings(settingResponse)
		if (!selectedOrderId && orderResponse.orders?.length) {
			const nextOrder = orderResponse.orders.find((order) => ['pending', 'rejected'].includes(order.payment_status))
			if (nextOrder) setSelectedOrderId(nextOrder.id)
		}
	}

	useEffect(() => {
		let active = true
		Promise.all([api.orders(), api.paymentSettings()])
			.then(([orderResponse, settingResponse]) => {
				if (!active) return
				setOrders(orderResponse.orders || [])
				setSettings(settingResponse)
				if (!requestedOrderId && orderResponse.orders?.length) {
					const pending = orderResponse.orders.find((order) => ['pending', 'rejected'].includes(order.payment_status))
					if (pending) setSelectedOrderId(pending.id)
				}
			})
			.catch((requestError) => { if (active) setError(requestError.message) })
			.finally(() => { if (active) setLoading(false) })
		return () => { active = false }
	}, [requestedOrderId])

	const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId), [orders, selectedOrderId])

	async function submit(event) {
		event.preventDefault()
		if (!selectedOrder) return
		setBusy(true)
		setError('')
		setNotice('')
		const formData = new FormData()
		formData.append('utr', utr)
		if (screenshot) formData.append('screenshot', screenshot)
		try {
			await api.submitPayment(selectedOrder.id, formData, csrfToken)
			setNotice(content.paymentSubmitted)
			setUtr('')
			setScreenshot(null)
			await loadPayments()
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setBusy(false)
		}
	}

	if (loading) return <section className="dashboard-loading"><span className="loading-ring" />{content.loading}</section>

	return (
		<div className="payments-page">
			<header className="page-intro-row"><div><p className="section-kicker">{content.paymentHistoryKicker}</p><h1>{content.paymentTitle}</h1><p>{content.paymentIntro}</p></div><button className="icon-button" aria-label={content.refresh} onClick={() => { setLoading(true); loadPayments().catch((e) => setError(e.message)).finally(() => setLoading(false)) }} type="button"><RefreshCw size={17} /></button></header>
			{error && <p className="page-error" role="alert">{error}</p>}
			{notice && <p className="form-notice" role="status">{notice}</p>}
			{!orders.length ? <div className="empty-state page-empty"><span className="empty-state-icon"><QrCode size={22} /></span><strong>{content.noPayments}</strong><p>{content.noPaymentsHelp}</p><a className="button button-primary compact-button" href="/courses">{content.exploreCourses}<ArrowRight size={15} /></a></div> : <div className="payments-layout">
				<section className="payment-history-panel">
					<div className="section-heading"><div><span className="section-kicker">{content.yourActivity}</span><h2>{content.paymentRecords}</h2></div></div>
					<div className="payment-list">{orders.map((order) => <button key={order.id} className={`payment-record${selectedOrderId === order.id ? ' selected' : ''}`} onClick={() => { setSelectedOrderId(order.id); setNotice(''); setError('') }} type="button">
						<span className={`status-marker status-${order.payment_status}`}><Clock3 size={17} /></span>
						<span className="payment-record-copy"><strong>{language === 'hi' ? order.title_hi : order.title_en}</strong><small>{order.upi_utr ? `${content.utr}: ${order.upi_utr}` : statusLabel(order.payment_status, content)}</small></span>
						<span className="payment-record-amount"><strong>{money(order.amount_paise)}</strong><small>{statusLabel(order.payment_status, content)}</small></span>
					</button>)}</div>
				</section>
				{selectedOrder && <section className="checkout-panel">
					<div className="checkout-header"><span className="section-kicker">{content.payForCourse}</span><h2>{language === 'hi' ? selectedOrder.title_hi : selectedOrder.title_en}</h2><p>{content.paymentStatus}: <strong className={`status-text status-text-${selectedOrder.payment_status}`}>{statusLabel(selectedOrder.payment_status, content)}</strong></p></div>
					<div className="checkout-total"><span>{content.amount}</span><strong>{money(selectedOrder.amount_paise)}</strong></div>
					{selectedOrder.payment_status === 'verified' ? <div className="verified-panel"><CheckCircle2 size={21} /><div><strong>{content.paymentVerified}</strong><p>{content.courseAccessVerified}</p>{selectedOrder.enrollment_id && <a className="subtle-link" href={`/learning/${selectedOrder.enrollment_id}`}>{content.continueCourse}<ArrowRight size={14} /></a>}</div></div>
						: ['submitted'].includes(selectedOrder.payment_status) ? <div className="pending-panel"><Clock3 size={20} /><div><strong>{content.paymentSubmittedStatus}</strong><p>{content.awaitingVerification}</p><small>{content.submittedAt}: {selectedOrder.utr_submitted_at ? new Date(selectedOrder.utr_submitted_at).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN') : '—'}</small></div></div>
						: settings?.configured ? <>
							<div className="upi-instructions">
								{settings.qr_url ? <img className="upi-qr-image" src={settings.qr_url} alt={content.upiQr} /> : <div className="qr-placeholder"><QrCode size={38} /><span>{content.qrNotProvided}</span></div>}
								<div><span>{content.upiId}</span><strong>{settings.upi_id}</strong><a href={`upi://pay?pa=${encodeURIComponent(settings.upi_id)}&am=${(Number(selectedOrder.amount_paise) / 100).toFixed(2)}&cu=INR`} className="subtle-link">{content.openUpiApp}<ExternalLink size={14} /></a></div>
							</div>
							<p className="upi-contact-note">{content.afterPaymentContactAdmin}</p>
							{selectedOrder.payment_status === 'rejected' && selectedOrder.review_note && <p className="rejection-note"><strong>{content.reviewNote}:</strong> {selectedOrder.review_note}</p>}
							<form className="payment-submit-form" onSubmit={submit}>
								<label>{content.utr}<input autoComplete="off" required minLength="6" maxLength="32" value={utr} onChange={(event) => setUtr(event.target.value)} /></label>
								<label className="screenshot-input"><span>{content.paymentScreenshot}</span><span className="file-picker"><ImagePlus size={17} />{screenshot?.name || content.chooseImage}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setScreenshot(event.target.files?.[0] || null)} /></span><small>{content.screenshotLimit}</small></label>
								{error && <p className="form-message" role="alert">{error}</p>}
								<button className="button button-primary auth-submit" disabled={busy} type="submit">{busy ? content.loading : content.submitPayment}<ArrowRight size={16} /></button>
							</form>
						</> : <div className="config-required"><QrCode size={22} /><strong>{content.upiNotConfigured}</strong><p>{content.paymentNoAccessUntilVerified}</p></div>}
				</section>}
			</div>}
		</div>
	)
}

export default Payment