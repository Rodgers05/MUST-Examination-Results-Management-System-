# Supabase and Next.js application

## Setup

The root application uses Next.js 16 App Router, Supabase Auth and the existing Supabase PostgreSQL project. Next.js 16 requires Node.js 20.9 or newer. Start locally with `npm install` followed by `npm run dev`; use `npm run build`, `npm run lint`, `npm run typecheck` and `npm test` for verification.

Copy `.env.example` to `.env.local` and configure the project URL and publishable key from Supabase. Never place a Supabase secret/service-role key in this app. Set `NEXT_PUBLIC_SITE_URL` to the local or hosted origin. **Registration accepts any syntactically valid email domain. Supabase email confirmation must remain enabled**, and the server action rejects unverified sessions before portal access. The `handle_new_must_user` trigger creates every new profile as `STUDENT` / `PENDING`; role assignment and activation remain administrator-controlled. Google sign-up follows the same profile rule, and Google must return a verified email. Password login and Google login accept any verified email domain for an existing account. Signup-confirmation resend accepts any valid registered email. Password registration and reset use the Have I Been Pwned Pwned Passwords range API with k-anonymity (only the first five SHA-1 characters are sent); if the breach-check service is unavailable, the operation fails closed. The Supabase Free plan does not include native leaked-password protection. Profile settings support editable display name, a JPG/PNG/WebP avatar up to 2 MB, light/dark/system appearance, role-specific academic information, and sign-out. Migration `20261116140000_allow_any_verified_email_domain.sql` removes the former MUST-domain restriction from new-account creation while preserving the verified-email and pending-account controls. Migration `20261116130500_allow_any_email_for_existing_account_login.sql` allows active existing profiles from any email domain to retain their administrator-assigned role. Older migrations that imposed MUST-only email-domain restrictions are superseded by these later migrations; do not reapply them after the newer migrations.
### Google OAuth setup

1. In Google Cloud Console, create an OAuth client with application type **Web application**.
2. Add `https://must-exam-results-arineitwerodgers04-8491s-projects.vercel.app` as an authorized JavaScript origin.
3. Add the Supabase callback URL `https://axqknavghtqeyayglosr.supabase.co/auth/v1/callback` as an authorized redirect URI.
4. In Supabase **Authentication → Sign In / Providers → Google**, enable Google and enter the Google OAuth client ID and client secret. Keep the client secret in Supabase only; do not add it to browser code or Git.
5. In Supabase **Authentication → URL Configuration**, set the Site URL to `https://must-exam-results-arineitwerodgers04-8491s-projects.vercel.app` and allow `https://must-exam-results-arineitwerodgers04-8491s-projects.vercel.app/auth/callback` as a redirect URL. Add the matching localhost callback for local development if needed.
6. Redeploy the app after code changes. The login button invokes Google OAuth directly. The callback rejects non-MUST email addresses even when Google has an existing identity.

### Email and OAuth operational checks

- Registration and confirmation emails require a verified sending domain in Resend. Resend's testing sender only delivers to the account owner's address; attempts to other recipients return SMTP 550 errors. Use a sender address on the verified domain in Supabase Authentication SMTP settings.
- An SMTP 535 response means the SMTP credentials were rejected. Recheck the Resend SMTP username and replace the SMTP password with the current Resend API key in Supabase. Do not put that key in a `NEXT_PUBLIC_*` variable or commit it.
- Google sign-in requires the Google provider to be enabled and configured in Supabase Authentication. The application reports a clear setup message when Supabase returns “provider is not enabled”.
- The registration form and server action enforce the current password rule: at least 12 characters, with at least one lowercase letter, one uppercase letter and one number.

## Existing schema map

| Application feature | Existing Supabase tables and functions |
|---|---|
| Catalogue | `departments`, `academic_years`, `semesters`, `courses`, `course_offerings` |
| Staff assignment | `course_staff` |
| Student enrolment | `profiles`, `enrollments` |
| Assessment setup and batch marks | `assessments`, `marks` |
| Lecturer submit/correct | `result_submissions`, `resubmit_returned_results` |
| Review and return | `review_actions`, `review_result_submission` |
| Registrar approval/publication | `review_result_submission`, `publish_approved_results` |
| Student results and reports | `published_results` |
| Audit and help | `audit_logs`, `support_tickets` |
| User access | `profiles`, `admin_set_user_access` |

The publishing RPC owns weighted total and grade calculation. Application code does not calculate a final mark or assign a grade.

## Hardened remote database and application permissions

The project owner reports that these remote migrations were applied. This repository does not contain their executable SQL, and no SQL was applied during this task:

- `harden_api_privileges_and_results_workflow`
- `secure_future_public_object_defaults`

Read-only checks against the project confirmed authenticated users have SELECT access subject to RLS and the following write grants:

| Table | Authenticated write columns / route |
|---|---|
| `departments` | INSERT/UPDATE `code`, `created_at`, `id`, `name` (admin RLS / action checks apply). |
| `academic_years` | INSERT/UPDATE `ends_on`, `id`, `is_current`, `label`, `starts_on` (admin RLS / action checks apply). |
| `semesters` | INSERT/UPDATE `academic_year_id`, `ends_on`, `id`, `name`, `starts_on`, `status` (admin RLS / action checks apply). |
| `courses` | INSERT/UPDATE `code`, `created_at`, `credit_units`, `department_id`, `id`, `level`, `title` (admin RLS / action checks apply). |
| `course_offerings` | INSERT/UPDATE `course_id`, `created_at`, `group_name`, `id`, `semester_id` (admin RLS / action checks apply). |
| `course_staff` | INSERT/UPDATE `assigned_by`, `assignment_role`, `created_at`, `id`, `offering_id`, `user_id` (admin RLS / action checks apply). |
| `enrollments` | INSERT/UPDATE `created_at`, `enrollment_status`, `id`, `offering_id`, `student_id` (admin RLS / action checks apply). |
| `profiles` | UPDATE `full_name` only. Role and account status remain protected. |
| `assessments` | INSERT `assessment_type`, `created_by`, `maximum_mark`, `offering_id`, `title`, `weight`; UPDATE `assessment_type`, `maximum_mark`, `title`, `weight`. |
| `marks` | INSERT `assessment_id`, `entered_by`, `mark`, `student_id`; UPDATE `mark`, `updated_at`, `updated_by`. RLS requires enrolled students. |
| `result_submissions` | INSERT `lecturer_note`, `offering_id`, `status`, `submitted_by`; workflow changes use protected RPCs. |
| `support_tickets` | INSERT `created_by`, `message`, `subject` only. |
| `published_results`, `review_actions`, `audit_logs` | No direct authenticated writes. Workflow RPCs write protected review/audit records. |

The four protected functions remain `SECURITY DEFINER`, use an empty `search_path`, and have these signatures: `admin_set_user_access(p_user_id uuid, p_role text, p_status text)`, `publish_approved_results(p_submission_id uuid)`, `resubmit_returned_results(p_submission_id uuid, p_lecturer_note text DEFAULT NULL)`, and `review_result_submission(p_submission_id uuid, p_action text, p_comments text DEFAULT NULL)`. Read-only inspection of the review/resubmit bodies confirmed active-role, assignment and workflow-state checks. Their audit and review-action writes remain inside the protected functions.

### Remaining default-privilege limitation

Read-only inspection of `pg_default_acl` shows `supabase_admin` still has broad default privileges configured for future objects in `public`: table DML grants and sequence privileges for `anon`, `authenticated` and `service_role`, plus function EXECUTE grants for those roles. The `secure_future_public_object_defaults` migration does not remove this owner-specific default ACL. Review grants and RLS for every future public object created as `supabase_admin`; do not assume the current table hardening automatically protects future objects.

### Application handling

- The app reads protected tables through the authenticated Supabase client and RLS.
- Support tickets are inserted only with `created_by`, `subject`, and `message`; status is displayed read-only because there is no approved update route.
- The app no longer inserts directly into `audit_logs`. Reviewer decisions, approval, resubmission, access administration and publication use the protected RPCs. Direct audit inserts for catalogue, assessment and mark changes are not available under these grants; add a database-owned audit trigger or narrowly scoped RPC in a separately reviewed migration if those events must be recorded.
- Mark entry first uses `upsert` with `ignoreDuplicates: true` and only the INSERT-granted fields (`assessment_id`, `student_id`, `mark`, `entered_by`). Conflicted rows are updated separately with only UPDATE-granted fields (`mark`, `updated_by`). Enrolment and offering assignment are validated in the server action and again by RLS. This is not a database transaction across the insert and update calls; if a later update fails, the action reports that some marks may already have been saved.

## Security observations from read-only project inspection

- All 15 existing public tables have RLS enabled. Policies use `auth.uid()`, profile state/role and course assignment helpers.
- The new profile column grants restrict authenticated UPDATE to `full_name`; role and account status are not writable by users. Admin role/status changes remain behind `admin_set_user_access`.
- The four security-advisor warnings concern authenticated execution of `SECURITY DEFINER` functions. Their ACLs grant execution to `authenticated` and `service_role`, not `anon` or `PUBLIC`; function bodies use an empty `search_path`. Keep authorization in the bodies and do not revoke access without checking call sites.
- Read-only inspection of the hardened `review_result_submission` and `resubmit_returned_results` bodies confirmed active account, role, assignment and valid-state checks for direct RPC calls.
- Marks RLS now independently checks student enrolment, so direct PostgREST calls cannot bypass the enrollment predicate described in the earlier review.
- Lecturer RLS exposes enrolment IDs but not other student profile names. Batch entry shows IDs only. A reviewed policy for staff to read only necessary roster fields would improve usability while preserving student privacy.

No remote database schema or data was changed during this work.

## Migration and rollback

The legacy Express/MySQL code and static frontend remain in place. Use `npm run dev:legacy` or `npm run start:legacy` to run the old app; the existing SQL schema and record backup were not altered. The default `npm run dev` and `npm start` now target Next.js.

The legacy demo seed refuses to run when `NODE_ENV=production`. Treat the old MySQL backup as private and keep it excluded from source control.

## Framework references checked

- [Supabase SSR client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase server-side authentication guidance](https://supabase.com/docs/guides/auth/server-side)
- [Next.js 16 Proxy convention](https://nextjs.org/docs/app/getting-started/proxy)
- [Next.js cookies API](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [Next.js ESLint flat configuration](https://nextjs.org/docs/app/api-reference/config/eslint)

## Verification record

The dependency-free tests cover MUST email domains, safe authentication redirects, active-role checks, batch mark boundaries, hardened write-column handling, workflow RPC wiring, student ownership filters, ignore rules and shared responsive UI states. Ten tests passed after the permission-compatibility repair. Offline JavaScript syntax and JSON validation also passed. Loading, route-error, database-query-error and returned-mark correction states have explicit UI handling.

Dependency installation was attempted but could not access `registry.npmjs.org` (`EACCES`). The existing `package-lock.json` therefore does not yet include the Next.js, React or Supabase dependencies. Lint, TypeScript checking and the production build could not run because their executables are not installed. Run `npm install` when registry access is available, then regenerate the lockfile and rerun all three checks.

Live Supabase RLS/workflow tests still need dedicated non-production users and fixtures. Read-only catalog checks confirmed the role column restriction is in effect and the workflow RPC signatures are present. Review the remaining `supabase_admin` default privileges for future public objects, and decide how non-workflow catalogue/assessment/mark changes should be recorded in the audit trail before production acceptance.

### Additional feature-branch migrations — not yet applied to production

The following migrations were added after the current production database audit. Keep them unapplied until the feature branch passes CI and its preview deployment is verified:

- `20261116170000_attendance_register_and_exam_eligibility.sql`: creates RLS-protected attendance sessions and registers, allows assigned lecturers/admins to submit a complete roll call atomically, and enforces complete registers plus at least 80% attendance at the database result-submission boundary. Attendance writes are performed through the authorised RPC; students can read only their own attendance records.
- `20261116171000_admin_support_ticket_workflow.sql`: adds an administrator-only support-ticket status RPC with audit logging. The dashboard exposes OPEN, IN_PROGRESS, RESOLVED and CLOSED transitions to administrators only.

Apply these migrations in timestamp order after preview verification. Do not seed attendance, programmes, faculties, course units, assessments, enrolments, marks or grades with invented values. Import the approved academic catalogue and real attendance registers through authorised workflows.
