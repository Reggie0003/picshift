# Pic Shift — Architecture

## 1. High-level system diagram

```
                       ┌─────────────────┐
                       │   Cloudflare    │  WAF + DDoS + cache + DNS
                       │     (free)      │
                       └────────┬────────┘
                                │ TLS 1.3
                       ┌────────▼────────┐
                       │  nginx proxy    │  TLS termination, rate limiting,
                       │  (your VMware)  │  reverse proxy, audit logging
                       └─────┬──────┬────┘
                  /api/*     │      │ /*
                ┌────────────▼┐    ┌▼──────────┐
                │  API        │    │  web      │   static SPA built by Vite
                │  Node 20+TS │    │  nginx    │
                │  Express    │    └───────────┘
                │  Prisma     │
                └──┬──────┬───┘
                   │      │
        ┌──────────▼┐    ┌▼──────────┐
        │ Postgres  │    │ Redis 7   │   sessions, rate-limit counters,
        │ 16 +      │    │           │   lockout, MFA challenge cache
        │ pgvector  │    └───────────┘
        │ pgcrypto  │
        └───────────┘
                   │
        ┌──────────▼───────────────┐
        │  AWS S3 (eu-west-1)      │   documents + nightly encrypted
        │  documents + backups     │   pg_dump backups
        └──────────────────────────┘
```

## 2. Modular monolith — module boundaries

| Module | Path | Owns |
|---|---|---|
| `auth` | `apps/api/src/modules/auth` | signup, login, MFA, sessions, refresh, lockout |
| `employees` | `apps/api/src/modules/employees` | employee CRUD with PII encryption |
| `pto` | `apps/api/src/modules/pto` | policies, requests, approvals, balances |
| `shifts` | `apps/api/src/modules/shifts` | scheduling + clock-in/out |
| `documents` | `apps/api/src/modules/documents` | S3 presigned upload/download |
| `audit` | `apps/api/src/modules/audit` | immutable audit ledger writer + viewer |
| `payroll` | `apps/api/src/modules/payroll` | Ghana PAYE calculator + payroll run engine |
| `payments` | `apps/api/src/modules/payments` | Flutterwave / Paystack / MoMo / Vodafone Cash |
| `ai` | `apps/api/src/modules/ai` | HR assistant with guardrails |

Each module exports:
- `*.schemas.ts` — Zod input validation
- `*.service.ts` — business logic, never imports Express
- `*.routes.ts` — Express handlers, never have inline business logic

This separation is what makes splitting into microservices later a one-week
job instead of a six-month rewrite.

## 3. Data flow — privileged operation

```
HTTP request
  → globalLimiter (Redis-backed, 120 req/min/IP)
  → requestContext (assigns ULID request id)
  → CORS check
  → helmet headers
  → requireAuth (verifies JWT access token)
  → setOrgContext (sets app.current_org_id session var)
  → requirePerm('employee.write')
  → Zod schema parse
  → service function (Prisma transaction)
    ├─ writes to domain table
    └─ writes to audit_log (immutable trigger fires on UPDATE/DELETE)
  → JSON response with X-Request-Id header
```

## 4. Trust boundaries

| Boundary | Trusted? | Mechanism |
|---|---|---|
| Cloudflare → nginx | Yes (verified via Origin Cert) | mTLS with Cloudflare Origin Certificate |
| nginx → API | Yes (intra-host) | Loopback only; no public route |
| API → Postgres | Yes | Network-isolated via Docker; password auth |
| API → Redis | Yes | Network-isolated; password if enabled |
| API → S3 | Untrusted network | IAM with least privilege + bucket policy |
| API → LLM provider | Untrusted | API key + per-org rate limiting; PII never sent |
| API → payment provider | Untrusted | API key + HMAC webhook signature verification |

## 5. Tenancy model

- Every business table carries `organizationId` (foreign key to `organizations`).
- Application code filters by `organizationId` on every query.
- Postgres RLS policies enforce the same filter as defence-in-depth — if a
  developer ever forgets the WHERE clause, the policy denies the row.
- The session variable `app.current_org_id` is set by
  `middleware/orgContext.ts` right after JWT verification.

## 6. Encryption boundaries

| Layer | At rest | In transit | Notes |
|---|---|---|---|
| Postgres column (PII) | AES-256-GCM (envelope) | TLS to DB | Ghana Card, SSNIT, TIN, BVN, NIN, address, DOB, bank, MoMo |
| Postgres disk | LUKS (VMware) | n/a | Encrypt the host VM disk |
| S3 objects | AES-256 (SSE-S3) or KMS | TLS to S3 | Switch to SSE-KMS in production for SOC 2 |
| Backups | GPG-encrypted | TLS to S3 | Recipient key managed offline |
| Redis | optional `--tls` | optional TLS | Local-only deployment, not strictly required |

## 7. Stateless / scaling story

- The API is stateless. Sessions live in Postgres, rate counters in Redis.
- Horizontal scale: add more API replicas behind nginx upstream.
- Postgres scale: read replicas for analytics; primary stays single until
  >5,000 employees or sustained > 1 k req/s.
- Documents scale automatically via S3.

## 8. Background jobs (Phase 2 plan)

When you outgrow synchronous handlers, add BullMQ (Redis-backed):

```
auth → emails (verification, password reset)
payroll → calculation jobs, payment dispatch
documents → virus scanning (ClamAV)
pto → nightly accrual + carry-over
audit → daily export to long-term S3 archive
```

## 9. ADRs

We don't keep a separate ADR file — the `Why:` block at the top of every
service/module explains the decision in context. Search the codebase for
`Why:` to surface the rationale.

## 10. Where the code lives

```
apps/api/src/
├── config/env.ts            # zod-validated env loader
├── lib/                     # shared infra (logger, prisma, redis, jwt,
│                            #  crypto, passwords, totp, lockout, rbac, s3)
├── middleware/              # auth, orgContext, rateLimit, errorHandler,
│                            #  requestContext
├── modules/                 # business modules (see §2)
├── routes/index.ts          # mounts every module router
├── db/seed.ts               # idempotent dev seed
├── app.ts                   # Express composition
└── server.ts                # entrypoint, graceful shutdown
```
