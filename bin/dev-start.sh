#!/usr/bin/env bash

npm-run-all clean:build -p watch:css watch:javascript -s start
