# Pic Shift — Deployment runbook

> **Target**: a single VMware Ubuntu 22.04 LTS host with Cloudflare in front and
> AWS S3 for documents + backups. Scale to ECS / Kubernetes later once you
> outgrow one host.

---

## 1. Provision the VMware host

Minimum specs for ≤ 100 employees:
- 4 vCPUs, 8 GB RAM, 100 GB SSD
- Ubuntu Server 22.04 LTS
- Static IP, ports 80/443 exposed only

Recommended for ≤ 500 employees:
- 8 vCPUs, 16 GB RAM, 200 GB SSD

```bash
# On the host as root or sudo user
apt update && apt upgrade -y
apt install -y \
  curl ca-certificates gnupg lsb-release ufw fail2ban unattended-upgrades \
  postgresql-client awscli gpg

# Firewall: only 22, 80, 443
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Encrypt the VM disk at the hypervisor layer (vSphere VM Encryption) —
# this is non-negotiable for Ghana DPA + NDPR compliance.

# Docker (official repo)
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Unattended security upgrades
dpkg-reconfigure -plow unattended-upgrades
```

## 2. Clone and configure

```bash
mkdir -p /opt && cd /opt
git clone <YOUR_GIT_URL> picshift
cd picshift

# Generate secrets (write these to a vault, NOT to a file you'll commit):
openssl rand -base64 48                       # JWT_ACCESS_SECRET
openssl rand -base64 48                       # JWT_REFRESH_SECRET
openssl rand -base64 32                       # ENCRYPTION_KEY (envelope KEK)
openssl rand -base64 24                       # POSTGRES_PASSWORD

cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — fill in:
#   - DATABASE_URL (use POSTGRES_PASSWORD from above)
#   - REDIS_URL
#   - JWT_* + ENCRYPTION_KEY
#   - APP_URL = https://yourdomain.com
#   - API_PUBLIC_URL = https://yourdomain.com/api
#   - CORS_ORIGINS = https://yourdomain.com
#   - S3_* (real AWS S3 in production)
#   - SES + SMS provider credentials
```

Store secrets ideally in HashiCorp Vault or AWS Secrets Manager;
`.env` files are the entry point but should be **chmod 600 root:root**.

## 3. AWS S3 buckets (one-time)

In your AWS account (region `eu-west-1` recommended for African latency):

```bash
aws s3 mb s3://picshift-documents-prod --region eu-west-1
aws s3 mb s3://picshift-backups-prod   --region eu-west-1

# Block all public access
aws s3api put-public-access-block --bucket picshift-documents-prod \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
aws s3api put-public-access-block --bucket picshift-backups-prod \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable default encryption (AES-256, swap to KMS for SOC 2)
aws s3api put-bucket-encryption --bucket picshift-documents-prod \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
aws s3api put-bucket-encryption --bucket picshift-backups-prod \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'

# Versioning (so a deleted/overwritten object can be recovered)
aws s3api put-bucket-versioning --bucket picshift-documents-prod --versioning-configuration Status=Enabled
aws s3api put-bucket-versioning --bucket picshift-backups-prod   --versioning-configuration Status=Enabled

# Lifecycle — backups → Glacier after 30d, expire after 7y (Ghana ITA 6y minimum)
# Save the JSON below to lifecycle.json and apply with put-bucket-lifecycle-configuration
```

`lifecycle.json`:
```json
{
  "Rules": [
    {
      "ID": "backups-tiering",
      "Status": "Enabled",
      "Filter": {"Prefix": "postgres/"},
      "Transitions": [{"Days": 30, "StorageClass": "GLACIER_IR"}],
      "Expiration": {"Days": 2555}
    }
  ]
}
```

Create an IAM user `picshift-api` with a least-privilege policy that allows
only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on these two buckets.

## 4. Cloudflare in front

1. Add the domain to Cloudflare (free plan is enough to start).
2. Create an **Origin Certificate** (Cloudflare dashboard → SSL/TLS → Origin
   Server → Create Certificate). Download the cert + key, save as
   `infra/nginx/certs/origin.pem` and `origin.key` (chmod 600 root:root).
3. SSL/TLS mode: **Full (strict)**.
4. Always Use HTTPS: ON. HSTS: ON (6 months).
5. Bot Fight Mode: ON. Security Level: High.
6. Add a WAF rule: block requests where `cf-connecting-ip` country is in
   your blocklist; rate-limit `/api/v1/auth/*` more aggressively.
7. (Optional) Cloudflare Access in front of `/audit` and `/settings/*`
   admin routes for SSO-gated access.

## 5. First boot

```bash
cd /opt/picshift
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis minio
# Wait for postgres healthcheck to pass:
docker compose ps

# Apply schema
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed     # optional demo data

# Start API and web
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Verify:
```bash
curl -fsS https://yourdomain.com/api/healthz   # → {"ok":true}
curl -fsS https://yourdomain.com/api/readyz    # → {"ok":true}
```

## 6. Backups — cron the script

```bash
# Save your GPG public key on the host
gpg --import backup-public-key.asc

# Schedule the backup script daily at 02:00 UTC
cat > /etc/cron.d/picshift-backup <<'CRON'
0 2 * * * root cd /opt/picshift && \
  AWS_REGION=eu-west-1 \
  DATABASE_URL='postgresql://...' \
  S3_BUCKET_BACKUPS=picshift-backups-prod \
  BACKUP_GPG_RECIPIENT=ops@picshift.app \
  /opt/picshift/infra/scripts/backup.sh >> /var/log/picshift-backup.log 2>&1
CRON
```

Test by running once manually. Also schedule a **restore drill** quarterly —
backups you never test are not backups.

## 7. Monitoring (cheap)

| Tool | Cost | Replaces |
|---|---|---|
| **Uptime Kuma** (self-host) | Free | Pingdom / StatusCake |
| **Grafana + Prometheus** (self-host) | Free | Datadog Infrastructure |
| **Loki** (self-host) | Free | Splunk / Sumo Logic |
| **Better Stack Free Tier** | Free | PagerDuty (limited) |
| **Sentry** (free dev tier) | Free → $26/mo | Bugsnag |

Run them on a second VM or inside Docker on the same host. Set up alerts
on:
- `pg_stat_replication` lag > 1 min
- API p95 latency > 2 s
- 5xx rate > 1% over 5 min
- Payroll job failures (any)
- Failed login spikes > 50/min
- Disk > 80% used

## 8. Disaster recovery

| RPO | RTO | Mechanism |
|---|---|---|
| 24 h | 4 h | Daily encrypted pg_dump → S3 |
| 5 min | 1 h | Postgres streaming replication to second VM (Phase 2) |
| 1 min | 15 min | Multi-region with RDS Postgres (Phase 3, requires AWS) |

A documented runbook lives at `docs/INCIDENT-RESPONSE.md`.

## 9. Cutover from this dev setup to production

Checklist:
- [ ] All secrets rotated away from `.env.example` values
- [ ] `ENCRYPTION_KEY` stored in 2-of-3 split + safe deposit box (losing it = losing all PII)
- [ ] S3 buckets created with Block-Public-Access enabled
- [ ] Cloudflare Origin Cert + Full (strict) SSL
- [ ] Daily backup cron running and verified
- [ ] Restore drill performed
- [ ] Monitoring + alerts firing on test failures
- [ ] Privacy Policy + Terms of Service published at /legal/*
- [ ] Data Protection Officer appointed (required by Ghana DPA §57 if you process > 1000 records)
- [ ] Ghana DPC registration submitted (Data Controller, fee ≈ GHS 1,000–10,000)
- [ ] NITDA NDPR audit filed for Nigeria customers (annual, by 15 March)
- [ ] Cyber liability + E&O insurance bound
