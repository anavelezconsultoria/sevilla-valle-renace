#!/usr/bin/env bash
# =============================================================================
# Prueba la base de datos de punta a punta, sin tocar produccion:
#   1. Levanta la misma imagen de Postgres que usa Supabase (trae auth, storage,
#      pg_cron, pgcrypto y la publicacion de tiempo real).
#   2. Aplica TODAS las migraciones en orden, cada una en su propia transaccion
#      (asi los valores nuevos de un enum quedan listos para la siguiente).
#   3. Corre supabase/tests/pruebas.sql (termina en ROLLBACK).
# Falla si una migracion o una prueba falla. En GitHub Actions, el error queda
# como anotacion visible en la ejecucion.
# Uso local (con Docker encendido): bash supabase/probar-base.sh
# =============================================================================
set -euo pipefail

IMAGEN="${IMAGEN:-supabase/postgres:17.6.1.178}"
CONTENEDOR="sr-pruebas-base"
RAIZ="$(cd "$(dirname "$0")" && pwd)"

anotar_error() {
  # Mensaje multilinea como anotacion de GitHub (los saltos van codificados).
  local titulo="$1" mensaje="$2"
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    mensaje="${mensaje//'%'/'%25'}"
    mensaje="${mensaje//$'\n'/'%0A'}"
    echo "::error title=${titulo}::${mensaje}"
  fi
  echo "ERROR ${titulo}: ${2}" >&2
}

limpiar() { docker rm -f "$CONTENEDOR" >/dev/null 2>&1 || true; }
trap limpiar EXIT
limpiar

echo "Levantando ${IMAGEN}..."
docker run -d --name "$CONTENEDOR" -e POSTGRES_PASSWORD=pruebas "$IMAGEN" >/dev/null

# Espera al servidor definitivo (el de inicializacion no escucha por TCP).
for _ in $(seq 1 90); do
  if docker exec "$CONTENEDOR" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then break; fi
  sleep 2
done
sleep 3
docker exec "$CONTENEDOR" pg_isready -U postgres -h 127.0.0.1

psql_en() {
  docker exec -i -e PGPASSWORD=pruebas "$CONTENEDOR" psql -h 127.0.0.1 -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"
}

for archivo in "$RAIZ"/migrations/*.sql; do
  nombre="$(basename "$archivo")"
  echo "Migracion ${nombre}"
  if ! salida="$(psql_en -1 < "$archivo" 2>&1)"; then
    anotar_error "Migracion ${nombre}" "$salida"
    exit 1
  fi
done

echo "Pruebas..."
if ! salida="$(psql_en < "$RAIZ/tests/pruebas.sql" 2>&1)"; then
  echo "$salida" | grep -E "NOTICE" | sed 's/^.*NOTICE:  //' || true
  anotar_error "Pruebas de base de datos" "$(echo "$salida" | grep -vE "NOTICE" | tail -15)"
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
