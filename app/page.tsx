import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { PortalFooter, PortalHeader } from '@/app/components/portal-ui'

export default async function HomePage() {
  const profile = await getProfile()
  if (profile?.account_status === 'ACTIVE') redirect('/dashboard')
  if (profile?.account_status === 'PENDING') redirect('/pending')

  return (
    <><PortalHeader nav /><main className="auth-wrap">
      <section className="auth-art">
        <div className="auth-brand-note">MUST RESULTS PORTAL</div>
        <div><div className="kicker">EXAMINATION RESULTS</div><h1>Manage examination results.</h1><p>Lecturers enter marks. Reviewers check them. The Registrar approves and publishes results.</p></div>
        <p>MBARARA UNIVERSITY OF SCIENCE AND TECHNOLOGY</p>
      </section>
      <section className="auth-card-wrap"><div className="auth-card">
        <div className="kicker">WELCOME</div><h1>Examination Results Portal</h1>
        <p className="muted">Sign in to view your workspace. New student accounts must be verified and approved.</p>
        <Link className="button" href="/login">Sign in</Link>
        <div style={{height:12}} />
        <Link className="button secondary" href="/register">Register as a student</Link>
        <p className="auth-foot">Need help? Contact the examinations office or visit <a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">must.ac.ug</a>.</p>
      </div></section>
    </main><PortalFooter /></>
  )
}
