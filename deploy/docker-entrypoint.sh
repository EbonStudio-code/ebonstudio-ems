#!/bin/sh
set -eu
exec node --import ./src/core/secrets.js "$@"
