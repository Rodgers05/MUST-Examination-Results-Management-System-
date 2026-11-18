# Group F Presentation Guide

## 1. Problem, proposed solution and scope
Explain the Registrar's examination-results challenges, the proposed controlled results workflow, intended users, objectives, scope and benefits. Use the approved project report as the source for the problem statement; do not claim that the prototype is an officially deployed MUST service.

## 2. Current application architecture
The live portal in this repository is Next.js 16 + React + Supabase Auth/PostgreSQL. Next.js server actions call Supabase, and PostgreSQL RLS, constraints, triggers and protected RPCs enforce authorization and workflow rules.

The Express 5 + MySQL service is a separate legacy Etivity prototype. It is not the current portal's backend and it is not connected to the live Supabase database. Do not describe it as the live UI's integrated API. If the lecturer requires Express to be the actual API for the current portal, present this as an outstanding architecture/integration item and demonstrate the Express prototype separately until a Supabase-backed Express bridge is implemented and deployed.

## 3. Current portal demonstration
1. Sign in as an administrator and show role-controlled account activation and course-staff/enrolment management.
2. Sign in as a Registrar and show the restricted enrolment register plus assigned approval/publication queue.
3. Sign in as a lecturer and open `/dashboard/lecturer`.
4. Show only assigned offerings and their active enrolled students, including full names and MUST registration numbers where recorded.
5. Record attendance, show the 80% eligibility state, enter the complete marks batch, save it and submit it for review.
6. Sign in as a reviewer and review only assigned submissions; return a submission with a correction comment where needed.
7. Sign back in as the assigned lecturer, correct the returned batch and resubmit it.
8. Sign in as the assigned Registrar, approve and publish the submission.
9. Sign in as the student and show only that student's published results.

Use approved test accounts and synthetic data. Do not enter real student marks or publish actual examination results without University approval.

## 4. Legacy Express/Postman demonstration
The Postman collection at `postman/MUST_API_Collection.json` targets the standalone legacy Express/MySQL prototype on `http://localhost:5000`. Set the local `PORT=5000`, MySQL connection variables and a long random `JWT_SECRET` in a local `.env` file, apply `database/schema.sql`, and seed only local demo data with `LEGACY_DEMO_PASSWORD` before running `npm run start:legacy`.

Demonstrate the collection's successful and invalid requests only against that local demo database. Save the Postman/Newman run report and console output as evidence; an importable collection by itself is not proof that requests were executed. The legacy API has not been accepted as a secure replacement for the current Supabase role model.

## 5. Validation, HTTP status codes and database integrity
Explain server-side validation, parameterised SQL in the legacy API, authenticated Supabase server actions, RLS, attendance eligibility, mark maxima, complete batches, workflow locks and audit events. Distinguish the Next/Supabase enforcement from the legacy MySQL prototype.

## 6. Team responsibilities and contribution evidence
Each member should explain the work they actually completed and provide their own GitHub pull-request URL, commits and review evidence. The responsibility table in `docs/TEAM_CONTRIBUTIONS.md` is a plan only; it must not be presented as proof of completed contributions.

## 7. Limitations and items requiring confirmation
- Registrar must confirm the current MUST grading scale, assessment weighting, coursework combination and attendance eligibility rules against the latest approved regulations.
- Two existing enrolled profiles have no MUST registration number recorded; the Registrar/administrator must correct those records.
- The current application has not yet had authenticated end-to-end tests with separate Admin, Registrar, Lecturer, Reviewer and Student accounts.
- Express/MySQL is not integrated with the live Next.js/Supabase frontend.
- SMTP sender configuration and Google OAuth provider credentials must be verified in Supabase.
- Vercel preview deployment and route smoke tests must pass for the latest commit before release review.
