const path = require('path')
const nunjucks = require('nunjucks')

const govukClassname = require('./govuk-classname')

const nunjucksConfigure = (app, appDir, kitDir, options = {}) => {
  var appViews = [
    path.join(appDir, 'app'),
    path.join(kitDir, 'app'),
    path.join(appDir, 'node_modules', 'govuk_frontend_alpha'),
    path.join(appDir, 'node_modules', 'govuk_frontend_alpha', 'components')
  ]
  const nunjuckOptions = Object.assign({
    autoescape: true,
    express: app
  }, options)

  const nunjucksAppEnv = nunjucks.configure(appViews, nunjuckOptions)

  nunjucksAppEnv.addGlobal('govukClassname', govukClassname)
  nunjucksAppEnv.addGlobal('Block', {})
  nunjucksAppEnv.addGlobal('JSON', JSON)
  nunjucksAppEnv.addGlobal('jsonify', obj => {
    return JSON.stringify(obj, null, 2)
  })
  nunjucksAppEnv.addGlobal('typeof', variable => typeof variable)
  nunjucksAppEnv.addGlobal('Object', Object)
  nunjucksAppEnv.addGlobal('objectAssign', (...args) => {
    Object.assign.apply(null, args)
  })
  nunjucksAppEnv.addGlobal('setCtx', function (key, val) {
    this.ctx[key] = val
  })
  nunjucksAppEnv.addGlobal('setGlobal', function (key, val) {
    nunjucksAppEnv.addGlobal(key, val)
  })
  nunjucksAppEnv.addGlobal('getCtx', function () {
    return this.ctx
  })
  nunjucksAppEnv.addFilter('json', JSON.stringify)
}

module.exports = nunjucksConfigure
