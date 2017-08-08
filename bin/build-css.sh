#!/usr/bin/env bash

HERE=$0
SCRIPTPATH=$HERE

SYMLINKPATH=$(ls -l $SCRIPTPATH | awk '{print $11}')
if [ "$SYMLINKPATH" != "" ]
  then
  if [ "$SYMLINKPATH" == "../pflr-express-kit/bin/build-css.sh" ]
    then
    SCRIPTPATH=$(dirname $HERE)/$SYMLINKPATH
    else
    SCRIPTPATH=$SYMLINKPATH
  fi
fi
CONFIGDIR=$(echo $SCRIPTPATH | sed 's/bin\/build-css.sh//')

node_modules/.bin/postcss -c ${CONFIGDIR}postcss.config.js app/css/*.css --dir public/stylesheets $@
