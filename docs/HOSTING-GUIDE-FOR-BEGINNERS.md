# How to host Pic Shift — beginner's guide

> Written so a 13-year-old can follow along. If a step doesn't make sense,
> the **"why we're doing this"** box right below it explains in plain English.

## What you'll end up with

When you finish, you'll have:

- Your code safely stored on **GitHub** (so you never lose it)
- A **Linux server** running inside VMware on your computer (the "engine")
- An **AWS account** holding your files and backups (the "warehouse")
- A real website at something like `https://picshift.app` that people can use

Think of it like a restaurant:
- **GitHub** = your recipe book (kept safe, you can always go back to old versions)
- **VMware** = your kitchen (where the food is actually cooked)
- **AWS** = the freezer + the storeroom (long-term storage for files)
- **Cloudflare** = the front door + security guard (we'll add this for free)

---

## Part 0 — Stuff you need first

You need:

1. A laptop or desktop with at least 16 GB of RAM (8 GB will be painful)
2. **VMware Workstation Pro** (free for personal use) — already installed since you mentioned it
3. An email address you'll use for all the accounts
4. A credit / debit card (AWS asks for one, but we'll stay under $5/month)
5. About 4–6 hours of focused time, broken across 2–3 days

**Don't rush.** This guide has ~80 steps. Take breaks. Save your progress.

---

# Part 1 — Make accounts (30 minutes)

## Step 1.1 — Make a GitHub account

1. Go to **https://github.com**
2. Click **Sign up**
3. Use the email you'll use for everything
4. Pick a username — this will appear in your URLs. Keep it simple like `reggie-boateng`
5. Choose the **Free** plan
6. Verify your email (check your inbox)

**Why we're doing this**: GitHub is like Google Drive for code. If your laptop dies, your work is still safe in the cloud. It also lets you go back in time — if you break something, you can rewind.

## Step 1.2 — Turn on 2-Factor Authentication

1. Click your profile picture (top right) → **Settings**
2. Click **Password and authentication** (left side)
3. Click **Enable two-factor authentication**
4. Pick **Set up using an app**
5. Install **Google Authenticator** or **Authy** on your phone
6. Scan the QR code with the app
7. Save the recovery codes somewhere safe (NOT in GitHub itself)

**Why**: A hacker stealing your password isn't enough — they also need your phone. This is the same MFA we built into Pic Shift itself.

## Step 1.3 — Make an AWS account

1. Go to **https://aws.amazon.com**
2. Click **Create an AWS Account** (top right)
3. Enter your email
4. Pick an **AWS account name** like `picshift-personal`
5. Verify email with the code
6. Set a strong password
7. Enter your address and phone number
8. Add a credit card — AWS won't charge you anything if you stay in the **Free Tier**
9. Pick the **Basic Support — Free** plan
10. Wait ~10 minutes for the account to activate

**Why**: AWS is where your photos, payslips, and backups will live. We'll only use about $5/month worth of AWS — way less than Netflix.

## Step 1.4 — Turn on MFA for your AWS root account (super important)

1. Log in to AWS Console
2. Top right, click your account name → **Security credentials**
3. Find **Multi-factor authentication (MFA)**
4. Click **Assign MFA device**
5. Pick **Authenticator app**
6. Scan the QR code with the same Authenticator app you used for GitHub
7. Enter two codes (it shows you when to enter the next one)
8. Done

**Why**: Your AWS root account can spend money. If somebody steals it, they can rack up huge bills. Always 2FA.

## Step 1.5 — Make an AWS "IAM user" for daily work

NEVER use your root account for everyday work. Make a regular user instead:

1. In AWS Console, search top: **IAM** → click it
2. Left menu: **Users** → **Create user**
3. User name: `reggie-admin`
4. Tick **Provide user access to the AWS Management Console**
5. Pick **I want to create an IAM user**
6. Set a password
7. Untick **User must create a new password at next sign-in** (we want it now)
8. Next → click **Attach policies directly** → tick **AdministratorAccess**
9. Next → Create user
10. **Important**: Save the sign-in URL it shows you. It looks like `https://123456789012.signin.aws.amazon.com/console`. Bookmark it.

Now sign out of root and sign in as `reggie-admin` via that URL. Also turn on MFA for this user (Step 1.4 again, but for this user).

**Why**: Splitting accounts means if one is compromised, the damage is limited. Pros do this.

---

# Part 2 — Put your code on GitHub (45 minutes)

## Step 2.1 — Install Git on your computer

**On Windows:**
1. Download from **https://git-scm.com/download/win**
2. Run the installer. Click Next for every option (defaults are fine)
3. Open **Git Bash** from the Start menu

**On Mac:**
1. Open Terminal
2. Type `git --version` and press Enter
3. If it asks to install Xcode tools, click Install

**Verify**: Type `git --version`. You should see something like `git version 2.43.0`.

## Step 2.2 — Tell Git who you are

In the terminal (Git Bash on Windows, Terminal on Mac), type:

```bash
git config --global user.name "Reggie Boateng"
git config --global user.email "boatengreggie@gmail.com"
```

Use the same email you used for GitHub.

## Step 2.3 — Create the repository on GitHub

1. Go to **https://github.com** while logged in
2. Top right, click **+** → **New repository**
3. Repository name: `picshift`
4. Description: `HR SaaS for Ghana and Nigeria`
5. Pick **Private** (so only you can see it)
6. **Do NOT** tick "Add a README" or "Add .gitignore" or "Add a license" — we already have those
7. Click **Create repository**
8. On the next page, **copy the URL** that ends in `.git`. It looks like `https://github.com/reggie-boateng/picshift.git`

## Step 2.4 — Push your local code to GitHub

Open a terminal and navigate to your project:

**Windows (Git Bash):**
```bash
cd "/c/Users/Reggie/Downloads/picshift-main"
```
(Adjust the path to match where your folder actually is.)

**Mac:**
```bash
cd ~/Downloads/picshift-main
```

Then run these one at a time:

```bash
git init
git add .
git commit -m "Initial commit — Pic Shift foundation"
git branch -M main
git remote add origin https://github.com/reggie-boateng/picshift.git
git push -u origin main
```

GitHub will ask you to sign in. **Use a Personal Access Token, not your password**:

1. Go to GitHub → click your photo → **Settings**
2. Bottom left → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**
4. Note: `picshift-laptop`
5. Expiration: 90 days
6. Tick **repo** (the whole section)
7. Click **Generate token**
8. **Copy the token now** — you can't see it again
9. Back in your terminal, paste the token when Git asks for your password

**Verify**: Refresh your GitHub repository page. You should see all your files.

**Why**: Now your work is safe even if your laptop is stolen. Every time you change something, you'll `git add`, `git commit`, `git push` to save it to GitHub.

---

# Part 3 — Set up your VMware Linux server (90 minutes)

This is the "kitchen" where Pic Shift actually runs.

## Step 3.1 — Download Ubuntu Server

1. Go to **https://ubuntu.com/download/server**
2. Click **Get Ubuntu Server 22.04 LTS** → **Download Ubuntu Server**
3. You'll get a file like `ubuntu-22.04.5-live-server-amd64.iso` (about 2 GB)
4. Save it somewhere you can find it

**Why Ubuntu Server?** It's the most popular free Linux. No fancy graphics, just a fast engine. Servers don't need windows.

## Step 3.2 — Create the virtual machine in VMware

1. Open **VMware Workstation Pro**
2. **File** → **New Virtual Machine** → **Typical** → Next
3. **Installer disc image (iso)**: browse to the Ubuntu file you downloaded → Next
4. Full name: `Reggie`. Username: `reggie`. Password: pick a strong one and write it down → Next
5. Virtual machine name: `picshift-server` → Next
6. Maximum disk size: **100 GB**. Choose **Store virtual disk as a single file** → Next
7. Click **Customize Hardware**:
   - **Memory**: 8192 MB (8 GB) minimum
   - **Processors**: 4 cores
   - **Network Adapter**: Bridged (this is important — it makes the VM look like a real computer on your network)
   - Close
8. Click **Finish**. VMware will start the VM and Ubuntu will install itself (~15 minutes).

**Why these numbers?** Pic Shift needs at least 4 GB RAM to run Postgres, Redis, API, and web at the same time. 8 GB gives you headroom.

## Step 3.3 — First boot

When Ubuntu finishes installing:

1. It will ask you to log in. Use the username (`reggie`) and password you set.
2. Type `ip addr` and press Enter
3. Look for a line that says `inet 192.168.x.x` — write this address down. Mine looks like `192.168.1.42`. **This is your server's address on your home network.**

**Why "bridged"?** It means your server can be reached from your laptop's browser by typing that IP. Like giving the kitchen a phone number.

## Step 3.4 — Update Ubuntu

In the VM, type these one at a time:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl ca-certificates gnupg lsb-release ufw fail2ban unattended-upgrades git nano
```

It will ask for your password. Type it (you won't see characters appear — that's normal).

**Why**: Updates fix security bugs. fail2ban automatically blocks people who try to brute-force your server.

## Step 3.5 — Set up the firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
sudo ufw status
```

You should see `Status: active` and three "ALLOW" lines (22, 80, 443).

**Why**: Closing every door except the three you need. Port 22 = SSH (remote login). 80 = web (http). 443 = secure web (https).

## Step 3.6 — Install Docker

Docker is what runs your app inside little isolated boxes:

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
```

**Important**: Log out and log back in (`exit`, then log in again) — this lets you run docker without `sudo`.

Test it:
```bash
docker run hello-world
```
You should see "Hello from Docker!".

## Step 3.7 — Pull your code from GitHub onto the server

```bash
sudo mkdir -p /opt
sudo chown $USER:$USER /opt
cd /opt
git clone https://github.com/reggie-boateng/picshift.git
cd picshift
ls
```

You should see folders like `apps`, `docs`, `infra`.

If GitHub asks for credentials, paste the same Personal Access Token from Step 2.4.

**Why /opt?** It's the standard Linux folder for "optional add-on applications you installed yourself."

---

# Part 4 — Set up AWS (storage + backups) (60 minutes)

We only use AWS for **two things**:
- **S3** — to store employee documents (payslips, contracts)
- **S3** — to store nightly backups of your database

Total cost for an MVP: about **$5/month**.

## Step 4.1 — Make an S3 bucket for documents

1. In AWS Console, search **S3** at the top
2. Click **Create bucket**
3. Bucket name: `picshift-documents-prod-reggie` (must be globally unique — add your name)
4. AWS Region: **Europe (Ireland) eu-west-1** (best speed for Africa)
5. **Object Ownership**: ACLs disabled — leave it
6. **Block Public Access**: leave ALL FOUR boxes ticked
7. **Bucket Versioning**: Enable
8. **Default encryption**: Server-side encryption with Amazon S3 managed keys (SSE-S3). Tick **Bucket Key — Enable**
9. Click **Create bucket**

Repeat for backups:
- Bucket name: `picshift-backups-prod-reggie`
- Same settings

**Why a bucket?** Think of it like a Dropbox folder, but for code to read and write to. Versioning means if a file is accidentally deleted, you can get it back.

## Step 4.2 — Make an IAM user just for the app

1. AWS Console → **IAM** → **Users** → **Create user**
2. Name: `picshift-api`
3. **Do NOT** tick "Provide user access to the AWS Management Console" (this user only needs API access)
4. Next → **Attach policies directly** → click **Create policy**
5. In the new tab, click **JSON**, paste this (replace the bucket names with yours):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::picshift-documents-prod-reggie/*",
        "arn:aws:s3:::picshift-backups-prod-reggie/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::picshift-documents-prod-reggie",
        "arn:aws:s3:::picshift-backups-prod-reggie"
      ]
    }
  ]
}
```

6. Next. Name it `picshift-api-s3` → Create policy
7. Back in the first tab, refresh, search `picshift-api-s3`, tick it → Next → Create user
8. Click the user → **Security credentials** tab → scroll down → **Create access key**
9. Pick **Application running outside AWS** → Next → Create
10. **Save both the Access key ID and Secret access key NOW** — you can't see the secret again. Save them in a password manager (Bitwarden is free).

**Why a separate user?** Even if these keys are stolen, they can ONLY touch those two buckets — not the rest of your AWS account.

## Step 4.3 — Buy a domain name

1. AWS Console → **Route 53** → **Registered domains** → **Register domain**
2. Search for `picshift.app` (or whatever you want). `.app` is about $14/year. `.com` is $12.
3. Add to cart → fill in your contact details → check out
4. AWS will email you when it's ready (5–30 minutes)

OR if you want it cheaper:
1. **https://porkbun.com** — domains often $5–10/year there
2. Or **https://cloudflare.com/products/registrar** — sells at cost

**Why a domain?** So people can type `picshift.app` instead of remembering your IP address.

---

# Part 5 — Connect Cloudflare in front (30 minutes, free!)

Cloudflare gives you free protection from hackers and free SSL certificates.

## Step 5.1 — Sign up for Cloudflare

1. Go to **https://dash.cloudflare.com/sign-up**
2. Sign up with your email
3. Turn on 2FA (Profile → Authentication)

## Step 5.2 — Add your domain

1. Click **Add a site**
2. Type your domain (`picshift.app`)
3. Pick the **Free** plan → Continue
4. Cloudflare will scan for DNS records. Click Continue.

## Step 5.3 — Change your domain's nameservers

Cloudflare will show you two nameservers like `dean.ns.cloudflare.com` and `alice.ns.cloudflare.com`.

**If you bought the domain from AWS Route 53**:
1. Open another tab → AWS Route 53 → Registered domains → click your domain
2. Click **Add or edit name servers**
3. Replace AWS's nameservers with the two Cloudflare ones
4. Save. Wait 5–30 minutes.

**If you bought it from Porkbun**:
1. Porkbun → your domain → Authoritative Nameservers → paste Cloudflare's two NS

## Step 5.4 — Find out your home internet's public IP

On any computer, go to **https://whatismyipaddress.com**. Write down the **IPv4** address (4 numbers like `41.66.55.123`).

## Step 5.5 — Forward ports on your home router

This is so the internet can reach your VMware server.

1. Open your router's admin page (usually `http://192.168.1.1` — check the sticker on your router)
2. Find **Port Forwarding** (sometimes under "Advanced")
3. Add two rules:
   - External port **80** → Internal IP `192.168.1.42` (your VM's IP from Step 3.3) port **80**
   - External port **443** → Internal IP `192.168.1.42` port **443**
4. Save

**Important**: If your ISP gives you a "dynamic" IP that changes, you'll need a **Dynamic DNS** service. The cheapest is **https://www.duckdns.org** (free) — but a simpler answer is to buy a basic VPS later and skip your home internet.

## Step 5.6 — Point your domain to your home IP via Cloudflare

1. Cloudflare dashboard → your domain → **DNS** → **Records**
2. Click **Add record**:
   - Type: **A**
   - Name: `@` (means the bare domain `picshift.app`)
   - IPv4 address: your home IP from Step 5.4
   - Proxy status: **Proxied** (orange cloud — VERY IMPORTANT)
   - Save
3. Add another record:
   - Type: **A**
   - Name: `www`
   - IPv4 address: same IP
   - Proxied: orange cloud
   - Save

## Step 5.7 — Turn on SSL

1. Cloudflare → your domain → **SSL/TLS** → **Overview**
2. Set encryption mode to **Full (strict)**
3. Click **Edge Certificates** (left)
4. Turn on **Always Use HTTPS**
5. Turn on **Automatic HTTPS Rewrites**
6. Set **Minimum TLS Version** to **TLS 1.2**

## Step 5.8 — Create a Cloudflare Origin Certificate (for nginx)

1. SSL/TLS → **Origin Server** → **Create Certificate**
2. Leave defaults → Create
3. You'll see two text boxes: **Origin Certificate** and **Private Key**
4. On your VM, create the cert files:

```bash
sudo mkdir -p /opt/picshift/infra/nginx/certs
sudo nano /opt/picshift/infra/nginx/certs/origin.pem
```
Paste the **Origin Certificate** text, then `Ctrl+O`, Enter to save, `Ctrl+X` to exit.

```bash
sudo nano /opt/picshift/infra/nginx/certs/origin.key
```
Paste the **Private Key** text, save, exit.

```bash
sudo chmod 600 /opt/picshift/infra/nginx/certs/origin.key
sudo chmod 644 /opt/picshift/infra/nginx/certs/origin.pem
```

**Why**: Cloudflare encrypts traffic from visitors → Cloudflare. The Origin Certificate encrypts Cloudflare → your VM. Now it's encrypted end-to-end.

---

# Part 6 — First boot of Pic Shift (45 minutes)

## Step 6.1 — Make your secrets

On the VM:

```bash
cd /opt/picshift
openssl rand -base64 48   # save as JWT_ACCESS_SECRET
openssl rand -base64 48   # save as JWT_REFRESH_SECRET
openssl rand -base64 32   # save as ENCRYPTION_KEY (super important!)
openssl rand -base64 24   # save as POSTGRES_PASSWORD
```

**Write these down in a password manager**. If you lose `ENCRYPTION_KEY`, all your encrypted employee data is gone forever. Save it in **at least two places**.

## Step 6.2 — Configure the .env file

```bash
cp apps/api/.env.example apps/api/.env
nano apps/api/.env
```

Fill in:
- `NODE_ENV=production`
- `APP_URL=https://picshift.app` (your domain)
- `API_PUBLIC_URL=https://picshift.app/api`
- `DATABASE_URL=postgresql://picshift:YOUR_POSTGRES_PASSWORD@postgres:5432/picshift`
- `REDIS_URL=redis://redis:6379`
- `JWT_ACCESS_SECRET=` (paste the first secret you generated)
- `JWT_REFRESH_SECRET=` (paste the second)
- `ENCRYPTION_KEY=` (paste the third)
- `CORS_ORIGINS=https://picshift.app`
- `S3_REGION=eu-west-1`
- `S3_BUCKET_DOCUMENTS=picshift-documents-prod-reggie`
- `S3_BUCKET_BACKUPS=picshift-backups-prod-reggie`
- `S3_ACCESS_KEY_ID=` (the access key ID from Step 4.2)
- `S3_SECRET_ACCESS_KEY=` (the secret from Step 4.2)
- `S3_ENDPOINT=` (leave blank for real AWS S3)
- `S3_FORCE_PATH_STYLE=false`
- `DEFAULT_TIMEZONE=Africa/Accra`
- `DEFAULT_CURRENCY=GHS`

Save with `Ctrl+O`, Enter, `Ctrl+X`.

```bash
chmod 600 apps/api/.env
```

**Why chmod 600?** Means only you can read this file. Secrets shouldn't be readable by anyone else.

## Step 6.3 — Set the Postgres password for Docker

```bash
echo "POSTGRES_PASSWORD=YOUR_POSTGRES_PASSWORD_HERE" > .env
chmod 600 .env
```

(Paste your actual Postgres password where it says `YOUR_POSTGRES_PASSWORD_HERE`.)

## Step 6.4 — Build and start everything

```bash
cd /opt/picshift
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

This takes about 5–10 minutes the first time. It downloads Node.js, builds your API, builds your frontend. Get a snack.

Once it's done:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d postgres redis
sleep 30  # let Postgres warm up
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm api npm run seed
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Check that everything is running:
```bash
docker compose ps
```

You should see `postgres`, `redis`, `api`, `web`, `proxy` all listed with `Up` status.

## Step 6.5 — Test from your laptop

Open a browser on your laptop and go to:
```
https://picshift.app
```

You should see the Pic Shift welcome page!

Try logging in with the seed account:
- Email: `owner@acme.gh`
- Password: `OwnerPassword!2026`

🎉 **You're live!**

---

# Part 7 — Daily life: updating your site

## Whenever you change code on your laptop:

```bash
cd ~/Downloads/picshift-main
git add .
git commit -m "describe what you changed"
git push
```

## Then deploy on the server:

SSH into your VM (from your laptop):
```bash
ssh reggie@192.168.1.42
```

Then on the VM:
```bash
cd /opt/picshift
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Boom. New version live.

## Make a daily backup

```bash
sudo crontab -e
```

Pick `nano` if asked. Add this line at the bottom:
```
0 2 * * * cd /opt/picshift && docker compose exec -T postgres pg_dump -U picshift picshift | gzip > /tmp/backup-$(date +\%Y\%m\%d).sql.gz && aws s3 cp /tmp/backup-$(date +\%Y\%m\%d).sql.gz s3://picshift-backups-prod-reggie/postgres/ && rm /tmp/backup-*.sql.gz
```

Save. This runs every night at 2 AM and uploads to S3.

(For the full encrypted backup script, see `infra/scripts/backup.sh` — fancier but more steps.)

---

# Troubleshooting

## "I can't access my site from outside my home"

- Your ISP might block ports 80/443. Test with **https://www.canyouseeme.org** — type `80` and `443`.
- If blocked, the cheapest fix is a **$5/month VPS at Hetzner or DigitalOcean** instead of hosting at home.

## "Docker says permission denied"

```bash
sudo usermod -aG docker $USER
```
Then log out and back in.

## "I forgot my secret keys"

If you lose `ENCRYPTION_KEY`, **all encrypted data is gone**. There is no recovery. Always save secrets in a password manager, ideally in 2 places.

## "My site loads but says 'Bad Gateway'"

Means nginx is running but the API isn't:
```bash
docker compose logs --tail=50 api
```
Look for red error lines.

## "Cloudflare says 521 Web Server Is Down"

Means Cloudflare can't reach your home. Check:
- Your VMware VM is running
- Your home internet is on
- Port forwarding rules on your router are still there
- Your home IP hasn't changed (Step 5.4)

## "I get certificate errors"

Cloudflare SSL mode probably isn't Full (strict). Check Step 5.7.

---

# Quick reference — what each command does

| Command | What it does |
|---|---|
| `git clone` | Download a copy of your code from GitHub |
| `git pull` | Get the newest version |
| `git add .` | Mark all changes for saving |
| `git commit -m "..."` | Save a snapshot with a description |
| `git push` | Upload to GitHub |
| `docker compose up -d` | Start your app in the background |
| `docker compose ps` | Show what's running |
| `docker compose logs api` | Show what the API is saying |
| `docker compose down` | Stop everything |
| `docker compose build` | Recompile after code changes |
| `sudo apt update && sudo apt upgrade -y` | Update Ubuntu |
| `ssh reggie@192.168.1.42` | Remote-control your VM from your laptop |
| `nano file.txt` | Edit a file in the terminal |

---

# Total monthly cost (real numbers)

| Item | Cost |
|---|---|
| GitHub (Free plan, private repo) | $0 |
| AWS S3 storage (~5 GB) | ~$0.15 |
| AWS S3 data transfer | ~$1 |
| Cloudflare (Free plan) | $0 |
| Domain (`picshift.app`) | $14 / year = $1.20 / month |
| Your home internet (you already pay this) | $0 extra |
| Your laptop electricity for VMware | ~$2–4 / month |
| **TOTAL** | **~$5–7 / month** |

You can literally run a real HR SaaS for the price of a coffee. As you grow, you'll move to AWS RDS + ECS — that's documented in `docs/COSTS.md`.

---

# What to do next (in order)

1. ☐ Read `DELIVERY.md` — the full summary of what's built
2. ☐ Get this guide working end-to-end (target: 1 weekend)
3. ☐ Set up MFA on your own account inside Pic Shift
4. ☐ Create your first real employee record (yourself!)
5. ☐ Test backups by running the cron job manually
6. ☐ Read `docs/SECURITY-CHECKLIST.md` and tick off everything you haven't done
7. ☐ Show 3 friends — fix what they complain about
8. ☐ When you have your first paying customer:
   - File for Ghana DPC registration (`docs/COMPLIANCE.md`)
   - Get cyber liability insurance
   - Read `docs/INCIDENT-RESPONSE.md` and practice the drill

You've got this. Take it one step at a time.
