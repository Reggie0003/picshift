# Pic Shift — Threat model (STRIDE)

> Use this with `docs/SECURITY-CHECKLIST.md`. Revisit annually and after any
> major architectural change.

## Assets we're protecting

1. **Employee PII** — Ghana Card, SSNIT, TIN, BVN, NIN, address, DOB, bank, MoMo
2. **Salary & bank disbursement data** — fraud target
3. **Auth credentials** — passwords, refresh tokens, MFA secrets
4. **Audit log** — must be tamper-evident for compliance
5. **Documents** — payslips, contracts, tax forms
6. **API keys for payment providers** — direct money-movement capability
7. **Pic Shift brand** — reputational damage from breaches

## Attacker personas

| Persona | Capabilities | Motivation |
|---|---|---|
| External script kiddie | Public web; common scanners | Vanity, ransomware |
| Sophisticated criminal | Credential stuffing, phishing, social engineering | Fraud — payroll redirect |
| Insider (employee at customer org) | Valid login | Privilege escalation, data theft |
| Compromised vendor | Supply-chain (npm package, payment provider) | Espionage, sabotage |
| Nation-state | Full network and host capability | Targeted espionage |

## STRIDE table

### Spoofing (impersonation)
| Threat | Mitigation |
|---|---|
| Login as another user | Argon2id, MFA TOTP, account lockout, no email enumeration |
| Webhook forgery (fake bank "payment success") | HMAC signature verification on every webhook |
| API caller spoofs `X-Forwarded-For` | nginx accepts real-IP header only from Cloudflare ranges |
| Stolen JWT replay | 15-min access TTL; refresh rotation revokes the prior token |
| Phishing for credentials | Customer-facing education + DMARC + HSTS preload |

### Tampering
| Threat | Mitigation |
|---|---|
| Audit log entries deleted | Postgres triggers reject UPDATE/DELETE on `audit_log` |
| PII modified without trace | Service-layer audit writes; immutability above |
| Payment redirected by altering employee bank account | Encrypted at rest; updates audited; pending Phase 2: confirmation OTP on bank-account change |
| Document tampering | SHA-256 stored on upload finalize; presigned URLs scoped to key |
| Container image tampering | Multi-stage Dockerfile + SBOM + image signing (Phase 2) |

### Repudiation
| Threat | Mitigation |
|---|---|
| User denies they approved a PTO request | Audit log captures actor, IP, UA, request ID |
| Admin denies they granted a role | Audit log + `RoleAssignment.grantedBy` |
| Webhook deny: "we never sent that" | Stored raw payload + signature in `webhook_deliveries` |

### Information disclosure
| Threat | Mitigation |
|---|---|
| PII leaked in logs | Pino redaction blocklist (`lib/logger.ts`) |
| PII leaked in error responses | `errorHandler.ts` strips stack in prod |
| Cross-tenant read | App-layer filter + Postgres RLS |
| Decrypted PII in URLs | Never — only IDs in URLs; download URLs are short-lived presigned |
| Browser cache leakage | `Cache-Control: no-store` on PII responses (Phase 2 micro-improvement) |
| AI assistant prompted to reveal other employees' data | Hard-coded system prompt; only the user's own `employee` record loaded into context |

### Denial of service
| Threat | Mitigation |
|---|---|
| Brute-force login | Redis-backed lockout per (email, IP) + Cloudflare Bot Fight |
| API flooded | Rate limit (global 120/min/IP, auth 10/min/IP) + Cloudflare WAF |
| Slow-loris | nginx `client_body_timeout`, `client_header_timeout` |
| ReDoS via untrusted regex | We only run trusted regex against fixed patterns; Zod schemas bounded |
| LLM abuse (token bomb) | Per-org token budget (Phase 2); current: 600-token cap per request |
| File upload bomb | 50 MB cap at API + at nginx |

### Elevation of privilege
| Threat | Mitigation |
|---|---|
| Employee performs admin action | RBAC checked at every route (`requirePerm`) |
| MFA bypass | `requireMfa` middleware on sensitive routes; MFA flag is a JWT claim |
| Server-side prototype pollution | Express + Zod parsing into typed objects; no `Object.assign(req.body)` |
| SQL injection | Prisma parametrised queries everywhere; raw queries restricted to migrations and one whitelisted `app_set_current_org` call |
| Path traversal on document filenames | `safeFilename()` strips dangerous chars + URL hashes |
| Container escape | Non-root user, drop-all caps, read-only FS, no-new-privileges |

## Top 5 risks ranked

1. **Insider PII theft via HR admin role** — mitigations: MFA enforced,
   per-action audit, quarterly access reviews, data-export rate limiting,
   plan: anomaly detection on bulk reads.
2. **Payment redirection (bank account swap)** — mitigations: encryption,
   audit, plan: confirmation OTP on bank account change, 24-h cool-off.
3. **Compromised npm dependency in the payroll path** — mitigations:
   Dependabot, npm audit in CI, plan: Socket.dev + lockfile lint.
4. **Cloudflare bypass** — mitigations: VMware firewall only accepts traffic
   from Cloudflare IP ranges; plan: Cloudflare Tunnel (cloudflared) to
   eliminate origin IP exposure entirely.
5. **Backup encryption key loss** — mitigations: 2-of-3 Shamir split,
   geographically separated; plan: quarterly drill including the split.

## What we deliberately accept

- We use HS256 JWT (symmetric secret), not RS256 — simpler for a single API.
  Migrate to RS256 if you adopt multi-service federation.
- We don't rotate `ENCRYPTION_KEY` automatically — manual KEK rotation with
  data re-encryption is a Phase 2 runbook.
- AI assistant prompts go to an external LLM. We strip PII before sending,
  but per-conversation telemetry could still leak metadata. Customers in
  highly regulated industries can disable AI per-org.
