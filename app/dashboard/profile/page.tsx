/* eslint-disable @next/next/no-img-element */
import { requireActiveProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, DashboardFrame, DataTable, Empty, StatusBadge } from '@/app/components/portal-ui'
import { updatePersonalProfile, updateThemePreference, uploadProfileAvatar } from '@/app/profile-actions'

type Row = Record<string, unknown>
const rows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : []
const value = (row: Row, key: string) => String(row[key] ?? '')
const labelDate = (value: unknown) => value ? new Date(String(value)).toLocaleDateString() : '—'

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ notice }, profile] = await Promise.all([searchParams, requireActiveProfile()])
  const supabase = await createClient()
  const avatarUrl = profile.avatar_path
    ? supabase.storage.from('profile-avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null

  const isStudent = profile.role === 'STUDENT'
  const resultQuery = isStudent
    ? supabase.from('published_results')
        .select('id,offering_id,coursework_mark,exam_mark,total_mark,grade,grade_value,published_at')
        .eq('student_id', profile.id).eq('publication_status', 'PUBLISHED').order('published_at', { ascending: false })
    : null
  const assignmentQuery = !isStudent
    ? supabase.from('course_staff').select('offering_id,assignment_role').eq('user_id', profile.id)
    : null
  const [resultResponse, assignmentResponse] = await Promise.all([
    resultQuery ?? Promise.resolve({ data: [], error: null }),
    assignmentQuery ?? Promise.resolve({ data: [], error: null }),
  ])
  const results = rows(resultResponse.data)
  const assignments = rows(assignmentResponse.data)
  const offeringIds = [...new Set([
    ...results.map((item) => value(item, 'offering_id')),
    ...assignments.map((item) => value(item, 'offering_id')),
  ])]
  const [offeringResponse, departmentResponse] = await Promise.all([
    offeringIds.length
      ? supabase.from('course_offerings').select('id,course_id,semester_id,group_name').in('id', offeringIds)
      : Promise.resolve({ data: [], error: null }),
    profile.department_id
      ? supabase.from('departments').select('id,code,name').eq('id', profile.department_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  const offerings = rows(offeringResponse.data)
  const courseIds = [...new Set(offerings.map((item) => value(item, 'course_id')))]
  const semesterIds = [...new Set(offerings.map((item) => value(item, 'semester_id')))]
  const [courseResponse, semesterResponse] = await Promise.all([
    courseIds.length ? supabase.from('courses').select('id,code,title,credit_units').in('id', courseIds) : Promise.resolve({ data: [], error: null }),
    semesterIds.length ? supabase.from('semesters').select('id,name,academic_year_id').in('id', semesterIds) : Promise.resolve({ data: [], error: null }),
  ])
  const courses = rows(courseResponse.data)
  const semesters = rows(semesterResponse.data)
  const offeringLabel = (offeringId: string) => {
    const offering = offerings.find((item) => value(item, 'id') === offeringId)
    const course = courses.find((item) => value(item, 'id') === value(offering ?? {}, 'course_id'))
    const semester = semesters.find((item) => value(item, 'id') === value(offering ?? {}, 'semester_id'))
    return (course ? value(course, 'code') + ' · ' + value(course, 'title') : 'Course') + ' / ' + (semester ? value(semester, 'name') : 'Semester') + (offering && value(offering, 'group_name') ? ' / ' + value(offering, 'group_name') : '')
  }
  const pageHasError = Boolean(resultResponse.error || assignmentResponse.error || offeringResponse.error || departmentResponse.error || courseResponse.error || semesterResponse.error)

  return <DashboardFrame profile={profile}>
    <main className="content">
      <section className="welcome"><div><div className="kicker">PERSONAL ACCOUNT</div><h1>My profile</h1><p>Manage your personal details, appearance and account information.</p></div><span className="tag">PRIVATE PROFILE</span></section>
      {notice && <div className="notice" role="status">{notice}</div>}
      {pageHasError && <div className="notice error" role="alert">Some personal records could not be loaded. Refresh the page or contact support.</div>}
      <div className="grid">
        <Card title="Profile picture" note="Use a clear JPG, PNG or WebP image up to 2 MB.">
          <div className="profile-photo-layout">
            {avatarUrl ? <img className="profile-photo" src={avatarUrl} alt="Your profile" /> : <div className="profile-photo profile-photo-placeholder">{profile.full_name.trim().split(/\s+/).map((part) => part[0]).slice(0,2).join('').toUpperCase()}</div>}
            <form action={uploadProfileAvatar} className="profile-upload-form">
              <div className="field"><label htmlFor="avatar">Choose a new picture</label><input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required /></div>
              <button type="submit">Upload profile picture</button>
            </form>
          </div>
        </Card>
        <Card title="Personal information" note="Your email and institutional role are managed by the examinations administrator.">
          <form action={updatePersonalProfile}>
            <div className="field"><label htmlFor="full_name">Display name</label><input id="full_name" name="full_name" defaultValue={profile.full_name} minLength={2} maxLength={120} required /></div>
            <div className="field"><label>Email address</label><input value={profile.institutional_email} disabled readOnly /></div>
            <div className="form-grid">
              <div className="field"><label>Account role</label><input value={profile.role} disabled readOnly /></div>
              <div className="field"><label>Account status</label><input value={profile.account_status} disabled readOnly /></div>
              {profile.student_number && <div className="field"><label>Student number</label><input value={profile.student_number} disabled readOnly /></div>}
              {profile.staff_number && <div className="field"><label>Staff number</label><input value={profile.staff_number} disabled readOnly /></div>}
              <div className="field"><label>Faculty / department</label><input value={departmentResponse.data?.name ?? 'Not assigned'} disabled readOnly /></div>
            </div>
            <button type="submit">Save personal details</button>
          </form>
        </Card>
        <Card title="Appearance" note="Your preference is saved to your account and follows you when you sign in on another device.">
          <form action={updateThemePreference} className="theme-preference-form">
            <div className="field"><label htmlFor="theme_preference">Theme</label><select id="theme_preference" name="theme_preference" defaultValue={profile.theme_preference ?? 'system'}><option value="light">Light</option><option value="dark">Dark</option><option value="system">Use device setting</option></select></div>
            <button type="submit">Save appearance</button>
          </form>
          <p className="subtle">The portal keeps MUST navy and gold accents across all appearance modes.</p>
        </Card>
        {isStudent ? <Card title="My academic record" note="Only results officially published for your student account are displayed.">
          {results.length ? <DataTable headings={['Course', 'Coursework / 40', 'Exam / 60', 'Total', 'Grade', 'Published']}>
            {results.map((item) => <tr key={value(item, 'id')}><td>{offeringLabel(value(item, 'offering_id'))}</td><td>{value(item, 'coursework_mark') || '—'}</td><td>{value(item, 'exam_mark') || '—'}</td><td><strong>{value(item, 'total_mark')}</strong></td><td><StatusBadge value={value(item, 'grade')} /></td><td>{labelDate(item.published_at)}</td></tr>)}
          </DataTable> : <Empty>No published academic results are available for your account yet. Results appear here after official publication.</Empty>}
        </Card> : <Card title="My assigned academic work" note="These are the course offerings currently assigned to your staff account.">
          {assignments.length ? <DataTable headings={['Course offering', 'Assignment role']}>
            {assignments.map((item, index) => <tr key={value(item, 'offering_id') + index}><td>{offeringLabel(value(item, 'offering_id'))}</td><td>{value(item, 'assignment_role')}</td></tr>)}
          </DataTable> : <Empty>No course offerings are currently assigned to your account.</Empty>}
        </Card>}
      </div>
    </main>
  </DashboardFrame>
}
