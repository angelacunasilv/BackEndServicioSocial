#!/bin/sh
set -eu

echo "Aplicando migraciones pendientes..."
node dist/scripts/migrate.js

exec "$@"
