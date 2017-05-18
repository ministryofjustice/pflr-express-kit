const path = require('path')
const nunjucks = require('nunjucks')

const nunjucksConfigure = (app, appDir, kitDir) => {
  var appViews = [
    path.join(appDir, 'app'),
    path.join(kitDir, 'app'),
    path.join(appDir, 'node_modules', 'govuk_frontend_alpha'),
    path.join(appDir, 'node_modules', 'govuk_frontend_alpha', 'components')
  ]
  // app.set('views', appViews)

  var nunjucksAppEnv = nunjucks.configure(appViews, {
    autoescape: true,
    express: app,
    noCache: true,
    watch: true
  })

  nunjucksAppEnv.addGlobal('Block', {})
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
