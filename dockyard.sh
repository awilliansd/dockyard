#!/bin/bash
# Wrapper to launch Dockyard using existing devdash script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/devdash.sh" "$@"
