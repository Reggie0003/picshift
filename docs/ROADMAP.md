# Pic Shift — 12-month roadmap

> Realistic timeline for a solo / small-team build. Your project instructions
> said "MVP 8–18 months" — this plan hits a paying-customer-ready MVP in
> month 6 and SOC 2-ready in month 12.

## ✅ Phase 0 — Foundation (this build delivers)

- [x] Multi-tenant Postgres schema with RLS
- [x] Auth (Argon2id, JWT, MFA TOTP, account lockout)
- [x] RBAC with 6 roles + 30+ permissions
- [x] Employee CRUD with field-level PII encryption
- [x] PTO module with Ghana Labour Act defaults
- [x] Shifts with timezone-safe storage
- [x] Documents (S3 presigned, retention)
- [x] Immutable audit log
- [x] Ghana payroll engine (PAYE 2026 bands, SSNIT, reliefs)
- [x] Payment provider adapters (Flutterwave, Paystack, MTN MoMo, Vodafone Cash) — stubbed
- [x] AI HR assistant with guardrails
- [x] Docker Compose deploy, nginx, Cloudflare-ready
- [x] CI (typecheck, lint, build, audit, gitleaks)

## Phase 1 — Polish for first paying customers (months 1–3)

- [ ] Onboarding wizard (org setup → first 5 employees → first PTO policy)
- [ ] Wire Flutterwave + MTN MoMo to live sandbox; settlement reconciliation
- [ ] Email templates (welcome, password reset, PTO decision, payslip ready)
- [ ] SMS notifications via Hubtel
- [ ] Public marketing page + pricing
- [ ] Privacy Policy + Terms of Service drafted by lawyer (Ghana + Nigeria)
- [ ] Ghana DPC registration submitted
- [ ] Beta with 3 friendly customers
- [ ] Status page (Uptime Kuma)

## Phase 2 — Production hardening (months 4–6)

- [ ] BullMQ background jobs (email, SMS, payroll dispatch, accrual)
- [ ] ClamAV virus scan on document uploads
- [ ] pgvector knowledge base for HR policies (per-org)
- [ ] AI assistant: real-time PTO/balance answers (already deterministic)
- [ ] Mobile app (React Native or Expo) — clock in/out, PTO, payslip view
- [ ] Reporting dashboards (payroll summary, PTO trends, attendance)
- [ ] Notification preferences per user
- [ ] Postgres streaming replication to second VMware host
- [ ] Multi-language: English + Twi (Akan) + Pidgin

## Phase 3 — Payroll go-live (months 6–9)

- [ ] Payroll run UI: draft → review → approve → dispatch flow
- [ ] Payslip PDF generation (Ghana / Nigeria templates)
- [ ] Garnishment / loan repayment ledger
- [ ] Multi-state / multi-country payroll
- [ ] Contractor vs. employee classification engine
- [ ] Tax filing exports (GRA P9 form for Ghana; FIRS PAYE schedule for Nigeria)
- [ ] Bank file generation (NACS for Ghana banks)
- [ ] Payroll anomaly detection (AI second-pair-of-eyes)

## Phase 4 — Enterprise & compliance (months 9–12)

- [ ] SAML / SSO (Auth0 or self-hosted Keycloak)
- [ ] SCIM provisioning
- [ ] SOC 2 Type II readiness assessment + audit
- [ ] Enterprise admin: device fingerprinting, IP allowlists, anomaly alerts
- [ ] Data Processing Agreement (DPA) template per customer
- [ ] Penetration test
- [ ] Cyber liability + E&O insurance bound
- [ ] Disaster recovery: multi-region (move to AWS RDS Multi-AZ)
- [ ] Customer-facing API + webhooks (with HMAC)

## Phase 5 — AI autonomy (months 12+)

- [ ] AI agents:
  - [ ] Auto-approve low-risk PTO (e.g. < 3 days, balance available)
  - [ ] Generate weekly HR digest for managers
  - [ ] Detect payroll anomalies (>2σ from baseline)
  - [ ] Summarise HR tickets / questions
  - [ ] Onboarding playbook executor
- [ ] Multi-LLM routing (Haiku for chat, Sonnet for analysis, Opus for audits)
- [ ] Per-org RAG over policy documents

## Anti-goals (we will NOT build initially)

- ❌ Our own payroll TAX calculations for countries other than Ghana / Nigeria —
  integrate Check / Gusto / etc. when you need US/EU
- ❌ Health insurance brokerage (heavy regulatory burden in Ghana / Nigeria)
- ❌ Real-time chat / messaging (use Slack/Teams integrations instead)
- ❌ Performance review module (cluttered space; differentiate later)
- ❌ Recruiting / ATS (a separate product; partner with Workable or Greenhouse)

## How this build was sized

Your project doc estimated 8–18 months for MVP. This Phase 0 delivers
~3–4 months of foundational work in one session because:
- Schema + auth + RBAC + audit are usually months 1–2 of a build
- The Ghana payroll engine is usually months 4–5
- Payment + AI adapters are usually months 6–7

What's still ahead of you: the *integration* work (live API keys, real
banks signing off your beneficiary registration, GRA tax filing format
verification, customer onboarding flows). That's the long pole.
