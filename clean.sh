#!/usr/bin/env bash
set -euo pipefail

# Run this from inside your repo's root directory.

DEFAULT_BRANCH="${1:-main}"   # pass your branch name as arg 1 if it's not "main"
COMMIT_MSG="${2:-Initial commit}"

echo "==> Creating orphan branch (no parent history)..."
git checkout --orphan __collapsed_tmp__

echo "==> Staging all current files..."
git add -A

echo "==> Committing as a single commit..."
git commit -m "$COMMIT_MSG"

echo "==> Replacing $DEFAULT_BRANCH with the collapsed branch..."
git branch -D "$DEFAULT_BRANCH"
git branch -m "$DEFAULT_BRANCH"

echo "==> Expiring reflog and garbage collecting to drop old commit objects..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "==> Force-pushing to origin..."
git push -f origin "$DEFAULT_BRANCH"

echo "Done. Local history collapsed and old objects pruned."
echo "NOTE: GitHub/GitLab may still cache old commits server-side for a while."
echo "If this was to remove a secret, rotate that credential regardless."