#!/usr/bin/env bash
# Wrapper — delega al script universal
exec "$(dirname "$0")/install.sh" backup "$@"