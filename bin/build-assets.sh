#!/usr/bin/env bash

babel -d app/assets/javascripts app/assetsSrc/javascripts

(cd app/assetsSrc/javascripts && find **/*.css | xargs -I % cp % ../../assets/javascripts/%)