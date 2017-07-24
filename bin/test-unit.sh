#!/usr/bin/env bash

# node_modules/ava/cli.js --verbose lib/**/*.unit.spec.js
# node_modules/ava/cli.js --verbose $TESTS

TESTS=$(find lib -name *.unit.spec.js | xargs echo)
node_modules/.bin/multi-tape -p=10 $TESTS | node_modules/.bin/tap-spec
# multi-tape