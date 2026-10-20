import { useState } from 'react'
import en from './i18n/en.js'
import hi from './i18n/hi.js'
import Register from './pages/Register.jsx'
import Login from './pages/Login.jsx'
import AuthCallback from './pages/AuthCallback.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Courses from './pages/Courses.jsx'
import CourseDetails from './pages/CourseDetails.jsx'
import MyCourses from './pages/MyCourses.jsx'
import Learning from './pages/Learning.jsx'
import Payment from './pages/Payment.jsx'
import Certificate from './pages/Certificate.jsx'
import VerifyCertificate from './pages/VerifyCertificate.jsx'
import Profile from './pages/Profile.jsx'
import AdminDashboard from './admin/AdminDashboard.jsx'
import AdminCourses from './admin/AdminCourses.jsx'
import AdminPayments from './admin/AdminPayments.jsx'
import AdminSettings from './admin/AdminSettings.jsx'
import Help from './pages/Help.jsx'
import NotFound from './pages/NotFound.jsx'
import DeveloperBadge from './components/common/DeveloperBadge.jsx'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import { AdminRoute, DashboardRoute, GuestRoute, ProtectedRoute } from './routes/AppRoutes.jsx'
import { useAuth } from './context/useAuth.js'
import './App.css'

function App() {
  const [language, setLanguage] = useState(() => localStorage.getItem('kp-language') || 'en')
  const { user, updateProfile } = useAuth()
  const content = language === 'hi' ? hi : en
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  let page = null

  const privatePage = (child) => (
    <ProtectedRoute content={content.auth}>
      <DashboardLayout content={content} language={language} onLanguageChange={changeLanguage} currentPath={path}>
        {child}
      </DashboardLayout>
    </ProtectedRoute>
  )

  const adminPage = (child) => (
    <AdminRoute content={content.auth}>
      <DashboardLayout content={content} language={language} onLanguageChange={changeLanguage} currentPath={path}>
        {child}
      </DashboardLayout>
    </AdminRoute>
  )

  if (path === '/register') page = <Register content={content.auth} />
  else if (path === '/login') page = <GuestRoute content={content.auth}><Login content={content.auth} /></GuestRoute>
  else if (path === '/auth/callback') page = <AuthCallback content={content.auth} />
  else if (path === '/dashboard') page = (
    <DashboardRoute content={content.auth}>
      <DashboardLayout content={content} language={language} onLanguageChange={changeLanguage} currentPath={path}>
        <Dashboard content={content} language={language} />
      </DashboardLayout>
    </DashboardRoute>
  )
  else if (path === '/courses') page = privatePage(<Courses content={content} language={language} />)
  else if (path.startsWith('/courses/')) page = privatePage(<CourseDetails content={content} language={language} />)
  else if (path === '/my-learning') page = privatePage(<MyCourses content={content} language={language} />)
  else if (path.startsWith('/learning/')) page = privatePage(<Learning content={content} language={language} />)
  else if (path === '/payments' || path === '/payment-status') page = privatePage(<Payment content={content} language={language} />)
  else if (path === '/certificates') page = privatePage(<Certificate content={content} language={language} />)
	else if (path.startsWith('/certificates/')) page = privatePage(<Certificate content={content} language={language} />)
  else if (path.startsWith('/verify-certificate')) page = <VerifyCertificate content={content} language={language} />
  else if (path === '/profile') page = privatePage(<Profile content={content} language={language} onLanguageChange={changeLanguage} />)
  else if (path === '/admin') page = adminPage(<AdminDashboard content={content} language={language} />)
  else if (path === '/admin/courses') page = adminPage(<AdminCourses content={content} language={language} />)
  else if (path === '/admin/payments') page = adminPage(<AdminPayments content={content} language={language} />)
  else if (path === '/admin/settings') page = adminPage(<AdminSettings content={content} language={language} />)
  else if (path === '/help') page = privatePage(<Help content={content} />)
  else if (path !== '/') page = <NotFound content={content} />

  async function changeLanguage(value) {
    setLanguage(value)
    localStorage.setItem('kp-language', value)
    if (user) await updateProfile({ preferredLanguage: value }).catch(() => {})
  }

  if (page && !['/login', '/register', '/auth/callback'].includes(path) && !path.startsWith('/verify-certificate')) {
    return page
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Kisan Pathshala home">
          <span className="brand-symbol" aria-hidden="true">🌾</span>
          <span className="brand-copy">
            <span className="brand-hindi">किसान पाठशाला</span>
            <span className="brand-english">Kisan Pathshala</span>
          </span>
        </a>
        <label className="language-picker">
          <span className="visually-hidden">{content.languageLabel}</span>
          <select
            value={language}
            onChange={(event) => changeLanguage(event.target.value)}
            aria-label={content.languageLabel}
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
          </select>
        </label>
      </header>

      {page || <section className="welcome" aria-labelledby="welcome-title">
        <div className="welcome-copy">
          <p className="eyebrow"><span aria-hidden="true">✳</span> {content.platform}</p>
          <h1 id="welcome-title">{content.headline}</h1>
          <p className="introduction">{content.introduction}</p>
          <div className="actions">
            <a className="button button-primary" href={user ? '/courses' : '/login'}>
              {content.viewCourses}<span aria-hidden="true">↗</span>
            </a>
            <a className="button button-secondary" href="/login">{content.login}</a>
            <a className="button button-secondary" href="/register">{content.auth.register}</a>
          </div>
          <p className="welcome-note">{content.note}</p>
        </div>

        <div className="field-art" aria-hidden="true">
          <div className="art-sun"></div>
          <div className="art-hill art-hill-back"></div>
          <div className="art-hill art-hill-front"></div>
          <div className="field-row field-row-one"></div>
          <div className="field-row field-row-two"></div>
          <div className="field-row field-row-three"></div>
          <div className="art-label"><span>01</span>{content.artLabel}</div>
          <span className="art-sprout">🌱</span>
        </div>
      </section>}

      <footer className="site-footer">
    <span className="site-footer-copy">{content.footer}</span>
    <div className="site-footer-actions">
      <span className="footer-mark" aria-hidden="true"><span></span><span></span><span></span></span>
      <DeveloperBadge />
    </div>
      </footer>
    </main>
  )
}

export default App
