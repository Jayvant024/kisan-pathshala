import { useState } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/useAuth.js'
import { api } from '../services/api.js'

const money = (paise) => new Intl.NumberFormat('en-IN', {
	style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(paise || 0) / 100)

function VerifyPaymentButton({ order, content, language, onVerified, disabled = false }) {
	const { csrfToken } = useAuth()
	const [busy, setBusy] = useState(false)
	const [verified, setVerified] = useState(order.payment_status === 'verified')
	const [error, setError] = useState('')
	const courseName = language === 'hi' ? order.title_hi : order.title_en
	const customerName = order.customer_name || order.student_name || order.email

	async function verifyPayment() {
		const details = [
			content.paymentVerificationConfirmation,
			'',
			`${content.adminCustomer}: ${customerName}`,
			`${content.course}: ${courseName}`,
			`${content.amount}: ${money(order.amount_paise)}`,
		].join('\n')
		if (!window.confirm(details)) return
		setBusy(true)
		setError('')
		try {
			await api.reviewPayment(order.id, 'approved', '', csrfToken, true)
			setVerified(true)
			onVerified?.(order.id)
		} catch (requestError) {
			setError(requestError.message)
		} finally {
			setBusy(false)
		}
	}

	if (verified) return <span className="lesson-complete-label"><CheckCircle2 size={16} />{content.accessGranted}</span>

	return <span className="verify-payment-action">
		<button className="button button-primary compact-button" disabled={disabled || busy} onClick={verifyPayment} type="button">
			<Check size={16} />{busy ? content.loading : content.verifyAndGrantAccess}
		</button>
		{error && <small className="form-message" role="alert">{error}</small>}
	</span>
}

export default VerifyPaymentButton