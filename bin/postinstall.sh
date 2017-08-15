#!/usr/bin/env bash

if [ -d .git ] && [ -x "$(command -v git)" ]
  then npm run githooks
  else echo 'git not installed'
fi

npm-run-all -p build
