#!/bin/bash

set -e

echo
echo ">> Rebuilding apm dependencies with bundled Node $(./bin/node -p "process.version + ' ' + process.arch")"

# parallel node-gyp
JOBS=16

./bin/npm rebuild
