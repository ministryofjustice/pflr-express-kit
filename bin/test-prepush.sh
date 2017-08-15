#!/usr/bin/env bash

HERE=$0
SCRIPTPATH=$HERE

SYMLINKPATH=$(ls -l $SCRIPTPATH | awk '{print $11}')
if [ "$SYMLINKPATH" != "" ]
  then
  if [ "$SYMLINKPATH" == "../pflr-express-kit/bin/test-prepush.sh" ]
    then
    SCRIPTPATH=$(dirname $HERE)/$SYMLINKPATH
    else
    SCRIPTPATH=$SYMLINKPATH
  fi
fi
SCRIPTPATH=$(echo $SCRIPTPATH | sed 's/\/test-prepush.sh//')

export JOB_NAME=$(cat package.json | grep name | head -1 | awk -F: '{ print $2 }' | sed 's/[\",]//g' | tr -d '[[:space:]]')
export BUILD_NUMBER=prepush

sh $SCRIPTPATH/test-ci.sh

npm run test:a11y