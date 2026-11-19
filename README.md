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
- Administrator-controlled account roles. Production account activation is being hardened so it remains separate from inbox verification.
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

The application validates registration, sign-in and confirmation-resend email addresses against the MUST institutional domains `@must.ac.ug` and `@std.must.ac.ug` in server-side code. Protected workspaces also require the profile's `email_verified` flag. **Critical production caveat:** the live database still has a `BEFORE INSERT` trigger that auto-confirms MUST-domain sign-ups, and `handle_new_must_user()` currently creates those profiles as ACTIVE and verified. The administrator access RPC also writes `auth.users.email_confirmed_at` and sets `profiles.email_verified` when an account is activated. Consequently, the current production flag is not reliable proof of inbox ownership, and new MUST registrations can bypass the intended administrator-approval stage. PR [#11 — Require real MUST inbox verification](https://github.com/Rodgers05/MUST-Examination-Results-Management-System-/pull/11) prepares a correction but has not been applied. Verify SMTP delivery, enable email confirmations, and review existing-account re-verification before applying it.

## Database and deployment

- Supabase PostgreSQL is the application database.
- Vercel deploys the Next.js application from the GitHub repository.
- Review and apply database migrations deliberately; a migration file committed to Git is **not** automatically applied to Supabase unless the migration workflow is explicitly run.
- Keep production database backups and review RLS policies whenever tables, RPCs or role permissions change.

## Security and release status

The Supabase project has RLS enabled on its application tables and uses protected workflow functions for marks submission, review, resubmission, access administration and publication. These functions must retain their internal role, assignment and workflow-state checks.

Known release checks that still require completion are tracked during deployment and testing:

- Verify email confirmation and SMTP delivery end to end.
- Confirm Google OAuth provider credentials and callback behaviour.
- Review and apply the pending email-verification hardening migration (PR #8) before relying on strict email ownership verification; confirm SMTP delivery first and plan re-verification for existing active-but-unconfirmed accounts.
- Review the authenticated `SECURITY DEFINER` RPC warnings and test each role boundary; do not revoke workflow RPC execution blindly.
- Perform end-to-end tests with dedicated ADMIN, LECTURER, REVIEWER, REGISTRAR and STUDENT accounts, including negative permission tests.
- Validate marks calculations, submission state transitions, publication and student result isolation using approved test records.
- Confirm backup/restore, monitoring, audit retention and university sign-off before real institutional use.

Supabase leaked-password protection may require a higher subscription tier. Where unavailable, retain strong password rules, secure reset flows, rate limiting and monitoring; document the plan limitation rather than claiming that breached-password screening is enabled.

## Legacy prototype

The previous Express/MySQL implementation and its scripts are retained only as a reference. It is not the live Next.js/Supabase application. Do not use legacy demo credentials or seed data in the production system.


## Release verification (2026-11-19)

### First application release

PR [#10 — Simplify MUST portal wording](https://github.com/Rodgers05/MUST-Examination-Results-Management-System-/pull/10) was merged to `main` as commit `786317eaabeed752a337b22af2c5c43bbae3db32`.

The source commit passed the GitHub Actions quality workflow, including dependency advisory check, lint, TypeScript type-check, automated tests and production build. Both linked Vercel projects completed production deployments for that merge commit:

- `must-exam-results`: deployment `dpl_utgfdoX9nxj8MjWfvCPLbY7EKaH4`, state **READY**, production.
- `mustexaminationresultsmanagementsystem`: deployment `dpl_DHWgoaVcpAhAUMvaUW5G8RtqVox9`, state **READY**, production.

The `must-exam-results.vercel.app` alias now resolves to the new production deployment, but it still has a 307 redirect to `must-results.is-a.dev`. Vercel reports that custom domain as **not verified** and supplies a pending TXT verification challenge. Therefore deployment promotion is confirmed, but end-user access through that redirect is not yet fully verified. The other project's stable Vercel domain is `https://mustexaminationresultsmanagementsys.vercel.app`.

### What this release changes

- Simplifies wording across the public pages, dashboard, navigation, profile and lecturer marks workspace.
- Restricts server-side email validation to `@must.ac.ug` and `@std.must.ac.ug`.
- Requires the profile email-verification flag before protected workspace access.
- Keeps role assignment administrator-controlled and does not modify academic records or marks calculations.

### Read-only production database snapshot

The following counts were read from the connected Supabase project after this release. No database writes were performed:

- 18 profiles; 4 ACTIVE profiles still have `email_verified = false`.
- 4 course offerings and 5 enrolments in `ENROLLED` status.
- 1 course-staff assignment; the current role-mismatch check returned no mismatches.
- 1 assessment and 2 mark records.
- 0 result submissions and 0 published results.
- 0 attendance sessions and 0 attendance records.

All 17 existing public application tables have RLS enabled. The database advisor currently reports 8 authenticated-callable `SECURITY DEFINER` functions and disabled leaked-password protection. These require a function-by-function authorization review; do not revoke execution blindly because the application uses protected RPCs for core workflows. The performance advisor also reports 17 unused indexes, which should be reviewed after real query workloads exist. The health advisor returned no findings.

### Remaining release and institutional acceptance work

1. Verify the `must-results.is-a.dev` DNS/TXT challenge or deliberately change the primary URL routing so the verified Vercel URL does not depend on an unverified redirect.
2. Verify real SMTP confirmation and password-reset delivery, Google OAuth credentials and callback behaviour. Do not assume that the Google button proves OAuth is configured.
3. Review the legacy Auth confirmation trigger and administrator-access RPC; plan the verification migration only after SMTP and existing-account impact are confirmed.
4. Review the 8 callable `SECURITY DEFINER` functions individually, including internal role, assignment and workflow-state checks. Review leaked-password protection availability and future-object default privileges.
5. Complete non-production end-to-end testing for ADMIN, REGISTRAR, LECTURER, REVIEWER and STUDENT, including role isolation, enrolled-student marks entry, logout on mobile, assessment weighting, attendance eligibility, result return/review/approval/publication and student result isolation.
6. The current production dataset has no result submissions, published results or attendance sessions/records, so a complete academic lifecycle and the 80% attendance rule have not been validated against real workflows.
7. Confirm the required MUST approval chain (Department Committee, Faculty Board, Senate and Academic Registrar) with the university's actual regulations and authorised stakeholders before treating the workflow as institutionally complete.
8. Verify backup/restore, audit retention, monitoring and formal university sign-off before real institutional use.

No production academic record, mark, result, role assignment, Auth setting or database schema was changed as part of this application-code release.
