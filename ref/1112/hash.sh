#!/bin/sh
cd "$(dirname "$0")/../.." && shasum -a 256 config.json shim.js auth/mode.js r9_api.js index.html bundle.js
