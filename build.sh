#!/usr/bin/env bash
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
OUT="$SRC/dist"

FILES=(popup.html popup.css popup.js content.js background.js)

build() {
  local browser="$1"
  local dir="$OUT/$browser"
  rm -rf "$dir"
  mkdir -p "$dir/icons"

  for f in "${FILES[@]}"; do
    cp "$SRC/$f" "$dir/$f"
  done
  cp "$SRC/icons/"*.png "$dir/icons/"

  # Write browser-specific manifest
  python3 - <<PYEOF
import json, sys

with open('$SRC/manifest.json') as f:
    m = json.load(f)

browser = '$browser'
if browser == 'chrome':
    m['background'] = {'service_worker': 'background.js'}
    m.pop('browser_specific_settings', None)
elif browser == 'firefox':
    m['background'] = {'scripts': ['background.js']}

with open('$dir/manifest.json', 'w') as f:
    json.dump(m, f, indent=2)
PYEOF

  # Zip it
  (cd "$OUT" && zip -qr "incisive-$browser-${VERSION}.zip" "$browser/")
  echo "Built: dist/incisive-$browser-${VERSION}.zip"
}

VERSION=$(python3 -c "import json; print(json.load(open('$SRC/manifest.json'))['version'])")

mkdir -p "$OUT"
build chrome
build firefox

echo "Done."
