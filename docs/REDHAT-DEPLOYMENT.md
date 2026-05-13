# Pic Shift — Red Hat Linux deployment (end-to-end)

> Single guide that takes you from "code on Mac" to "live website on Red Hat
> server" using free tools only.
>
> Time: ~90 minutes if everything goes smoothly. Stack: VSCode + GitHub +
> Git + Docker + Red Hat Linux server.

## What you'll build

```
   Your Mac                  GitHub                  Red Hat Server
   ┌────────┐  git push    ┌────────┐  git pull    ┌──────────────────┐
   │ VSCode │ ───────────► │ remote │ ◄─────────── │ /opt/picshift    │
   │ + Git  │              │  repo  │              │   docker compose │
   └────────┘  ◄──────────►└────────┘              │   postgres ───── │
       │       (sync)                              │   redis    ───── │
       │                                           │   api      ───── │
       │  Remote-SSH (edit server files from Mac)  │   web      ───── │
       └──────────────────────────────────────────►│   nginx    ───── │
                                                   └──────────────────┘
                                                       ▲     ▲     ▲
                                                       │     │     │
                                                       ports 22 / 80 / 443
                                                       (open in firewalld)
```

---

# Phase 1 — Local test on your Mac first (15 min)

**Goal**: confirm the app runs cleanly on your laptop before deploying to the
real server. If it doesn't run here, server is a waste of time.

```bash
cd ~/Downloads/picshift-main
cp apps/api/.env.example apps/api/.env

# Generate secrets, copy each line into apps/api/.env
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"

# Open .env, paste the JWT/ENCRYPTION lines in
code apps/api/.env

# Tell Docker Compose the postgres password (same value!)
echo "POSTGRES_PASSWORD=PASTE_SAME_PG_PASS_HERE" > .env

# Start everything in dev mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build postgres redis minio
sleep 20
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm api npx prisma migrate deploy
docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm api npm run seed
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d api web
```

Open http://localhost:8080 → log in with `owner@acme.gh` / `OwnerPassword!2026`.

If that works, you're ready. Tear it down with:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

---

# Phase 2 — Prepare the Red Hat server (30 min)

You'll do all of this in the **Red Hat server's terminal** (not your Mac).
Two ways to get there:

| Method | When to use |
|---|---|
| SSH from VSCode's terminal: `ssh reggie@SERVER_IP` | Quick commands |
| VSCode Remote-SSH window | Editing config files on the server |

## 2.1 — Update the system

```bash
sudo dnf update -y
sudo dnf install -y curl wget git nano htop policycoreutils-python-utils
```

## 2.2 — Install Docker (Red Hat repos)

Red Hat replaced Docker with Podman by default. We want real Docker:

```bash
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo=https://download.docker.com/linux/rhel/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

**Log out and back in** so the docker group takes effect, then verify:

```bash
docker run hello-world
docker compose version
```

If `docker run` works without `sudo`, you're good.

## 2.3 — Open the firewall (firewalld)

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
sudo firewall-cmd --list-all     # confirm http + https + ssh listed
```

## 2.4 — Add swap (important on small RHEL VMs)

If your server has less than 8 GB RAM, add swap so Postgres + Node won't get OOM-killed during peaks:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
free -h   # should show ~4 GB swap
```

## 2.5 — SELinux: leave it on, but understand it

Red Hat ships with SELinux in `enforcing` mode. **Don't turn it off** — instead use the `:Z` flag on Docker volumes (already done in `docker-compose.redhat.yml`).

Verify:

```bash
getenforce       # should say "Enforcing"
```

If you ever get cryptic "Permission denied" errors that don't make sense, run:

```bash
sudo ausearch -m AVC -ts recent      # shows SELinux blocks
```

Usually the fix is adding `:Z` to a volume mount.

## 2.6 — Create the deploy directory

```bash
sudo mkdir -p /opt
sudo chown $USER:$USER /opt
```

---

# Phase 3 — Connect the server to GitHub (10 min)

The cleanest way: generate an SSH key on the server and add it to GitHub. No more typing tokens.

## 3.1 — Generate an SSH key on the server

```bash
ssh-keygen -t ed25519 -C "picshift-server" -f ~/.ssh/github_picshift -N ""
cat ~/.ssh/github_picshift.pub
```

Copy the entire output (starts with `ssh-ed25519 ...`).

## 3.2 — Add the key to GitHub

In your browser:

1. GitHub → click your avatar → **Settings**
2. **SSH and GPG keys** → **New SSH key**
3. Title: `picshift-redhat-server`
4. Key type: **Authentication Key**
5. Paste the key → **Add SSH key**

## 3.3 — Tell SSH to use it for github.com

On the server:

```bash
cat >> ~/.ssh/config <<EOF
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_picshift
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
```

## 3.4 — Test

```bash
ssh -T git@github.com
```

You should see: `Hi Reggie0003! You've successfully authenticated...`

## 3.5 — Clone the repo

```bash
cd /opt
git clone git@github.com:Reggie0003/picshift.git
cd picshift
ls
```

You should see `apps`, `docs`, `infra`, `docker-compose.yml`, etc.

---

# Phase 4 — Configure secrets on the server (10 min)

```bash
cd /opt/picshift
cp apps/api/.env.example apps/api/.env
```

Generate fresh secrets (DIFFERENT from your local Mac secrets — production should never reuse dev keys):

```bash
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)"
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
```

**Save the ENCRYPTION_KEY in Bitwarden NOW.** Lose it = lose all encrypted PII forever.

Edit `apps/api/.env`:

```bash
nano apps/api/.env
```

Key lines to set:

```env
NODE_ENV=production
PORT=4000
APP_URL=http://YOUR_SERVER_IP        # or https://yourdomain.com later
API_PUBLIC_URL=http://YOUR_SERVER_IP

DATABASE_URL=postgresql://picshift:YOUR_PG_PASSWORD@postgres:5432/picshift
REDIS_URL=redis://redis:6379

JWT_ACCESS_SECRET=...    # paste
JWT_REFRESH_SECRET=...   # paste
ENCRYPTION_KEY=...       # paste

CORS_ORIGINS=http://YOUR_SERVER_IP

# S3 — for now use local MinIO; switch to AWS S3 when you go live
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET_DOCUMENTS=picshift-documents-dev
S3_BUCKET_BACKUPS=picshift-backups-dev
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true

# Use console output for email/SMS until you wire real providers
EMAIL_PROVIDER=console
SMS_PROVIDER=console

DEFAULT_TIMEZONE=Africa/Accra
DEFAULT_CURRENCY=GHS
```

Lock it down:

```bash
chmod 600 apps/api/.env
```

Create the root `.env` for Docker Compose (Postgres uses this):

```bash
echo "POSTGRES_PASSWORD=YOUR_PG_PASSWORD" > .env
chmod 600 .env
```

---

# Phase 5 — First deployment (20 min)

```bash
cd /opt/picshift

# Build all images (slow first time, ~10 min)
docker compose -f docker-compose.yml \
               -f docker-compose.prod.yml \
               -f docker-compose.redhat.yml \
               build

# Start the data services first
docker compose -f docker-compose.yml \
               -f docker-compose.prod.yml \
               -f docker-compose.redhat.yml \
               up -d postgres redis minio

# Wait for Postgres to be ready
sleep 30

# Apply schema
docker compose -f docker-compose.yml \
               -f docker-compose.prod.yml \
               -f docker-compose.redhat.yml \
               run --rm api npx prisma migrate deploy

# Create demo org + seed
docker compose -f docker-compose.yml \
               -f docker-compose.prod.yml \
               -f docker-compose.redhat.yml \
               run --rm api npm run seed

# Bring up API, web, and nginx proxy
docker compose -f docker-compose.yml \
               -f docker-compose.prod.yml \
               -f docker-compose.redhat.yml \
               up -d

# See what's running
docker compose ps
```

You should see 5 services Up: `postgres`, `redis`, `minio`, `api`, `web`,
`proxy`.

## Skip TLS for now (test phase)

The default prod compose expects Cloudflare Origin certs at `infra/nginx/certs/`. For pure testing, comment out the TLS bits OR use this minimal nginx override:

```bash
cat > infra/nginx/conf.d/picshift.conf <<'NGINX'
server {
  listen 80 default_server;
  server_name _;
  client_max_body_size 50m;

  location /api/ {
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_pass http://api:4000/;
  }
  location / {
    proxy_set_header Host $host;
    proxy_pass http://web:80;
  }
}
NGINX

docker compose -f docker-compose.yml \
               -f docker-compose.prod.yml \
               -f docker-compose.redhat.yml \
               restart proxy
```

## Verify it's alive

```bash
curl http://localhost/api/healthz       # → {"ok":true,...}
curl -I http://localhost/               # → HTTP/1.1 200 OK
```

From your Mac (replace `SERVER_IP`):

```bash
curl http://SERVER_IP/api/healthz
open http://SERVER_IP/                   # opens in browser
```

Log in: `owner@acme.gh` / `OwnerPassword!2026`. 🎉

---

# Phase 6 — Make `docker compose` shorter (optional but worth it)

Typing those three `-f` flags every time is painful. Create a Makefile:

```bash
cat > /opt/picshift/Makefile <<'MAKE'
COMPOSE := docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.redhat.yml

up:
	$(COMPOSE) up -d
down:
	$(COMPOSE) down
build:
	$(COMPOSE) build
logs:
	$(COMPOSE) logs -f --tail=50 api
ps:
	$(COMPOSE) ps
migrate:
	$(COMPOSE) run --rm api npx prisma migrate deploy
seed:
	$(COMPOSE) run --rm api npm run seed
restart:
	$(COMPOSE) restart $(svc)
shell:
	$(COMPOSE) exec api sh
deploy:
	git pull && $(COMPOSE) build && $(COMPOSE) up -d
MAKE
```

Now your daily workflow is:

```bash
make deploy   # pull, build, restart everything
make logs     # tail the API logs
make ps       # see what's running
make restart svc=api   # restart just the API
```

---

# Phase 7 — Daily workflow from now on

## On your Mac in VSCode

1. Edit code in VSCode
2. Test locally: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`
3. Open Source Control panel (left sidebar) → write commit message → click ✓
4. Click `...` → Push (or `git push` in terminal)

## On the Red Hat server (SSH from VSCode terminal)

```bash
ssh reggie@SERVER_IP
cd /opt/picshift
make deploy
make logs        # watch it come up
```

That's it. The full cycle is < 2 minutes once images are cached.

---

# Phase 8 — Monitoring + backups (15 min, do this before letting anyone use it)

## 8.1 — Daily Postgres backup

```bash
sudo tee /etc/cron.daily/picshift-backup > /dev/null <<'SH'
#!/usr/bin/env bash
set -e
cd /opt/picshift
DATE=$(date -u +%Y%m%d)
docker compose exec -T postgres pg_dump -U picshift picshift \
  | gzip > /var/backups/picshift-${DATE}.sql.gz
# Keep last 14 days only
find /var/backups -name 'picshift-*.sql.gz' -mtime +14 -delete
SH
sudo chmod +x /etc/cron.daily/picshift-backup
sudo mkdir -p /var/backups
```

Test it manually:

```bash
sudo /etc/cron.daily/picshift-backup
ls -lah /var/backups/
```

## 8.2 — Health monitoring

Sign up at https://uptimerobot.com (free, 50 monitors). Point at
`http://SERVER_IP/api/healthz`. You'll get an email the second it goes down.

## 8.3 — Quick health dashboard

```bash
# CPU + memory at a glance
htop

# Just the docker container resource usage
docker stats

# Disk space
df -h
```

If disk hits 80%, the most likely culprit is Postgres data or Docker image
layers. Clean unused images:

```bash
docker image prune -a    # asks before deleting
```

---

# Common problems and fixes

| Problem | Fix |
|---|---|
| `Cannot connect to the Docker daemon` | Service isn't running. `sudo systemctl start docker` |
| `permission denied` on docker commands | You haven't re-logged after `usermod -aG docker`. Type `exit`, ssh back in. |
| `port already allocated` on 80/443 | Apache or nginx is running natively. `sudo systemctl stop httpd nginx` then retry. |
| Volume mount appears empty | SELinux relabeling needed. Add `:Z` to the volume in your compose file. |
| `docker compose build` OOMs | Add more swap (Phase 2.4) or build images on your Mac then `docker save | ssh ... docker load`. |
| Web loads but API calls 502 | nginx is up but API is down. `make logs` to see why. |
| `prisma migrate deploy` hangs forever | Postgres isn't actually ready yet. `docker compose logs postgres` to confirm it says "ready to accept connections". |

---

# What's NOT in this guide (and when to add it)

| Feature | Add when |
|---|---|
| HTTPS / TLS | Before letting anyone outside your network use it. Easiest: Cloudflare in front (free). |
| Real domain name | Same time as TLS. |
| AWS S3 instead of MinIO | When you have real user uploads to protect. |
| Real SMTP for password resets | First customer signup. AWS SES = cheapest. |
| Off-site backup (S3) | First real customer data. |
| Monitoring beyond UptimeRobot | When you have > 10 users. Grafana + Prometheus is free. |
| CI/CD (GitHub Actions auto-deploy) | When `make deploy` from the server starts feeling repetitive. |

You don't need any of these for testing. Add them one at a time as needs grow.
