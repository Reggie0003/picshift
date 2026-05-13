# Pic Shift — Security checklist

Tick every box before going live. Re-tick quarterly.

## Identity & access

- [x] Passwords hashed with Argon2id (memoryCost 64 MiB) — `lib/passwords.ts`
- [x] MFA TOTP available, enforced for HR / payroll / owner roles via `requireMfa`
- [x] Account lockout after 5 failed attempts / 15 min — `lib/lockout.ts`
- [x] JWT access tokens 15 min; refresh tokens 30 days, rotated on every refresh
- [x] Refresh tokens hashed (SHA-256) before storage; revoked-on-rotate
- [x] Session table tracks IP + user agent; admin can revoke
- [x] RBAC permission matrix — `lib/rbac.ts` (6 roles, 30+ permissions)
- [ ] SSO / SAML for enterprise customers — **Phase 2**

## Data protection

- [x] AES-256-GCM envelope encryption on Ghana Card, SSNIT, TIN, BVN, NIN, DOB, address, bank account, MoMo
- [x] Searchable hash columns separate from ciphertext
- [x] TLS 1.3 from client → Cloudflare → nginx → API
- [x] Postgres RLS policies on every business table
- [x] VM disk encrypted at the hypervisor layer (vSphere VM Encryption)
- [x] S3 default encryption (AES-256) + Block-Public-Access on all buckets
- [x] Backups GPG-encrypted before S3 upload
- [ ] Production: switch S3 SSE-KMS for per-tenant key isolation — **Phase 2**

## Application security

- [x] Helmet CSP, HSTS, frame-ancestors 'none'
- [x] CORS allowlist (no `*`)
- [x] Strict JSON body limit (1 MB)
- [x] Zod input validation on every endpoint
- [x] No raw SQL except in vetted migrations
- [x] Prisma parametrised queries
- [x] Rate limiting (global + stricter for auth)
- [x] CSRF — N/A; we use Bearer tokens, not cookies
- [x] HTTP security headers via nginx + helmet (defence in depth)

## Audit & detection

- [x] Audit log table with Postgres triggers blocking UPDATE/DELETE
- [x] Every privileged action emits an audit entry
- [x] Failed-login attempts logged
- [x] Structured Pino logs with PII redaction (passwords, tokens, IDs)
- [x] Request IDs propagated end-to-end via `X-Request-Id`
- [ ] Centralised log aggregation (Loki / Datadog) — **Recommended for prod**
- [ ] Anomaly detection on login geographies — **Phase 2**

## Network & host hardening

- [x] UFW firewall — only 22/80/443 open
- [x] fail2ban on the host
- [x] Unattended security upgrades
- [x] Containers drop ALL caps, read-only FS, no-new-privileges
- [x] Containers run as UID 10001 (non-root)
- [x] Cloudflare WAF + DDoS protection
- [ ] SSH key-only auth (disable password auth) — **Do this on first boot**
- [ ] Intrusion detection (e.g. Wazuh) — **Recommended for prod**

## Vulnerability management

- [x] npm audit + Dependabot in CI
- [x] gitleaks (secret scan) in CI
- [ ] Snyk / Socket.dev for SCA — **Optional**
- [ ] Quarterly external penetration test — **Required for SOC 2**

## Compliance

- [x] Consent ledger (Ghana DPA §17, NDPR 2.1, GDPR Art. 6)
- [x] Right-to-erasure flow (Ghana DPA §20, NDPR 2.x, GDPR Art. 17)
- [x] Data exportable (CSV audit export; JSON profile export)
- [x] Privacy Policy + ToS templates (see `docs/legal/`)
- [ ] DPO appointed (required if > 1,000 records)
- [ ] Ghana DPC registration submitted
- [ ] NITDA NDPR audit filed (Nigeria customers)

## Secrets

- [x] `.env.example` shipped; real `.env` gitignored
- [x] All secrets must be 32+ char random — schema enforced
- [ ] HashiCorp Vault or AWS Secrets Manager in production — **Recommended**
- [ ] Quarterly secret rotation runbook — **Required for SOC 2**
- [x] `ENCRYPTION_KEY` recovery plan: 2-of-3 Shamir split, geographically separated

## Backups & DR

- [x] Daily encrypted Postgres dumps → S3
- [x] Restore script + integrity check
- [ ] Quarterly restore drill performed
- [ ] Multi-region replication — **Phase 2**

## Incident response

- [x] Runbook at `docs/INCIDENT-RESPONSE.md`
- [x] 72-hour breach-notification SLA codified
- [ ] On-call rotation — **Required before customer GA**
- [ ] Tabletop exercise — **Annually**
