"use client"

import { useMemo, useState } from 'react'

type Faculty = { id: string; name: string }
type Course = { id: string; code: string; title: string; department_id: string }

export function FacultyCourseSelect({ faculties, courses }: { faculties: Faculty[]; courses: Course[] }) {
  const [facultyId, setFacultyId] = useState('')
  const [courseId, setCourseId] = useState('')
  const facultyCourses = useMemo(
    () => courses.filter((course) => course.department_id === facultyId),
    [courses, facultyId],
  )

  function changeFaculty(nextFaculty: string) {
    setFacultyId(nextFaculty)
    setCourseId('')
  }

  return <>
    <div className="field">
      <label htmlFor="offering-faculty">Faculty</label>
      <select id="offering-faculty" value={facultyId} onChange={(event) => changeFaculty(event.target.value)} required>
        <option value="">Choose faculty first</option>
        {faculties.map((faculty) => <option key={faculty.id} value={faculty.id}>{faculty.name}</option>)}
      </select>
    </div>
    <div className="field">
      <label htmlFor="offering-course">Course unit</label>
      <select id="offering-course" name="course_id" value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={!facultyId || facultyCourses.length === 0} required>
        <option value="">{!facultyId ? 'Select a faculty first' : facultyCourses.length ? 'Choose a course unit' : 'No courses registered for this faculty'}</option>
        {facultyCourses.map((course) => <option key={course.id} value={course.id}>{course.code ? course.code + ' · ' : ''}{course.title}</option>)}
      </select>
    </div>
  </>
}
