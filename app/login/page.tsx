import Link from 'next/link'
import { login, googleSignIn } from '@/app/auth-actions'
import { PortalFooter, PortalHeader } from '@/app/components/portal-ui'
import { PasswordInput } from '@/app/components/password-input'

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 01-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0024 44z" />
      <path fill="#FBBC05" d="M12.6 27.6a12 12 0 010-7.2v-5.3H5.8a20 20 0 000 17.8l6.8-5.3z" />
      <path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.9 29.5 4 24 4A20 20 0 005.8 15.1l6.8 5.3c1.6-4.9 6.1-8.5 11.4-8.5z" />
    </svg>
  )
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string; next?: string }> }) {
  const { notice, next } = await searchParams
  return (
    <><PortalHeader nav /><main className="auth-wrap">
      <section className="auth-art"><div className="auth-brand-note">MUST EXAMINATION SERVICES</div><div><div className="kicker">SECURE ACADEMIC WORKSPACE</div><h1>One trusted record for every result.</h1><p>Role-based access supports teaching staff, reviewers, the registrar and students.</p></div><a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">Visit MUST website ↗</a></section>
      <section className="auth-card-wrap"><div className="auth-card">
        <div className="kicker">WELCOME BACK</div><h1>Sign in</h1><p className="muted">Use the email address registered with your account.</p>
        {notice && <div className="notice">{notice}</div>}
        <form action={login}>
          <input type="hidden" name="next" value={next || '/dashboard'} />
          <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" required /></div>
          <div className="field"><label htmlFor="password">Password</label><PasswordInput id="password" name="password" autoComplete="current-password" required /></div>
          <button type="submit">Sign in securely</button>
          <p className="auth-foot auth-recovery-link"><Link href="/forgot-password">Forgot your password?</Link></p>
        </form>
        <div className="auth-divider"><span>OR</span></div>
        <form action={googleSignIn}>
          <button type="submit" className="google-signin-button"><GoogleMark /><span>Continue with Google</span></button>
        </form>
        <p className="auth-foot">New student? <Link href="/register">Create an account</Link>. New accounts require email verification and administrator approval. <a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">MUST website</a>.</p>
      </div></section>
    </main><PortalFooter /></>
  )
}
