#!/bin/bash
# Safely release HeroByte dev processes on the canonical ports.

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

node scripts/dev-port-preflight.mjs free
