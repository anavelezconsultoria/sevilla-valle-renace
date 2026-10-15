#!/usr/bin/env bash
# =============================================================================
# Prueba la base de datos de punta a punta, sin tocar produccion:
#   1. Levanta Supabase local con la CLI oficial (Postgres 17 + auth + storage,
#      igual que produccion). Al arrancar aplica TODAS las migraciones en orden.
#   2. Corre supabase/tests/pruebas.sql (termina en ROLLBACK).
# Falla si una migracion o una prueba falla. En GitHub Actions, el error queda
# como anotacion visible en la ejecucion.
# Uso local (con Docker encendido): bash supabase/probar-base.sh
# =============================================================================
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SUPABASE="${SUPABASE:-npx -y supabase@latest}"
# Servicios que las pruebas no necesitan: arranca mas rapido.
EXCLUIR="studio,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor,realtime,postgres-meta"

anotar_error() {
  local titulo="$1" mensaje="$2"
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    mensaje="${mensaje//'%'/'%25'}"
    mensaje="${mensaje//$'\n'/'%0A'}"
    echo "::error title=${titulo}::${mensaje}"
  fi
  echo "ERROR ${titulo}: ${2}" >&2
}

cd "$RAIZ"
trap '$SUPABASE stop --no-backup >/dev/null 2>&1 || true' EXIT

echo "Levantando Supabase local y aplicando migraciones..."
if ! salida="$($SUPABASE start -x "$EXCLUIR" 2>&1)"; then
  anotar_error "Migraciones" "$(echo "$salida" | tail -25)"
  exit 1
fi
echo "$salida" | grep -iE "applying|migration" || true

CONTENEDOR="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)"
if [ -z "$CONTENEDOR" ]; then
  anotar_error "Base de datos" "No se encontro el contenedor de la base."
  exit 1
fi

echo "Pruebas..."
if ! salida="$(docker exec -i "$CONTENEDOR" psql -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 < supabase/tests/pruebas.sql 2>&1)"; then
  echo "$salida" | grep "NOTICE" | sed 's/^.*NOTICE:  //' || true
  anotar_error "Pruebas de base de datos" "$(echo "$salida" | grep -v "NOTICE" | tail -15)"
  exit 1
fi

aprobadas="$(echo "$salida" | grep -c "OK  " || true)"
echo "$salida" | grep "OK  " | sed 's/^.*NOTICE:  //'
echo "Aprobadas: ${aprobadas}"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "### Base de datos: ${aprobadas} pruebas aprobadas"
    echo "$salida" | grep "OK  " | sed 's/^.*NOTICE:  OK  /- /'
  } >> "$GITHUB_STEP_SUMMARY"
fi
if [ -n "${GITHUB_ACTIONS:-}" ]; then
  echo "::notice title=Base de datos::${aprobadas} pruebas aprobadas"
fi
