#!/usr/bin/env bash

if [ -f "nodockerfile" ]
  then
    echo 'Removing cloned Dockerfile'
    rm Dockerfile
    rm nodockerfile
fi
