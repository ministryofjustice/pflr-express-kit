#!/usr/bin/env node
const linter = require('./lint-javascript')

const paths = ['lib/**/*.js', 'bin/**/*.js']

linter({
  paths
})
