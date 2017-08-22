#!/usr/bin/env bash

if [ -f "nodockerfile" ]
  then
    echo 'Removing cloned Dockerfile'
    rm Dockerfile
    rm nodockerfile
fi
if [ -f "nodockerignore" ]
  then
    echo 'Removing cloned .dockerignore'
    rm .dockerignore
    rm nodockerignore
fi
