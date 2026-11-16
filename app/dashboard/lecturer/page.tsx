import { requireActiveProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, DashboardFrame, DataTable, Empty, StatusBadge } from '@/app/components/portal-ui'
import { createAssessment, recordAttendanceSession, saveBatchMarks, submitResults, resubmitResults } from '../actions'

type Row = Record<string, unknown>
const rows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : []
const value = (row: Row, key: string) => String(row[key] ?? '')
const id = (row: Row) => value(row, 'id')

export default async function LecturerMarksPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ notice }, profile] = await Promise.all([searchParams, requireActiveProfile(['LECTURER'])])
  const supabase = await createClient()
  const { data: assignments, error: assignmentError } = await supabase
    .from('course_staff').select('offering_id').eq('user_id', profile.id).eq('assignment_role', 'LECTURER')
  const offeringIds = [...new Set((assignments ?? []).map((item) => item.offering_id))]
  const [offeringResult, assessmentResult, enrollmentResult, submissionResult, attendanceSessionResult] = await Promise.all([
    offeringIds.length ? supabase.from('course_offerings').select('id,course_id,semester_id,group_name').in('id', offeringIds) : Promise.resolve({ data: [], error: null }),
    offeringIds.length ? supabase.from('assessments').select('id,offering_id,title,assessment_type,maximum_mark,weight').in('offering_id', offeringIds) : Promise.resolve({ data: [], error: null }),
    offeringIds.length ? supabase.from('enrollments').select('id,offering_id,student_id,enrollment_status').in('offering_id', offeringIds).eq('enrollment_status', 'ENROLLED') : Promise.resolve({ data: [], error: null }),
    offeringIds.length ? supabase.from('result_submissions').select('id,offering_id,status,reviewer_note,lecturer_note').in('offering_id', offeringIds) : Promise.resolve({ data: [], error: null }),
    offeringIds.length ? supabase.from('attendance_sessions').select('id,offering_id,session_date,session_title').in('offering_id', offeringIds).order('session_date', { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ])
  const offerings = rows(offeringResult.data)
  const assessments = rows(assessmentResult.data)
  const enrollments = rows(enrollmentResult.data)
  const submissions = rows(submissionResult.data)
  const attendanceSessions = rows(attendanceSessionResult.data)
  const attendanceSessionIds = attendanceSessions.map(id)
  const assessmentIds = assessments.map(id)
  // These independent reads run concurrently to reduce the lecturer workspace's critical path.
  const [coursesResult, semestersResult, marksResult, attendanceRecordResult] = await Promise.all([
    offerings.length
      ? supabase.from('courses').select('id,code,title,department_id').in('id', offerings.map((item) => value(item, 'course_id')))
      : Promise.resolve({ data: [], error: null }),
    offerings.length
      ? supabase.from('semesters').select('id,name,academic_year_id').in('id', offerings.map((item) => value(item, 'semester_id')))
      : Promise.resolve({ data: [], error: null }),
    assessmentIds.length
      ? supabase.from('marks').select('assessment_id,student_id,mark').in('assessment_id', assessmentIds)
      : Promise.resolve({ data: [], error: null }),
    attendanceSessionIds.length
      ? supabase.from('attendance_records').select('session_id,student_id,attendance_status').in('session_id', attendanceSessionIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  const attendanceRecords = rows(attendanceRecordResult.data)
  const courseMap = new Map(rows(coursesResult.data).map((item) => [id(item), item]))
  const semesterMap = new Map(rows(semestersResult.data).map((item) => [id(item), item]))
  const marks = rows(marksResult.data)
  const hasError = Boolean(assignmentError || offeringResult.error || assessmentResult.error || enrollmentResult.error || submissionResult.error || attendanceSessionResult.error || attendanceRecordResult.error || coursesResult.error || semestersResult.error || marksResult.error)
  const offeringLabel = (offering: Row) => {
    const course = courseMap.get(value(offering, 'course_id'))
    const semester = semesterMap.get(value(offering, 'semester_id'))
    return `${course ? value(course, 'code') + ' · ' + value(course, 'title') : 'Course'} / ${semester ? value(semester, 'name') : 'Semester'} / ${value(offering, 'group_name')}`
  }

  return <DashboardFrame profile={profile}>
    <main className="content">
      <section className="welcome"><div><div className="kicker">LECTURER WORKSPACE</div><h1>Marks and assessment entry</h1><p>Manage coursework, end-of-semester examinations and results for your assigned courses.</p></div><span className="tag">ASSIGNED COURSES ONLY</span></section>
      {notice && <div className="notice" role="status">{notice}</div>}
      {hasError && <div className="notice error" role="alert">Some course information could not be loaded. Refresh the page or contact support.</div>}
      <section className="notice"><strong>MUST assessment rules:</strong> Coursework contributes up to 40 marks and the end-of-semester examination up to 60 marks. Coursework must include at least two tests, or one test and one assignment/take-home assessment. Publish coursework marks at least two weeks before examinations. A minimum 80% attendance is required to qualify for university examinations.</section>
      <Card title="Assessment setup" note="Create the coursework components and one end-of-semester examination for each assigned course. Weights must total 100% before submission.">
        <form action={createAssessment} className="form-grid">
          <div className="field"><label>Assigned course</label><select name="offering_id" required defaultValue=""><option value="" disabled>Select course offering</option>{offerings.map((item) => <option key={id(item)} value={id(item)}>{offeringLabel(item)}</option>)}</select></div>
          <div className="field"><label>Assessment title</label><input name="title" required maxLength={120} placeholder="e.g. Mid-semester test / Assignment 1" /></div>
          <div className="field"><label>Assessment category</label><select name="assessment_type"><option value="TEST">Coursework — Test</option><option value="COURSEWORK">Coursework — Assignment / take-home</option><option value="PRACTICAL">Coursework — Practical</option><option value="EXAM">End-of-semester examination</option></select></div>
          <div className="field"><label>Maximum raw mark</label><input type="number" name="maximum_mark" min="1" max="100" step="0.01" required /></div>
          <div className="field"><label>Contribution to final mark (%)</label><input type="number" name="weight" min="0.01" max="60" step="0.01" required /></div>
          <button type="submit">Add assessment</button>
        </form>
        {assessments.length ? <DataTable headings={['Course offering','Assessment','Category','Raw maximum','Final contribution']}>{assessments.map((item) => <tr key={id(item)}><td>{offeringLabel(offerings.find((offer) => id(offer) === value(item, 'offering_id')) ?? {})}</td><td>{value(item, 'title')}</td><td>{value(item, 'assessment_type')}</td><td>{value(item, 'maximum_mark')}</td><td>{value(item, 'weight')}%</td></tr>)}</DataTable> : <Empty>No assessments have been configured for your assigned courses.</Empty>}
      </Card>
      <Card title="Enter coursework and examination marks" note="Only enrolled students in your assigned course offerings are displayed. Marks are validated against each assessment's maximum raw mark.">
        {offerings.length ? offerings.map((offering) => {
          const offeringId = id(offering)
          const courseAssessments = assessments.filter((item) => value(item, 'offering_id') === offeringId)
          const students = enrollments.filter((item) => value(item, 'offering_id') === offeringId)
          const submission = submissions.find((item) => value(item, 'offering_id') === offeringId)
          const existing = new Map(marks.map((item) => [value(item, 'assessment_id') + ':' + value(item, 'student_id'), value(item, 'mark')]))
          const totalWeight = courseAssessments.reduce((sum, item) => sum + Number(item.weight), 0)
          const courseworkWeight = courseAssessments.filter((item) => value(item, 'assessment_type') !== 'EXAM').reduce((sum, item) => sum + Number(item.weight), 0)
          const examWeight = courseAssessments.filter((item) => value(item, 'assessment_type') === 'EXAM').reduce((sum, item) => sum + Number(item.weight), 0)
          return <section key={offeringId} className="card">
            <h3>{offeringLabel(offering)}</h3>
            <p className="subtle">Coursework: {courseworkWeight}% / 40% maximum · Examination: {examWeight}% / 60% maximum · Total configured: {totalWeight}%</p>
            {submission && <p><StatusBadge value={value(submission, 'status')} /></p>}
            {submission && value(submission, 'status') === 'RETURNED' && <div className="notice error"><strong>Reviewer feedback:</strong> {value(submission, 'reviewer_note') || 'Review the returned marks and correct them.'}</div>}
            <section className="card" style={{marginTop:18}}>
              <h3>Attendance register and examination eligibility</h3>
              <p className="subtle">Record every scheduled session for every enrolled student. Students need at least 80% attendance to be examination-eligible. Registers become locked after results submission.</p>
              {students.length > 0 ? <form action={recordAttendanceSession} className="form-grid">
                <input type="hidden" name="offering_id" value={offeringId} />
                <div className="field"><label>Session date</label><input type="date" name="session_date" required /></div>
                <div className="field"><label>Session title / topic</label><input name="session_title" minLength={2} maxLength={160} required placeholder="e.g. Lecture 3 — Data structures" /></div>
                <DataTable headings={['Student ID','Attendance status']}>
                  {students.map((student) => <tr key={value(student, 'student_id')}>
                    <td><code>{value(student, 'student_id')}</code></td>
                    <td><select name={'attendance-' + value(student, 'student_id')} defaultValue="" required><option value="" disabled>Select status</option><option value="PRESENT">Present</option><option value="ABSENT">Absent</option></select></td>
                  </tr>)}
                </DataTable>
                <button type="submit">Save complete attendance register</button>
              </form> : <Empty>Enrol students before recording attendance.</Empty>}
              {(() => {
                const courseSessions = attendanceSessions.filter((session) => value(session, 'offering_id') === offeringId)
                const courseRecords = attendanceRecords.filter((record) => courseSessions.some((session) => id(session) === value(record, 'session_id')))
                return courseSessions.length ? <>
                  <h4>Recorded sessions ({courseSessions.length})</h4>
                  <DataTable headings={['Date','Session / topic']}>
                    {courseSessions.map((session) => <tr key={id(session)}><td>{value(session, 'session_date')}</td><td>{value(session, 'session_title')}</td></tr>)}
                  </DataTable>
                  <h4>Attendance summary</h4>
                  <DataTable headings={['Student ID','Present','Sessions recorded','Attendance','Exam eligibility']}>
                    {students.map((student) => {
                      const own = courseRecords.filter((record) => value(record, 'student_id') === value(student, 'student_id'))
                      const present = own.filter((record) => value(record, 'attendance_status') === 'PRESENT').length
                      const complete = own.length === courseSessions.length
                      const percentage = courseSessions.length ? Math.round((present / courseSessions.length) * 10000) / 100 : 0
                      return <tr key={value(student, 'student_id')}><td><code>{value(student, 'student_id')}</code></td><td>{present}</td><td>{own.length}/{courseSessions.length}</td><td>{complete ? percentage + '%' : 'Incomplete'}</td><td><StatusBadge value={!complete ? 'IN_PROGRESS' : percentage >= 80 ? 'ELIGIBLE' : 'INELIGIBLE'} /></td></tr>
                    })}
                  </DataTable>
                </> : <Empty>No attendance sessions have been recorded for this offering.</Empty>
              })()}
            </section>
            {!courseAssessments.length || !students.length ? <Empty>Add assessments and enrollments before entering marks.</Empty> : <form action={saveBatchMarks}>
              <input type="hidden" name="offering_id" value={offeringId} />
              <DataTable headings={['Student ID', ...courseAssessments.map((item) => value(item, 'title') + ' (' + value(item, 'maximum_mark') + ')')]}>
                {students.map((student) => <tr key={value(student, 'student_id')}><td><code>{value(student, 'student_id')}</code></td>{courseAssessments.map((assessment) => <td key={id(assessment)}><input aria-label={value(assessment, 'title') + ' mark for ' + value(student, 'student_id')} type="number" min="0" max={value(assessment, 'maximum_mark')} step="0.01" name={'mark-' + id(assessment) + '-' + value(student, 'student_id')} defaultValue={existing.get(id(assessment) + ':' + value(student, 'student_id')) ?? ''} disabled={Boolean(submission && value(submission, 'status') !== 'RETURNED')} /></td>)}</tr>)}
              </DataTable>
              {(!submission || value(submission, 'status') === 'RETURNED') && <div className="actions"><button type="submit">Save marks</button></div>}
            </form>}
            {!submission && <form action={submitResults} className="form-grid"><input type="hidden" name="offering_id" value={offeringId}/><div className="field"><label>Submission note (optional)</label><input name="lecturer_note" maxLength={500}/></div><button type="submit">Submit results for departmental review</button></form>}
            {submission && value(submission, 'status') === 'RETURNED' && <form action={resubmitResults} className="form-grid"><input type="hidden" name="submission_id" value={id(submission)}/><div className="field"><label>Correction note</label><input name="lecturer_note" maxLength={500} required/></div><button type="submit">Resubmit corrected marks</button></form>}
            {submission && value(submission, 'status') !== 'RETURNED' && <p className="subtle">Marks are locked while this submission is being reviewed, approved or published.</p>}
          </section>
        }) : <Empty>No lecturer course offerings are assigned to your account. Contact the administrator to be assigned to a course.</Empty>}
      </Card>
    </main>
  </DashboardFrame>
}
