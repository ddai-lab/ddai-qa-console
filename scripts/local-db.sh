#!/usr/bin/env bash
# Beatrice · Postgres LOCAL para desarrollo (autocontenido, fuera del repo).
# Uso:  ./scripts/local-db.sh {start|stop|status|reset}
# Crea un clúster propio en ~/.beatrice/pgdata en el puerto 5432. No toca ningún
# otro Postgres del sistema. La base se llama "beatrice".
set -euo pipefail

PGBIN="/opt/homebrew/opt/postgresql@14/bin"
[ -x "$PGBIN/pg_ctl" ] || PGBIN="$(brew --prefix postgresql@14 2>/dev/null)/bin"
PGDATA="$HOME/.beatrice/pgdata"
PORT="${BEATRICE_DB_PORT:-5432}"
DB="beatrice"

start() {
  if [ ! -d "$PGDATA/base" ]; then
    echo "→ inicializando clúster en $PGDATA"
    mkdir -p "$PGDATA"
    "$PGBIN/initdb" -U postgres -D "$PGDATA" >/dev/null
  fi
  if "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    echo "→ ya estaba corriendo"
  else
    "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PORT" -l "$PGDATA/server.log" start
    sleep 1
  fi
  "$PGBIN/psql" -p "$PORT" -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$DB'" | grep -q 1 \
    || "$PGBIN/psql" -p "$PORT" -U postgres -c "CREATE DATABASE $DB;" >/dev/null
  echo "✓ Postgres local en puerto $PORT · base '$DB'"
}
stop()   { "$PGBIN/pg_ctl" -D "$PGDATA" stop 2>/dev/null && echo "✓ detenido" || echo "no estaba corriendo"; }
status() { "$PGBIN/pg_ctl" -D "$PGDATA" status 2>/dev/null || echo "detenido"; }
reset()  { stop || true; rm -rf "$PGDATA"; echo "✓ clúster borrado ($PGDATA)"; start; }

case "${1:-start}" in
  start) start ;; stop) stop ;; status) status ;; reset) reset ;;
  *) echo "uso: $0 {start|stop|status|reset}"; exit 1 ;;
esac
