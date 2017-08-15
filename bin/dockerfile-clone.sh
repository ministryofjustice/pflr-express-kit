#!/usr/bin/env bash

if [ -f "Dockerfile" ]
  then echo 'Using existing Dockerfile'
  else
    echo 'Cloning Dockerfile from pflr-express-kit'
    touch nodockerfile
    DOCKERFILE=pflr-express-kit/Dockerfile
    if [ ! -d pflr-express-kit ]
      then DOCKERFILE=node_modules/$DOCKERFILE
    fi
    cp $DOCKERFILE .
fi
