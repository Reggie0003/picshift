# Pic Shift — Compliance mapping

> Plain-English mapping from the laws Pic Shift must comply with to the
> code/feature that implements each control. Hand this to your auditor.

---

## 1. Ghana Data Protection Act, 2012 (Act 843)

| Section | Requirement | Implementation |
|---|---|---|
| §17 — Lawful processing | Process personal data only on a lawful basis | Consent ledger (`consent_records` table) captured at signup; legitimate-interest documented in Privacy Policy |
| §18 — Right of access | Data subject must be able to obtain their data | `GET /v1/employees/:id` for self; CSV/JSON export via right-to-erasure flow |
| §19 — Right to correction | Subject can amend inaccurate data | `PATCH /v1/employees/:id` allows self-edits (employees of their own profile) |
| §20 — Right of erasure | Subject can request deletion | `POST /v1/employees/:id/erase` → soft-delete + PII redaction; statutory retention retained for tax records (Income Tax Act §125 — 6 years) |
| §22 — Notification of breach | DPC must be notified | `docs/INCIDENT-RESPONSE.md` defines 72-hour DPC notification SLA |
| §30 — Security safeguards | Appropriate technical and organisational measures | AES-256-GCM field encryption (`lib/crypto.ts`), TLS 1.3 (Cloudflare + nginx), Argon2id passwords, MFA TOTP, audit log |
| §47 — Cross-border transfers | Restricted unless equivalent protection | Documents stored in `eu-west-1` (Ireland) — GDPR-equivalent; SCC clauses in DPA template |
| §57 — Data Protection Officer | Required for entities processing personal data | DPO appointment recorded in `docs/INCIDENT-RESPONSE.md` |
| §60-§61 — Registration | Data Controller registration with DPC | Annual registration — track in `docs/COMPLIANCE-CALENDAR.md` |

## 2. Nigeria Data Protection Act 2023 (NDPA) + NDPR 2019

| Article | Requirement | Implementation |
|---|---|---|
| NDPR 2.1 | Lawful processing | Consent ledger |
| NDPR 2.5 | Privacy policy made available | Public `/privacy` route on web |
| NDPR 2.6 | Data Protection Compliance Organisation (DPCO) audit | Engage NITDA-licensed DPCO annually |
| NDPA §32 | DPO appointment for entities processing > 1000 data subjects | DPO record |
| NDPA §40 | Breach notification within 72 h to NDPC | Incident-response runbook |
| NDPA §41 | Cross-border transfer adequacy | EU adequacy decision basis used |
| Sectoral: CBN | BVN handling | BVN encrypted at rest; hash-only equality search; no BVN ever returned in lists |

## 3. GDPR (for any EU citizens employed by Pic Shift customers)

| Article | Requirement | Implementation |
|---|---|---|
| Art. 5 | Lawfulness, transparency, minimisation | Consent ledger + Privacy Policy + only collect fields necessary for HR |
| Art. 15 | Right of access | Self-service export endpoint |
| Art. 17 | Right to erasure | `POST /v1/employees/:id/erase` |
| Art. 25 | Privacy by design | Encryption-at-rest at field level, audit log, RLS |
| Art. 30 | Records of processing | This document + `apps/api/prisma/schema.prisma` schema doc |
| Art. 32 | Security of processing | See §1 row "Security safeguards" |
| Art. 33 | Breach notification (72 h) | Incident-response runbook |
| Art. 37 | DPO requirement | DPO record |

## 4. SOC 2 Type II — control mapping

| Trust Service Criterion | Control | Evidence |
|---|---|---|
| **CC6.1** Logical access | RBAC with 6 roles, MFA enforced for HR/payroll/owner | `lib/rbac.ts`, `middleware/auth.ts` requireMfa, `audit_log` entries |
| **CC6.2** New user provisioning | Role assignments require `org.users.manage` | `RoleAssignment` table + audit entries |
| **CC6.3** Logical access modification | Permission changes audited | `audit_log` `permission_change` action |
| **CC6.6** Encryption | TLS 1.3 in transit; AES-256-GCM at rest | `lib/crypto.ts`, nginx + Cloudflare configs |
| **CC6.7** Restricted access to PII | Field-level encryption; RLS on tenant boundary | `lib/crypto.ts` envelope encryption; Postgres RLS policies |
| **CC7.1** Detection of vulnerabilities | npm audit in CI, Dependabot, gitleaks | `.github/workflows/ci.yml` |
| **CC7.2** Monitoring | Pino structured logs, Prometheus metrics | `lib/logger.ts`, monitoring stack |
| **CC7.3** Incident response | Documented runbook, 72-h SLA | `docs/INCIDENT-RESPONSE.md` |
| **CC7.4** Recovery from incidents | Daily encrypted backups + restore drill quarterly | `infra/scripts/backup.sh`, `restore.sh` |
| **CC8.1** Change management | All code via PR + CI; Prisma migrations are append-only and tracked | `.github/workflows/ci.yml` |
| **A1.1** Availability | Healthchecks, graceful shutdown, multi-replica scale path | `server.ts`, docker-compose healthchecks |
| **P4.2** Confidentiality of customer info | Audit log immutability via Postgres trigger | `prisma/migrations/0002_audit_immutability_and_rls/migration.sql` |

## 5. Ghana Labour Act 2003 (Act 651) — encoded defaults

| Section | Requirement | Encoded in |
|---|---|---|
| §20 | 15 working days annual leave (after 12 months) | `pto.service.ts GHANA_LABOUR_ACT_DEFAULTS` |
| §57 | 12 weeks paid maternity leave | `pto.service.ts` |
| §35 | Overtime: 1.5× weekday, 2× rest day | `payroll/ghana/tax-tables.ts GH_OVERTIME` |
| §33 | Standard 40-hour work week | `payroll/ghana/tax-tables.ts` |
| §10 | 36 hours weekly rest | Schedule validation (Phase 2) |

## 6. Ghana Income Tax Act 2015 (Act 896) — encoded

| Section | Requirement | Encoded in |
|---|---|---|
| §6 | PAYE on chargeable income | `payroll/ghana/calculator.ts computeMonthlyPaye` |
| §51 | Reliefs (marriage, dependants, disability, training) | `payroll/ghana/calculator.ts computeMonthlyReliefsMinor` |
| §125 | 6-year record retention | Right-to-erasure preserves payroll history |
| Finance Acts | Annual band updates | `payroll/ghana/tax-tables.ts` (versioned, `tablesVersion` stamped on every payroll run) |

## 7. Ghana National Pensions Act 2008 (Act 766) — encoded

| Section | Requirement | Encoded in |
|---|---|---|
| §3 | Mandatory tiers 1 (13.5%) + 2 (5%) + voluntary 3 | `payroll/ghana/tax-tables.ts GH_SSNIT` |
| §3(1)(a) | Employee deduction 5.5% pre-tax | `payroll/ghana/calculator.ts` (computed before chargeable income) |

## 8. Other levies (informational — NOT payroll deductions)

| Levy | Rate | Statute | Note |
|---|---|---|---|
| NHIL | 2.5% | Health Insurance Act 852 | VAT-eligible point-of-sale only |
| GETFund | 2.5% | Education Trust Fund Act 581 | Same |
| COVID-19 Recovery | 1.0% | Act 1068 (2021) | Same |

Pic Shift's own SaaS subscriptions are subject to these levies if billed
from a Ghana-incorporated entity. They do NOT come off employee paychecks.

## 9. PCI-DSS

Pic Shift never stores card numbers or CVVs. Card payments (if customers
pay subscriptions with cards) are tokenised by Flutterwave/Paystack. We
remain in SAQ-A scope.

## 10. Audit calendar

| Activity | Frequency | Owner |
|---|---|---|
| Restore drill | Quarterly | Engineering |
| Access review (who has which role) | Quarterly | Security |
| Dependency vulnerability scan | Weekly (Dependabot) + on every push | CI |
| Penetration test | Annually | External vendor |
| SOC 2 Type II audit | Annually | External auditor |
| Ghana DPC registration renewal | Annually | Legal / DPO |
| NDPR audit (NITDA DPCO) | Annually by 15 March | DPO |
| Privacy Policy + ToS review | Annually | Legal |
| Insurance renewal | Annually | Finance |
