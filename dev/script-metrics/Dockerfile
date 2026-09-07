# Everything runs in here so the host only ever needs Docker.
#
# lbzip2 is the reason this is not a one-liner: it parallelises decompression of
# *any* bzip2 stream (pbzip2 only handles streams it compressed itself), and the
# 15 GB edit dump is decompressed twice per run. On a multi-core machine that is
# the difference between minutes and most of an hour.
#
# No Python packages are needed — the pipeline is stdlib only.
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      lbzip2 bzip2 curl ca-certificates sqlite3 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY src/       /app/src/
COPY sql/       /app/sql/
COPY config/    /app/config/
COPY templates/ /app/templates/

# Unbuffered so the progress heartbeats actually appear during a long pass.
ENV PYTHONUNBUFFERED=1

# The mount points belong on the ENTRYPOINT, not in CMD. `docker compose run
# metrics --report-only` REPLACES the CMD with the user's arguments, so with the
# defaults there --out silently fell back to /app/out — inside the container,
# unmounted, thrown away when it exits. Every --report-only run appeared to
# "produce no changes" because it never wrote to the host at all. On the
# ENTRYPOINT they always apply and any extra argument simply appends.
ENTRYPOINT ["python", "/app/src/pipeline.py", "--data-dir", "/data", "--out", "/out"]
CMD []
