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

## RLS-backed workflow write permissions — pending correction

A read-only audit of the connected production database found that several write policies exist without the corresponding SQL table privileges. This means the application can display an action that PostgreSQL will reject before the RLS policy is evaluated:

- Assessment creation and weight edits have INSERT/UPDATE policies but the authenticated role currently lacks INSERT/UPDATE table privileges.
- Lecturer result submission has an INSERT policy but the authenticated role currently lacks INSERT privilege.
- Help/support ticket creation has an INSERT policy but the authenticated role currently lacks INSERT privilege.
- Student and staff identifier columns intentionally have no direct user UPDATE grant; the current administrator action attempted a direct profile update and therefore could not reliably save official identifiers.

The pending migration grants only the operations already constrained by those RLS policies. Official student/staff identifiers are moved to a SECURITY DEFINER administrator RPC with role, format, uniqueness and audit checks. It does not grant broad table access or direct identifier updates to ordinary users.

This migration is not applied or deployed. It must be tested on isolated staging and released only after the verified-MUST database role gate is in place. The application code and SQL migration must be deployed together; deploying only one side would leave affected actions unavailable.

## MUST results approval policy gap — pending workflow implementation

The currently implemented workflow is Lecturer submission → Reviewer review/return → Academic Registrar approval → publication. It does not yet model the Department Committee, Faculty Board of Examiners, Senate confirmation, or provisional publication.

The publicly available MUST Examination Regulations and Policies (2023), sections 2.5.1–2.5.5, specify:
- the Department Committee considers coursework and examination results and submits them with meeting minutes to the Faculty Board;
- the Faculty Board vets and approves results, after which results are provisional and may be published provisionally;
- the University Senate confirms and approves the Faculty Board results; and
- the Academic Registrar receives the Senate submission one week before the meeting, with the Dean's signature and Faculty Board minutes, and the student portal is a publication avenue.

The 2023 regulations also require at least 80% attendance, completed coursework as stipulated, and payment of University dues for examination eligibility. The current application calculates attendance only; it has no authoritative fees/dues integration.

MUST's official website also lists an approved Examination Management Policy 2025. Its document download could not be retrieved during this audit, so the 2023 workflow is a verified baseline, not confirmation that no 2025 amendments exist. Before building the multi-stage workflow, compare the 2025 policy and confirm the responsible user roles, meeting-minute/signature evidence, provisional publication permissions, and Senate finalisation process.

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

### Current production application release

The current application release is commit `517155f6c20666574db4447c4c3ed26d411f7e05` (PR [#14 — Enforce MUST email verification in login and OAuth callback](https://github.com/Rodgers05/MUST-Examination-Results-Management-System-/pull/14)).

The PR's full quality workflow passed dependency advisories, ESLint, TypeScript, all 14 automated tests and the Next.js production build. Both existing Vercel projects report **READY** on the **production** target for this exact commit:
- `must-exam-results`: deployment `dpl_2K55XYMUfvsb84PMHaFwwNnvNPxt`; alias `https://must-exam-results.vercel.app`.
- `mustexaminationresultsmanagementsystem`: deployment `dpl_CG3WHrZdL2LkpVystAgfXGAVahWy`; alias `https://mustexaminationresultsmanagementsys.vercel.app`.

**URL routing caveat:** the first alias is verified by Vercel but has a 307 redirect to `must-results.is-a.dev`, which Vercel still reports as unverified. The second alias is verified and has no redirect, so it is the direct fallback URL. The custom domains `must-results.is-a.dev` and `portal.mustresultsnomaclcloudsonline.aclclouds.online` are not verified. Do not treat preview URLs as production URLs.

### Test coverage boundary

The production quality workflow runs `npm test` (14 Node tests under `tests/*.test.mjs`), lint, type-check and a production build. The separate legacy MySQL integration suite (`npm run test:legacy`) requires a dedicated isolated MySQL test database and `LEGACY_DEMO_PASSWORD`; it was not run because only the production Supabase project is connected and no staging project is available. Do not point the legacy suite at production.

### Current application behaviour

- Registration, password login, confirmation resend and password-reset requests validate MUST institutional domains `@must.ac.ug` and `@std.must.ac.ug` in application code.
- Password login now requires `profiles.email_verified = true`. The Google OAuth callback now rejects non-MUST email domains and requires the same verified profile flag before redirecting to a pending or active workspace.
- The login page exposes Google sign-in, but the Google provider credentials and a real end-to-end Google sign-in have not been verified.
- Protected application workspaces also check the profile's `email_verified` flag and active account status.
- Role-specific dashboard visibility is implemented for ADMIN, LECTURER, REVIEWER, REGISTRAR and STUDENT. Student published-result queries are scoped to the authenticated profile; lecturer course rosters are scoped to assigned offerings.
- Desktop sidebar and mobile navigation both include a sign-out action.
- The lecturer marks workspace requires the lecturer to select a course offering; only that offering's enrolled students and assessments appear. Batch saves validate the full assessment/student matrix, enrolment, duplicate rows and assessment maximums through the `save_batch_marks` database RPC.
- Assessment weights can be corrected without changing previously entered raw marks. Weight edits are blocked while a submission is in review, approved or published; a reviewer must return the submission before corrections.
- The current results workflow is lecturer submission → reviewer review/return → Registrar approval → publication. The additional Department Committee, Faculty Board and Senate stages have not been implemented or institutionally confirmed.
- The current lecturer workspace explicitly treats all enrolled students as eligible for all assessment marks. The 80% attendance eligibility threshold is **not enforced** in the current application/database workflow. The roster RPC currently returns `examination_eligible = true` rather than deriving it from attendance.
- No production result-submission or publication lifecycle has been exercised: the database currently contains zero result submissions and zero published results.

### Read-only production database audit (2026-11-20)

No production data, schema, Auth setting or migration was changed during this audit.

| Record / control | Current result |
|---|---:|
| Account records | Existing records present; reconcile against authorised MUST records |
| Legacy email-domain state | Non-MUST records remain and require reconciliation |
| Student/staff identifiers | Some records lack official registration or staff numbers |
| Course-staff/profile role consistency | No current assignment-role mismatches |
| Public application tables with RLS enabled | 17 / 17 |
| Result submissions / published results | 0 / 0 |
| Attendance sessions / attendance records | 0 / 0 |

Existing non-MUST accounts and missing registration/staff numbers were left untouched. Do not invent or bulk-edit institutional identity data; reconcile it with authorised MUST records first.

### Security and authentication blockers

- The live database signup triggers currently auto-confirm and activate MUST-domain signups rather than requiring independent inbox verification and administrator approval. Non-MUST signups can also create pending profile records instead of being rejected at the database boundary.
- Legacy non-MUST profiles remain in the production database. The database role helper checks active status but does not independently enforce the MUST institutional domain or verified-email flag for RLS policies and protected RPCs. This is a **production authorization blocker**; application-level validation alone is not sufficient.
- The live administrator approval RPC currently sets the Auth email-confirmation timestamp and profile verification flag when activating an account. Administrator approval can therefore manufacture inbox verification instead of remaining separate from email ownership.
- The private `current_role()` helper must require both a verified profile and an approved MUST institutional email domain before returning a role. That change must be reviewed and tested against every RLS policy and protected RPC before release.
- PR [#11 — Require real MUST inbox verification](https://github.com/Rodgers05/MUST-Examination-Results-Management-System-/pull/11) contains a pending migration draft to remove automatic confirmation, synchronize the profile flag from Supabase Auth, and stop administrator approval from manufacturing verification. It is not merged or applied. The draft must also add and test the `current_role()` email-verification condition before it is considered release-ready.
- Supabase security advisors report 8 authenticated-callable public `SECURITY DEFINER` functions and disabled leaked-password protection. The reviewed functions use an empty `search_path` and contain role/assignment checks, but the email-verification helper issue above must be corrected before relying on them for verified-email enforcement. Do not revoke RPC execution blindly because the application uses these functions for marks, attendance, support, review and publication.
- The performance advisor reports 17 unused indexes; review them against real workload before removing anything. The health advisor returned no findings.
- SMTP confirmation and password-reset delivery have not been verified with a real MUST mailbox. Auth log inspection did not provide evidence of a successful end-to-end email delivery test.

**Do not apply the pending Auth migration or change Supabase Auth settings until SMTP delivery is proven, existing users receive a re-verification plan, and a reviewed backup/rollback procedure is ready.** The four active-but-unverified profiles and 12 legacy non-MUST profiles require authorised account reconciliation; do not delete, auto-confirm or silently reclassify them.

### Remaining institutional validation

1. Verify SMTP confirmation and password-reset delivery to controlled MUST mailboxes, then verify Google OAuth credentials, provider configuration and callback behaviour.
2. Review the pending email-verification migration, add the `current_role()` email-verification condition, prepare a rollback plan and communicate the impact on legacy accounts before applying it.
3. Complete isolated staging end-to-end tests for every stakeholder role, including negative cross-user/cross-course access tests and the administrator approval RPC.
4. Confirm whether the 80% attendance threshold blocks examination entry, result submission or publication under the current MUST regulations; then implement and test the approved rule. Current production has no attendance sessions or records.
5. Confirm the required Department Committee, Faculty Board, Senate and Academic Registrar approval sequence with authorised MUST stakeholders before adding or enabling those stages.
6. Validate weighted mark calculations, review/return/resubmission/approval/publication and student result isolation using synthetic staging fixtures only.
7. Complete backup/restore, audit-retention, monitoring, accessibility, responsive-device and formal University acceptance checks before real institutional use.

The system remains a student-developed academic project, not an officially certified MUST-operated information system. No real student marks or results should be entered or published until the University authorises the system and the outstanding controls are validated.
