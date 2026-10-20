import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ExternalLink, X } from 'lucide-react'

const profilePhoto = '/images/jay-kangralkar.png'
const portfolioUrl = 'https://jaykangralkar024.wixstudio.com/portfolio'
const technologies = ['React', 'Node.js', 'MySQL', 'UI/UX']

function DeveloperBadge() {
	const [open, setOpen] = useState(false)
	const triggerRef = useRef(null)
	const closeRef = useRef(null)
	const dialogRef = useRef(null)

	useEffect(() => {
		if (!open) return undefined
		const previousFocus = document.activeElement
		const previousOverflow = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		closeRef.current?.focus()
		function handleKeyDown(event) {
			if (event.key === 'Escape') setOpen(false)
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => {
			window.removeEventListener('keydown', handleKeyDown)
			document.body.style.overflow = previousOverflow
			previousFocus?.focus?.()
		}
	}, [open])

	function keepFocusInside(event) {
		if (event.key !== 'Tab') return
		const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), a[href]')
		if (!focusable?.length) return
		const first = focusable[0]
		const last = focusable[focusable.length - 1]
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault()
			last.focus()
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault()
			first.focus()
		}
	}

	function closeOnBackdropClick(event) {
		if (event.target === event.currentTarget) setOpen(false)
	}

	return (
		<>
			<button
				ref={triggerRef}
				className="developer-badge"
				aria-label="Built by Jay. Open developer profile."
				aria-haspopup="dialog"
				aria-expanded={open}
				type="button"
				onClick={() => setOpen(true)}
			>
				<img src={profilePhoto} alt="" />
				<span>Built by Jay</span>
				<ExternalLink size={13} aria-hidden="true" />
			</button>
			{open && <div className="developer-profile-backdrop" onClick={closeOnBackdropClick}>
				<section
					ref={dialogRef}
					className="developer-profile-card"
					role="dialog"
					aria-modal="true"
					aria-labelledby="developer-profile-title"
					onKeyDown={keepFocusInside}
					onClick={(event) => event.stopPropagation()}
				>
					<button ref={closeRef} className="developer-profile-close" type="button" aria-label="Close developer profile" onClick={() => setOpen(false)}>
						<X size={18} />
					</button>
					<img className="developer-profile-photo" src={profilePhoto} alt="Jay Kangralkar" />
					<p className="developer-profile-kicker">DEVELOPED BY</p>
					<h2 id="developer-profile-title">Jay Kangralkar</h2>
					<p className="developer-profile-role">Full Stack Developer</p>
					<p className="developer-profile-bio">“Passionate about building meaningful web applications and digital solutions for real-world impact.”</p>
					<ul className="developer-tech-list" aria-label="Technologies">
						{technologies.map((technology) => <li key={technology}>{technology}</li>)}
					</ul>
					<a className="developer-portfolio-link" href={portfolioUrl} target="_blank" rel="noopener noreferrer">
						View My Portfolio <ArrowRight size={16} aria-hidden="true" />
					</a>
				</section>
			</div>}
		</>
	)
}

export default DeveloperBadge