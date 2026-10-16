import { ArrowLeft, Compass } from 'lucide-react'

function NotFound({ content }) {
	return <section className="not-found-page"><span className="not-found-icon"><Compass size={25} /></span><p className="section-kicker">404</p><h1>{content.notFoundTitle}</h1><p>{content.notFoundHelp}</p><a className="button button-primary compact-button" href="/dashboard"><ArrowLeft size={16} />{content.goDashboard}</a></section>
}

export default NotFound