#!/usr/bin/env bash

if [[ $1 == "-h" || $1 == "--help" ]]
then
  read -d '' USAGE <<- EndOfMessage
		test-a11y-ci.sh
		=======================

    Currently does not work and not used by the build job

    Phantomjs requires netstat to extract correct port but Jenkins instance does not allow the container access to that info

    ---

		Runs a11y tests on app running a docker container

		Used by Jenkins jobs:
		  https://ci.service.dsd.io/view/family%20justice/job/BUILD-cait

		The following environment variables must be set:

		  JOB_NAME

		  BUILD_NUMBER

		The following environment variables can also be set:

		  BASE_URL
		  base url to run the tests against
		  - must include protocol, port and credentials (if necessary)

		  SKIP_A11Y
		  whether to run a11y tests or not
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

if [ "$SKIP_A11Y" != "true" ]
then
  DOCKERTAG=$(echo $JOB_NAME-$BUILD_NUMBER | tr '[:upper:]' '[:lower:]')

  APP=$DOCKERTAG-app-a11y
  docker build -t $APP .

  #### If no environment url passed, spin the app up
  if [ -n $BASE_URL ]
  then
    docker run --name $APP -d $APP
    APP_IP=$(docker inspect --format '{{.NetworkSettings.IPAddress}}' $APP)
    BASE_URL=http://$APP_IP:3000
  fi

  HERE=$0
  SCRIPTPATH=$HERE

  SYMLINKPATH=$(ls -l $SCRIPTPATH | awk '{print $11}')
  if [ "$SYMLINKPATH" != "" ]
    then
    if [ "$SYMLINKPATH" == "../pflr-express-kit/bin/test-ci.sh" ]
      then
      SCRIPTPATH=$(dirname $HERE)/$SYMLINKPATH
      else
      SCRIPTPATH=$SYMLINKPATH
    fi
  fi
  SCRIPTDIR=$(echo $SCRIPTPATH | sed 's/\/test-a11y-ci.sh//')

  sh $SCRIPTDIR/test-a11y.sh $BASE_URL $PWD/spec/pa11y-ci.json

fi
