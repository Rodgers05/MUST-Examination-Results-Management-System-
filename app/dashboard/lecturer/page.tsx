import { requireActiveProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, DashboardFrame, DataTable, Empty, StatusBadge } from '@/app/components/portal-ui'
import { createAssessment, saveBatchMarks, submitResults, resubmitResults } from '../actions'

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
  const [offeringResult, assessmentResult, enrollmentResult, submissionResult] = await Promise.all([
    offeringIds.length ? supabase.from('course_offerings').select('id,course_id,semester_id,group_name').in('id', offeringIds) : Promise.resolve({ data: [], error: null }),
    offeringIds.length ? supabase.from('assessments').select('id,offering_id,title,assessment_type,maximum_mark,weight').in('offering_id', offeringIds) : Promise.resolve({ data: [], error: null }),
    offeringIds.length ? supabase.from('enrollments').select('id,offering_id,student_id,enrollment_status').in('offering_id', offeringIds).eq('enrollment_status', 'ENROLLED') : Promise.resolve({ data: [], error: null }),
    offeringIds.length ? supabase.from('result_submissions').select('id,offering_id,status,reviewer_note,lecturer_note').in('offering_id', offeringIds) : Promise.resolve({ data: [], error: null }),
  ])
  const offerings = rows(offeringResult.data)
  const assessments = rows(assessmentResult.data)
  const submissions = rows(submissionResult.data)
  const rosterResponses = await Promise.all(offeringIds.map(async (offeringId) => {
    const response = await supabase.rpc('get_assigned_offering_student_roster', { p_offering_id: offeringId })
    return { offeringId, data: rows(response.data), error: response.error }
  }))
  const rosterByOffering = new Map(rosterResponses.map((response) => [response.offeringId, response.data]))
  const coursesResult = offerings.length
    ? await supabase.from('courses').select('id,code,title,department_id').in('id', offerings.map((item) => value(item, 'course_id')))
    : { data: [], error: null }
  const semestersResult = offerings.length
    ? await supabase.from('semesters').select('id,name,academic_year_id').in('id', offerings.map((item) => value(item, 'semester_id')))
    : { data: [], error: null }
  const courseMap = new Map(rows(coursesResult.data).map((item) => [id(item), item]))
  const semesterMap = new Map(rows(semestersResult.data).map((item) => [id(item), item]))
  const assessmentIds = assessments.map(id)
  const marksResult = assessmentIds.length
    ? await supabase.from('marks').select('assessment_id,student_id,mark').in('assessment_id', assessmentIds)
    : { data: [], error: null }
  const marks = rows(marksResult.data)
  const hasError = Boolean(assignmentError || offeringResult.error || assessmentResult.error || enrollmentResult.error || submissionResult.error || rosterResponses.some((response) => response.error) || coursesResult.error || semestersResult.error || marksResult.error)
  const offeringLabel = (offering: Row) => {
    const course = courseMap.get(value(offering, 'course_id'))
    const semester = semesterMap.get(value(offering, 'semester_id'))
    return `${course ? value(course, 'code') + ' · ' + value(course, 'title') : 'Course'} / ${semester ? value(semester, 'name') : 'Semester'} / ${value(offering, 'group_name')}`
  }

  return <DashboardFrame profile={profile}>
    <main className="content">
      <section className="welcome"><div><div className="kicker">LECTURER WORKSPACE</div><h1>Marks and assessment entry</h1><p>Enter marks and manage results for your assigned courses.</p></div><span className="tag">MY COURSES</span></section>
      {notice && <div className="notice" role="status">{notice}</div>}
      {hasError && <div className="notice error" role="alert">Some course details did not load. Refresh the page.</div>}
      <section className="notice"><strong>Assessment rules:</strong> Coursework is out of 40 marks and the final exam is out of 60. Include at least two tests, or one test and one assignment. Publish coursework marks at least two weeks before exams. Students need at least 80% attendance to sit the exam.</section>
      <Card title="Assessment setup" note="Add coursework and one final exam for each course. All assessment weights must add up to 100%.">
        <form action={createAssessment} className="form-grid">
          <div className="field"><label>Assigned course</label><select name="offering_id" required defaultValue=""><option value="" disabled>Select course offering</option>{offerings.map((item) => <option key={id(item)} value={id(item)}>{offeringLabel(item)}</option>)}</select></div>
          <div className="field"><label>Assessment title</label><input name="title" required maxLength={120} placeholder="e.g. Mid-semester test / Assignment 1" /></div>
          <div className="field"><label>Type</label><select name="assessment_type"><option value="TEST">Coursework — Test</option><option value="COURSEWORK">Coursework — Assignment / take-home</option><option value="PRACTICAL">Coursework — Practical</option><option value="EXAM">End-of-semester examination</option></select></div>
          <div className="field"><label>Maximum mark</label><input type="number" name="maximum_mark" min="1" max="100" step="0.01" required /></div>
          <div className="field"><label>Weight (%)</label><input type="number" name="weight" min="0.01" max="60" step="0.01" required /></div>
          <button type="submit">Add assessment</button>
        </form>
        {assessments.length ? <DataTable headings={['Course offering','Assessment','Category','Raw maximum','Final contribution']}>{assessments.map((item) => <tr key={id(item)}><td>{offeringLabel(offerings.find((offer) => id(offer) === value(item, 'offering_id')) ?? {})}</td><td>{value(item, 'title')}</td><td>{value(item, 'assessment_type')}</td><td>{value(item, 'maximum_mark')}</td><td>{value(item, 'weight')}%</td></tr>)}</DataTable> : <Empty>No assessments have been added yet.</Empty>}
      </Card>
      <Card title="Enter coursework and examination marks" note="Only students enrolled in your courses appear here. Each mark must be within the assessment maximum.">
        {offerings.length ? offerings.map((offering) => {
          const offeringId = id(offering)
          const courseAssessments = assessments.filter((item) => value(item, 'offering_id') === offeringId)
          const students = rosterByOffering.get(offeringId) ?? []
          const submission = submissions.find((item) => value(item, 'offering_id') === offeringId)
          const existing = new Map(marks.map((item) => [value(item, 'assessment_id') + ':' + value(item, 'student_id'), value(item, 'mark')]))
          const totalWeight = courseAssessments.reduce((sum, item) => sum + Number(item.weight), 0)
          const courseworkWeight = courseAssessments.filter((item) => value(item, 'assessment_type') !== 'EXAM').reduce((sum, item) => sum + Number(item.weight), 0)
          const examWeight = courseAssessments.filter((item) => value(item, 'assessment_type') === 'EXAM').reduce((sum, item) => sum + Number(item.weight), 0)
          return <section key={offeringId} className="card">
            <h3>{offeringLabel(offering)}</h3>
            <p className="subtle">Coursework: {courseworkWeight}% / 40% maximum · Examination: {examWeight}% / 60% maximum · Total configured: {totalWeight}%</p>
            {submission && <p><StatusBadge value={value(submission, 'status')} /></p>}
            {submission && value(submission, 'status') === 'RETURNED' && <div className="notice error"><strong>Reviewer comment:</strong> {value(submission, 'reviewer_note') || 'Review the returned marks and correct them.'}</div>}
            {!courseAssessments.length || !students.length ? <Empty>Add assessments and enrol students before entering marks.</Empty> : <form action={saveBatchMarks}>
              <input type="hidden" name="offering_id" value={offeringId} />
              <DataTable headings={['Student name', 'Registration number', 'Attendance', ...courseAssessments.map((item) => value(item, 'title') + ' (' + value(item, 'maximum_mark') + ')')]}>
                {students.map((student) => <tr key={value(student, 'student_id')}>
                  <td><strong>{value(student, 'full_name') || 'Name not available'}</strong><small className="subtle" style={{display:'block'}}>{value(student, 'institutional_email')}</small></td>
                  <td><code>{value(student, 'student_number') || 'Not available'}</code></td>
                  <td>{value(student, 'attendance_percentage') ? value(student, 'attendance_percentage') + '%' : 'Not available'}<small className="subtle" style={{display:'block'}}>{student.examination_eligible ? 'Can sit exam' : 'Attendance not confirmed'}</small></td>
                  {courseAssessments.map((assessment) => <td key={id(assessment)}>{value(assessment, 'assessment_type') === 'EXAM' && student.examination_eligible !== true ? <span className="subtle">Not eligible</span> : <input aria-label={value(assessment, 'title') + ' mark for ' + value(student, 'student_number')} type="number" min="0" max={value(assessment, 'maximum_mark')} step="0.01" name={'mark-' + id(assessment) + '-' + value(student, 'student_id')} defaultValue={existing.get(id(assessment) + ':' + value(student, 'student_id')) ?? ''} disabled={Boolean(submission && value(submission, 'status') !== 'RETURNED')} />}</td>)}
                </tr>)}
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
