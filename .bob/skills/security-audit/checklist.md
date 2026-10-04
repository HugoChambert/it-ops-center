# OWASP ASVS Level 1 — Audit Checklist

Reference: OWASP Application Security Verification Standard 4.0, Level 1.  
Use this checklist alongside `SKILL.md`. Mark each item ✅ Pass, ❌ Fail, or N/A.

---

## V2 / V4 — Authentication & Access Control

| # | Check | Result |
|---|-------|--------|
| 2.1 | All non-public routes require authentication | |
| 2.2 | Passwords / secrets never stored or logged in plain text | |
| 2.3 | Session tokens have a reasonable expiry | |
| 2.4 | JWT or token secret is strong and loaded from env | |
| 4.1 | Application enforces least-privilege; no unintended data exposure | |
| 4.2 | ID-based access control verified server-side (no IDOR via ID guessing) | |
| 4.3 | Admin or privileged operations are restricted | |

---

## V5 — Input Validation & Sanitisation

| # | Check | Result |
|---|-------|--------|
| 5.1 | All request body fields are validated (type, length, allowed values) | |
| 5.2 | All SQL queries use parameterised statements (no string concatenation) | |
| 5.3 | User input reflected in responses is sanitised / escaped (XSS prevention) | |
| 5.4 | Integer route parameters are validated and cast safely | |
| 5.5 | File upload endpoints (if any) restrict file type and size | |
| 5.6 | Search / filter query params are sanitised before use in queries | |

---

## V7 — Error Handling & Logging

| # | Check | Result |
|---|-------|--------|
| 7.1 | Error handler does not leak stack traces or internal details to the client | |
| 7.2 | Unexpected server errors are logged server-side | |
| 7.3 | Authentication failures are logged | |
| 7.4 | Sensitive data (tokens, passwords, PII) is not written to logs | |

---

## V13 — Rate Limiting & Request Constraints

| # | Check | Result |
|---|-------|--------|
| 13.1 | A rate-limiter is applied to the API (e.g. `express-rate-limit`) | |
| 13.2 | `express.json()` has an explicit `limit` option | |
| 13.3 | Expensive endpoints (AI calls, heavy DB queries) have additional protection | |
| 13.4 | No endpoint allows unbounded iteration or resource consumption | |

---

## V14 — Security Headers & HTTP Configuration

| # | Check | Result |
|---|-------|--------|
| 14.1 | `Helmet` or equivalent middleware sets security headers | |
| 14.2 | Content-Security-Policy (CSP) header is present | |
| 14.3 | `X-Frame-Options` or `frame-ancestors` CSP directive prevents clickjacking | |
| 14.4 | `X-Content-Type-Options: nosniff` is set | |
| 14.5 | HSTS header is set for HTTPS deployments | |
| 14.6 | CORS is configured; allowed origins are not wildcard unless intentional | |
| 14.7 | `Referrer-Policy` header is set | |

---

## V6 / V14 — Secrets & Configuration Handling

| # | Check | Result |
|---|-------|--------|
| 6.1 | No secrets or API keys are hard-coded in source files | |
| 6.2 | `.env` / secrets files are in `.gitignore` | |
| 6.3 | API responses never return secret values to the client | |
| 6.4 | Default credentials or example secrets are clearly labelled as not for production | |
| 6.5 | Environment variables are documented (`.env.example` or equivalent) | |

---

## Scoring Guide

- **Critical** — Exploitable remotely with no authentication; direct path to data breach or full compromise.
- **High** — Significant risk; exploitable with low effort or limited access.
- **Medium** — Real risk but requires specific conditions, user interaction, or chained exploits.
- **Low** — Defence-in-depth gap; limited standalone impact but should be addressed.
