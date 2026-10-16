import { useEffect, useState } from 'react'
import {
	Award,
	BookOpen,
	ChevronDown,
	CircleDollarSign,
	HelpCircle,
	LayoutDashboard,
	LogOut,
	Menu,
	PanelLeftClose,
	PanelLeftOpen,
	Settings,
	ShieldCheck,
	UserRound,
	X,
} from 'lucide-react'
import { useAuth } from '../../context/useAuth.js'
import { api } from '../../services/api.js'
import { signOut } from '../../services/authService.js'

const navigation = [
	{ key: 'overview', href: '/dashboard', icon: LayoutDashboard },
	{ key: 'explore', href: '/courses', icon: BookOpen },
	{ key: 'learning', href: '/my-learning', icon: BookOpen },
	{ key: 'payments', href: '/payments', icon: CircleDollarSign },
	{ key: 'certificates', href: '/certificates', icon: Award },
	{ key: 'profile', href: '/profile', icon: UserRound },
	{ key: 'help', href: '/help', icon: HelpCircle },
]

function initials(name = '') {
	return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'KP'
}

function DashboardLayout({ children, content, language, onLanguageChange, currentPath }) {
	const { user, csrfToken, profile, clearAuthState } = useAuth()
	const [collapsed, setCollapsed] = useState(false)
	const [drawerOpen, setDrawerOpen] = useState(false)
	const [profileMenuOpen, setProfileMenuOpen] = useState(false)
	const [noticeOpen, setNoticeOpen] = useState(false)
	const [pendingPayments, setPendingPayments] = useState(0)
	const [logoutError, setLogoutError] = useState('')
	const name = profile?.full_name || user?.email || content.studentFallback
	const showAdmin = profile?.role === 'admin'
	const pageTitle = content.pageTitles[currentPath]
		|| (currentPath.startsWith('/courses/') ? content.pageTitles['/courses'] : '')
		|| (currentPath.startsWith('/learning/') ? content.pageTitles['/my-learning'] : '')
		|| content.pageTitles.default

	useEffect(() => {
		let active = true
		api.orders().then(({ orders }) => {
			if (active) setPendingPayments((orders || []).filter((order) => ['pending', 'submitted'].includes(order.payment_status)).length)
		}).catch(() => {})
		return () => { active = false }
	}, [])

	useEffect(() => {
		if (!drawerOpen) return undefined
		function closeOnEscape(event) {
			if (event.key === 'Escape') closeDrawer()
		}
		window.addEventListener('keydown', closeOnEscape)
		return () => window.removeEventListener('keydown', closeOnEscape)
	}, [drawerOpen])

	async function logout() {
		setLogoutError('')
		try {
			await signOut(csrfToken)
			clearAuthState()
			window.location.assign('/login')
		} catch (error) {
			setLogoutError(error.message)
		}
	}

	function closeDrawer() {
		setDrawerOpen(false)
	}

	return (
		<div className={`dashboard-app${collapsed ? ' sidebar-collapsed' : ''}`}>
			{drawerOpen && <button className="drawer-scrim" aria-label={content.closeNavigation} onClick={closeDrawer} type="button" />}
			<aside id="dashboard-navigation" className={`dashboard-sidebar${drawerOpen ? ' drawer-open' : ''}`} aria-label={content.sidebarLabel}>
				<div className="sidebar-brand-row">
					<a className="sidebar-brand" href="/dashboard" aria-label="Kisan Pathshala dashboard">
						<span className="sidebar-brand-mark" aria-hidden="true">क</span>
						<span className="sidebar-brand-name"><strong>किसान पाठशाला</strong><small>KISAN PATHSHALA</small></span>
					</a>
					<button className="icon-button mobile-close" onClick={closeDrawer} aria-label={content.closeNavigation} type="button"><X size={18} /></button>
				</div>
				<div className="sidebar-user">
					<div className="user-avatar" aria-hidden="true">
						<span>{initials(name)}</span>
						{profile?.avatar_url && <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
					</div>
					<div className="sidebar-user-copy"><strong>{name}</strong><span>{profile?.role === 'admin' ? content.administrator : content.learner}</span></div>
				</div>
				<nav className="sidebar-nav">
					<p className="sidebar-label">{content.workspace}</p>
					{navigation.map(({ key, href, icon: Icon }) => {
						const active = currentPath === href || (href === '/courses' && currentPath.startsWith('/courses/')) || (href === '/my-learning' && currentPath.startsWith('/learning/'))
						return <a key={key} className={`sidebar-link${active ? ' active' : ''}`} href={href} onClick={closeDrawer} aria-current={active ? 'page' : undefined}>
							<Icon size={18} strokeWidth={1.8} /><span>{content.nav[key]}</span>
						</a>
					})}
					{showAdmin && <>
						<p className="sidebar-label sidebar-label-spaced">{content.administration}</p>
						<a className={`sidebar-link${currentPath === '/admin' ? ' active' : ''}`} href="/admin" onClick={closeDrawer}>
							<ShieldCheck size={18} strokeWidth={1.8} /><span>{content.nav.adminOverview}</span>
						</a>
						<a className={`sidebar-link${currentPath === '/admin/courses' ? ' active' : ''}`} href="/admin/courses" onClick={closeDrawer}>
							<BookOpen size={18} strokeWidth={1.8} /><span>{content.nav.adminCourses}</span>
						</a>
						<a className={`sidebar-link${currentPath === '/admin/payments' ? ' active' : ''}`} href="/admin/payments" onClick={closeDrawer}>
							<ShieldCheck size={18} strokeWidth={1.8} /><span>{content.nav.adminPayments}</span>
						</a>
						<a className={`sidebar-link${currentPath === '/admin/settings' ? ' active' : ''}`} href="/admin/settings" onClick={closeDrawer}>
							<Settings size={18} strokeWidth={1.8} /><span>{content.nav.adminSettings}</span>
						</a>
					</>}
				</nav>
				<div className="sidebar-bottom">
					<p>{content.sidebarNote}</p>
					<div className="sidebar-harvest"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
				</div>
			</aside>

			<div className="dashboard-main-wrap">
				<header className="dashboard-topbar">
					<div className="topbar-leading">
						<button className="icon-button mobile-menu" onClick={() => setDrawerOpen(true)} aria-label={content.openNavigation} aria-expanded={drawerOpen} aria-controls="dashboard-navigation" type="button"><Menu size={20} /></button>
						<button className="icon-button collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? content.expandSidebar : content.collapseSidebar} type="button">
							{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
						</button>
						<div className="topbar-title"><span>{content.workspace}</span><strong>{pageTitle}</strong></div>
					</div>
					<div className="topbar-actions">
						<label className="topbar-language">
							<span className="visually-hidden">{content.languageLabel}</span>
							<select value={language} onChange={(event) => onLanguageChange(event.target.value)} aria-label={content.languageLabel}>
								<option value="en">EN</option><option value="hi">हिंदी</option>
							</select>
						</label>
						<div className="topbar-popover-wrap">
							<button className={`icon-button notification-button${noticeOpen ? ' selected' : ''}`} onClick={() => { setNoticeOpen((open) => !open); setProfileMenuOpen(false) }} aria-label={content.notifications} aria-expanded={noticeOpen} type="button">
								<CircleDollarSign size={19} />
								{pendingPayments > 0 && <span className="notification-dot" />}
							</button>
							{noticeOpen && <div className="topbar-popover notice-popover">
								<strong>{content.notifications}</strong>
								<p>{pendingPayments ? `${pendingPayments} ${content.pendingPaymentNotifications}` : content.noNewNotifications}</p>
								<a href="/payments" onClick={() => setNoticeOpen(false)}>{content.nav.payments}</a>
							</div>}
						</div>
						<div className="topbar-popover-wrap">
							<button className="topbar-profile-button" onClick={() => { setProfileMenuOpen((open) => !open); setNoticeOpen(false) }} aria-label={content.openProfileMenu} aria-expanded={profileMenuOpen} type="button">
								<span className="user-avatar user-avatar-small" aria-hidden="true"><span>{initials(name)}</span>{profile?.avatar_url && <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</span>
								<span className="topbar-profile-copy"><strong>{name}</strong><small>{profile?.email || user?.email}</small></span>
								<ChevronDown size={15} />
							</button>
							{profileMenuOpen && <div className="topbar-popover profile-popover">
								<a href="/profile" onClick={() => setProfileMenuOpen(false)}><UserRound size={16} />{content.nav.profile}</a>
								{logoutError && <p className="form-message" role="alert">{logoutError}</p>}
								<button onClick={logout} type="button"><LogOut size={16} />{content.logout}</button>
							</div>}
						</div>
					</div>
				</header>
				<main className="dashboard-content">{children}</main>
			</div>
		</div>
	)
}

export default DashboardLayout