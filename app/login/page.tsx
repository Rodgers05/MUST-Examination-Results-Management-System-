import Link from 'next/link'
import { login, googleSignIn } from '@/app/auth-actions'
import { PortalFooter, PortalHeader } from '@/app/components/portal-ui'
import { PasswordField } from '@/app/components/password-field'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string; next?: string }> }) {
  const { notice, next } = await searchParams
  return (
    <><PortalHeader nav /><main className="auth-wrap">
      <section className="auth-art"><div className="auth-brand-note">MUST EXAMINATION SERVICES</div><div><div className="kicker">SECURE ACADEMIC WORKSPACE</div><h1>One trusted record for every result.</h1><p>Role-based access supports teaching staff, reviewers, the registrar and students.</p></div><a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">Visit MUST website ↗</a></section>
      <section className="auth-card-wrap"><div className="auth-card">
        <div className="kicker">WELCOME BACK</div><h1>Sign in</h1><p className="muted">Sign in using the email address registered to your account.</p>
        {notice && <div className="notice">{notice}</div>}
        <form action={login}>
          <input type="hidden" name="next" value={next || '/dashboard'} />
          <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" required /></div>
          <div className="field"><label htmlFor="password">Password</label><PasswordField id="password" autoComplete="current-password" /></div>
          <button type="submit">Sign in securely</button>
        <p className="auth-foot"><Link href="/forgot-password">Forgot your password?</Link></p>
        </form>
        <div className="auth-divider"><span>OR</span></div>
        <form action={googleSignIn}><button type="submit" className="secondary">Continue with Google</button></form>
        <p className="auth-foot">New student? <Link href="/register">Create an account</Link>. New accounts require email verification and administrator approval. <a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">MUST website</a>.</p>
      </div></section>
    </main><PortalFooter /></>
  )
}
