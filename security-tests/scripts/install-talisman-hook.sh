#!/bin/sh
# Installs a git pre-commit hook that runs Talisman on every commit.
# Install Talisman first: https://github.com/thoughtworks/talisman#installation
set -e
hook="$(git rev-parse --git-path hooks)/pre-commit"
cat > "$hook" <<'HOOK'
#!/bin/sh
if command -v talisman >/dev/null 2>&1; then
  exec talisman --githook pre-commit
fi
echo "Talisman is not installed, so this commit was not scanned for secrets." >&2
HOOK
chmod +x "$hook"
echo "Installed $hook"
