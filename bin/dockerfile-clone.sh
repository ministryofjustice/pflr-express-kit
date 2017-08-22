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
if [ -f ".dockerignore" ]
  then echo 'Using existing .dockerignore'
  else
    echo 'Cloning .dockerignore from pflr-express-kit'
    touch nodockerignore
    DOCKERIGNORE=pflr-express-kit/.dockerignore
    if [ ! -d pflr-express-kit ]
      then DOCKERIGNORE=node_modules/$DOCKERIGNORE
    fi
    cp $DOCKERIGNORE .
fi