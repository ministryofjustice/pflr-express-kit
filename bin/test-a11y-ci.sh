#!/bin/sh

if [[ $1 == "-h" || $1 == "--help" ]]
then
  read -d '' USAGE <<- EndOfMessage
		functional-tests-run.sh
		=======================

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

		  REPORTS
		  directory on host where reports should be written to
		  - must be an absolute path

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
  fi

  REPORTS=reports
  if [ "$REPORTS" != "" ]
  then
    REPORTS_VOLUME="-v $REPORTS:/usr/app/reports"
    echo "Reports will be output to $REPORTS"
  fi
  # Now run the tests
  A11Y=$DOCKERTAG-a11y
  docker run $REPORTS_VOLUME --name $A11Y $APP yarn test:a11y http://$APP_IP:3000

fi
