#!/usr/bin/env bash

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
SCRIPTPATH=$(echo $SCRIPTPATH | sed 's/\/test-ci.sh//')

sh $SCRIPTPATH/test-unit-ci.sh
# sh $SCRIPTPATH/test-a11y-ci.sh
sh $SCRIPTPATH/test-functional-ci.sh
