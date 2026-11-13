#!/bin/sh
# Builds dist/ stamped with main's HEAD sha and pushes it to the gh-pages branch.
set -e
sha=$(git rev-parse HEAD)
BUILD_SHA=$sha node build.mjs
tmp=$(mktemp -d); cp -R dist/. "$tmp"; touch "$tmp/.nojekyll"
cd "$tmp" && git init -q && git checkout -q -b gh-pages && git add -A && git -c user.name=Sartonon -c user.email="$(cd - >/dev/null; git config user.email)" commit -qm "deploy $sha" && git push -qf "$(cd - >/dev/null; git remote get-url origin)" gh-pages
echo deployed $sha
