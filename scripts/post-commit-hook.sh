#!/usr/bin/env bash
# EMA Git-to-Wiki Auto-Sync post-commit hook
# Install: cp scripts/post-commit-hook.sh .git/hooks/post-commit && chmod +x .git/hooks/post-commit
# Or symlink: ln -sf ../../scripts/post-commit-hook.sh .git/hooks/post-commit

REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"
EMA_URL="${EMA_URL:-http://localhost:4488}"

if [ -z "$REPO_DIR" ]; then
  exit 0
fi

# Fire-and-forget — don't block the commit
curl -s -X POST \
  "${EMA_URL}/api/intelligence/git-events/scan" \
  -H "Content-Type: application/json" \
  -d "{\"repo\": \"${REPO_DIR}\"}" \
  >/dev/null 2>&1 &

exit 0
