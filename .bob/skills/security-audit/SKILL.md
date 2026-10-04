---
name: security-audit
description: Use when the user wants to audit a web application for security vulnerabilities, run an OWASP ASVS Level 1 security review, check for authentication issues, input validation gaps, missing security headers, rate limiting, secrets handling, or access control weaknesses.
---

# OWASP ASVS Level 1 Security Audit

This skill guides a structured security audit of a web application against OWASP Application Security Verification Standard (ASVS) Level 1 — the baseline for all web apps. Level 1 is achievable through black-box or code review with no specialist tools.

Reference: [OWASP ASVS 4.0 Checklist](checklist.md) (included alongside this skill).

---

## Step 1 — Scope the Project

Read the following files to understand the stack before auditing anything:
- Entry point (`server/index.js` or equivalent)
- HTTP layer / router (`server/app.js` or equivalent)
- All service files
- Environment config (`.env.example`, `package.json`)
- Any middleware registration

Use `read_file`, `glob`, and `grep` to explore. Do **not** skip files — a finding must be grounded in actual code.

---

## Step 2 — Audit Each ASVS Category

Work through the [checklist.md](checklist.md) categories in order. For each item, search the codebase for the relevant pattern before recording a pass or fail. Use `grep` to locate specific patterns (headers, validation calls, rate-limit middleware, etc.).

### Categories to cover

1. **Authentication & Access Control (V2/V4)**
   - Is there any authentication mechanism? If not, is that intentional and documented?
   - Are all non-public routes protected?
   - Are session tokens or JWTs used correctly (algorithm, expiry, secret strength)?
   - Are there account lockout or brute-force protections?

2. **Input Validation (V5)**
   - Are all request body fields validated for type, length, and allowed values?
   - Is user-controlled input used in SQL queries? If so, are parameterised queries used?
   - Is user input reflected in responses without sanitisation (potential XSS)?
   - Are integer IDs validated to prevent negative / non-integer injection?

3. **Error Handling & Logging (V7)**
   - Does the error handler leak stack traces or internal details to the client?
   - Are unexpected errors logged server-side?
   - Are successful and failed operations logged appropriately?

4. **Rate Limiting & Request Size Limits (V13)**
   - Is there a rate-limiter middleware (e.g. `express-rate-limit`)?
   - Is `express.json()` called with a `limit` option?
   - Are individual endpoints that trigger expensive work (AI calls, DB scans) protected?

5. **Security Headers (V14)**
   - Are `Helmet` or equivalent headers set (CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy)?
   - Is CORS configured? If so, is the origin whitelist restrictive?

6. **Secrets Handling (V6/V14)**
   - Are secrets (API keys, DB passwords) loaded from environment variables, never hard-coded?
   - Is `.env` in `.gitignore`?
   - Does the API ever return the key or sensitive config to clients?

---

## Step 3 — Record Findings

For **each gap found**, create a finding with:

| Field | Content |
|-------|---------|
| **ID** | SEC-NNN (sequential) |
| **Severity** | Critical / High / Medium / Low |
| **Category** | ASVS category name |
| **Evidence** | File and line number (as a code link) |
| **Why it matters** | One to three sentences on exploitability and impact |
| **Recommended fix** | Concrete, minimal code change or package to add |

Also note what the project **does well** (a short positive list).

---

## Step 4 — Write the Report

Use `write_file` to create `docs/security-audit.md` with:
1. A header block (date, scope, ASVS level)
2. An **executive summary** (2–3 sentences)
3. A **findings table** (ID, severity, category, one-line description)
4. **Full finding details** (one section per finding)
5. A **What the project does well** section
6. A **Recommended next steps** priority-ordered list

---

## Step 5 — Log the Work

Append an entry to `docs/BOB_LOG.md` with:
- The date
- A one-line description of what was asked
- A list of files read and files created/modified
- Verification step (e.g. "No application code changed")

---

## Step 6 — Commit

Commit all new and changed files with a message like:  
`security: add OWASP ASVS Level 1 audit report`

Do **not** change any application code as part of the audit step.
