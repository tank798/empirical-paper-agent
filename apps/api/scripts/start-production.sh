#!/bin/sh
set -eu

echo "[startup] preparing database schema"

if pnpm --filter api exec prisma migrate deploy; then
  echo "[startup] prisma migrate deploy succeeded"
else
  echo "[startup] prisma migrate deploy failed, falling back to prisma db push"
  if pnpm --filter api exec prisma db push --accept-data-loss; then
    echo "[startup] prisma db push succeeded"
  else
    echo "[startup] prisma db push failed, starting API anyway"
  fi
fi

echo "[startup] starting api server"
exec node apps/api/dist/apps/api/src/main.js
