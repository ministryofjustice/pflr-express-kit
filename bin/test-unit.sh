#!/usr/bin/env bash

SPECS=$(find lib -name *.unit.spec.js)

node_modules/.bin/multi-tape -p=10 $SPECS | node_modules/.bin/tap-spec
