export function isValidEmail(value) {
  const email = String(value ?? '').trim().toLowerCase()
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isMustInstitutionalEmail(value) {
  if (!isValidEmail(value)) return false
  const domain = String(value).trim().toLowerCase().split('@').at(-1)
  return domain === 'must.ac.ug' || domain === 'std.must.ac.ug'
}

export function getSignupVerificationMode(value) {
  if (!isValidEmail(value)) return 'INVALID'
  return isMustInstitutionalEmail(value) ? 'MUST_AUTO' : 'ADMIN_REVIEW'
}

export function isValidPassword(value) {
  const password = String(value ?? '')
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password)
}

export function validateBatchMarks(rows, assessments, enrolledStudentIds, examEligibleStudentIds = enrolledStudentIds) {
  if (!Array.isArray(rows) || rows.length === 0) return { error: 'Enter the required marks for this batch.' }
  if (!Array.isArray(assessments) || assessments.length === 0) return { error: 'Configure at least one assessment before entering marks.' }

  const assessmentMap = new Map(assessments.map((item) => [item.id, {
    maximum: Number(item.maximum_mark),
    type: item.assessment_type,
  }]))
  if (assessmentMap.size !== assessments.length) return { error: 'The assessment list contains duplicate identifiers.' }

  const enrolled = new Set(enrolledStudentIds)
  if (enrolled.size === 0) return { error: 'There are no actively enrolled students in this course offering.' }
  const examEligible = new Set(examEligibleStudentIds.filter((studentId) => enrolled.has(studentId)))
  const expected = new Set()

  for (const assessment of assessments) {
    const maximum = Number(assessment.maximum_mark)
    if (!Number.isFinite(maximum) || maximum <= 0) return { error: 'Every assessment must have a valid maximum mark.' }
    for (const studentId of enrolled) {
      if (assessment.assessment_type !== 'EXAM' || examEligible.has(studentId)) {
        expected.add(assessment.id + ':' + studentId)
      }
    }
  }
  if (expected.size === 0) return { error: 'No marks can be entered until the course has eligible assessment and attendance records.' }

  const seen = new Set()
  const normalized = []

  for (const row of rows) {
    const assessmentId = String(row?.assessment_id ?? '')
    const studentId = String(row?.student_id ?? '')
    const rawMark = row?.mark
    const assessment = assessmentMap.get(assessmentId)
    if (!assessment) return { error: 'A mark references an unknown assessment.' }
    if (!enrolled.has(studentId)) return { error: 'Every student must be actively enrolled in this course offering.' }
    if (assessment.type === 'EXAM' && !examEligible.has(studentId)) {
      return { error: 'Examination marks are disabled until the student has complete attendance and at least 80% attendance.' }
    }
    if (rawMark === null || rawMark === undefined ||
        (typeof rawMark === 'string' && !/^(?:\d+(?:\\.\d*)?|\\.\d+)$/.test(rawMark.trim())) ||
        (typeof rawMark !== 'string' && typeof rawMark !== 'number')) {
      return { error: 'Enter a numeric mark for every required student and assessment.' }
    }
    const mark = Number(rawMark)
    if (!Number.isFinite(mark) || mark < 0 || mark > assessment.maximum) {
      return { error: 'Marks must be between 0 and the assessment maximum (' + assessment.maximum + ').' }
    }
    const key = assessmentId + ':' + studentId
    if (!expected.has(key)) return { error: 'This student-assessment pair is not eligible for mark entry.' }
    if (seen.has(key)) return { error: 'A student can have only one row per assessment in this batch.' }
    seen.add(key)
    normalized.push({ assessment_id: assessmentId, student_id: studentId, mark })
  }

  if (seen.size !== expected.size) return { error: 'Enter one mark for every enrolled student and assessment; examination marks are required only for attendance-eligible students.' }
  return { data: normalized }
}
export function hasRole(profile, allowed) {
  return Boolean(profile && profile.account_status === 'ACTIVE' && allowed.includes(profile.role))
}
