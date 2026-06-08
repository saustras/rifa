#!/usr/bin/env sh
set -eu

cd /opt/rifa

NEW_PASS="$(openssl rand -hex 24)"

printf "ALTER USER rifa WITH PASSWORD '%s';\n" "$NEW_PASS" \
  | docker exec -i rifa-postgres-1 psql -U rifa -d rifa -v ON_ERROR_STOP=1 >/dev/null

tmp_env="$(mktemp)"
awk -v pass="$NEW_PASS" '
  BEGIN {
    seen_pg = 0;
    seen_url = 0;
  }
  /^POSTGRES_PASSWORD=/ {
    print "POSTGRES_PASSWORD=" pass;
    seen_pg = 1;
    next;
  }
  /^DATABASE_URL=/ {
    print "DATABASE_URL=postgresql://rifa:" pass "@postgres:5432/rifa";
    seen_url = 1;
    next;
  }
  { print }
  END {
    if (seen_pg == 0) print "POSTGRES_PASSWORD=" pass;
    if (seen_url == 0) print "DATABASE_URL=postgresql://rifa:" pass "@postgres:5432/rifa";
  }
' .env > "$tmp_env"

cat "$tmp_env" > .env
rm -f "$tmp_env"
chmod 600 .env

echo "DB_PASSWORD_ROTATED_URL_SAFE"
