#!/bin/sh

DOCKERTAG=$(echo $JOB_NAME-$BUILD_NUMBER | tr '[:upper:]' '[:lower:]')

REMOVED=$(docker rm -f $DOCKERTAG-lint 2>/dev/null \
docker rm -fv $DOCKERTAG-unit 2>/dev/null \
docker rm -fv $DOCKERTAG-app 2>/dev/null \
docker rm -fv $DOCKERTAG-selenium 2>/dev/null \
docker rm -fv $DOCKERTAG-functional 2>/dev/null \
docker rm -fv $DOCKERTAG-a11y 2>/dev/null \
docker rm -f $DOCKERTAG-accessibility 2>/dev/null)

echo Removed docker volumes $REMOVED

# docker rmi -f $DOCKERTAG-test 2>/dev/null
# docker rmi -f $DOCKERTAG-app 2>/dev/null
