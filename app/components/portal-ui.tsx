import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Profile } from '@/lib/auth'
import { getStatusAppearance } from '@/lib/status.mjs'

function WorkspaceLinks({ profile }: { profile: Profile }) {
  return <>
    <a href="#overview">Overview</a>
    <Link href="/dashboard/profile">My profile</Link>
    <a href="#catalogue">Course catalogue</a>
    {profile.role === 'LECTURER' && <><Link href="/dashboard/lecturer">Lecturer marks workspace</Link><a href="#assessments">Assessment setup</a><a href="#marks">Batch marks</a></>}
    {['REVIEWER', 'REGISTRAR', 'ADMIN'].includes(profile.role) && <a href="#workflow">Results workflow</a>}
    {profile.role === 'STUDENT' && <a href="#results">Published results</a>}
    {['ADMIN', 'REGISTRAR', 'REVIEWER'].includes(profile.role) && <a href="#reports">Reports</a>}
    {profile.role === 'ADMIN' && <><a href="#access">Account access</a><a href="#audit">Audit trail</a></>}
    <a href="#support">Help and support</a>
  </>
}

export function MustBrand({
  subtitle = 'Examination Results Management System',
}: {
  subtitle?: string
}) {
  return (
    <Link
      className="brand"
      href="/"
      aria-label="Mbarara University of Science and Technology home"
    >
      {/* The original crest is stored in the repository's Images folder rather than Next.js public/. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://raw.githubusercontent.com/Rodgers05/MUST-Examination-Results-Management-System-/main/Images/campus_logo.jpg"
        alt="Mbarara University of Science and Technology crest"
        width={58}
        height={58}
        className="brand-logo"
      />

      <span className="brand-text">
        <strong>Mbarara University of Science and Technology</strong>
        <small>{subtitle}</small>
      </span>
    </Link>
  )
}
export function PortalHeader({ nav = false }: { nav?: boolean }) {
  return (
    <header className="site-header">
      <MustBrand />
      {nav && (
        <nav className="main-nav" aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/register">Student registration</Link>
          <a href="https://www.must.ac.ug/" target="_blank" rel="noopener noreferrer">MUST website</a>
        </nav>
      )}
    </header>
  )
}

export function PortalFooter() {
  return <footer className="site-footer"><strong>Mbarara University of Science and Technology</strong><span>Examination Results Management System · Secure academic services</span><a href="https://www.must.ac.ug/" target="_blank" rel="noopener noreferrer">Official university website</a></footer>
}

export function DashboardFrame({ profile, children }: { profile: Profile; children: ReactNode }) {
  const displayName = profile.full_name.trim() || (profile.role === 'ADMIN' ? 'System Administrator' : profile.role.charAt(0) + profile.role.slice(1).toLowerCase())
  const initials = displayName.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'MU'
  const avatarUrl = profile.avatar_path && process.env.NEXT_PUBLIC_SUPABASE_URL
    ? process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public/profile-avatars/' + profile.avatar_path
    : null
  return <div className="dashboard-shell" data-theme={profile.theme_preference ?? 'system'}>
    <aside className="sidebar">
      <MustBrand subtitle="Examination Services" />
      <div className="side-label">{profile.role} WORKSPACE</div>
      <nav className="side-nav" aria-label="Workspace navigation">
        <WorkspaceLinks profile={profile} />
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><strong>Need assistance?</strong><p>Contact your examinations coordinator for account and workflow support.</p><a href="https://www.must.ac.ug/" target="_blank" rel="noopener noreferrer">Visit MUST website →</a></div>
        <div className="sidebar-user">{avatarUrl && <img className="sidebar-avatar" src={avatarUrl} alt=""/>}<span>{profile.institutional_email}</span><small>{profile.role}</small><StatusBadge value={profile.account_status} /><Link href="/dashboard/profile">Manage profile →</Link></div>
        <form action="/auth/logout" method="post"><button className="button secondary signout" type="submit">Sign out</button></form>
      </div>
    </aside>
    <div className="dashboard-main">
      <header className="topbar"><div className="mobile-brand"><MustBrand subtitle="Examination Services" /></div><div className="topbar-title"><span className="crumb">MUST / {profile.role} workspace</span><strong>Examination Results Management System</strong></div><div className="userbar"><Link href="/dashboard/profile" className="userbar-profile" aria-label="Open my profile">{avatarUrl ? <img className="avatar avatar-image" src={avatarUrl} alt=""/> : <span className="avatar" aria-hidden="true">{initials}</span>}<span className="user-meta"><strong>{displayName}</strong><small>{profile.role}</small><StatusBadge value={profile.account_status} /></span></Link></div></header>
      <div className="mobile-nav"><details><summary>Workspace menu</summary><nav aria-label="Mobile workspace navigation"><WorkspaceLinks profile={profile} /></nav></details></div>
      {children}
      <PortalFooter />
    </div>
  </div>
}

export function Card({ id, title, note, children }: { id?: string; title: string; note?: string; children: ReactNode }) {
  return <section className="card" id={id}><div className="card-head"><div><h2>{title}</h2>{note && <p className="subtle">{note}</p>}</div></div>{children}</section>
}

export function Empty({ children = 'No records are available for this account yet.' }: { children?: ReactNode }) { return <div className="empty">{children}</div> }

export function DataTable({ headings, children }: { headings: string[]; children: ReactNode }) {
  return <div className="table-wrap" role="region" aria-label={`${headings.join(', ')} table`} tabIndex={0}><table><thead><tr>{headings.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}

export function StatusBadge({ value }: { value: unknown }) {
  const { label, tone } = getStatusAppearance(value)
  return <span className={'status status-' + tone} aria-label={'Status: ' + label}>{label}</span>
}
