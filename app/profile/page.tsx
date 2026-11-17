import Image from 'next/image'
import { requireActiveProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { DashboardFrame, Card, Empty, StatusBadge } from '@/app/components/portal-ui'
import { updateProfile, uploadProfileAvatar } from './actions'
import { ProfileAppearance } from '@/app/components/profile-appearance'

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ notice }, profile] = await Promise.all([searchParams, requireActiveProfile()])
  const supabase = await createClient()
  const [departmentResult, resultsResult, assignmentsResult, enrollmentsResult] = await Promise.all([
    profile.department_id
      ? supabase.from('departments').select('name,code').eq('id', profile.department_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    profile.role === 'STUDENT'
      ? supabase.from('published_results').select('id,offering_id,coursework_mark,exam_mark,total_mark,grade,published_at')
          .eq('student_id', profile.id).eq('publication_status', 'PUBLISHED').order('published_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    ['LECTURER', 'REVIEWER', 'REGISTRAR'].includes(profile.role)
      ? supabase.from('course_staff').select('offering_id,assignment_role').eq('user_id', profile.id)
      : Promise.resolve({ data: [], error: null }),
    profile.role === 'STUDENT'
      ? supabase.from('enrollments').select('offering_id,enrollment_status').eq('student_id', profile.id).eq('enrollment_status', 'ENROLLED')
      : Promise.resolve({ data: [], error: null }),
  ])
  const resultRows = resultsResult.data ?? []
  const offeringIds = [...new Set([
    ...(assignmentsResult.data ?? []).map((row) => row.offering_id),
    ...(enrollmentsResult.data ?? []).map((row) => row.offering_id),
    ...resultRows.map((row) => row.offering_id),
  ])]
  const offeringsResult = offeringIds.length
    ? await supabase.from('course_offerings').select('id,course_id,semester_id,group_name').in('id', offeringIds)
    : { data: [], error: null }
  const courseIds = [...new Set((offeringsResult.data ?? []).map((row) => row.course_id))]
  const coursesResult = courseIds.length
    ? await supabase.from('courses').select('id,code,title').in('id', courseIds)
    : { data: [], error: null }
  const courseById = new Map((coursesResult.data ?? []).map((course) => [course.id, course]))
  const offeringById = new Map((offeringsResult.data ?? []).map((offering) => [offering.id, offering]))
  const [attendanceSessionsResult, attendanceRecordsResult] = profile.role === 'STUDENT' && offeringIds.length
    ? await Promise.all([
        supabase.from('attendance_sessions').select('id,offering_id,session_date,session_title').in('offering_id', offeringIds),
        supabase.from('attendance_records').select('session_id,attendance_status').eq('student_id', profile.id),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]
  const attendanceSessions = attendanceSessionsResult.data ?? []
  const attendanceRecords = attendanceRecordsResult.data ?? []
  const attendanceSummary = (enrollmentsResult.data ?? []).map((enrollment) => {
    const sessions = attendanceSessions.filter((session) => session.offering_id === enrollment.offering_id)
    const sessionIds = new Set(sessions.map((session) => session.id))
    const records = attendanceRecords.filter((record) => sessionIds.has(record.session_id))
    const present = records.filter((record) => record.attendance_status === 'PRESENT').length
    const complete = sessions.length > 0 && records.length === sessions.length
    const percentage = sessions.length ? Math.round((present / sessions.length) * 10000) / 100 : null
    return { offering_id: enrollment.offering_id, sessions: sessions.length, recorded: records.length, present, complete, percentage }
  })
  const avatarUrl = profile.avatar_path
    ? supabase.storage.from('profile-avatars').getPublicUrl(profile.avatar_path).data.publicUrl
    : null

  return <DashboardFrame profile={profile}><main className="content">
    <div className="welcome"><div><div className="kicker">ACCOUNT SETTINGS</div><h1>My profile</h1><p>Manage your personal details, profile photo and appearance.</p></div><div className="welcome-actions"><span className="tag">{profile.role}</span><form action="/auth/logout" method="post"><button type="submit" className="danger profile-signout">Sign out</button></form></div></div>
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="grid">
      <Card title="Personal profile" note="Your role and account status are controlled by the examinations administrator.">
        <div className="profile-identity">
          {avatarUrl ? <Image className="profile-photo" src={avatarUrl} alt="Your profile" width={88} height={88} unoptimized /> : <div className="profile-photo profile-initials" aria-hidden="true">{profile.full_name.split(/\s+/).map((part) => part[0]).slice(0,2).join('').toUpperCase()}</div>}
          <div><strong>{profile.full_name}</strong><p>{profile.institutional_email}</p><StatusBadge value={profile.account_status} /></div>
        </div>
        <form action={uploadProfileAvatar} className="avatar-upload">
          <div className="field"><label htmlFor="avatar">Profile photo</label><input id="avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp" required /><small className="subtle">JPG, PNG or WebP · maximum 2 MB</small></div>
          <button type="submit">Upload photo</button>
        </form>
        <form action={updateProfile}>
          <div className="field"><label htmlFor="full_name">Display name</label><input id="full_name" name="full_name" defaultValue={profile.full_name} minLength={2} maxLength={120} required /></div>
          <div className="field"><label htmlFor="email_display">Verified email address</label><input id="email_display" value={profile.institutional_email} readOnly disabled /></div>
          <div className="form-grid">
            <div className="field"><label>Account role</label><input value={profile.role} readOnly disabled /></div>
            <div className="field"><label>Account status</label><input value={profile.account_status} readOnly disabled /></div>
          </div>
          <div className="form-grid">
            <div className="field"><label htmlFor="student_number">Student number</label><input id="student_number" value={profile.student_number ?? 'Not assigned'} readOnly disabled /></div>
            <div className="field"><label htmlFor="staff_number">Staff number</label><input id="staff_number" value={profile.staff_number ?? 'Not assigned'} readOnly disabled /></div>
          </div>
          <div className="field"><label>Faculty / department</label><input value={departmentResult.data ? departmentResult.data.name + ' (' + departmentResult.data.code + ')' : 'Not assigned'} readOnly disabled /></div>
          <ProfileAppearance initialTheme={profile.theme_preference} />
          <button type="submit">Save profile changes</button>
        </form>
      </Card>
      {profile.role === 'STUDENT' && <Card title="Attendance and examination eligibility" note="Your attendance is calculated from lecturer-submitted registers. At least 80% attendance is required for examination eligibility.">
        {attendanceSummary.length ? <div className="table-wrap"><table><thead><tr><th scope="col">Course</th><th scope="col">Present</th><th scope="col">Recorded sessions</th><th scope="col">Attendance</th><th scope="col">Eligibility</th></tr></thead><tbody>{attendanceSummary.map((item) => { const offering = offeringById.get(item.offering_id); const course = offering ? courseById.get(offering.course_id) : null; return <tr key={item.offering_id}><td>{course ? course.code + ' · ' + course.title : 'Course details unavailable'}</td><td>{item.present}</td><td>{item.recorded}/{item.sessions}</td><td>{item.percentage === null || !item.complete ? 'Register pending' : item.percentage + '%'}</td><td><StatusBadge value={!item.complete ? 'IN_PROGRESS' : item.percentage !== null && item.percentage >= 80 ? 'ELIGIBLE' : 'INELIGIBLE'} /></td></tr> })}</tbody></table></div> : <Empty>No active course enrolments are linked to your profile yet.</Empty>}
      </Card>}
      {profile.role === 'STUDENT' && <Card title="Published academic results" note="Only results formally published for your account are shown here.">
        {resultsResult.error ? <Empty>Published results could not be loaded. Refresh and try again.</Empty> : resultRows.length === 0 ? <Empty>No published results are available for your account.</Empty> : <div className="table-wrap"><table><thead><tr><th>Course offering</th><th>Coursework</th><th>Examination</th><th>Total</th><th>Grade</th><th>Published</th></tr></thead><tbody>{resultRows.map((row) => { const offering = offeringById.get(row.offering_id); const course = offering ? courseById.get(offering.course_id) : null; return <tr key={row.id}><td>{course ? course.code + ' · ' + course.title : row.offering_id}</td><td>{row.coursework_mark ?? '—'}</td><td>{row.exam_mark ?? '—'}</td><td>{row.total_mark ?? '—'}</td><td>{row.grade ?? '—'}</td><td>{row.published_at ? new Date(row.published_at).toLocaleDateString() : '—'}</td></tr> })}</tbody></table></div>}
      </Card>}
      {['LECTURER', 'REVIEWER', 'REGISTRAR'].includes(profile.role) && <Card title="Academic assignments" note="Course assignments currently associated with your staff profile.">
        {assignmentsResult.error || offeringsResult.error || coursesResult.error ? <Empty>Assignments could not be loaded.</Empty> : (assignmentsResult.data ?? []).length === 0 ? <Empty>No course assignments are currently associated with your account.</Empty> : <div className="table-wrap"><table><thead><tr><th>Course</th><th>Assignment role</th><th>Offering</th></tr></thead><tbody>{(assignmentsResult.data ?? []).map((assignment, index) => { const offering = offeringById.get(assignment.offering_id); const course = offering ? courseById.get(offering.course_id) : null; return <tr key={assignment.offering_id + assignment.assignment_role + index}><td>{course ? course.code + ' · ' + course.title : 'Course details unavailable'}</td><td>{assignment.assignment_role}</td><td>{offering?.group_name ?? '—'}</td></tr> })}</tbody></table></div>}
      </Card>}
      <Card title="Account security" note="Use sign out when you finish using a shared or public device.">
        <p>Your email must be verified to authenticate. Privileged access remains subject to administrator approval.</p>
        <form action="/auth/logout" method="post"><button type="submit" className="danger">Sign out</button></form>
      </Card>
    </div>
  </main></DashboardFrame>
}
