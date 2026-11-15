import Link from 'next/link'
import { register, resendSignupConfirmation } from '@/app/auth-actions'
import { PortalFooter, PortalHeader } from '@/app/components/portal-ui'

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams
  return (
    <><PortalHeader nav /><main className="auth-wrap">
      <section className="auth-art"><div className="auth-brand-note">MUST EXAMINATION SERVICES</div><div><div className="kicker">STUDENT ACCOUNT REQUEST</div><h1>Start with a verified email address.</h1><p>Registration creates a pending student profile. Staff roles are assigned by an administrator.</p></div><a href="https://www.must.ac.ug/" target="_blank" rel="noreferrer">Visit MUST website ↗</a></section>
      <section className="auth-card-wrap"><div className="auth-card">
        <div className="kicker">CREATE ACCOUNT</div><h1>Student registration</h1><p className="muted">Use any valid email address that you can access.</p>
        {notice && <div className="notice error">{notice}</div>}
        <form action={register}>
          <div className="field"><label htmlFor="full_name">Full name</label><input id="full_name" name="full_name" autoComplete="name" minLength={2} maxLength={120} required /></div>
          <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={12} pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{12,}" title="At least 12 characters, including uppercase, lowercase and a number." required /><small className="subtle">At least 12 characters, with uppercase, lowercase and a number.</small></div>
          <button type="submit">Request student account</button>
        </form>
        <div className="auth-divider"><span>ALREADY HAVE AN ACCOUNT?</span></div>
        <form action={resendSignupConfirmation}>
          <div className="field"><label htmlFor="resend_email">Resend confirmation email</label><input id="resend_email" name="email" type="email" autoComplete="email" placeholder="Enter your registered email" required /></div>
          <button type="submit" className="secondary-button">Resend confirmation email</button>
        </form>
        <p className="auth-foot">Already verified? <Link href="/login">Sign in</Link>. Accounts require administrator approval.</p>
      </div></section>
    </main><PortalFooter /></>
  )
}
