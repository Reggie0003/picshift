# Pic Shift

**Autonomous AI-powered HR operating system for Africa — Ghana & Nigeria first.**

Pic Shift is a multi-tenant HR SaaS covering employee management, scheduling, PTO,
document storage, audit, and (Phase 3) payroll with Ghana GRA-compliant tax
calculation, SSNIT, NHIL, GETFund, and mobile-money disbursement via Flutterwave,
Paystack, MTN MoMo, and Vodafone Cash.

## Repository layout

```
picshift-main/
├── apps/
│   ├── web/                Vite + React + TS frontend (existing UI, upgraded)
│   └── api/                Express + TypeScript + Prisma backend
├── packages/
│   └── shared/             Shared types & Zod schemas
├── infra/
│   ├── docker/             Dockerfiles for api, web, postgres, redis
│   ├── nginx/              Reverse proxy + TLS termination config
│   ├── scripts/            Backup, restore, key-rotation, deploy scripts
│   └── terraform/          AWS S3 (documents + backup) + Cloudflare WAF
├── docs/
│   ├── ARCHITECTURE.md     System diagram, module boundaries, data flows
│   ├── DEPLOYMENT.md       VMware bare-metal + AWS DR runbook
│   ├── COMPLIANCE.md       Ghana DPA + NDPR + GDPR + SOC 2 mapping
│   ├── SECURITY-CHECKLIST.md
│   ├── COSTS.md            VMware vs AWS vs Supabase cost comparison
│   ├── ROADMAP.md          Phased build plan
│   ├── THREAT-MODEL.md     STRIDE-based threat analysis
│   └── INCIDENT-RESPONSE.md
└── docker-compose.yml      Local dev + VMware production
```

## Quick start (local development)

```bash
# 1. Bring up Postgres 16 + Redis 7 + MinIO (S3-compatible)
docker compose up -d postgres redis minio

# 2. Configure API
cd apps/api
cp .env.example .env
# Fill in DB_URL, JWT keys, S3 credentials, etc.
npm install
npx prisma migrate deploy
npm run seed
npm run dev          # API on :4000

# 3. Configure web
cd ../web
cp .env.example .env
# Set VITE_API_URL=http://localhost:4000
npm install
npm run dev          # Web on :5173
```

## Production deployment (VMware)

See `docs/DEPLOYMENT.md` for the full runbook.

```bash
# On your VMware Ubuntu/Debian host
git clone <repo> /opt/picshift
cd /opt/picshift
cp .env.production.example .env.production
# Edit secrets
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
# Configure Cloudflare DNS + Origin Cert
```

## Phase 1 features (working in this build)

- Multi-tenant organizations with strict row-level isolation
- Email + password auth with **Argon2id** hashing
- **MFA (TOTP)** enrollment & enforcement
- 6-role RBAC: `super_admin`, `org_owner`, `hr_admin`, `payroll_admin`, `manager`, `employee`
- Employee management with **field-level encryption** of PII (Ghana Card, SSNIT, TIN, BVN, NIN, address, DOB, bank, MoMo)
- **PTO** policies, accrual, requests, approvals, balance ledger (Ghana Labour Act compliant)
- Scheduling / shifts with timezone-safe storage (UTC) and Africa/Accra default display
- Document storage with S3-compatible presigned uploads + signed downloads
- **Immutable audit log** with Postgres triggers preventing UPDATE / DELETE
- Consent ledger for Ghana DPA + NDPR + GDPR compliance
- Right-to-erasure flow (soft-delete + redaction)
- Brute-force protection via Redis counters + account lockout
- Rate limiting on all auth endpoints
- Structured (Pino) logging with request IDs
- Health, readiness, and metrics probes

## Phase 2 / 3 features (stubbed, typed contracts)

- AI HR assistant (Anthropic + OpenAI adapters, pgvector knowledge base)
- Payroll engine: **Ghana PAYE 2026 bands, SSNIT Tier 1/2/3, NHIL, GETFund, COVID-19 levy** — calculator implemented and unit-tested
- Banking adapters: Flutterwave, Paystack, MTN MoMo, Vodafone Cash, Hubtel
- Webhook receiver with HMAC signature verification

## Compliance posture

| Regulation | Status | Reference |
|---|---|---|
| Ghana Data Protection Act 2012 (Act 843) | Implemented | docs/COMPLIANCE.md |
| Nigeria NDPR 2019 + NDPA 2023 | Implemented | docs/COMPLIANCE.md |
| GDPR (for any EU-based clients) | Implemented | docs/COMPLIANCE.md |
| SOC 2 Type II evidence | Scaffolded | docs/COMPLIANCE.md |
| Ghana Labour Act 2003 (Act 651) | Encoded in PTO defaults | apps/api/src/modules/pto |
| Ghana Income Tax Act 2015 (Act 896) | Encoded in payroll | apps/api/src/modules/payroll |

## Cost summary (~50 employees, MVP scale)

| Stack | Monthly | Notes |
|---|---|---|
| **Self-host on VMware (chosen)** | **~$15–35** | Cloudflare free tier + AWS S3 backup ($5–10) + SES email ($1) + domain |
| Supabase + Cloudflare | ~$25–60 | Supabase Pro $25, no infra ops |
| Full AWS (ECS + RDS + ElastiCache) | ~$280–500 | Best for SOC 2, scale > 1000 employees |

See `docs/COSTS.md` for full breakdown.

## License

Proprietary. © Pic Shift 2026.
