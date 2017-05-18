#!/usr/bin/env node

const glob = require('glob-promise')
const fs = require('fs')

const nunjucks = require('nunjucks')

const appDir = process.cwd()
// const kitDir = __dirname

const errors = []
const reportError = msg => {
  errors.push(msg)
}

const srcPaths = [`${appDir}/app/components/**/*.njk`, `${appDir}/app/templates/**/*.html`]

const testNunjucks = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    fs.readFile(file, {encoding: 'utf8'}, (err, fileContent) => {
      if (err) {
        reportError(`Could not open file - ${file}`)
        resolve()
      }
      try {
        nunjucks.parser.parse(fileContent)
      } catch (e) {
        reportError(['Line', e.lineno, 'Col', e.colno, file, '\n', e.toString()].join(' '))
      }
      resolve()
    })
  })
}

const testNunjucksFiles = (files, options) => Promise.all(files.map(file => testNunjucks(file)))

const getTemplateFiles = globPattern => {
  return glob(globPattern)
          .then(files => testNunjucksFiles(files))
}

Promise.all(srcPaths.map(getTemplateFiles))
  .then(() => {
    if (errors.length) {
      console.log(errors.join('\n\n'))
      process.exit(1)
    }
  })
