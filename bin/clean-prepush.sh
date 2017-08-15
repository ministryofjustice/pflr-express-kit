#!/usr/bin/env bash

HERE=$0
SCRIPTPATH=$HERE

SYMLINKPATH=$(ls -l $SCRIPTPATH | awk '{print $11}')
if [ "$SYMLINKPATH" != "" ]
  then
  if [ "$SYMLINKPATH" == "../pflr-express-kit/bin/clean-prepush.sh" ]
    then
    SCRIPTPATH=$(dirname $HERE)/$SYMLINKPATH
    else
    SCRIPTPATH=$SYMLINKPATH
  fi
fi
SCRIPTPATH=$(echo $SCRIPTPATH | sed 's/\/clean-prepush.sh//')

export JOB_NAME=$(cat package.json | grep name | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')
export BUILD_NUMBER=prepush

sh $SCRIPTPATH/dockerfile-unclone.sh
sh $SCRIPTPATH/clean-docker.sh
