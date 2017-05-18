#!/usr/bin/env node
const path = require('path')
const CLIEngine = require('eslint').CLIEngine

const configFile = path.join(__dirname, '..', '.eslintrc.js')
module.exports = (options = {}) => {
  options.configFile = options.configFile || configFile

  const cli = new CLIEngine({
    configFile: options.configFile
  })

  const report = cli.executeOnFiles(options.paths)
  const formatter = cli.getFormatter()

  const formatted = formatter(report.results)
  if (formatted) {
    console.log(formatted)
    process.exit(1)
  }
}
