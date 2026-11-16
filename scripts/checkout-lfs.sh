#!/bin/sh
# Vercel Git clones with GIT_LFS_SKIP_SMUDGE set, so data/*.npu-rep stays a
# pointer and the demo build would publish that pointer. Pull the real
# data/** objects before npm ci / sync:demo-fixtures.
set -eu
cd "$(dirname "$0")/.."

if ! command -v git-lfs >/dev/null 2>&1; then
  if ! command -v dnf >/dev/null 2>&1; then
    echo "checkout-lfs: git-lfs is required to check out data fixtures" >&2
    exit 1
  fi
  dnf install -y git-lfs
fi

git lfs install --local
env -u GIT_LFS_SKIP_SMUDGE git lfs pull --include="data/**"
