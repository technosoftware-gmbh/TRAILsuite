#!/usr/bin/env bash
#
# Copies the built plugins into a vault's plugin folder.
#
# Build first: this script deliberately does not build, so that what lands in a
# vault is whatever was last verified rather than whatever compiles right now.
#
# Usage:  ./scripts/install-into-vault.sh /path/to/Vault
set -euo pipefail

VAULT="${1:?usage: install-into-vault.sh /path/to/Vault}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for plugin in apertrail nodatrail; do
  src="$ROOT/packages/$plugin"
  dest="$VAULT/.obsidian/plugins/$plugin"
  if [ ! -f "$src/main.js" ]; then
    echo "$plugin has no main.js. Run npm run build first." >&2
    exit 1
  fi
  mkdir -p "$dest"
  cp "$src/main.js" "$src/styles.css" "$src/manifest.json" "$dest/"
  echo "installed $plugin -> $dest"
done

echo "Reload Obsidian, or disable and re-enable each plugin, to pick the new build up."
