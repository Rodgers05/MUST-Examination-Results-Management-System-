"use client"

import { useState } from 'react'
import { DataTable, Empty, StatusBadge } from '@/app/components/portal-ui'
import { resubmitResults, saveBatchMarks, submitResults } from '@/app/dashboard/actions'

type Offering = { id: string; label: string }
type Assessment = { id: string; offering_id: string; title: string; assessment_type: string; maximum_mark: number; weight: number }
type Student = {
  student_id: string
  full_name: string
  student_number: string
  institutional_email: string
  attendance_sessions: number
  attendance_recorded: number
  attendance_present: number
  attendance_percentage: number | null
  examination_eligible: boolean
}
type Submission = { id: string; offering_id: string; status: string; reviewer_note: string; lecturer_note: string }
type Mark = { assessment_id: string; student_id: string; mark: string }

export function LecturerMarksWorkspace({
  offerings, assessments, studentsByOffering, submissions, marks, initialSelectedOffering,
}: {
  offerings: Offering[]
  assessments: Assessment[]
  studentsByOffering: Record<string, Student[]>
  submissions: Submission[]
  marks: Mark[]
  initialSelectedOffering?: string
}) {
  const [selectedOffering, setSelectedOffering] = useState(initialSelectedOffering ?? '')
  const selected = offerings.find((item) => item.id === selectedOffering)
  const existing = new Map(marks.map((item) => [item.assessment_id + ':' + item.student_id, item.mark]))

  return <section className="card" aria-labelledby="marks-workspace-title">
    <div className="card-heading"><div><h2 id="marks-workspace-title">Enter coursework and examination marks</h2><p className="subtle">Choose one of your assigned course offerings. Only that course&apos;s enrolled students and assessments will appear in the marks table.</p></div></div>
    {offerings.length === 0 ? <Empty>No lecturer course offerings are assigned to your account. Contact the administrator to be assigned to a course.</Empty> : <>
      <div className="field">
        <label id="marks-course-label">Select course offering</label>
        <div className="course-picker" role="group" aria-labelledby="marks-course-label">
          {offerings.map((offering) => <button key={offering.id} type="button" className={selectedOffering === offering.id ? 'course-picker-option active' : 'course-picker-option'} aria-pressed={selectedOffering === offering.id} onClick={() => setSelectedOffering(offering.id)}>{offering.label}</button>)}
        </div>
      </div>
      {!selected && <div className="notice" role="status">Select or tap a course above to load its marks-entry table. No course is preselected.</div>}
      {offerings.map((offering) => {
        const offeringAssessments = assessments.filter((item) => item.offering_id === offering.id)
        const offeringStudents = studentsByOffering[offering.id] ?? []
        const offeringSubmission = submissions.find((item) => item.offering_id === offering.id)
        const offeringWeight = offeringAssessments.reduce((sum, item) => sum + Number(item.weight), 0)
        const offeringCoursework = offeringAssessments.filter((item) => item.assessment_type !== 'EXAM').reduce((sum, item) => sum + Number(item.weight), 0)
        const offeringExam = offeringAssessments.filter((item) => item.assessment_type === 'EXAM').reduce((sum, item) => sum + Number(item.weight), 0)
        const allExamEligible = offeringStudents.length > 0 && offeringStudents.every((student) => student.examination_eligible)
        const ineligibleCount = offeringStudents.filter((student) => !student.examination_eligible).length
        const hasMarkableAssessments = offeringAssessments.some((assessment) =>
          assessment.assessment_type !== 'EXAM' || offeringStudents.some((student) => student.examination_eligible),
        )
        return <section key={offering.id} hidden={selectedOffering !== offering.id} aria-label={offering.label} style={{marginTop:20}}>
          <div className="selected-course-heading"><div><span className="kicker">SELECTED COURSE</span><h3>{offering.label}</h3></div><span className="tag">{offeringStudents.length} enrolled</span></div>
          <p className="subtle">Coursework: {offeringCoursework}% / 40% maximum · Examination: {offeringExam}% / 60% maximum · Total configured: {offeringWeight}%</p>
          {offeringSubmission && <p><StatusBadge value={offeringSubmission.status} /></p>}
          {!allExamEligible && <div className="notice" role="status">Examination marks require a complete attendance register and at least 80% attendance. {ineligibleCount} enrolled student(s) do not yet meet the rule. Coursework marks can still be entered, but results cannot be submitted until every enrolled student is eligible.</div>}
          {offeringSubmission?.status === 'RETURNED' && <div className="notice error"><strong>Reviewer comment:</strong> {offeringSubmission.reviewer_note || 'Review the returned marks and correct them.'}</div>}
          {offeringAssessments.length === 0 || offeringStudents.length === 0 ? <Empty>{offeringAssessments.length === 0 ? 'No assessments have been configured for this course yet.' : 'There are no actively enrolled students in this course.'}</Empty> : <>
            <form action={saveBatchMarks}>
              <input type="hidden" name="offering_id" value={offering.id} />
              <input type="hidden" name="next_offering_id" value={offerings[(offerings.findIndex((item) => item.id === offering.id) + 1) % offerings.length]?.id ?? offering.id} />
              <DataTable headings={['Student name', 'Registration number', 'Attendance', 'Exam eligibility', ...offeringAssessments.map((item) => item.title + ' (' + item.maximum_mark + ')')]}>
                {offeringStudents.map((student) => <tr key={student.student_id}>
                  <td><strong>{student.full_name || 'Name not available'}</strong><small className="subtle" style={{display:'block'}}>{student.institutional_email}</small></td>
                  <td><code>{student.student_number || 'Not available'}</code></td>
                  <td>
                    <strong>{student.attendance_sessions > 0 ? student.attendance_present + '/' + student.attendance_sessions + ' present' : 'No sessions recorded'}</strong>
                    <small className="subtle" style={{display:'block'}}>Records: {student.attendance_recorded}/{student.attendance_sessions}</small>
                    <small className="subtle" style={{display:'block'}}>Rate: {student.attendance_percentage === null ? 'Not available' : student.attendance_percentage + '%'}</small>
                  </td>
                  <td><span className={student.examination_eligible ? 'status status-success' : 'status status-warning'}>{student.examination_eligible ? 'Eligible' : 'Not eligible'}</span></td>
                  {offeringAssessments.map((assessment) => {
                    const examIneligible = assessment.assessment_type === 'EXAM' && !student.examination_eligible
                    const workflowLocked = Boolean(offeringSubmission && offeringSubmission.status !== 'RETURNED')
                    return <td key={assessment.id}>
                      <input
                        aria-label={assessment.title + ' mark for ' + (student.student_number || student.full_name)}
                        type="number"
                        min="0"
                        max={assessment.maximum_mark}
                        step="0.01"
                        required={!examIneligible}
                        name={'mark-' + assessment.id + '-' + student.student_id}
                        defaultValue={existing.get(assessment.id + ':' + student.student_id) ?? ''}
                        disabled={workflowLocked || examIneligible}
                      />
                      {examIneligible && <small className="subtle" style={{display:'block'}}>Requires 80% attendance</small>}
                    </td>
                  })}
                </tr>)}
              </DataTable>
              {(!offeringSubmission || offeringSubmission.status === 'RETURNED') && <div className="actions"><button type="submit" disabled={!hasMarkableAssessments}>Save marks &amp; open next course</button></div>}
            </form>
            {!offeringSubmission && <form action={submitResults} className="form-grid" style={{marginTop:16}}><input type="hidden" name="offering_id" value={offering.id}/><div className="field"><label>Submission note (optional)</label><input name="lecturer_note" maxLength={500}/></div><button type="submit" disabled={!allExamEligible}>Submit results for departmental review</button></form>}
            {offeringSubmission?.status === 'RETURNED' && <form action={resubmitResults} className="form-grid" style={{marginTop:16}}><input type="hidden" name="submission_id" value={offeringSubmission.id}/><div className="field"><label>Correction note</label><input name="lecturer_note" maxLength={500} required/></div><button type="submit" disabled={!allExamEligible}>Resubmit corrected marks</button></form>}
            {offeringSubmission && offeringSubmission.status !== 'RETURNED' && <p className="notice">Marks are locked while this submission is being reviewed, approved or published.</p>}
          </>}
        </section>
      })}
    </>}
  </section>
}
