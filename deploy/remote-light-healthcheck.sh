#!/usr/bin/env sh
set -eu

cd /opt/rifa

docker compose -f docker-compose.light.yml ps

curl -fsS --max-time 5 http://127.0.0.1:3000/api/health
printf '\n'
curl -fsS --max-time 5 http://127.0.0.1:3000/api/health/db
printf '\n'
curl -fsS --max-time 5 http://127.0.0.1:18081/ >/dev/null
echo "PUBLIC_WEB_OK"
curl -fsS --max-time 5 http://127.0.0.1:8080/ >/dev/null
echo "ADMIN_WEB_OK"
curl -fsS --max-time 5 -H 'Host: dinamicas.labellamj.com' http://127.0.0.1/ >/dev/null
echo "CADDY_PUBLIC_DOMAIN_OK"
curl -fsS --max-time 5 -H 'Host: admin.labellamj.com' http://127.0.0.1/ >/dev/null
echo "CADDY_ADMIN_DOMAIN_OK"

df -h /
free -h
docker system df
