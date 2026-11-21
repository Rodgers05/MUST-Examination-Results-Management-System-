'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireActiveProfile, type AppRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const roles: AppRole[] = ['ADMIN', 'LECTURER', 'REVIEWER', 'REGISTRAR', 'STUDENT']
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const id = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
const say = (message: string): never => redirect('/dashboard?notice=' + encodeURIComponent(message))
const validId = (candidate: string) => uuidPattern.test(candidate)
type ValidatedMark = { assessment_id: string; student_id: string; mark: number }

async function actor(allowed: AppRole[]) {
  const profile = await requireActiveProfile(allowed)
  const supabase = await createClient()
  return { profile, supabase }
}

async function assigned(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, offeringId: string, role: 'LECTURER' | 'REVIEWER' | 'REGISTRAR') {
  const { data, error } = await supabase.from('course_staff').select('id')
    .eq('user_id', userId).eq('offering_id', offeringId).eq('assignment_role', role).maybeSingle()
  return !error && Boolean(data)
}

async function offeringRows(supabase: Awaited<ReturnType<typeof createClient>>, offeringId: string) {
  const [assessmentResult, enrollmentResult] = await Promise.all([
    supabase.from('assessments').select('id,title,assessment_type,maximum_mark,weight').eq('offering_id', offeringId),
    supabase.from('enrollments').select('student_id').eq('offering_id', offeringId).eq('enrollment_status', 'ENROLLED'),
  ])
  return { assessments: assessmentResult.data ?? [], enrollments: enrollmentResult.data ?? [], error: assessmentResult.error || enrollmentResult.error }
}

async function requireCompleteOffering(supabase: Awaited<ReturnType<typeof createClient>>, offeringId: string) {
  const { assessments, enrollments, error } = await offeringRows(supabase, offeringId)
  if (error) return 'Could not verify this course offering.'
  if (!assessments.length) return 'Configure at least one assessment before submitting results.'
  if (!enrollments.length) return 'There are no enrolled students in this course offering.'

  const { data: rosterData, error: rosterError } = await supabase.rpc(
    'get_assigned_offering_student_roster',
    { p_offering_id: offeringId },
  )
  if (rosterError || !Array.isArray(rosterData) || rosterData.length !== enrollments.length) {
    return 'Could not verify the attendance register for every enrolled student.'
  }
  const roster = rosterData as { student_id: string; examination_eligible: boolean }[]
  const eligibleRosterIds = new Set(roster.map((student) => student.student_id))
  if (enrollments.some((student) => !eligibleRosterIds.has(student.student_id))) {
    return 'Could not match the attendance register to every enrolled student.'
  }
  const ineligibleCount = roster.filter((student) => student.examination_eligible !== true).length
  if (ineligibleCount > 0) {
    return 'Results cannot be submitted yet. Every enrolled student must have a complete attendance register and at least 80% attendance.'
  }

  const weight = assessments.reduce((sum, item) => sum + Number(item.weight), 0)
  const coursework = assessments.filter((item) => item.assessment_type !== 'EXAM')
  const exams = assessments.filter((item) => item.assessment_type === 'EXAM')
  const courseworkWeight = coursework.reduce((sum, item) => sum + Number(item.weight), 0)
  const examWeight = exams.reduce((sum, item) => sum + Number(item.weight), 0)
  const testCount = coursework.filter((item) => item.assessment_type === 'TEST').length
  const assignmentCount = coursework.filter((item) => item.assessment_type === 'COURSEWORK').length
  if (Math.abs(weight - 100) > 0.01) return 'Assessment weights must total 100 percent before submission.'
  if (courseworkWeight > 40.01 || examWeight > 60.01 || !exams.length) return 'MUST weighting requires coursework not to exceed 40% and end-of-semester examinations not to exceed 60%.'
  if (!(testCount >= 2 || (testCount >= 1 && assignmentCount >= 1))) return 'Coursework must include at least two tests, or one test and one assignment/take-home assessment.'

  const { data: marks, error: marksError } = await supabase.from('marks').select('assessment_id,student_id')
    .in('assessment_id', assessments.map((assessment) => assessment.id))
  if (marksError) return 'Could not verify the assessment marks.'
  const complete = new Set((marks ?? []).map((mark) => mark.assessment_id + ':' + mark.student_id))
  for (const student of enrollments) {
    for (const assessment of assessments) {
      if (!complete.has(assessment.id + ':' + student.student_id)) {
        return 'Every enrolled student needs a mark for every configured assessment before results can be submitted.'
      }
    }
  }
  return null
}

export async function createCatalogueRecord(form: FormData) {
  const { profile, supabase } = await actor(['ADMIN'])
  const kind = value(form, 'kind')
  let error: { message: string } | null = null
  if (kind === 'department') {
    const code = value(form, 'code').toUpperCase()
    const name = value(form, 'name')
    if (!code || !name) say('Enter a department code and name.')
    ;({ error } = await supabase.from('departments').insert({ code, name }))
  } else if (kind === 'academic_year') {
    const label = value(form, 'label')
    const starts_on = value(form, 'starts_on')
    const ends_on = value(form, 'ends_on')
    if (!label || !starts_on || !ends_on || ends_on <= starts_on) say('Enter a valid academic year and date range.')
    ;({ error } = await supabase.from('academic_years').insert({ label, starts_on, ends_on, is_current: false }))
  } else if (kind === 'semester') {
    const academic_year_id = id(form, 'academic_year_id')
    const name = value(form, 'name')
    const starts_on = value(form, 'starts_on')
    const ends_on = value(form, 'ends_on')
    const status = value(form, 'status')
    if (!validId(academic_year_id) || !['SEMESTER 1', 'SEMESTER 2', 'RECESS'].includes(name) ||
      !['PLANNED', 'OPEN', 'CLOSED'].includes(status) || ends_on <= starts_on) say('Check the semester, academic year and date range.')
    ;({ error } = await supabase.from('semesters').insert({ academic_year_id, name, starts_on, ends_on, status }))
  } else if (kind === 'course') {
    const code = value(form, 'code').toUpperCase()
    const title = value(form, 'title')
    const department_id = id(form, 'department_id')
    const credit_units = Number(value(form, 'credit_units'))
    const level = Number(value(form, 'level'))
    if (!code || !title || !validId(department_id) || !Number.isInteger(credit_units) || !Number.isInteger(level)) say('Check the course details and department.')
    ;({ error } = await supabase.from('courses').insert({ code, title, department_id, credit_units, level }))
  } else if (kind === 'offering') {
    const course_id = id(form, 'course_id')
    const semester_id = id(form, 'semester_id')
    const group_name = value(form, 'group_name') || 'MAIN'
    if (!validId(course_id) || !validId(semester_id)) say('Choose a course and semester.')
    ;({ error } = await supabase.from('course_offerings').insert({ course_id, semester_id, group_name }))
  } else if (kind === 'staff') {
    const offering_id = id(form, 'offering_id')
    const user_id = id(form, 'user_id')
    const assignment_role = value(form, 'assignment_role')
    if (!validId(offering_id) || !validId(user_id) || !['LECTURER', 'REVIEWER', 'REGISTRAR'].includes(assignment_role)) say('Choose an offering, active profile and course role.')
    const { data: assignedUser } = await supabase.from('profiles').select('role,account_status').eq('id', user_id).maybeSingle()
    if (!assignedUser || assignedUser.account_status !== 'ACTIVE' || assignedUser.role !== assignment_role) say('Choose an active user whose approved role matches the course assignment.')
    ;({ error } = await supabase.from('course_staff').insert({ offering_id, user_id, assignment_role, assigned_by: profile.id }))
  } else if (kind === 'enrollment') {
    const offering_id = id(form, 'offering_id')
    const student_id = id(form, 'student_id')
    if (!validId(offering_id) || !validId(student_id)) say('Choose an offering and student profile.')
    const { data: student } = await supabase.from('profiles').select('role,account_status').eq('id', student_id).maybeSingle()
    if (!student || student.role !== 'STUDENT' || student.account_status !== 'ACTIVE') say('Only an active student profile may be enrolled.')
    ;({ error } = await supabase.from('enrollments').insert({ offering_id, student_id, enrollment_status: 'ENROLLED' }))
  } else {
    say('Choose a supported catalogue action.')
  }
  if (error) say('The record could not be saved. Check for duplicate codes, dates and permissions.')
  revalidatePath('/dashboard')
  say('Catalogue record saved.')
}

export async function setUserAccess(form: FormData) {
  const { supabase } = await actor(['ADMIN'])
  const userId = id(form, 'user_id')
  const role = value(form, 'role')
  const status = value(form, 'account_status')
  const studentNumber = value(form, 'student_number').toUpperCase()
  const staffNumber = value(form, 'staff_number').toUpperCase()
  if (!validId(userId) || !roles.includes(role as AppRole) || !['PENDING', 'ACTIVE', 'SUSPENDED'].includes(status)) say('Choose a valid profile, role and account status.')
  if (studentNumber.length > 40 || staffNumber.length > 40) say('Student and staff identifiers must be 40 characters or fewer.')
  if ((role === 'STUDENT' && studentNumber && !/^[A-Z0-9/-]+$/.test(studentNumber)) ||
      (role !== 'STUDENT' && staffNumber && !/^[A-Z0-9/-]+$/.test(staffNumber))) say('Use only letters, numbers, hyphens or slashes in official identifiers.')
  if (role === 'STUDENT' && studentNumber) {
    const { data: duplicate, error: duplicateError } = await supabase.from('profiles').select('id').eq('student_number', studentNumber).neq('id', userId).maybeSingle()
    if (duplicateError) say('Could not verify whether this registration number is already in use.')
    if (duplicate) say('That student registration number is already assigned to another account.')
  }
  if (role !== 'STUDENT' && staffNumber) {
    const { data: duplicate, error: duplicateError } = await supabase.from('profiles').select('id').eq('staff_number', staffNumber).neq('id', userId).maybeSingle()
    if (duplicateError) say('Could not verify whether this staff number is already in use.')
    if (duplicate) say('That staff number is already assigned to another account.')
  }
  const { error } = await supabase.rpc('admin_set_user_access', { p_user_id: userId, p_role: role, p_status: status })
  if (error) say('The database rejected the access change. Confirm your administrator access and selection.')
  const identifierUpdate = role === 'STUDENT' && studentNumber
    ? { student_number: studentNumber }
    : role !== 'STUDENT' && staffNumber
      ? { staff_number: staffNumber }
      : null
  if (identifierUpdate) {
    const { error: identifierError } = await supabase.from('profiles').update(identifierUpdate).eq('id', userId)
    if (identifierError) say('Access was updated, but the identifier could not be saved. Check the number and try again.')
  }
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/profile')
  say('Account access and available identifier details updated.')
}

export async function removeInvalidStaffAssignment(form: FormData) {
  const { supabase } = await actor(['ADMIN'])
  const assignmentId = id(form, 'assignment_id')
  if (!validId(assignmentId)) say('Choose a valid staff assignment.')
  const { data: assignment, error: assignmentError } = await supabase.from('course_staff')
    .select('id,user_id,assignment_role').eq('id', assignmentId).maybeSingle()
  if (assignmentError || !assignment) return say('The staff assignment could not be found.')
  const { data: assignedProfile, error: profileError } = await supabase.from('profiles')
    .select('role').eq('id', assignment.user_id).maybeSingle()
  if (profileError || !assignedProfile) return say('The account linked to this assignment could not be verified.')
  if (assignedProfile.role === assignment.assignment_role) return say('This assignment matches the account role and cannot be removed through the mismatch cleanup.')
  const { error } = await supabase.from('course_staff').delete().eq('id', assignmentId)
  if (error) say('The invalid staff assignment could not be removed. Check administrator permissions.')
  revalidatePath('/dashboard')
  say('The role-mismatched staff assignment has been removed.')
}

export async function createAssessment(form: FormData) {
  const { profile, supabase } = await actor(['ADMIN', 'LECTURER'])
  const offering_id = id(form, 'offering_id')
  const title = value(form, 'title')
  const assessment_type = value(form, 'assessment_type')
  const maximum_mark = Number(value(form, 'maximum_mark'))
  const weight = Number(value(form, 'weight'))
  if (!validId(offering_id) || !title || !['COURSEWORK', 'TEST', 'PRACTICAL', 'EXAM'].includes(assessment_type) ||
      !Number.isFinite(maximum_mark) || maximum_mark <= 0 || maximum_mark > 100 ||
      !Number.isFinite(weight) || weight <= 0 || weight > 100) say('Check the assessment title, type, maximum mark and weight.')
  if (profile.role === 'LECTURER' && !(await assigned(supabase, profile.id, offering_id, 'LECTURER'))) say('You are not assigned to that course offering.')
  const { data: existing } = await supabase.from('assessments').select('assessment_type,weight').eq('offering_id', offering_id)
  const courseworkTotal = (existing ?? []).filter((item) => item.assessment_type !== 'EXAM').reduce((sum, item) => sum + Number(item.weight), 0)
  const examTotal = (existing ?? []).filter((item) => item.assessment_type === 'EXAM').reduce((sum, item) => sum + Number(item.weight), 0)
  const categoryTotal = assessment_type === 'EXAM' ? examTotal : courseworkTotal
  const categoryLimit = assessment_type === 'EXAM' ? 60 : 40
  if (categoryTotal + weight > categoryLimit + 0.01) say(`MUST allows up to ${categoryLimit}% for ${assessment_type === 'EXAM' ? 'end-of-semester examinations' : 'coursework'}.`)
  const { error } = await supabase.from('assessments').insert({
    offering_id, title, assessment_type, maximum_mark, weight, created_by: profile.id,
  })
  if (error) say('The assessment was not saved. Check your course assignment and assessment settings.')
  revalidatePath('/dashboard')
  say('Assessment saved.')
}

export async function updateAssessment(form: FormData) {
  const { profile, supabase } = await actor(['LECTURER'])
  const assessmentId = id(form, 'assessment_id')
  const offeringId = id(form, 'offering_id')
  const weight = Number(value(form, 'weight'))
  if (!validId(assessmentId) || !validId(offeringId)) say('Choose a valid assessment and course.')
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) say('Weight must be greater than 0 and no more than 100.')
  if (!(await assigned(supabase, profile.id, offeringId, 'LECTURER'))) say('You are not assigned to this course offering.')
  const { data: current, error: currentError } = await supabase.from('assessments').select('id,offering_id,assessment_type').eq('id', assessmentId).eq('offering_id', offeringId).maybeSingle()
  if (currentError) say('The assessment could not be found in this course.')
  const currentAssessmentType = current?.assessment_type
  if (!currentAssessmentType) say('The assessment could not be found in this course.')
  const { data: submission, error: submissionError } = await supabase.from('result_submissions').select('id,status').eq('offering_id', offeringId).maybeSingle()
  if (submissionError) say('Could not verify the results workflow for this course.')
  if (submission && submission.status !== 'RETURNED') say('This course has already been submitted for review. Assessment weights are locked until the reviewer returns the results.')
  const { data: otherAssessments, error: assessmentsError } = await supabase.from('assessments').select('id,assessment_type,weight').eq('offering_id', offeringId).neq('id', assessmentId)
  if (assessmentsError) say('Could not validate the other assessment weights.')
  const categoryLimit = currentAssessmentType === 'EXAM' ? 60 : 40
  const categoryTotal = (otherAssessments ?? []).filter((item) => (item.assessment_type === 'EXAM') === (currentAssessmentType === 'EXAM')).reduce((sum, item) => sum + Number(item.weight), 0)
  if (categoryTotal + weight > categoryLimit + 0.01) say('This change would exceed the ' + categoryLimit + '% ' + (currentAssessmentType === 'EXAM' ? 'examination' : 'coursework') + ' weighting limit.')
  const { data: updated, error: updateError } = await supabase.from('assessments').update({ weight }).eq('id', assessmentId).eq('offering_id', offeringId).select('id').maybeSingle()
  if (updateError || !updated) say('The assessment weight was not updated. It may be locked or your course assignment may have changed.')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/lecturer')
  say('Assessment weight updated. All previously entered raw student marks were preserved.')
}
export async function saveBatchMarks(form: FormData) {
  const { profile, supabase } = await actor(['LECTURER'])
  const offeringId = id(form, 'offering_id')
  if (!validId(offeringId) || !(await assigned(supabase, profile.id, offeringId, 'LECTURER'))) say('You are not assigned to that course offering.')
  const { data: submission, error: submissionError } = await supabase.from('result_submissions')
    .select('id,status').eq('offering_id', offeringId).maybeSingle()
  if (submissionError) say('Could not verify the current results workflow.')
  if (submission && submission.status !== 'RETURNED') say('Marks can only be changed before submission or after a reviewer returns the results.')

  let rawRows: unknown
  const jsonRows = value(form, 'marks_json')
  if (jsonRows) {
    try { rawRows = JSON.parse(jsonRows) } catch { say('The mark batch is not valid JSON.') }
  } else {
    rawRows = Array.from(form.entries()).flatMap(([name, mark]) => {
      const match = /^mark-([0-9a-f-]{36})-([0-9a-f-]{36})$/i.exec(name)
      return match && String(mark).trim() !== ''
        ? [{ assessment_id: match[1], student_id: match[2], mark }]
        : []
    })
  }
  if (!Array.isArray(rawRows)) return say('Submit a valid list of student assessment marks.')
  const markRows = rawRows as unknown[]

  const { assessments, enrollments, error } = await offeringRows(supabase, offeringId)
  if (error) say('Could not verify assessments and enrolments for this course.')
  const enrolledIds = new Set(enrollments.map((student) => student.student_id))
  const { data: rosterData, error: rosterError } = await supabase.rpc(
    'get_assigned_offering_student_roster',
    { p_offering_id: offeringId },
  )
  if (rosterError || !Array.isArray(rosterData) || rosterData.length !== enrolledIds.size) {
    say('Could not verify attendance eligibility for every enrolled student.')
  }
  const roster = rosterData as { student_id: string; examination_eligible: boolean }[]
  const rosterIds = new Set(roster.map((student) => student.student_id))
  if ([...enrolledIds].some((studentId) => !rosterIds.has(studentId))) {
    say('Could not match the attendance register to every enrolled student.')
  }
  const eligibleExamStudentIds = new Set(
    roster.filter((student) => student.examination_eligible === true).map((student) => student.student_id),
  )
  const assessmentById = new Map(assessments.map((assessment) => [assessment.id, assessment]))
  const expected = new Set<string>()
  for (const assessment of assessments) {
    for (const studentId of enrolledIds) {
      if (assessment.assessment_type !== 'EXAM' || eligibleExamStudentIds.has(studentId)) {
        expected.add(assessment.id + ':' + studentId)
      }
    }
  }

  const validatedMarks: ValidatedMark[] = []
  const seen = new Set<string>()
  for (const raw of markRows) {
    if (!raw || typeof raw !== 'object') say('A mark row is malformed.')
    const row = raw as Record<string, unknown>
    const assessmentId = String(row.assessment_id ?? '')
    const studentId = String(row.student_id ?? '')
    const mark = Number(row.mark)
    const assessment = assessmentById.get(assessmentId)
    const key = assessmentId + ':' + studentId
    if (!validId(assessmentId) || !validId(studentId) || !assessment || !enrolledIds.has(studentId)) return say('A mark references a student or assessment outside this assigned course.')
    if (assessment.assessment_type === 'EXAM' && !eligibleExamStudentIds.has(studentId)) {
      say('Examination marks require a complete attendance register and at least 80% attendance.')
    }
    if (!Number.isFinite(mark) || mark < 0 || mark > Number(assessment.maximum_mark)) say('A mark is outside the allowed assessment maximum.')
    if (!expected.has(key) || seen.has(key)) say('The batch contains a duplicate or unexpected student-assessment row.')
    seen.add(key)
    validatedMarks.push({ assessment_id: assessmentId, student_id: studentId, mark })
  }
  if (seen.size !== expected.size) {
    say('Enter every coursework mark for enrolled students and examination marks only for students who meet the 80% attendance rule.')
  }

  const { error: saveError } = await supabase.rpc('save_batch_marks', {
    p_offering_id: offeringId,
    p_marks: validatedMarks,
  })
  if (saveError) say(saveError.message || 'The database rejected the mark batch. Check enrolment and assessment rules.')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/lecturer')
  const nextOfferingId = id(form, 'next_offering_id')
  const destination = validId(nextOfferingId) && nextOfferingId !== offeringId ? nextOfferingId : offeringId
  redirect('/dashboard/lecturer?course=' + encodeURIComponent(destination) + '&notice=' + encodeURIComponent('Marks saved successfully. You can continue with the selected course or choose another course.'))
}

export async function submitResults(form: FormData) {
  const { profile, supabase } = await actor(['LECTURER'])
  const offeringId = id(form, 'offering_id')
  if (!validId(offeringId) || !(await assigned(supabase, profile.id, offeringId, 'LECTURER'))) say('You are not assigned to that course offering.')
  const reason = await requireCompleteOffering(supabase, offeringId)
  if (reason) say(reason)
  const { error } = await supabase.from('result_submissions').insert({
    offering_id: offeringId, submitted_by: profile.id, status: 'SUBMITTED',
    lecturer_note: value(form, 'lecturer_note') || null,
  })
  if (error) say('This course may already have a submission, or the database rejected the request.')
  revalidatePath('/dashboard')
  say('Results submitted for review.')
}

export async function resubmitResults(form: FormData) {
  const { profile, supabase } = await actor(['LECTURER'])
  const submissionId = id(form, 'submission_id')
  if (!validId(submissionId)) say('Choose a returned submission.')
  const { data: submission, error } = await supabase.from('result_submissions')
    .select('id,offering_id,status').eq('id', submissionId).maybeSingle()
  if (error) say('Could not load the returned submission.')
  const returnedSubmission = submission ?? say('Only the assigned lecturer can resubmit a returned submission.')
  if (returnedSubmission.status !== 'RETURNED' ||
      !(await assigned(supabase, profile.id, returnedSubmission.offering_id, 'LECTURER'))) say('Only the assigned lecturer can resubmit a returned submission.')
  const issue = await requireCompleteOffering(supabase, returnedSubmission.offering_id)
  if (issue) say(issue)
  const { error: rpcError } = await supabase.rpc('resubmit_returned_results', {
    p_submission_id: submissionId, p_lecturer_note: value(form, 'lecturer_note') || null,
  })
  if (rpcError) say('The database did not allow this resubmission.')
  revalidatePath('/dashboard')
  say('Corrected results have been resubmitted.')
}

export async function reviewSubmission(form: FormData) {
  const { profile, supabase } = await actor(['REVIEWER'])
  const submissionId = id(form, 'submission_id')
  const action = value(form, 'action')
  const comments = value(form, 'comments')
  if (!validId(submissionId) || !['REVIEWED', 'RETURNED'].includes(action)) say('Choose a submission and review action.')
  if (action === 'RETURNED' && !comments) say('Add a return comment so the lecturer can make a correction.')
  const { data: submission } = await supabase.from('result_submissions').select('id,offering_id,status')
    .eq('id', submissionId).maybeSingle()
  if (!submission || !['SUBMITTED', 'UNDER_REVIEW'].includes(submission.status) ||
      !(await assigned(supabase, profile.id, submission.offering_id, 'REVIEWER'))) say('You are not assigned to review that submission or its state has changed.')
  const { error } = await supabase.rpc('review_result_submission', {
    p_submission_id: submissionId, p_action: action, p_comments: comments || null,
  })
  if (error) say('The database did not allow that review transition. Refresh the queue and check its current status.')
  revalidatePath('/dashboard')
  say(action === 'RETURNED' ? 'Submission returned with comments.' : 'Submission moved to reviewer review.')
}

export async function approveSubmission(form: FormData) {
  const { profile, supabase } = await actor(['REGISTRAR'])
  const submissionId = id(form, 'submission_id')
  if (!validId(submissionId)) say('Choose a submission to approve.')
  const { data: submission } = await supabase.from('result_submissions').select('id,offering_id,status')
    .eq('id', submissionId).maybeSingle()
  if (!submission || submission.status !== 'UNDER_REVIEW' ||
      !(await assigned(supabase, profile.id, submission.offering_id, 'REGISTRAR'))) say('You are not assigned as registrar or the submission is not ready for approval.')
  const { error } = await supabase.rpc('review_result_submission', {
    p_submission_id: submissionId, p_action: 'APPROVED', p_comments: value(form, 'comments') || null,
  })
  if (error) say('The database did not allow approval. Confirm that the submission has been reviewed.')
  revalidatePath('/dashboard')
  say('Results approved.')
}

export async function publishSubmission(form: FormData) {
  const { profile, supabase } = await actor(['REGISTRAR'])
  const submissionId = id(form, 'submission_id')
  if (!validId(submissionId)) say('Choose an approved submission to publish.')
  const { data: submission } = await supabase.from('result_submissions').select('id,offering_id,status')
    .eq('id', submissionId).maybeSingle()
  if (!submission || submission.status !== 'APPROVED' ||
      !(await assigned(supabase, profile.id, submission.offering_id, 'REGISTRAR'))) say('You are not assigned as registrar or the submission is not approved.')
  const { error } = await supabase.rpc('publish_approved_results', { p_submission_id: submissionId })
  if (error) say('The database did not publish these results. Check approval, assessment weights and complete marks.')
  revalidatePath('/dashboard')
  say('Results published. Weighted totals and grades were calculated by the database.')
}

export async function createSupportTicket(form: FormData) {
  const { profile, supabase } = await actor(roles)
  const subject = value(form, 'subject')
  const message = value(form, 'message')
  if (subject.length < 4 || subject.length > 160 || message.length < 10 || message.length > 4000) say('Use a subject (4–160 characters) and message (10–4,000 characters).')
  const { error } = await supabase.from('support_tickets').insert({ created_by: profile.id, subject, message })
  if (error) say('The support request could not be saved.')
  revalidatePath('/dashboard')
  say('Support request submitted.')
}
