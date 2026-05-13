# Pic Shift — AWS Free Tier deployment guide

> 12 months of $0 hosting, then ~$25–30/month after. Targets a real,
> production-grade single-tenant deployment that supports up to ~50 active
> employees comfortably.

## The hard truth about t2.micro

The Free Tier's `t2.micro` is **1 GB RAM, 1 vCPU**. Pic Shift's default config
won't fit because:

- Argon2id is set to 64 MB per password hash (10 concurrent logins = 640 MB)
- Postgres wants 256+ MB shared buffers
- Node + Prisma needs 200–400 MB
- Redis adds 50 MB
- nginx + OS adds 100 MB

Total comfortable: ~1.2 GB. We have 1 GB. So we do two things:

1. **Split the database off the API host.** Run Postgres on RDS
   `db.t3.micro` (also free), API + Redis + nginx on EC2 `t3.micro`.
2. **Dial down memory-heavy settings** — Argon2id 16 MB instead of 64,
   Redis maxmemory 100 MB, Node `--max-old-space-size=600`.

That's the architecture below. It works.

---

# Architecture

```
                 ┌─────────────────┐
                 │   Cloudflare    │  Free tier — WAF, DDoS, SSL
                 └────────┬────────┘
                          │
                ┌─────────▼──────────┐
                │ EC2 t3.micro       │  Ubuntu 22.04, 1 GB RAM, 1 vCPU
                │ (Free Tier)        │  Docker: nginx + api + redis + web
                │ eu-west-1          │  20 GB EBS gp3
                └──┬──────────────┬──┘
                   │              │
        ┌──────────▼────┐    ┌────▼─────────┐
        │ RDS Postgres  │    │ S3 (eu-west-1)│
        │ db.t3.micro   │    │ documents +   │
        │ 20 GB free    │    │ backups       │
        │ Free Tier     │    └───────────────┘
        └───────────────┘
```

Everything in `eu-west-1` (Ireland) — closest AWS region to Ghana / Nigeria.

---

# Part 0 — Before you start

## Free Tier limits (what you actually get)

| Service | Free | What this means for you |
|---|---|---|
| EC2 t3.micro / t2.micro | 750 hrs/mo for 12 mo | One instance running 24/7 (744 hrs) — covered |
| RDS db.t3.micro (Postgres) | 750 hrs/mo for 12 mo | One instance — covered |
| RDS storage | 20 GB SSD | Plenty for ~10,000 employees |
| S3 | 5 GB storage + 20k GET + 2k PUT / mo | Fine until ~500 active employees |
| Data transfer out | 100 GB / mo | Fine for an internal HR tool |
| EBS storage (EC2 disk) | 30 GB gp2 / mo | Use 20 GB; leaves 10 GB headroom |
| SES (email) | 62k emails / mo if sent from EC2 | Way more than you need |
| CloudWatch | 10 metrics + 5 GB logs | Enough for basic monitoring |
| KMS | 20k requests / mo | Plenty |

After 12 months: ~$25/mo for the same shape (EC2 + RDS). Plan ahead.

## Critical AWS account hygiene (do these BEFORE deploying)

1. **Enable MFA on the root account** (Settings → Security credentials).
2. **Set up a billing alarm** — Billing → Billing preferences → Receive alerts → email alert at $5, $10, $20. This is how you avoid surprise bills.
3. **Make an IAM admin user** for daily work (not the root account).
4. **Turn on Cost Explorer** — Billing → Cost Explorer → Launch. Lets you watch spending daily.

I covered these in `docs/HOSTING-GUIDE-FOR-BEGINNERS.md` Part 1 — go do them now if you skipped.

---

# Part 1 — Configure Pic Shift for low-RAM hosting (5 min, do on your laptop)

Before deploying, tweak two settings so the API behaves on a 1 GB host.

## 1.1 — Reduce Argon2id memory cost

Open `apps/api/src/lib/passwords.ts`. Find this block:

```ts
const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
} as const;
```

Change `memoryCost` to `19_456` (19 MiB) and `timeCost` to `2`. This is
still above OWASP 2025 minimum (19 MiB / 2 iterations is their baseline).

```ts
const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19_456, // 19 MiB — OWASP 2025 minimum, fits free tier
  timeCost: 2,
  parallelism: 1,
} as const;
```

## 1.2 — Cap Node's heap

In `apps/api/package.json`, change the `start` script to add a memory limit:

```json
"start": "node --max-old-space-size=600 dist/server.js",
```

## 1.3 — Smaller Redis

In `docker-compose.yml`, find the redis service and change:

```yaml
command: >
  redis-server --save 60 1 --loglevel notice --maxmemory 100mb --maxmemory-policy allkeys-lru
```

(I had `256mb` — drop to `100mb`.)

## 1.4 — Commit and push

```bash
cd ~/Downloads/picshift-main
git add -A
git commit -m "Tune for AWS Free Tier (1 GB RAM)"
git push
```

---

# Part 2 — Provision AWS resources via the Console (30 min)

I'll show Console clicks first because they're easier to follow. CLI version
at the bottom if you prefer.

## 2.1 — Create the VPC defaults (already done if your account is new)

Free Tier accounts have a default VPC. Skip this — you're set.

## 2.2 — Create the RDS Postgres database (do this FIRST, it takes 5–10 min)

1. AWS Console → search **RDS** → click it
2. Top right region: **Europe (Ireland) eu-west-1**
3. **Create database**
4. Choose **Standard create**, engine: **PostgreSQL**
5. Engine version: **PostgreSQL 16.x** (whatever's latest 16.x)
6. Templates: **Free tier**
7. Settings:
   - DB instance identifier: `picshift-prod-db`
   - Master username: `picshift`
   - Auto-generate password: **Yes** (you'll grab it after creation) OR set your own
8. Instance configuration: **db.t3.micro** (auto-selected by Free tier)
9. Storage: **20 GB gp2** (auto)
10. **Storage autoscaling**: turn OFF (so you don't accidentally pay for more)
11. Connectivity:
    - Public access: **No** (we want it private, only EC2 can reach it)
    - VPC security group: **Create new** — name `picshift-db-sg`
    - Availability Zone: any
12. Database authentication: **Password authentication**
13. **Additional configuration** (expand):
    - Initial database name: `picshift`
    - Backup retention: 7 days
    - Encryption: **Enable** (it's free)
    - Deletion protection: **Enable**
14. Click **Create database**

Wait ~7 minutes. Status will go from Creating → Available.

**Grab the password**: Click the DB → top blue banner says "View connection details" — click that, copy the password, save in Bitwarden.

**Grab the endpoint**: On the DB page, Connectivity & security → Endpoint. Looks like `picshift-prod-db.abc123.eu-west-1.rds.amazonaws.com`. Copy it.

## 2.3 — Create the EC2 instance

1. AWS Console → **EC2** → top right region **eu-west-1**
2. **Launch instance**
3. Name: `picshift-prod-api`
4. AMI: **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type**, 64-bit (x86)
5. Instance type: **t3.micro** (eligible for Free tier) — NOT t2.micro (t3 is newer and slightly faster for the same price)
6. Key pair:
   - **Create new key pair**
   - Name: `picshift-key`
   - Type: ED25519
   - Format: `.pem` (for Mac/Linux SSH)
   - Click **Create key pair** — it downloads `picshift-key.pem`
   - Move it: `mv ~/Downloads/picshift-key.pem ~/.ssh/picshift-key.pem`
   - Lock it down: `chmod 400 ~/.ssh/picshift-key.pem`
7. Network settings → **Edit**:
   - Auto-assign public IP: **Enable**
   - Create security group, name `picshift-api-sg`. Rules:
     - SSH (port 22) from **My IP** (Console will fill in your home IP)
     - HTTP (port 80) from **Anywhere (0.0.0.0/0)**
     - HTTPS (port 443) from **Anywhere (0.0.0.0/0)**
8. Configure storage: 20 GB gp3 (NOT gp2 — gp3 is cheaper and faster, still free up to 30 GB)
9. **Launch instance**

Wait 1 minute. Click the instance → status should be **Running**, copy the **Public IPv4 address**.

## 2.4 — Let EC2 talk to RDS

By default the RDS security group blocks everything. Fix:

1. RDS → Databases → `picshift-prod-db` → **Connectivity & security**
2. Click the security group link (it's something like `picshift-db-sg`)
3. **Edit inbound rules** → **Add rule**:
   - Type: **PostgreSQL** (port 5432 auto)
   - Source: **Custom** → start typing `picshift-api-sg`, pick it
4. Save

This says: "RDS will only accept connections from the EC2 instance's security group." Tightest you can get.

## 2.5 — Create S3 buckets and IAM user

See `docs/HOSTING-GUIDE-FOR-BEGINNERS.md` Part 4 — exactly the same steps.
Bucket names: `picshift-documents-prod-reggie` and `picshift-backups-prod-reggie`.

---

# Part 3 — Set up the EC2 server (30 min)

## 3.1 — SSH in from your Mac

```bash
ssh -i ~/.ssh/picshift-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Replace `YOUR_EC2_PUBLIC_IP` with the public IPv4 from Step 2.3.

You should land at `ubuntu@ip-172-31-...:~$`.

## 3.2 — Install everything you need

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ca-certificates gnupg lsb-release ufw fail2ban \
  unattended-upgrades git nano htop postgresql-client
```

## 3.3 — Set up swap (CRITICAL on 1 GB machines)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
free -h    # should show 2 GB swap
```

**Why**: AWS doesn't give EC2 instances swap by default. Without swap, a memory spike (e.g. someone uploads a big file) kills your API. 2 GB of swap on disk costs nothing and saves you.

## 3.4 — Configure the firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## 3.5 — Install Docker

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
```

**Log out and back in** so the docker group takes effect:

```bash
exit
# then SSH back in
ssh -i ~/.ssh/picshift-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

Test:
```bash
docker run hello-world
```

## 3.6 — Clone your code

```bash
sudo mkdir -p /opt && sudo chown $USER:$USER /opt
cd /opt
git clone https://github.com/Reggie0003/picshift.git
cd picshift
```

If the repo is private, you'll need to authenticate. Easiest: use a Personal Access Token in the clone URL:

```bash
git clone https://Reggie0003:YOUR_PAT_HERE@github.com/Reggie0003/picshift.git
```

(You created the PAT in the previous guide. Re-use it.)

## 3.7 — Test RDS connectivity from EC2

```bash
psql "postgresql://picshift:YOUR_RDS_PASSWORD@picshift-prod-db.abc123.eu-west-1.rds.amazonaws.com:5432/picshift?sslmode=require" -c "SELECT version();"
```

Replace the password and endpoint with yours. You should see the Postgres version. If you get "could not connect" — check Step 2.4 (security group).

## 3.8 — Enable required Postgres extensions on RDS

RDS doesn't ship pgvector or pgcrypto enabled. Connect and turn them on:

```bash
psql "postgresql://picshift:YOUR_RDS_PASSWORD@YOUR_RDS_ENDPOINT:5432/picshift?sslmode=require" <<EOF
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS vector;
EOF
```

(pgvector is supported on RDS Postgres 15.2+ — you'll be fine on 16.x.)

---

# Part 4 — Configure and start Pic Shift (20 min)

## 4.1 — Make secrets

On the EC2 instance:

```bash
cd /opt/picshift
openssl rand -base64 48   # save → JWT_ACCESS_SECRET
openssl rand -base64 48   # save → JWT_REFRESH_SECRET
openssl rand -base64 32   # save → ENCRYPTION_KEY  (CRITICAL — losing this loses all encrypted data)
```

Save each in Bitwarden, twice.

## 4.2 — Fill in the .env

```bash
cp apps/api/.env.example apps/api/.env
nano apps/api/.env
```

Key fields for AWS Free Tier:

```env
NODE_ENV=production
PORT=4000
LOG_LEVEL=info
APP_URL=https://picshift.app
API_PUBLIC_URL=https://picshift.app/api

# RDS connection — note ?sslmode=require is REQUIRED for RDS
DATABASE_URL=postgresql://picshift:YOUR_RDS_PASS@picshift-prod-db.abc123.eu-west-1.rds.amazonaws.com:5432/picshift?sslmode=require

# Redis (still in Docker on the same EC2)
REDIS_URL=redis://redis:6379

JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
ENCRYPTION_KEY=...

CORS_ORIGINS=https://picshift.app

# S3 (real AWS, not MinIO)
S3_REGION=eu-west-1
S3_BUCKET_DOCUMENTS=picshift-documents-prod-reggie
S3_BUCKET_BACKUPS=picshift-backups-prod-reggie
S3_ACCESS_KEY_ID=AKIA...   # from Part 2.5
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=               # leave EMPTY for real AWS
S3_FORCE_PATH_STYLE=false

EMAIL_PROVIDER=ses
EMAIL_FROM="Pic Shift <no-reply@picshift.app>"
SES_REGION=eu-west-1

SMS_PROVIDER=hubtel
HUBTEL_CLIENT_ID=
HUBTEL_CLIENT_SECRET=
HUBTEL_SENDER_ID=PicShift

DEFAULT_TIMEZONE=Africa/Accra
DEFAULT_CURRENCY=GHS
```

Save (`Ctrl+O`, Enter, `Ctrl+X`). Lock it down:
```bash
chmod 600 apps/api/.env
```

## 4.3 — Override docker-compose to skip Postgres (we use RDS instead)

Create `docker-compose.override.yml` so Compose doesn't try to start a local Postgres:

```bash
cat > docker-compose.override.yml <<'YAML'
# Free-Tier override: Postgres is hosted on RDS, not in a container.
services:
  postgres:
    profiles: ["never"]   # disable
  minio:
    profiles: ["never"]   # we use real S3
  api:
    environment:
      NODE_OPTIONS: "--max-old-space-size=600"
    depends_on:
      redis:
        condition: service_healthy
YAML
```

## 4.4 — Build images (this is slow on t3.micro — ~10 min)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.override.yml build
```

If the build OOMs partway through (very possible on 1 GB), build the images on your Mac instead and push them to a registry, OR add more swap temporarily:

```bash
sudo swapoff /swapfile
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

Then retry the build. Once done, you can shrink swap back to 2 GB.

## 4.5 — Run migrations on RDS

```bash
docker compose run --rm api npx prisma migrate deploy
docker compose run --rm api npm run seed
```

## 4.6 — Start everything

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.override.yml up -d
docker compose ps
```

You should see `redis`, `api`, `web`, `proxy` all Up. Postgres is NOT listed — that's correct, it's on RDS.

## 4.7 — Cloudflare in front

Follow `docs/HOSTING-GUIDE-FOR-BEGINNERS.md` Part 5 — same steps, but point the DNS A record at your **EC2 public IP** instead of your home IP.

**One difference**: skip the home-router port-forwarding section. EC2 already has its security group open on 80/443.

---

# Part 5 — Set up free-tier-friendly monitoring (10 min)

## 5.1 — Billing alarms (do this NOW)

1. AWS Console → top right account name → **Billing & Cost Management**
2. **Billing preferences** → tick **Receive AWS Free Tier alerts** and **Receive billing alerts**
3. **Budgets** → **Create budget**
4. Use a template: **Monthly cost budget**, $5
5. Email: yours
6. Repeat for $10, $20, $40 (these mean "something's wrong, fix it")

## 5.2 — CloudWatch alarms (free)

1. CloudWatch → **Alarms** → **Create alarm**
2. Select metric → EC2 → Per-Instance Metrics → your instance → **CPUUtilization**
3. Threshold: > 90% for 10 minutes → notify your email
4. Repeat for **StatusCheckFailed** (any failure = alarm)

## 5.3 — Free uptime monitoring

Sign up at https://uptimerobot.com (free for 50 monitors). Point at `https://picshift.app/healthz` and `https://picshift.app/api/healthz`. Get an email if either goes down.

---

# Part 6 — Daily life

## Deploy new code

On your Mac:
```bash
cd ~/Downloads/picshift-main
git add -A && git commit -m "describe change" && git push
```

On the EC2 (SSH in):
```bash
cd /opt/picshift
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.override.yml build api web
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.override.yml up -d
```

## Watch logs

```bash
docker compose logs -f --tail=50 api
```

## RDS auto-backs-up daily

You set retention to 7 days in Step 2.2 — RDS handles snapshots for you. To restore: RDS Console → Snapshots → pick one → Restore.

## Check Free Tier usage

AWS Console → top right → **Free Tier**. Shows your usage as a percentage. Set up
alarms long before you'd actually hit limits.

---

# Part 7 — What happens after 12 months (Free Tier expires)

You'll start paying for what was free. At your usage:

| Service | After Free Tier | Monthly |
|---|---|---|
| EC2 t3.micro 24/7 | ~$7.50 |
| EC2 EBS 20 GB gp3 | ~$1.60 |
| RDS db.t3.micro 24/7 | ~$13 |
| RDS storage 20 GB | ~$2.50 |
| RDS backups | ~$0.50 |
| S3 (10 GB used) | ~$0.25 |
| Data transfer out | ~$1 |
| Route 53 hosted zone | $0.50 |
| **Total** | **~$27 / month** |

To shave that lower:

1. **Reserved Instances** — pre-pay 1 year for t3.micro, save ~30% → ~$5/mo
2. **AWS Savings Plans** — similar but more flexible
3. **Move RDS off AWS** — Supabase free tier is 500 MB Postgres + 1 GB transfer + 2 GB storage, $0 forever (limits will hit at ~100 employees)
4. **Move to Hetzner Cloud** — €4/mo gives you 4 GB RAM (vastly more than t3.micro). When you outgrow free tier, this is the biggest single win — better hardware at a third the price.
5. **VMware at home is back on the table** — your laptop bill stays the same; AWS bill goes to ~$3/mo (just S3).

---

# Part 8 — Things that bite people on Free Tier (PLEASE READ)

1. **One EC2 instance, total.** If you launch a second one "just to test," it'll meter both — Free Tier is 750 hours/month combined. Don't do it.

2. **No data transfer to the internet from EC2.** Watch the 100 GB/mo cap — Pic Shift won't hit it, but if you accidentally serve big files, you'll pay.

3. **Don't enable RDS Multi-AZ.** It doubles your hours, instantly making you NOT-free. Single AZ + daily snapshots is the Free Tier sweet spot.

4. **Stop the instance when you go to bed?** **NO.** Stopping an EC2 doesn't save Free Tier hours (you get 750/mo whether you use 1 or 750). It DOES mean your public IP changes when you restart it (unless you allocate an Elastic IP). Just leave it running.

5. **Elastic IPs cost money if not attached.** Allocate one to your EC2 — free while attached. If you terminate the EC2 and forget, you'll get billed ~$3.65/mo.

6. **CloudWatch Logs cost** if you ship every container log to CloudWatch. The default Docker JSON logs on disk are free. Only export to CloudWatch what you need.

7. **NAT Gateway = bankrupt.** If you ever set up a private subnet and need outbound internet from inside it, AWS will suggest a NAT Gateway ($32/mo, not free). For Pic Shift, you don't need this — keep EC2 in the public subnet.

---

# Quick sanity check before you start

- [ ] AWS root account has MFA enabled
- [ ] Billing alarm at $5 is set up and confirmed (you got the test email)
- [ ] You're working as an IAM admin user, NOT root
- [ ] Your region is **eu-west-1** in the top right of every page
- [ ] You're using **t3.micro** (not t2.micro — they're both free but t3 is newer)
- [ ] RDS security group ONLY allows traffic from EC2 security group
- [ ] EC2 security group SSH rule is restricted to **My IP**, not 0.0.0.0/0

If any of these aren't true, fix them before you spend an hour on Part 3.
