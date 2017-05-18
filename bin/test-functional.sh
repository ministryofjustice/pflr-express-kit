#!/usr/bin/env bash

CONFPATH=$PWD/codecept.conf.js

HERE=$0
SCRIPTPATH=$HERE

SYMLINKPATH=$(ls -l $SCRIPTPATH | awk '{print $11}')
if [ "$SYMLINKPATH" != "" ]
  then
  if [ "$SYMLINKPATH" == "../pflr-express-kit/bin/test-functional.sh" ]
    then
    SCRIPTPATH=$(dirname $HERE)/$SYMLINKPATH
    else
    SCRIPTPATH=$SYMLINKPATH
  fi
fi

SCRIPTPATH=$(dirname $SCRIPTPATH)

echo "Copying config file to: $CONFPATH"
cp $SCRIPTPATH/codecept.conf.js $CONFPATH

# Run the tests
node_modules/codeceptjs/bin/codecept.js run --steps

if [ $? != 0 ]
  then
  FAILED=true
fi

echo "Removing config file: $CONFPATH"
rm $CONFPATH

if [ "$FAILED" == "true" ]
  then
  exit 1
fi
