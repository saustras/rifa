# Rifa production deployment

This project is prepared for Dokploy using `docker-compose.dokploy.yml`.

For a small VPS without Dokploy, use `docker-compose.light.yml` instead. It publishes:

- public web: `http://<vps-ip>/`
- admin web: `http://<vps-ip>:8080/`
- API: `127.0.0.1:3000` only
- PostgreSQL: `127.0.0.1:55432` only

## Services

- `postgres` — PostgreSQL 17 with a persistent Docker volume. It binds only to `127.0.0.1:${POSTGRES_HOST_PORT:-55432}` on the VPS so it is not publicly exposed.
- `api` — Node API on port `3000`. Startup runs Drizzle migrations before serving traffic.
- `public-web` — Nginx static container for the public raffle site.
- `admin-web` — Nginx static container for the seller/admin UI.

Both web containers proxy `/api/*` and `/local-campaign-assets/*` to the internal API service, so `VITE_API_BASE_URL` can remain empty when the web and API are deployed in the same compose network.

## Dokploy setup

1. Create a Docker Compose app in Dokploy using this repository.
2. Use `docker-compose.dokploy.yml` as the compose file.
3. Copy `deploy/dokploy.env.example` into Dokploy environment variables and replace all placeholder secrets.
4. Deploy.
5. Verify API health from inside the Dokploy network or through the configured domain: `/api/health` and `/api/health/db`.

## Local connection to production PostgreSQL

Do not open PostgreSQL publicly. Use an SSH tunnel:

```bash
ssh -L 127.0.0.1:15432:127.0.0.1:55432 root@<vps-ip> -N
```

Then point local commands to the tunneled URL:

```bash
DATABASE_URL=postgresql://rifa:<password>@127.0.0.1:15432/rifa pnpm db:migrate
DATABASE_URL=postgresql://rifa:<password>@127.0.0.1:15432/rifa pnpm api:dev
```

Never commit real `DATABASE_URL`, SMTP credentials, Telegram tokens, or API tokens.

## Current lightweight VPS operation

The small VPS path intentionally avoids Dokploy because the first server had less than 1GB RAM and less than 10GB disk. Dokploy's documented minimum is higher, so the safer lightweight stack is Docker Compose directly under `/opt/rifa`.

Useful commands on the VPS:

```bash
cd /opt/rifa
docker compose -f docker-compose.light.yml ps
docker compose -f docker-compose.light.yml logs --tail 120 api
docker compose -f docker-compose.light.yml up -d --build
docker builder prune -af
./deploy/remote-light-healthcheck.sh
df -h /
free -h
```

Health checks:

```bash
curl -fsS http://127.0.0.1:3000/api/health
curl -fsS http://127.0.0.1:3000/api/health/db
curl -fsS http://127.0.0.1/ >/dev/null && echo PUBLIC_WEB_OK
curl -fsS http://127.0.0.1:8080/ >/dev/null && echo ADMIN_WEB_OK
```

Public endpoints in the lightweight setup:

- Public web: `http://<vps-ip>/`
- API through public web proxy: `http://<vps-ip>/api/health`
- Admin web: `http://<vps-ip>:8080/` if the provider firewall allows port `8080`.

Admin login is JWT-based:

- `ADMIN_USERNAME` — admin username.
- `ADMIN_PASSWORD` — admin password stored only in `/opt/rifa/.env` or the deployment secret store.
- `ADMIN_SELLER_ID` — seller tenant the admin controls.
- `JWT_SECRET` — strong random signing secret.
- `ADMIN_JWT_TTL_SECONDS` — token lifetime, defaults to 8 hours.

If `8080` is blocked by the provider, keep it private and use an SSH tunnel from the local machine:

```powershell
ssh -i "$env:USERPROFILE\.ssh\rifa_vps_ed25519" -L 127.0.0.1:18080:127.0.0.1:8080 -N root@<vps-ip>
```

Then open:

```text
http://127.0.0.1:18080/
```

From this repo on Windows, both DB and admin tunnels can be started with:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\start-local-tunnels.ps1
```

## Secret rotation helper

If a generated PostgreSQL password contains URL-hostile characters or needs rotation, use:

```bash
/opt/rifa/deploy/remote-rotate-db-url-safe.sh
docker compose -f docker-compose.light.yml restart api
```

The script generates a URL-safe hex password on the VPS, updates PostgreSQL, and rewrites only `POSTGRES_PASSWORD` and `DATABASE_URL` in `/opt/rifa/.env`.

## Security hardening TODO after domain

- Put a domain in front of the public web and enable HTTPS with a reverse proxy such as Caddy or Traefik.
- Avoid exposing the admin on a random public port; prefer a protected admin subdomain with HTTPS and authentication, or keep using SSH tunnel.
- Rotate the original root password because it was shared during setup.
- After confirming SSH key access and recovery console access, disable SSH password authentication.
- Keep PostgreSQL private on `127.0.0.1:55432`; do not open `5432` publicly.
- Add off-server backups for the Docker PostgreSQL volume before real sales traffic.
