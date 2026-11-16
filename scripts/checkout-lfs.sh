#!/bin/sh
# Vercel Git leaves data/*.npu-rep as LFS pointers. The build image has no
# git-lfs, and installing it there failed the deploy. Pull when git-lfs is
# already on PATH; then download any pointers still on disk from GitHub LFS.
set -eu
cd "$(dirname "$0")/.."

if command -v git-lfs >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git lfs install --local
  env -u GIT_LFS_SKIP_SMUDGE git lfs pull --include="data/**" || true
fi

node scripts/checkout-lfs.mjs
