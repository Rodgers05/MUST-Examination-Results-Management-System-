import { requireActiveProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, DashboardFrame, DataTable, Empty } from '@/app/components/portal-ui'
import { LecturerMarksWorkspace } from '@/app/components/lecturer-marks-workspace'
import { createAssessment } from '../actions'

type Row = Record<string, unknown>
const rows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : []
const value = (row: Row, key: string) => String(row[key] ?? '')
const id = (row: Row) => value(row, 'id')

export default async function LecturerMarksPage({ searchParams }: { searchParams: Promise<{ notice?: string; course?: string }> }) {
  const [{ notice, course }, profile] = await Promise.all([searchParams, requireActiveProfile(['LECTURER'])])
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
  const rosterResponses = await Promise.all(offerings.map(async (offering) => {
    const offeringId = id(offering)
    const response = await supabase.rpc('get_assigned_offering_student_roster', { p_offering_id: offeringId })
    return { offeringId, data: rows(response.data), error: response.error }
  }))
  const coursesResult = offerings.length
    ? await supabase.from('courses').select('id,code,title,department_id').in('id', offerings.map((item) => value(item, 'course_id')))
    : { data: [], error: null }
  const semestersResult = offerings.length
    ? await supabase.from('semesters').select('id,name,academic_year_id').in('id', offerings.map((item) => value(item, 'semester_id')))
    : { data: [], error: null }
  const courseMap = new Map(rows(coursesResult.data).map((item) => [id(item), item]))
  const semesterMap = new Map(rows(semestersResult.data).map((item) => [id(item), item]))
  const offeringLabel = (offering: Row) => {
    const course = courseMap.get(value(offering, 'course_id'))
    const semester = semesterMap.get(value(offering, 'semester_id'))
    return `${course ? value(course, 'code') + ' · ' + value(course, 'title') : 'Course'} / ${semester ? value(semester, 'name') : 'Semester'} / ${value(offering, 'group_name')}`
  }
  const assessmentIds = assessments.map(id)
  const marksResult = assessmentIds.length
    ? await supabase.from('marks').select('assessment_id,student_id,mark').in('assessment_id', assessmentIds)
    : { data: [], error: null }
  const studentsByOffering = Object.fromEntries(rosterResponses.map((response) => [
    response.offeringId,
    response.data.map((student) => ({
      student_id: value(student, 'student_id'),
      full_name: value(student, 'full_name'),
      student_number: value(student, 'student_number'),
      institutional_email: value(student, 'institutional_email'),
    })),
  ]))
  const hasError = Boolean(assignmentError || offeringResult.error || assessmentResult.error || enrollmentResult.error || submissionResult.error || rosterResponses.some((response) => response.error) || coursesResult.error || semestersResult.error || marksResult.error)

  return <DashboardFrame profile={profile}>
    <main className="content">
      <section className="welcome"><div><div className="kicker">LECTURER WORKSPACE</div><h1>Marks and assessment entry</h1><p>Choose the course you are working on. The marks table will load only for that selected course.</p></div><span className="tag">MY COURSES</span></section>
      {notice && <div className="notice" role="status">{notice}</div>}
      {hasError && <div className="notice error" role="alert">Some course details did not load. Refresh the page before entering marks.</div>}
      <section className="notice"><strong>Marks eligibility:</strong> Every student actively enrolled in the selected course is eligible to receive marks for all configured assessments, including the examination. Attendance does not block marks entry. Assessment weighting and mark maximums are still validated.</section>
      <Card title="Assessment setup" note="Configure coursework and examination assessments separately for each assigned course. Assessment weights must total 100% before results can be submitted.">
        <form action={createAssessment} className="form-grid">
          <div className="field"><label>Assigned course</label><select name="offering_id" required defaultValue=""><option value="" disabled>Select course offering</option>{offerings.map((item) => <option key={id(item)} value={id(item)}>{offeringLabel(item)}</option>)}</select></div>
          <div className="field"><label>Assessment title</label><input name="title" required maxLength={120} placeholder="e.g. Mid-semester test / Assignment 1" /></div>
          <div className="field"><label>Type</label><select name="assessment_type"><option value="TEST">Coursework — Test</option><option value="COURSEWORK">Coursework — Assignment / take-home</option><option value="PRACTICAL">Coursework — Practical</option><option value="EXAM">End-of-semester examination</option></select></div>
          <div className="field"><label>Maximum mark</label><input type="number" name="maximum_mark" min="0.01" max="100" step="0.01" required /></div>
          <div className="field"><label>Weight (%)</label><input type="number" name="weight" min="0.01" max="60" step="0.01" required /></div>
          <button type="submit">Add assessment</button>
        </form>
        {assessments.length ? <DataTable headings={['Course offering','Assessment','Category','Raw maximum','Final contribution']}>{assessments.map((item) => {
          const offering = offerings.find((offer) => id(offer) === value(item, 'offering_id'))
          return <tr key={id(item)}><td>{offering ? offeringLabel(offering) : 'Course offering'}</td><td>{value(item, 'title')}</td><td>{value(item, 'assessment_type')}</td><td>{value(item, 'maximum_mark')}</td><td>{value(item, 'weight')}%</td></tr>
        })}</DataTable> : <Empty>No assessments have been added yet.</Empty>}
      </Card>
      <LecturerMarksWorkspace
        offerings={offerings.map((item) => ({ id: id(item), label: offeringLabel(item) }))}
        assessments={assessments.map((item) => ({ id: id(item), offering_id: value(item, 'offering_id'), title: value(item, 'title'), assessment_type: value(item, 'assessment_type'), maximum_mark: Number(value(item, 'maximum_mark')), weight: Number(value(item, 'weight')) }))}
        studentsByOffering={studentsByOffering}
        submissions={submissions.map((item) => ({ id: id(item), offering_id: value(item, 'offering_id'), status: value(item, 'status'), reviewer_note: value(item, 'reviewer_note'), lecturer_note: value(item, 'lecturer_note') }))}
        marks={rows(marksResult.data).map((item) => ({ assessment_id: value(item, 'assessment_id'), student_id: value(item, 'student_id'), mark: value(item, 'mark') }))}
        initialSelectedOffering={course && offeringIds.includes(course) ? course : undefined}
      />
    </main>
  </DashboardFrame>
}
