#!/usr/bin/env bash

node_modules/.bin/multi-tape -p=10 lib/**/*.unit.spec.js | node_modules/.bin/tap-spec