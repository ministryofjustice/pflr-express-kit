#!/usr/bin/env bash

if [ -e app/javascript ]
  then
  babel --presets=es2015 -d public/javascripts app/javascript $@
fi