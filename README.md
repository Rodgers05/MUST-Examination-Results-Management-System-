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

The application currently accepts syntactically valid email addresses from any domain, as required by the current project decision. **Important production caveat:** the live database still has a legacy trigger that auto-confirms MUST-domain sign-ups, and its current administrator-access RPC also confirms an email when activating an account. The email-verification hardening migration is prepared in PR #8 but has not been applied. Until that migration is reviewed and applied, do not treat administrator approval as proof of inbox ownership or claim that strict email verification is enforced.

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


## Release verification (2026-11-20)

### Automated CI and production build

The application code on `main` at commit `4a403c7a70ddf89c12c4041f1b59f74b18e4366c` passed the GitHub Actions quality workflow:

- `npm ci`
- `npm audit --audit-level=high`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

The matching Vercel deployment for project `must-exam-results` reached **READY** with target **production** and the same repository, branch and commit.

### Production routing caveat

The configured URL `https://must-exam-results.vercel.app` currently returns a Vercel 307 redirect to `https://must-results.is-a.dev`. Vercel reports the redirect target as **unverified**. Verify that domain's DNS ownership or remove the redirect before treating the configured URL as fully operational. The production deployment itself is READY; direct page-content verification was not available from this environment.

### Read-only Supabase checks

The connected production database was inspected without changing schema or data:

- All **17** existing public application tables have RLS enabled.
- No direct table privileges are granted to `anon` on those existing application tables.
- The inspected `SECURITY DEFINER` workflow functions use an empty `search_path`; no `anon` execute grants were found.
- Role-claim RLS checks confirmed that an enrolled student sees only their own profile, enrollment and offering; a student account with a mismatched lecturer assignment does not gain lecturer offering or marks access; an unassigned lecturer and reviewer see no course workflow data; and registrar/admin visibility follows their configured policies.
- Vercel's runtime-error aggregation returned no error clusters in the preceding 24 hours.

### Production data readiness and outstanding controls

The live academic data currently contains **4 course offerings**, **3 active enrolments**, and **1 staff assignment**. That assignment is a role mismatch: a STUDENT profile is assigned as LECTURER. There are currently **0 assessments, 0 marks, 0 result submissions and 0 published results**. Consequently, the full marks-to-review-to-approval-to-publication workflow cannot yet be exercised end to end. No staff were assigned and no academic records were invented or inserted during this release.

Read-only account checks found **4 ACTIVE profiles** whose Supabase Auth email remains unconfirmed (1 lecturer and 3 students). The current login action rejects unconfirmed email addresses. PR [#8 — Harden MUST email verification and database access controls](https://github.com/Rodgers05/MUST-Examination-Results-Management-System-/pull/8) remains an open draft; its migration `database/20261118_auth_verification_hardening.sql` has **not** been applied. Do not treat administrator activation as proof of inbox ownership until the migration and email-delivery process have been reviewed and approved.

The `supabase_admin` default privileges for future objects in `public` still grant broad table, sequence and function privileges to `anon` and `authenticated`. Existing tables were checked separately and are RLS-protected, but future public objects created by `supabase_admin` need a reviewed default-privilege hardening migration before they are relied on.

### Remaining production acceptance work

1. Verify or remove the redirect from `must-exam-results.vercel.app` to the unverified custom domain.
2. Review and explicitly approve the email-verification hardening migration after confirming SMTP delivery and the impact on existing accounts.
3. Correct the role-mismatched staff assignment using verified institutional records; do not guess the intended lecturer.
4. Complete official course-staff assignments and assessment/attendance setup, then test marks entry, reviewer return, registrar approval, publication and student result isolation using dedicated non-production accounts and approved fixtures.
5. Review the `supabase_admin` default ACLs for future public tables, sequences and functions.
6. Verify Google OAuth, SMTP delivery, backup/restore, monitoring and institutional sign-off.

No Supabase migration, account-status change, staff assignment, mark, result or other academic data write was performed during this release audit.
