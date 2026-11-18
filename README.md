# MUST Examination Results Management System

A web-based examination-results workflow for Mbarara University of Science and Technology (MUST). The **current application** is built with **Next.js 16 App Router, React 19, Supabase Auth and Supabase PostgreSQL**. The older Express/MySQL implementation is retained as a legacy academic API prototype; it is not the primary backend used by the current portal.

> **Project status:** active development and verification. This repository is an academic project, not an officially certified MUST production service. Do not use it to publish real examination results until the University has approved the grading rules, operational controls and deployment.

## Current application

- Role-based sign-in, registration, account approval and profile management.
- Academic structure: faculties/departments, academic years, semesters, courses and course offerings.
- Course staff assignment and student enrolment.
- Lecturer workspace for assessment setup, attendance recording, batch marks entry, submission and correction of returned results.
- Review, approval and publication workflow, with protected database functions and audit records.
- Student access to their own published results.
- Support tickets, profile settings, avatar upload and light/dark/system appearance.
- Responsive portal layout and security headers.

## Roles and data visibility

| Role | Intended access |
|---|---|
| **ADMIN** | User access and role administration, academic catalogue, course offerings, staff assignments, enrolment management and system-wide administration. |
| **REGISTRAR** | Registrar functions and course-offering responsibilities only where the account has the relevant assignment and permissions. |
| **LECTURER** | Assigned course offerings, enrolled students in those offerings, assessment setup, attendance and marks entry/submission. |
| **REVIEWER** | Assigned submissions for review, verification or return with comments; no general enrolment-management access. |
| **STUDENT** | Their own enrolled courses and their own published results only. |

The dashboard should not expose a global enrolment register to every role. The current dashboard's global staff/enrolment management view is admin-gated; lecturer views are scoped to assigned offerings, and student enrolment queries are scoped to the signed-in student. Database row-level security (RLS) and server-side authorization must remain the enforcement boundary—hiding a screen alone is not sufficient.

## Marks and results workflow

The lecturer workspace is available at `/dashboard/lecturer`. It is designed to show the lecturer's assigned offerings and enrolled students, including each student's name and MUST registration number where recorded.

1. An administrator configures the academic year, semester, course offering, enrolments and staff assignments.
2. The assigned lecturer configures assessments and records attendance.
3. The lecturer enters marks for enrolled students against the relevant assessments and submits the results.
4. The authorised reviewer verifies the submission or returns it with comments.
5. The authorised Registrar/approver completes the approval and publication steps.
6. Students view only their own published results.

The application uses protected Supabase workflow functions for review, returned-result resubmission and publication. Final weighted totals and grades are calculated by the database publishing function; do not replace this with an unapproved client-side grade calculation.

**Academic policy must be confirmed by MUST.** Current submission checks in the application enforce a 100% total assessment weight, coursework not exceeding 40%, examination weight not exceeding 60%, the configured coursework assessment combination, complete marks and attendance records, and an 80% attendance threshold. Confirm these rules against the latest approved University regulations before real use.

## Registration and account security

- Any syntactically valid email address can be used to register.
- MUST addresses ending in `@must.ac.ug` or `@std.must.ac.ug` follow the MUST auto-verification path.
- Other valid email domains require administrator verification and account activation before portal access.
- New accounts receive the **STUDENT** role by default. Staff and administrator roles are assigned by an administrator; users cannot self-select privileged roles.
- Pending, suspended and unverified accounts are blocked from protected portal access.
- Passwords must be at least 12 characters and include uppercase, lowercase and numeric characters. Registration/reset performs a breached-password check using the Pwned Passwords range API.
- Google sign-in is available in the interface but requires the Google provider and redirect URLs to be configured in Supabase.
- Email confirmation requires a verified SMTP sender domain and working Supabase SMTP configuration.

Relevant current signup migration: `supabase/migrations/20261117201908_domain_aware_signup_verification.sql`.

## Technology stack

- **Frontend/application:** Next.js 16, React 19, TypeScript
- **Authentication:** Supabase Auth
- **Database:** Supabase PostgreSQL
- **Authorization:** application server actions, PostgreSQL RLS and protected database functions
- **Testing:** Node.js test runner, ESLint and TypeScript
- **Legacy prototype only:** Express 5, MySQL 8, JWT and Postman

## Local development setup

### Prerequisites

- Node.js **20.9 or newer** (use a currently supported LTS release where possible)
- npm
- Access to the configured Supabase project, or a local Supabase environment

### Install and configure

1. Clone the repository and enter the project directory:

   ```bash
   git clone https://github.com/Rodgers05/MUST-Examination-Results-Management-System-.git
   cd MUST-Examination-Results-Management-System-
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create the local environment file:

   ```bash
   cp .env.example .env.local
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Set the Supabase project URL, publishable key and local site URL in `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   Use the publishable/anon client key only. **Never put a Supabase service-role/secret key, SMTP password, OAuth client secret or production credential in browser code or Git.**

5. Ensure the required Supabase schema and migrations have been applied to your development database. Configure Auth email confirmation, SMTP and Google OAuth separately as described in [docs/SUPABASE_NEXT_MIGRATION.md](docs/SUPABASE_NEXT_MIGRATION.md).

6. Start the Next.js application:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000).

## Verification commands

Run these before proposing or merging a change:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- `npm run dev` — start the current Next.js app.
- `npm run build` — production build.
- `npm run lint` — ESLint.
- `npm run typecheck` — TypeScript validation.
- `npm test` — current application/security tests.
- `npm run start` — start a previously built Next.js app.

A successful local test run is not proof that every live Supabase role, OAuth provider, SMTP sender or deployed workflow has been tested. Record the commit SHA and test output when reporting verification.

## Database and catalogue notes

The application uses existing Supabase tables for departments, academic years, semesters, courses, course offerings, course staff, enrolments, profiles, assessments, marks, attendance, result submissions, review actions, published results, audit logs and support tickets.

The course catalogue was expanded with 2026/27 Semester 1 listings sourced from MUST VLE material. Imported entries marked `VLE_LISTED_UNVERIFIED` are not automatically approved academic records. Missing course codes, credit units, levels and other academic metadata must be confirmed by the Registrar before creating operational offerings. Do not infer or invent those values.

See [docs/SUPABASE_NEXT_MIGRATION.md](docs/SUPABASE_NEXT_MIGRATION.md) for the schema map, authentication configuration, database permissions and known operational checks. Verify that document against the latest migrations before treating it as a complete record of the live database.

## Legacy Express/MySQL API (not the current portal backend)

The repository retains `backend/server.js`, the MySQL schema and `postman/MUST_API_Collection.json` for the earlier API prototype and coursework demonstration. These scripts are separate from the Next.js/Supabase application:

- `npm run start:legacy` — start the legacy Express server.
- `npm run dev:legacy` — start it with Nodemon.
- `npm run seed` — seed legacy demonstration data; use only a disposable local database.
- `npm run test:legacy` — run legacy API tests.
- Import `postman/MUST_API_Collection.json` into Postman for the legacy API examples.

The legacy collection uses its own sample identifiers and authentication flow. It is **not evidence that the current Supabase portal is integrated with the Express API**. Do not use shared demo credentials or real student data. Keep the legacy server and database isolated from production.

## Team collaboration

Use feature branches and pull requests. Each contributor must commit and submit their own work so the repository history accurately records individual contributions. The planned task allocation is not proof that a contribution was completed; use merged commits, PRs and review records as evidence.

## Known release checks and limitations

Before any production release, verify all of the following with authorised test accounts and the actual target environment:

- RLS and server-side permission tests for ADMIN, REGISTRAR, LECTURER, REVIEWER and STUDENT, including cross-user and cross-course denial.
- End-to-end marks entry, attendance eligibility, submission, return/correction, review, approval, publication and student result visibility.
- Database migration state, obsolete email-domain constraints/triggers and default privileges.
- SMTP delivery to external recipients and Google OAuth configuration.
- Approved grading/weighting rules, catalogue metadata and registration-number completeness.
- Backup/restore, monitoring, audit retention, accessibility, mobile usability and security review.
- Individual team contributions and the lecturer's required demonstration evidence.

This repository should be treated as **not production-approved** until the University and project team have completed and documented these checks.
