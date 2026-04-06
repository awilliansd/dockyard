#!/bin/bash
set -e

echo ""
echo "  Dockyard - Setup"
echo "  ────────────────"
echo ""

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "  [!] Node.js is required (>= 18). Install from https://nodejs.org"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo "  [!] Node.js >= 18 required. Found: $(node -v)"
  exit 1
fi
echo "  [ok] Node.js $(node -v)"

# Check pnpm
if ! command -v pnpm &>/dev/null; then
  echo "  [..] Installing pnpm..."
  npm install -g pnpm
fi
echo "  [ok] pnpm $(pnpm -v)"

# Check git
if ! command -v git &>/dev/null; then
  echo "  [!] git is required. Install from https://git-scm.com"
  exit 1
fi
echo "  [ok] git $(git --version | cut -d' ' -f3)"

# Install dependencies
echo ""
echo "  [..] Installing dependencies..."
pnpm install

# Create data directory
mkdir -p data/tasks

echo ""
echo "  [ok] Setup complete!"
echo ""
echo "  Run Dockyard:"
echo "    pnpm dev          Start dev server (http://localhost:5421)"
echo "    ./dockyard.sh      Start + open browser (Linux/macOS)"
echo ""

# Offer to create shell alias
read -p "  Create 'dockyard' shell alias? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  SHELL_RC=""
  if [ -f "$HOME/.zshrc" ]; then
    SHELL_RC="$HOME/.zshrc"
  elif [ -f "$HOME/.bashrc" ]; then
    SHELL_RC="$HOME/.bashrc"
  fi

  if [ -n "$SHELL_RC" ]; then
    SHIPYARD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    echo "" >> "$SHELL_RC"
echo "# Dockyard" >> "$SHELL_RC"
    echo "alias dockyard='cd \"$SHIPYARD_DIR\" && ./dockyard.sh'" >> "$SHELL_RC"
    echo "  [ok] Alias added to $SHELL_RC"
    echo "  Run 'source $SHELL_RC' or open a new terminal, then type 'dockyard'"
  else
    echo "  [!] Could not find .bashrc or .zshrc. Add the alias manually:"
    echo "      alias dockyard='cd \"$(pwd)\" && ./dockyard.sh'"
  fi
fi

# Offer to create Linux desktop shortcut
if command -v xdg-open &>/dev/null && [ -d "$HOME/.local/share/applications" ]; then
  echo ""
  read -p "  Create desktop shortcut (Linux)? [y/N] " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    SHIPYARD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cat > "$HOME/.local/share/applications/dockyard.desktop" << DESKTOP
[Desktop Entry]
Name=Dockyard
Comment=Local Development Dashboard
Exec=bash -c 'cd "$SHIPYARD_DIR" && ./dockyard.sh'
Icon=$SHIPYARD_DIR/client/public/favicon.svg
Terminal=true
Type=Application
Categories=Development;
DESKTOP
echo "  [ok] Desktop shortcut created. Search 'Dockyard' in your app launcher."
  fi
fi

echo ""
