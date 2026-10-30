#!/bin/sh
# What a production container does when it starts. Any failing step stops the start, so a bad
# setting shows up in the deploy log instead of as a service that is up but broken.
set -e

python manage.py migrate --noinput
python manage.py ensure_platform_admin

# One worker with several threads: it fits the free plan's memory, and the request limits keep
# their counts in the process, so a single worker keeps them right. Raise WEB_CONCURRENCY only
# together with a shared cache.
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-10000}" \
  --workers "${WEB_CONCURRENCY:-1}" \
  --threads "${GUNICORN_THREADS:-4}" \
  --worker-tmp-dir /dev/shm \
  --timeout 60 \
  --access-logfile - \
  --error-logfile -
