#!/usr/bin/env node

const path = require('path')
const stylelint = require('stylelint')

const configFile = path.join(__dirname, '..', 'stylelint.config.js')

const srcPaths = ['app/**/*.pcss', 'app/**/*.css']

const errors = []
const reportError = msg => {
  errors.push(msg)
}

const testCSSFiles = (globPattern) => {
  const soptions = {
    configFile,
    files: globPattern,
    formatter: 'string'
  }

  return stylelint.lint(soptions)
    .then(resultObject => {
      if (resultObject.errored) {
        reportError(resultObject.output)
      }
      return globPattern
    })
}

Promise.all(srcPaths.map(globPattern => testCSSFiles(globPattern)))
  .then(() => {
    if (errors.length) {
      console.log(errors.join('\n\n'))
      process.exit(1)
    }
  })
