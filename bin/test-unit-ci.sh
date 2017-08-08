#!/bin/sh

if [[ $1 == "-h" || $1 == "--help" ]]
then
  read -d '' USAGE <<- EndOfMessage
		test-unit-ci.sh
		=================

		Runs unit tests in a docker container

		Used by Jenkins job https://ci.service.dsd.io/view/family%20justice/job/BUILD-cait

		The following environment variables must be set:

		  JOB_NAME

		  BUILD_NUMBER

		The following environment variables can also be set:

		  SKIP_LINT
		  whether to run linting or not

		  SKIP_UNIT
		  whether to run unit tests or not
EndOfMessage

  echo "$USAGE"
  exit 0
fi

if [ "$JOB_NAME" == "" ]
then
  echo Environment variable JOB_NAME must be set
  exit 1
fi
if [ "$BUILD_NUMBER" == "" ]
then
  echo Environment variable BUILD_NUMBER must be set
  exit 1
fi

NOSKIP=false
if [ "$SKIP_LINT" != "true" ]; then NOSKIP=true; fi
if [ "$SKIP_UNIT" != "true" ]; then NOSKIP=true; fi

if [ $NOSKIP = true ]
then
  DOCKERTAG=$(echo $JOB_NAME-$BUILD_NUMBER | tr '[:upper:]' '[:lower:]')
  TEST_IMAGE=$DOCKERTAG-test
  docker build -t=$TEST_IMAGE .
  if [ "$SKIP_LINT" != "true" ]
  then
    docker run --name $DOCKERTAG-lint $TEST_IMAGE npm run lint
    if [ "$?" != "0" ]
    then
      exit 1
    fi
  fi
  if [ "$SKIP_UNIT" != "true" ]
  then
    docker run --name $DOCKERTAG-unit $TEST_IMAGE npm run test:unit
  fi
fi
