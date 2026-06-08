#!/usr/bin/env sh
set -eu

cd /opt/rifa

docker compose -f docker-compose.light.yml up -d --build
docker builder prune -af >/dev/null
./deploy/remote-light-healthcheck.sh
