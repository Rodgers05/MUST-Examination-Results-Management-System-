# MUST Examination Results Management System

A role-based examination results management portal built with **Next.js 16**, **React 19**, **Supabase Auth**, and **PostgreSQL**.

**Configured application URL:** https://must-exam-results.vercel.app (currently redirects to an unverified custom domain; see Release verification below)  
**University website:** https://www.must.ac.ug/

> This is a student-developed academic system. It is not an official MUST-operated information system. Use authorised test data until the university formally approves production use.

## Current application

The Next.js App Router application at the repository root is the primary application. The older Express/MySQL prototype is retained for reference and is not the deployed application.

### Main capabilities

- Email/password registration and sign-in using Supabase Auth.
- Google OAuth sign-in button (requires the Google provider and redirect URLs to be configured in Supabase and Google Cloud).
- Password show/hide control on password fields.
- Administrator-controlled account roles and activation.
- Role-aware workspaces for **ADMIN**, **LECTURER**, **REVIEWER**, **REGISTRAR**, and **STUDENT**.
- Academic catalogue: departments, academic years, semesters, courses and course offerings.
- Student enrolment and staff course assignments.
- Lecturer assessment setup and batch marks entry for assigned course offerings.
- Marks validation against assessment maximums and configured assessment weights.
- Result submission, review/return for correction, registrar approval and publication.
- Student access to their own enrolled courses and published results.
- Attendance register and exam-eligibility support.
- Help/support tickets, audit records, profile settings and password recovery.
- Responsive layouts and MUST-inspired navy, blue and gold visual styling.

## Role visibility

| Role | Intended access |
|---|---|
| ADMIN | User access, academic catalogue, course assignments, enrolments, system administration and support oversight. |
| LECTURER | Assigned course offerings, eligible enrolled-student roster, assessments, marks entry and submission/correction workflow. |
| REVIEWER | Assigned result submissions for review, return or recommendation according to workflow permissions. |
| REGISTRAR | Reviewed submissions, approval and publication workflow. |
| STUDENT | Own profile, own enrolments and own published results only. |

Access is enforced through application checks and PostgreSQL row-level security (RLS). The database remains the authority for weighted final-mark and grade calculation during publication.

## Local setup

### Requirements

- Node.js 20.9 or newer
- npm
- Supabase project credentials

### Install and run

```bash
npm install
cp .env.example .env.local
npm run dev
```

On Windows PowerShell, create `.env.local` by copying `.env.example`:

```powershell
Copy-Item .env.example .env.local
```

Set the environment variables in `.env.local` using the Supabase project URL and publishable/anon key. Never put a Supabase service-role or secret key in a `NEXT_PUBLIC_*` variable or commit it to Git.

Open http://localhost:3000.

## Verification commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run tests against a dedicated test environment. Do not run destructive test fixtures against real student or examination data.

## Authentication configuration

1. Configure Supabase Auth email/password settings and a working SMTP sender for confirmation and password-recovery messages.
2. Configure Google OAuth in Google Cloud and enable the Google provider in Supabase.
3. Add the production origin `https://must-exam-results.vercel.app` and Supabase callback `https://axqknavghtqeyayglosr.supabase.co/auth/v1/callback` to the appropriate provider settings.
4. Configure Supabase Site URL and allowed redirect URLs to include the production callback `https://must-exam-results.vercel.app/auth/callback`.
5. Keep role assignment administrator-controlled. New self-registrations must not grant privileged roles.

The application now validates registration, sign-in and confirmation-resend email addresses against the MUST institutional domains `@must.ac.ug` and `@std.must.ac.ug` in server-side code. Protected workspaces also require the profile's `email_verified` flag. **Database caveat:** the production database still has legacy email-confirmation behaviour, and the separate verification-synchronisation hardening migration has not been applied. The application gate is therefore not proof that SMTP delivery and inbox ownership have been verified end to end. Confirm SMTP delivery and review existing active-but-unverified accounts before changing Auth settings or applying that migration.

## Database and deployment

- Supabase PostgreSQL is the application database.
- Vercel deploys the Next.js application from the GitHub repository.
- Review and apply database migrations deliberately; a migration file committed to Git is **not** automatically applied to Supabase unless the migration workflow is explicitly run.
- Keep production database backups and review RLS policies whenever tables, RPCs or role permissions change.

## Live production and security audit — 21 November 2026

### Production release

The latest application release remains deployed to both existing Vercel production projects:

| Project | Production deployment | Commit |
|---|---|---|
| `must-exam-results` | `dpl_2K55XYMUfvsb84PMHaFwwNnvNPxt` | `517155f6c20666574db4447c4c3ed26d411f7e05` |
| `mustexaminationresultsmanagementsystem` | `dpl_CG3WHrZdL2LkpVystAgfXGAVahWy` | `517155f6c20666574db4447c4c3ed26d411f7e05` |

Use the verified direct production URL:

**https://mustexaminationresultsmanagementsys.vercel.app**

The other alias, `must-exam-results.vercel.app`, currently redirects to `must-results.is-a.dev`, which Vercel reports as unverified. Do not use that redirecting alias as the canonical URL.

The latest main-branch commit after the application release is `1d8110c` and contains README/documentation changes only. It is not the deployed application commit. No application code from draft PRs #16–#18 has been merged or deployed.

### What is implemented in the deployed application layer

- MUST institutional-domain validation in registration, password sign-in, confirmation resend and Google OAuth callback.
- A protected-workspace gate requiring an active profile with `email_verified = true`.
- Role-specific dashboard navigation and course-assignment checks.
- Lecturer course selection, enrolled-student roster, per-course assessment entry and atomic batch-mark RPC.
- Assessment-weight editing UI and raw-mark preservation logic.
- Reviewer/Registrar result review, return, approval and publication actions.
- Shared desktop/mobile navigation with logout controls.
- Help/support entry points and links to MUST.

These are application-layer implementations, not proof that every workflow succeeds against the current production database. The read-only database audit below found permission and policy mismatches that block several actions.

### Current production database findings

**Identity and account verification**

- 20 profiles exist: 13 active profiles use non-MUST email domains and 7 use MUST domains.
- Of the 7 MUST-domain profiles, 5 have `email_verified = true` and 2 are unverified.
- 16 Auth users have `email_confirmed_at`; 4 do not.
- The live Auth trigger `auto_confirm_must_signup` still auto-confirms MUST-domain sign-ups.
- The live `admin_set_user_access` RPC writes `auth.users.email_confirmed_at` and `profiles.email_verified` when an account is activated. Administrator approval can therefore manufacture an email-verification state.
- `private.current_role()` currently checks ACTIVE status but not MUST domain, profile verification or the Auth confirmation timestamp. Since RLS policies rely on this helper, active non-MUST accounts can potentially satisfy database role checks through a direct Supabase client.
- Existing MUST accounts may have historical confirmation timestamps created by the auto-confirm trigger. Those timestamps are not proof that the user personally verified an inbox.

Draft PR #18 prepares the database identity gate. It is not applied. Legacy-account re-verification requires verified SMTP, an institutionally approved account-recovery plan and a verified break-glass administrator.

**RLS, grants and SECURITY DEFINER functions**

- RLS is enabled on all 17 public application tables. The reviewed public policies are authenticated-role policies; no anonymous application policy was found.
- The authenticated role currently has only SELECT on `assessments`, although INSERT and UPDATE RLS policies exist and the app uses direct INSERT/UPDATE.
- `result_submissions` has an INSERT policy but the authenticated role lacks INSERT privilege, while the app uses direct INSERT.
- `support_tickets` has an INSERT policy but the authenticated role lacks INSERT privilege, while the app uses direct INSERT.
- `student_number` and `staff_number` are not directly updateable by authenticated users. The current administrator action attempted a direct profile update, so official identifiers may fail to save.
- Eight SECURITY DEFINER functions in the public schema are executable by authenticated users and require continued function-by-function review; do not revoke them indiscriminately because the application uses approved RPC paths.
- Two private trigger-only SECURITY DEFINER functions currently retain PUBLIC/anon/authenticated EXECUTE privileges. PR #18 prepares revocation after confirming they are trigger-only.
- Supabase Security Advisor reports eight SECURITY DEFINER findings. Performance Advisor reports 17 unused indexes. Health Advisor returned no findings.
- Leaked-password protection is disabled and needs an Auth settings review.

Draft PR #17 prepares narrowly scoped RLS-backed table grants and an administrator-only identifier RPC. It depends on PR #18 and has not been applied.

**Attendance and marks**

- The database already enforces a complete attendance register and at least 80% presence for examination marks and result submission.
- The current roster RPC reports every enrolled student as attendance-eligible, and the current lecturer UI therefore enables examination fields that the database trigger can reject.
- The current atomic marks RPC expects a full assessment-by-student matrix, which does not match the attendance rule when a student is below 80%.
- The production database currently has 0 attendance sessions and 0 attendance records. It has 5 assessments and 2 marks; both existing marks are coursework marks.
- Draft PR #16 aligns the roster, UI, server action and atomic RPC: coursework marks remain available for enrolled students, examination marks require a complete attendance register and at least 80%, and result submission is blocked until every enrolled student meets the attendance condition.
- This is the attendance condition only. MUST's published regulations also require stipulated coursework and payment of University dues before a candidate sits examinations. Coursework structure/marks are checked in the portal, but fee/dues clearance is not integrated with an authoritative MUST finance system.

**Academic data snapshot**

| Record | Current count |
|---|---:|
| Course offerings | 4 |
| Enrolled student records | 6 |
| Course-staff assignments | 2 |
| Assessments | 5 |
| Marks | 2 |
| Attendance sessions | 0 |
| Attendance records | 0 |
| Result submissions | 0 |
| Published results | 0 |
| Student profiles missing registration numbers | 8 |
| Staff profiles missing staff numbers | 10 |

No real student, registration number, mark, attendance record or result has been fabricated or changed. The missing identifiers require official source data and administrator entry.

### MUST approval and publication policy

The published MUST Examination Regulations and Policies (2023), sections 2.3 and 2.5, specify an 80% attendance requirement, stipulated coursework and University dues for examination eligibility; coursework is capped at 40% and the examination at 60%.

The 2023 regulations specify the results path:
1. Department Committee considers coursework and examination results and submits them with meeting minutes to the Faculty Board of Examiners.
2. Faculty Board vets and approves the results. Results may then be published provisionally.
3. University Senate confirms and approves the Faculty Board results.
4. The Academic Registrar receives the Senate submission at least one week before the meeting with the Dean's signature and Faculty Board minutes; final results are then published through approved channels including the student portal.

The currently implemented application workflow is only Lecturer submission → Reviewer review/return → Academic Registrar approval → publication. It does not model Department Committee, Faculty Board, Senate, or provisional publication. The Academic Registrar is a receipt/administration step in the 2023 regulations, not a substitute for Senate approval.

MUST's official website also lists an approved Examination Management Policy 2025, but its document download could not be retrieved during this audit. The 2023 regulations are therefore the accessible policy baseline, not proof that no 2025 amendments exist. Obtain and compare the 2025 policy before implementing the multi-stage workflow, meeting-minute/signature requirements and provisional/final publication permissions.

Official references:
- [MUST Examination Regulations and Policies (2023)](https://www.must.ac.ug/wp-content/uploads/2024/06/Examination-Regulations-and-Policies-2023.pdf)
- [MUST Examination Management Policy 2025 listing](https://www.must.ac.ug/download/examination-management-policy-2025/)

### Current remediation branches

| PR | Scope | State |
|---|---|---|
| [#16](https://github.com/Rodgers05/MUST-Examination-Results-Management-System-/pull/16) | Attendance-aware marks and roster RPC | Draft; CI and previews must be checked on latest head; staging migration not run |
| [#17](https://github.com/Rodgers05/MUST-Examination-Results-Management-System-/pull/17) | RLS-backed write grants and admin identifier RPC | Draft; depends on #18; staging migration not run |
| [#18](https://github.com/Rodgers05/MUST-Examination-Results-Management-System-/pull/18) | MUST-only verified identity at database boundary | Draft; CI and previews passed; staging and SMTP/OAuth validation still required |
| [#6](https://github.com/Rodgers05/MUST-Examination-Results-Management-System-/pull/6) | Older broad workflow proposal | Legacy draft; do not merge without rework |

PRs #10 and #12–#15 are merged. Obsolete duplicate PRs #7–#9 and the older database attempt #11 were closed as superseded. No PR #16–#18 migration has been applied to production.

### Validation completed and still required

The deployed application commit passed its dependency advisory check, lint, TypeScript check, 14 automated tests and production build. PR #18's current clean branch passed its CI suite (18 tests), lint, type-check and production build; both Vercel previews were READY. PR #16 and #17 have separate draft checks and preview builds; verify their latest head commits before any review decision.

Still required before production use:
- A separate staging Supabase project and synthetic-only integration fixtures.
- Verified SMTP confirmation and password-reset delivery using controlled MUST mailboxes.
- Google OAuth provider, redirect and end-to-end sign-in verification in Supabase.
- A reviewed production backup, restore test and rollback plan.
- Migration execution and negative RLS tests on staging.
- Full lecturer, reviewer, Department Committee, Faculty Board, Senate, Registrar and student end-to-end tests.
- Mobile/responsive and accessibility acceptance testing.
- Official MUST confirmation of the 2025 policy and the current approval/signature process.

**Production safety:** No production schema, grants, Auth settings, student identifiers, attendance, marks, submissions or published results were changed during this audit. Do not use the current portal for real result publication until the identity gate, RLS grants, attendance alignment and institutionally approved results workflow have been validated.
