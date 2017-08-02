#!/usr/bin/env bash

if [ -n "$1" ]
then
  TARGET=$1
else
  IP_ADDRESS=$(ifconfig | sed -En 's/127.0.0.1//;s/.*inet (addr:)?(([0-9]*\.){3}[0-9]*).*/\2/p')
  IP_ADDRESS=$(echo $IP_ADDRESS | sed 's/ .*//')
  TARGET=http://$IP_ADDRESS:3000
fi

echo Checking $TARGET is reachable

curl -s $TARGET > /dev/null
if [ "$?" != "0" ]
then
  echo $TARGET is not reachable - is the app running?
  exit 1
fi

if [ -n "$2" ]
then
  CONFIG=$2
  CONFIGDIR=$(echo "$CONFIG" | rev | cut -d"/" -f2-  | rev)
  CONFIGFILE=$(echo "$CONFIG" | rev | cut -d"/" -f1  | rev)
  CONFIGVOLUME="-v $CONFIGDIR:/usr/src/app/config"
  CONFIGOPTION="--config config/$CONFIGFILE"
fi

echo Running a11y checks against $TARGET
if [ "$CONFIG" != "" ]
then
  echo Using config from $CONFIG
fi

docker run $CONFIGVOLUME solidgoldpig/pa11y-ci:0.0.2 sh pa11y-ci-wrapper --rootUrl $TARGET $CONFIGOPTION
