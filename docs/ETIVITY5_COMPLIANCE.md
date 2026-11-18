# SWE2106 Etivity 5 - Implementation and Evidence Audit

**Audit scope:** branch `feature/production-completion-audit-fixes`, current application (Next.js + Supabase), legacy Express/MySQL prototype, and the linked Supabase project.

This document separates implementation evidence from demonstration evidence. A source file or Postman collection is not proof that a live workflow was executed.

## Lecturer checklist

| # | Requirement | Status | Evidence / remaining work |
|---|---|---|---|
| 1 | Registrar problem, proposed solution, users, objectives, scope and benefits | Partial | The repository contains the Group F report and this presentation guide. The team must verify the report explicitly covers every required element and use lecturer-approved wording. |
| 2 | Production-ready end-to-end examination-results workflow | Partial | Next/Supabase supports lecturer marks, attendance, submission, reviewer return/review, Registrar approval/publication and student published results. Authenticated multi-role end-to-end evidence and Registrar policy sign-off remain outstanding. |
| 3 | Express server/API with clear setup instructions | Partial | `backend/server.js`, `backend/db.js`, `database/schema.sql` and legacy setup instructions exist. Express/MySQL is a separate prototype; it does not power the current Next.js/Supabase portal. If Express must be the actual integrated API, a Supabase-backed bridge and deployment are still required. |
| 4 | Importable Postman collection, sample variables, success and invalid requests, actual run evidence | Partial | `postman/MUST_API_Collection.json` is importable and includes environment variables and example positive/negative requests. No Newman/Postman run report has been captured for this audit. |
| 5 | Server-side validation, correct HTTP status codes and useful errors | Partial | Current Next server actions, Supabase RLS, database triggers and RPCs validate role, offering assignment, enrolment, assessment maxima, complete mark batches, attendance and workflow state. Legacy Express endpoints need separate hardening and execution tests before exposure. |
| 6 | Live database and frontend integration, demonstrated end-to-end | Partial | The current Next.js application reads/writes the linked Supabase PostgreSQL database. The Express/MySQL prototype is not integrated with that frontend. No authenticated cross-role E2E run was possible in this audit. |
| 7 | GitHub repository and consistent setup documentation | Substantially present | Repository, README, environment example, migration history, local setup commands and presentation guide exist. Verify the team can reproduce the setup on a clean machine. |
| 8 | Actual team responsibilities and individual PR/contribution evidence | Missing evidence | `docs/TEAM_CONTRIBUTIONS.md` is explicitly a responsibility plan, not proof. Current open release PRs are authored by Rodgers05; each other member must submit their own real work/PR and provide evidence. Do not fabricate contributions. |
| 9 | Presentation materials, rationale, live Postman demo and member speaking roles | Partial | `docs/PRESENTATION_GUIDE.md` is available and now distinguishes the current portal from the legacy API. A final slide deck, recorded/live Postman run and confirmed speaking assignments remain team tasks. |

## Current role-based enrolment policy

| Role | Enrolment visibility | Enforcement |
|---|---|---|
| ADMIN | Global enrolment register and management | Dashboard/server action and PostgreSQL RLS |
| REGISTRAR | Global enrolment register and management; assigned submission workflow | Dashboard/server action and PostgreSQL RLS |
| LECTURER | Active students only in offerings assigned to that lecturer | `course_staff` assignment check, server action and RLS |
| REVIEWER | No direct enrolment-table roster; assigned submission/marks and minimum student identity context only | RLS and assigned-student profile helper |
| STUDENT | Own enrolled offerings in the current open academic year; own published results | Authenticated `auth.uid()` scope and RLS |

## Marks-entry implementation

- Dedicated lecturer workspace: `/dashboard/lecturer`.
- Roster is restricted to the lecturer's assigned offerings and active enrolments.
- Student name and MUST registration number are displayed where recorded.
- Assessment columns show configured maximum marks; existing marks remain visible.
- Exam mark fields are disabled when attendance records are incomplete or attendance is below 80%.
- `validateBatchMarks` rejects missing, duplicate, non-numeric, out-of-range, non-enrolled and ineligible examination entries.
- `public.save_batch_marks` saves the complete eligible matrix atomically and checks lecturer assignment, offering/assessment relationship, active enrolment, maximum marks, attendance eligibility and workflow lock state.
- Database trigger prevents direct Data API writes of examination marks for students who do not meet the attendance rule.
- Batch saves are audited; enrolment create/status/delete changes are audited.
- Returned submissions can be corrected and resubmitted; other submission states remain locked.
- The existing submission guard still blocks the entire offering if any active enrolment lacks complete attendance or is below 80%. Registrar must confirm how such a student should be treated before this rule is changed.

## Signup policy

- Any syntactically valid email address is accepted for registration.
- `@must.ac.ug` and `@std.must.ac.ug` are auto-verified.
- Other valid domains remain pending until administrator verification/activation.
- New profiles default to STUDENT; role changes remain administrator-controlled.
- Live Auth trigger inspection found only the MUST auto-confirm trigger and profile creation trigger; no old MUST-only trigger or profile email-domain check constraint remains.
- SMTP and Google OAuth credentials still require provider configuration/verification.

## Database and security evidence

- Supabase profile role model includes ADMIN, LECTURER, REVIEWER, REGISTRAR and STUDENT.
- RLS policies now give global enrolment management to ADMIN/REGISTRAR; lecturer read access is assigned-offering-only; student read access is own current/open-year enrolment; reviewer receives no enrolments-table access.
- Course-offering RLS scopes student access to their current open academic-year enrolments and staff access to assigned offerings.
- Profile RLS allows only the minimal assigned student context for lecturers/reviewers and student profiles for Registrar enrolment management.
- `save_batch_marks` is a SECURITY DEFINER function with empty search_path and execute granted to authenticated users; it performs its own role/assignment/mark/attendance/state checks.
- Enrollment and marks batch changes write audit records.
- Profile column privileges were checked: authenticated users can update only permitted profile fields such as name, avatar and theme; they cannot update their own role or account status.
- No authenticated role-by-role API test with real test accounts was completed during this audit.

## Live database snapshot and security findings

The linked database was checked after applying the role-scope migrations:

- RLS is enabled on **17/17 public tables**; no anonymous SELECT/ALL policies were found.
- Profile counts: 1 ADMIN, 2 REGISTRAR, 5 LECTURER, 3 REVIEWER and 7 STUDENT.
- There are 3 current/open 2026/2027 Semester 1 offerings and 3 active enrolments.
- Only 1 LECTURER course assignment exists; there are currently no REVIEWER or REGISTRAR course assignments.
- There are currently 0 assessments, 0 marks, 0 result submissions and 0 published results. The live database therefore cannot yet demonstrate a complete marks-to-publication cycle.
- All 3 currently enrolled student profiles have a blank MUST registration number. The lecturer UI displays a clear warning rather than inventing a number.

Supabase advisor results after the migrations:

- Security: 7 authenticated-callable SECURITY DEFINER RPC warnings. These are intentional workflow functions and have internal role/assignment/state checks; each uses an empty search path. They still require code review whenever changed.
- Security: leaked-password protection is disabled in Supabase Auth. Enable it if the current Supabase plan/settings support it.
- Performance: the unindexed attendance `recorded_by` foreign keys were indexed. The multiple-permissive-policy warnings were removed by splitting administrator write policies from SELECT policies. 18 low-usage/unused-index advisories remain; do not drop those indexes without workload evidence.
- Health: no health advisor findings.

The legacy Express/MySQL prototype is not safe to expose as a public production API in its current state: its CORS configuration is permissive, `GET /api/students` returns an unscoped student list to several staff roles, and result-list/detail routes do not consistently verify reviewer/approver assignment. It must remain a local demonstration only until those routes are assignment-scoped and tested. This is an additional reason not to describe it as the current live portal API.

## Required real-world evidence before release

1. Capture separate authenticated test runs for ADMIN, REGISTRAR, LECTURER, REVIEWER and STUDENT, including cross-user and cross-course denial.
2. Capture the Postman/Newman execution report and console output; do not rely on the collection JSON alone.
3. Obtain Registrar confirmation of the current grading scale, assessment weights, coursework composition and 80% attendance rule.
4. Have the Registrar/administrator complete the two missing student registration numbers.
5. Obtain each team member's genuine PR URL, commits and review evidence.
6. Confirm whether the lecturer requires Express to be the live integrated API. If yes, implement and deploy the Supabase-backed Express bridge before claiming Etivity 5 compliance.
7. Pass CI, dependency/security review, fresh preview deployment and smoke tests on the final release candidate.
