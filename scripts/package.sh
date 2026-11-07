#!/usr/bin/env bash
# Build a Chrome "load unpacked" ZIP from the repository root.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')"
OUT="dist/zhibo8-modern-v${VERSION}.zip"

python3 -m json.tool manifest.json > /dev/null
node --check content.js
node --check popup.js

rm -rf dist
mkdir -p dist
zip -qr "$OUT" \
  manifest.json content.js theme.css popup.html popup.css popup.js icons

echo "Built $OUT"
