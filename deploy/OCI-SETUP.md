# Deploying to Oracle Cloud Infrastructure (Always Free)

Runs the whole app on one Always Free Ampere VM: Postgres, the Node API, and Caddy
(automatic HTTPS), via Docker Compose. Cost is $0 on the Always Free tier.

## 1. Create the OCI account

Sign up at <https://www.oracle.com/cloud/free/>. A credit card is required for identity
verification; Always Free resources are not charged. During signup pick a **home region**
close to you — it cannot be changed later, and Ampere capacity varies by region.

## 2. Create the VM

Console → **Compute → Instances → Create instance**:

| Setting | Value |
|---|---|
| Image | Canonical Ubuntu 24.04 |
| Shape | `VM.Standard.A1.Flex` (Ampere, Arm) |
| OCPUs / memory | 2 OCPU / 12 GB (Always Free allows up to 4 / 24 total) |
| Boot volume | 50 GB is plenty (200 GB free across all volumes) |
| SSH keys | Upload your public key, or let the console generate and download one |

Save the **public IP** shown after creation.

> If you get "Out of host capacity", Ampere is temporarily exhausted in that availability
> domain. Try another availability domain, or retry later — it does free up.

## 3. Open ports 80 and 443 — *both* layers

This is the most common OCI mistake: there are **two** firewalls, and the VM is
unreachable until both are open.

**Layer 1 — VCN security list.** Networking → Virtual Cloud Networks → your VCN →
Subnets → your subnet → Security Lists → default list → **Add Ingress Rules**:

| Source CIDR | IP Protocol | Destination Port |
|---|---|---|
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |

**Layer 2 — the OS firewall.** Oracle's Ubuntu images ship iptables rules that drop
everything except SSH. SSH in and run:

```bash
ssh ubuntu@<PUBLIC_IP>

sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

(On an Oracle Linux image instead: `sudo firewall-cmd --permanent --add-port=80/tcp
--add-port=443/tcp && sudo firewall-cmd --reload`.)

## 4. Install Docker

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu
newgrp docker
```

## 5. Deploy

```bash
git clone https://github.com/abbishek11/Pistol-dashboard.git
cd Pistol-dashboard

cp .env.example .env
nano .env
```

Fill in `.env`:

- `POSTGRES_PASSWORD` — generate one: `openssl rand -base64 24`
- `SITE_ADDRESS` — `:80` to start (plain HTTP on the public IP). Switch to your domain
  later for automatic HTTPS.
- `ANTHROPIC_API_KEY` — optional. Without it, photos still upload and store, but
  score-sheet extraction returns `extractionError: "no_api_key"`.

Then:

```bash
docker compose up -d --build
```

First run pulls images, builds the app, and applies `migrations/` automatically
(creating the `sessions` table). Watch it with `docker compose logs -f app` — you
should see `Applied migration 20260904120000_init.sql` then `Listening on :8080`.

## 6. Verify

```bash
curl http://<PUBLIC_IP>/api/sessions     # -> []
```

Then open `http://<PUBLIC_IP>/` in a browser, add a session, and reload to confirm it
persisted.

## 7. Add a domain and HTTPS (optional)

1. Point an `A` record at the VM's public IP.
2. Set `SITE_ADDRESS=pistol.example.com` in `.env`.
3. `docker compose up -d`

Caddy obtains and renews a Let's Encrypt certificate automatically. DNS must resolve
*before* this step or the certificate request fails.

## Operations

```bash
docker compose logs -f app          # application logs
docker compose restart app          # restart after a config change
git pull && docker compose up -d --build   # deploy updates

# Back up the database
docker compose exec db pg_dump -U pistol pistol > backup-$(date +%F).sql

# Back up uploaded photos
docker run --rm -v pistol-dashboard_photos:/p -v "$PWD":/out alpine \
  tar czf /out/photos-$(date +%F).tar.gz -C /p .
```

Photos live in the `photos` Docker volume and the database in `db-data`; both survive
`docker compose down`. They do **not** survive terminating the VM — take the backups
above if the data matters.

## Notes

- Postgres is not published to the host, so it is reachable only from the app container
  on the internal Docker network.
- The app serves only `index.html`, `sw.js`, `manifest.json`, and `icons/` as static
  files — source and config are not web-reachable.
- The Netlify files (`netlify/`, `netlify.toml`) are unused by this deployment and can be
  deleted once you have settled on OCI.
