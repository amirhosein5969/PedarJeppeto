#!/usr/bin/env bash
# =============================================================================
# Handcrafted Hearthwood — monorepo git initializer
#
# Builds a clean, logical 4-commit history at the repo root:
#   1. chore: init monorepo workspace and docs
#   2. feat(backend): implement FastAPI headless core and DB models
#   3. feat(frontend): implement React TanStack storefront and admin UI
#   4. ops: fully dockerize frontend and backend services
#
# Usage:
#   bash setup_git.sh
#
# Safe to re-run: steps that have nothing to commit are skipped.
# =============================================================================
set -euo pipefail

# Always operate from the directory containing this script (the repo root).
cd "$(dirname "$0")"

# --- Preflight ------------------------------------------------------------------
command -v git >/dev/null 2>&1 || { echo "ERROR: git is not installed."; exit 1; }
git config user.email >/dev/null 2>&1 || { echo "ERROR: git user.email is not set (git config --global user.email you@example.com)"; exit 1; }
git config user.name  >/dev/null 2>&1 || { echo "ERROR: git user.name is not set (git config --global user.name Your Name)"; exit 1; }

# --- a) Remove nested .git folders (old per-app sub-repos) -----------------------
for dir in frontend backend; do
  if [ -d "$dir/.git" ]; then
    echo ">> Removing nested .git in $dir/"
    rm -rf "$dir/.git"
  fi
done

# --- b) Initialize the repository at the root ------------------------------------
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo ">> WARNING: repository already contains commits — new commits will be APPENDED, not a clean history."
fi
git init -b main 2>/dev/null || git init
git symbolic-ref HEAD refs/heads/main

# --- c) Root .gitignore must be present (it is committed in step 1) ---------------
[ -f .gitignore ] || { echo "ERROR: .gitignore not found at the repo root."; exit 1; }

# --- Commit helper: stage the given paths, commit only if something changed -------
phase_commit() {
  local message="$1"
  shift
  git add -- "$@"
  if git diff --cached --quiet; then
    echo ">> SKIP (nothing to commit): $message"
  else
    git commit -m "$message"
    echo ">> COMMITTED: $message"
  fi
}

# --- d) Commit 1 — workspace + docs ------------------------------------------------
phase_commit "chore: init monorepo workspace and docs" \
  docker-compose.yml .gitignore README.md setup_git.sh .env.example

# --- e) Commit 2 — backend (app code; Docker ops files land in commit 4) ----------
phase_commit "feat(backend): implement FastAPI headless core and DB models" \
  backend/ \
  ':(exclude)backend/Dockerfile' \
  ':(exclude)backend/.dockerignore' \
  ':(exclude)backend/docker-entrypoint.sh'

# --- f) Commit 3 — frontend (app code; Docker ops files land in commit 4) ---------
phase_commit "feat(frontend): implement React TanStack storefront and admin UI" \
  frontend/ \
  ':(exclude)frontend/Dockerfile' \
  ':(exclude)frontend/.dockerignore'

# --- g) Commit 4 — dockerization ---------------------------------------------------
phase_commit "ops: fully dockerize frontend and backend services" \
  backend/Dockerfile backend/.dockerignore backend/docker-entrypoint.sh \
  frontend/Dockerfile frontend/.dockerignore

echo ""
echo "=== Done. History: ==="
git log --oneline