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
  echo $TARGET is not reachable
  exit 1
fi

echo Running a11y checks against $TARGET

echo BASEAPP
ls -l
echo REPORTS
ls -l reports
echo REPORTS-A11Y
ls -l reports/a11ym

node_modules/.bin/a11ym -o reports/a11ym --no-verbose $TARGET

echo BASEAPP
ls -l
echo REPORTS
ls -l reports
echo REPORTS-A11Y
ls -l reports/a11ym

ERRORS=$(node -e "const results = require('./reports/a11ym/statistics.json'); console.log(results.reduce((sum, result) => sum + result.errorCount, 0))")

if [ "$ERRORS" != "0" ]
then
  echo "There were $ERRORS accessibility errors - check reports/a11ym/statistics.json for details"
  exit 1
fi


# items.reduce((a, b) => { a + b.errorCount }, 0)


# results.map(r => r.errorCount).reduce((sum, value) => sum + value, 0)

# results.reduce((sum, result) => sum + result.errorCount, 0)


# .reduce(function(sum, value) {
#   return sum + value;
# }, 0);