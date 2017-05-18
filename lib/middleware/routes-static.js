const path = require('path')
const express = require('express')

const router = express.Router()

const routesStatic = (appDir, kitDir, assetPath, assetSrcPath) => {
  // app.use('/', express.static(getDistPath(), {
  //   index: ['index.html'],
  //   extensions: ['html']
  // }))
  // first path to allow serving of html
  // app.use(express.static(path.join(appDir, ASSET_PATH, 'html'), {
  //   index: ['index.html'],
  //   extensions: ['html']
  // }))
  // app.use(ASSET_SRC_PATH, express.static(path.join(appDir, ASSET_PATH)))
  // app.use(ASSET_SRC_PATH, express.static(path.join(appDir, 'app', 'assets')))
  // app.use(ASSET_SRC_PATH, express.static(path.join(kitDir, 'app', 'assets')))
  // app.use(ASSET_SRC_PATH, express.static(path.join(appDir, 'node_modules', 'govuk_frontend_alpha', 'assets')))

  router.use(express.static(path.join(appDir, assetPath, 'html'), {
    index: ['index.html'],
    extensions: ['html']
  }))
  router.use(assetSrcPath, express.static(path.join(appDir, assetPath)))
  router.use(assetSrcPath, express.static(path.join(appDir, 'app', 'assets')))
  router.use(assetSrcPath, express.static(path.join(kitDir, 'app', 'assets')))
  router.use(assetSrcPath, express.static(path.join(appDir, 'node_modules', 'govuk_frontend_alpha', 'assets')))

  return router
}

module.exports = routesStatic
