#!/usr/bin/env bash
# Cloud sessions only: install the OS tools the test suite needs that the
# container image lacks. The GitHub workflows install the same (checks.yml,
# suite.yml); keep the two lists in step. Local sessions do nothing.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0

# bsdtar, for Art Station's zip specs (604-zip-reader, 604-zip-drop)
if ! command -v bsdtar >/dev/null 2>&1; then
  sudo=; [ "$(id -u)" -ne 0 ] && sudo=sudo
  export DEBIAN_FRONTEND=noninteractive
  { $sudo apt-get install -y -qq libarchive-tools \
    || { $sudo apt-get update -qq && $sudo apt-get install -y -qq libarchive-tools; }; } >/dev/null 2>&1 \
    || echo "session-start: installing libarchive-tools (bsdtar) failed; Art Station's zip specs will fail" >&2
fi
exit 0
