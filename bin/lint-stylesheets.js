#!/usr/bin/env node

const path = require('path')
const stylelint = require('stylelint')

const configFile = path.join(__dirname, '..', 'stylelint.config.js')

const srcPaths = ['app/**/*.pcss', 'app/**/*.css']

const testCSSFiles = (globPattern) => {
  const soptions = {
    configFile,
    files: globPattern,
    formatter: 'string'
  }

  return stylelint.lint(soptions)
    .then(resultObject => {
      if (resultObject.errored) {
        return resultObject.output
      }
    })
    .catch(() => {})
}

Promise.all(srcPaths.map(globPattern => testCSSFiles(globPattern)))
  .then(results => {
    const errors = results.filter(result => result !== undefined)
    if (errors.length) {
      console.log(errors.join('\n\n'))
      process.exit(1)
    }
  })
