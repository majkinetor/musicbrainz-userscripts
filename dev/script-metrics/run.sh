#!/usr/bin/env bash
# Build and run the script-metrics pipeline in Docker. See run.ps1 for the
# Windows equivalent; both are thin wrappers around docker compose.
#
#   ./run.sh                      full run against the latest dump
#   ./run.sh --report-only        re-render from the existing database
#   ./run.sh --dump-id 20260905-002519
#   ./run.sh --clean              drop the cached dumps (frees ~15 GB)
set -euo pipefail
cd "$(dirname "$0")"

if [[ "${1:-}" == "--clean" ]]; then
    echo 'Removing the cached dump volume...'
    docker compose down -v
    exit 0
fi

docker compose build
docker compose run --rm metrics --data-dir /data --out /out "$@"

echo
echo 'Reports written to out/:'
ls -lh out/ | grep -v metrics.db || true
