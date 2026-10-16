import { CircleHelp, Mail } from 'lucide-react'

function Help({ content }) {
	return <section className="help-page"><span className="help-mark"><CircleHelp size={25} /></span><p className="section-kicker">{content.helpKicker}</p><h1>{content.helpTitle}</h1><p>{content.helpIntro}</p><div className="help-contact"><Mail size={18} /><span>{content.helpContactAdmin}</span></div></section>
}

export default Help