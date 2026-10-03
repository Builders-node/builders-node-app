#!/bin/sh
# Vercel runs this instead of `build` (it prefers a `vercel-build` script).
#
# Migrations go first, so a production deploy never serves code that reads a
# column the database doesn't have yet. Vercel deploys on push while the CI
# migrate job waits for the tests — for those minutes every request touching
# a new column failed.
#
# Only for production, and only when DIRECT_URL is set: a preview build must
# never migrate the production database, and without a direct URL this falls
# back to the old behaviour (CI applies them). The CI job stays as a second
# path; `migrate deploy` takes a lock and the later one finds nothing to do.
set -e
if [ "$VERCEL_ENV" = "production" ] && [ -n "$DIRECT_URL" ]; then
  echo "Applying migrations before the build"
  npx prisma migrate deploy
fi
npx nest build
