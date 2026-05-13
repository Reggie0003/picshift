# Pic Shift — Incident response runbook

## Roles

| Role | Owner | Backup |
|---|---|---|
| Incident Commander | Engineering Lead | CTO |
| Comms Lead | Founder / CEO | Engineering Lead |
| Data Protection Officer | (appointed) | External counsel |
| Tech Lead (containment) | On-call engineer | Senior engineer |

Maintain on-call rotation in `infra/oncall.md` (private).

## Severity

| Sev | Definition | Examples | First response |
|---|---|---|---|
| **SEV-1** | Confirmed PII breach OR money loss OR production down > 30 min | Postgres compromise, payroll dispatch error, S3 bucket public | 15 min — page all-hands |
| **SEV-2** | Suspected breach OR partial outage OR data integrity | Anomalous admin downloads, login flood, payment-provider webhook spoofing | 1 h — incident channel |
| **SEV-3** | Single-customer impact OR non-PII bug | One org reports stale data | 1 day — ticket queue |

## Phase 1 — Detect (0–15 min)

Triggers:
- Page from monitoring (5xx rate > 1%, payroll-failure metric > 0)
- Customer report
- Audit-log anomaly alert (admin downloads > 100 PII records / hour)
- Cloudflare WAF burst
- Sentry / log pattern match

Open the incident channel in #incidents (Slack/Teams). Declare severity.

## Phase 2 — Contain (15 min – 4 h)

For confirmed PII breach (SEV-1):
1. **Rotate all secrets** in `apps/api/.env` — JWT, ENCRYPTION_KEY, DB pass, S3 keys, payment-provider keys.
2. **Revoke all refresh tokens**: `UPDATE sessions SET revoked_at = now() WHERE revoked_at IS NULL`.
3. **Force MFA re-enrollment** for affected admins.
4. **Disable payment dispatch**: set `payroll.run` permission off temporarily.
5. **Snapshot Postgres** (for forensics) before any cleanup.
6. **Preserve container logs** to a separate S3 prefix (out of normal retention).

For app down (SEV-1):
1. `docker compose ps` — identify failing service
2. `docker compose logs --tail=200 api`
3. Roll back: `git checkout <last-good-tag> && docker compose build api && docker compose up -d api`

## Phase 3 — Eradicate (1 h – 24 h)

- Patch the vulnerability (or document the human cause).
- Run dependency audit + container rebuild.
- Verify the audit log shows no further suspicious activity since rotation.
- Engage external forensics if scope unclear.

## Phase 4 — Recover (1 h – 7 days)

- Restore from clean Postgres backup if data integrity compromised.
- Bring services back behind feature flags first; smoke test.
- Communicate restoration to affected customers.
- Re-enable disabled features (payment dispatch, etc.).

## Phase 5 — Notify (within 72 h for personal-data breach)

### Ghana Data Protection Commission (Ghana DPA §22)
- **Deadline**: 72 hours from awareness, where feasible
- **Channel**: notify@dataprotection.org.gh + DPC online portal
- **Content**: nature of breach, categories and approx. number of data
  subjects, likely consequences, mitigation taken / planned

### Nigeria Data Protection Commission (NDPA §40)
- **Deadline**: 72 hours
- **Channel**: NDPC portal + dpo@ndpc.gov.ng

### Affected individuals
- Notify within reasonable time once contained. Template:
  - What data was involved
  - When the breach occurred / was discovered
  - What we have done to contain it
  - What they should do (rotate passwords, watch for phishing)
  - Who to contact at Pic Shift

### Insurance + counsel
- Within 24 h of confirmed SEV-1.

## Phase 6 — Lessons learned (within 7 days)

Post-mortem template in `docs/postmortems/TEMPLATE.md`:
1. Timeline (UTC)
2. Impact (records, $, downtime)
3. Root cause
4. What went well
5. What went badly
6. Action items (owners + dates)

Action items go on the team's tracker. We review unresolved ones weekly.

## Tabletop drill

Every 6 months. Pick one scenario per drill:
- "An HR admin exported 5,000 employees overnight"
- "Postgres host disk hits 100%"
- "Flutterwave returns webhook for a payout we never initiated"
- "ENCRYPTION_KEY recipient quits — restore needed and we have only 2 of 3 shards"

Each drill records timing against this runbook to find gaps.

## Contact list (PRIVATE — keep in `infra/oncall.md`)

```
Incident Commander    : +233 ...
DPO                   : +233 ...
External counsel      : ...
Cyber insurance carrier (24/7) : ...
AWS Support           : Business plan — open case at https://...
Cloudflare Emergency  : ...
Flutterwave Risk Team : risk@flutterwavego.com
Paystack Risk Team    : security@paystack.com
MTN MoMo Ghana Risk   : ...
Bank-of-Ghana Cyber   : ...
NITDA NDPC            : ...
```
