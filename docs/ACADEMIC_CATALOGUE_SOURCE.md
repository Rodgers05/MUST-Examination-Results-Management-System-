 # MUST academic catalogue source and release notes

Last checked: 16 November 2026.

## Faculty coverage

The live public.departments catalogue currently contains these seven faculties:

| Code | Faculty |
|---|---|
| FAEVS | Faculty of Agriculture, Environment and Veterinary Sciences |
| FAST | Faculty of Applied Sciences and Technology |
| FOBMS | Faculty of Business and Management Sciences |
| FCI | Faculty of Computing and Informatics |
| FHS | Faculty of Health Sciences |
| FIS | Faculty of Interdisciplinary Studies |
| FOS | Faculty of Science |

The University's 33rd Graduation Ceremony report (30 October 2026) explicitly names all seven faculties. Official source:
https://www.must.ac.ug/1670-strong-and-49-phds-conferred-as-must-celebrates-historic-33rd-graduation-ceremony-at-kihumuro-main-campus/

## Programme sources

Use the current official MUST programme pages and joining instructions to curate programme records:
- Undergraduate programmes: https://www.must.ac.ug/undergraduate-programmes/
- Graduate programmes: https://www.must.ac.ug/graduate-programmes/
- Downloads and 2026–2027 joining instructions: https://www.must.ac.ug/Downloads/
- Faculty of Health Sciences: https://www.must.ac.ug/university_unit/faculty-of-medicine/
- Faculty of Science: https://www.must.ac.ug/university_unit/faculty-of-science/

## Important data-quality boundary

The live database currently has 9 course-unit records across 3 faculties. It has 1 course offering and 0 assessments. The seven faculties are present, but this does not mean the course-unit catalogue is complete.

Do not create invented course units, programme-to-course mappings, student enrolments, marks, or assessment structures to make the dashboard look populated. Populate those from approved MUST programme matrices / department curriculum documents and the active academic year.

## Provisional assessment configuration

The current results publication RPC enforces a 100% total, coursework no greater than 40%, examination no greater than 60%, at least one examination assessment, and the required coursework components. This is a provisional system rule pending formal confirmation against the applicable MUST Examination Management Policy and faculty/programme assessment regulations. Do not change historical or already-published results when updating this rule.

## Production-safe validation

The application and Supabase Auth trigger both restrict new accounts to must.ac.ug and subdomains (including std.must.ac.ug). New accounts default to STUDENT / PENDING; staff roles remain administrator-controlled. Existing profiles and academic records are preserved.
