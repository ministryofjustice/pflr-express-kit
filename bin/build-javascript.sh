#!/usr/bin/env bash

if [ -e app/javascript ]
  then
  babel -d public/javascripts app/javascript $@
fi