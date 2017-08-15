#!/usr/bin/env node
const path = require('path')
const linter = require('./lint-javascript')

const configFile = path.join(__dirname, '..', 'app', '.eslintrc.js')
const paths = ['app/assetsSrc/**/*.js']

linter({
  configFile,
  paths
})
