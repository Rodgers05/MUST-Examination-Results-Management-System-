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

export function validateBatchMarks(rows, assessments, enrolledStudentIds) {
  if (!Array.isArray(rows) || rows.length === 0) return { error: 'Enter at least one mark.' }
  const assessmentMap = new Map(assessments.map((item) => [item.id, Number(item.maximum_mark)]))
  const enrolled = new Set(enrolledStudentIds)
  const seen = new Set()
  const normalized = []

  for (const row of rows) {
    const assessmentId = String(row?.assessment_id ?? '')
    const studentId = String(row?.student_id ?? '')
    const mark = Number(row?.mark)
    const maximum = assessmentMap.get(assessmentId)
    if (!assessmentMap.has(assessmentId)) return { error: 'A mark references an unknown assessment.' }
    if (!enrolled.has(studentId)) return { error: 'Every student must be actively enrolled in this course offering.' }
    if (!Number.isFinite(mark) || mark < 0 || mark > maximum) {
      return { error: 'Marks must be between 0 and the assessment maximum (' + maximum + ').' }
    }
    const key = assessmentId + ':' + studentId
    if (seen.has(key)) return { error: 'A student can have only one row per assessment in this batch.' }
    seen.add(key)
    normalized.push({ assessment_id: assessmentId, student_id: studentId, mark })
  }
  return { data: normalized }
}

export function hasRole(profile, allowed) {
  return Boolean(profile && profile.account_status === 'ACTIVE' && allowed.includes(profile.role))
}
