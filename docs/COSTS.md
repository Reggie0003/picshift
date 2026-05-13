# Pic Shift — Monthly cost comparison

> Three realistic scales, three deployment shapes, real $ figures.
> AWS prices use eu-west-1 (cheapest African-reachable region).

## Scale assumptions

| Tier | Employees | API req/day | Document GB | DB size GB |
|---|---|---|---|---|
| MVP | 50 | 50,000 | 5 | 1 |
| Growth | 500 | 500,000 | 50 | 10 |
| Scale | 5,000 | 5,000,000 | 500 | 100 |

---

## Option A — Self-host on your VMware + AWS S3 + Cloudflare (CHOSEN)

| Line item | MVP | Growth | Scale |
|---|---|---|---|
| VMware host (electricity + internet attribution) | ~$10 | ~$15 | ~$30 |
| AWS S3 — documents (Standard) | $0.12 | $1.15 | $11.50 |
| AWS S3 — backups (Standard-IA → Glacier IR after 30d) | $0.08 | $0.80 | $8.00 |
| AWS S3 — data transfer out (10% of stored / mo) | $0.05 | $0.50 | $5.00 |
| AWS SES — transactional email (10/employee/mo) | $0.05 | $0.50 | $5.00 |
| Cloudflare — Free plan | $0 | $0 | $0 (Pro $20 recommended at Scale) |
| Hubtel SMS (Ghana) — at 5 SMS/employee/mo, ~$0.015 each | $3.75 | $37.50 | $375.00 |
| Domain | $1.00 | $1.00 | $1.00 |
| **Total** | **~$15** | **~$56** | **~$435** |

Notes:
- The big variable cost at Scale is **SMS** (Hubtel ≈ ₵0.18 = $0.015 each).
  Mitigate with email-first delivery and SMS only for high-priority alerts.
- At Scale you'll also want a second VMware host for HA and Postgres
  replication; add $0–30 for the second host + a managed UPS.

## Option B — Supabase + Cloudflare + AWS S3 (alternate, lowest-ops)

| Line item | MVP | Growth | Scale |
|---|---|---|---|
| Supabase Pro | $25 | $25 | $25 (+ ~$0.10/employee for additional storage) |
| AWS S3 documents + backups | $0.25 | $2.45 | $24.50 |
| AWS SES + Hubtel SMS | $3.80 | $38.00 | $380.00 |
| Cloudflare | $0 | $0 | $20 |
| **Total** | **~$29** | **~$66** | **~$450** |

Why we DIDN'T pick this:
- You wanted to self-host on VMware (cheaper at Scale, full control).
- Supabase is in `us-east-1`/`eu-west-1` only — Ghana latency ≈ 200–300 ms.
- Field-level PII encryption is harder to bolt on (you'd have to use Vault
  Functions and forgo Supabase's Realtime).

When you'd PICK it: solo founder with no time for VMware ops; staying < 200
employees forever.

## Option C — Full AWS managed (ECS + RDS + ElastiCache + ALB)

| Line item | MVP | Growth | Scale |
|---|---|---|---|
| ECS Fargate 2× 0.5 vCPU / 1 GB | $30 | $60 | $480 (Spot + autoscale) |
| RDS Postgres db.t4g.micro / db.t4g.small / db.m6g.large + multi-AZ | $14 | $80 | $580 |
| ElastiCache Redis cache.t4g.micro | $11 | $11 | $90 |
| ALB | $20 | $20 | $20 |
| Data transfer (CloudFront in front) | $5 | $30 | $250 |
| S3 + SES + KMS | $5 | $20 | $100 |
| CloudWatch Logs/Metrics | $5 | $20 | $80 |
| SMS via SNS / Hubtel | $4 | $40 | $400 |
| **Total** | **~$94** | **~$281** | **~$2,000** |

When you'd PICK it: SOC 2 Type II commit, > 5,000 employees, multi-region DR.

## Decision matrix

| Need | Option |
|---|---|
| Cheapest at MVP | **A (VMware)** — $15/mo |
| Lowest ops effort | B (Supabase) |
| SOC 2 day-one | C (AWS) |
| Ghana-region latency | A (your VMware in Accra) |
| Multi-region DR built in | C (AWS) |
| No vendor lock-in | A |

## Hidden costs people forget

1. **DNS lookups + SMS** at Scale dwarf compute. Budget early.
2. **Anthropic / OpenAI tokens** when you turn on the AI assistant: at
   500 employees asking ~10 questions/month, expect ~$15/mo on Haiku 4.5
   or ~$60/mo on Sonnet. Cache popular answers.
3. **Compliance / audit fees**:
   - Ghana DPC registration: GHS 1,000 – 10,000 / year
   - NITDA NDPR audit (DPCO): ₦300,000 – 1,500,000 / year for Nigeria
   - SOC 2 Type II audit: $15k – 50k / year (Vanta / Drata cuts to $7–20k)
   - Cyber liability + E&O insurance: $1,500 – $5,000 / year at MVP
4. **Domain + email**:
   - `.app` / `.com` domain: $12–20 / year
   - Google Workspace ($6/user/mo) or Zoho Mail (free for 5)
