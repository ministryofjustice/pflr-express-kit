const path = require('path')
const express = require('express')

const router = express.Router()
const routesStatic = (appDir, kitDir, assetPath, assetSrcPath) => {
  router.use('/public/downloads/*.pdf', (req, res, next) => {
    const pdfPath = req.url.replace(/.*\//, '')
    res.set({
      'Content-Type': 'application/pdf',
      'Access-Control-Allow-Origin': '*',
      'Content-Disposition': `attachment; filename=${pdfPath}`
    })
    next()
  })
  router.use(assetSrcPath, express.static(path.join(appDir, assetPath)))
  router.use(assetSrcPath, express.static(path.join(appDir, 'app', 'assets')))
  router.use(assetSrcPath, express.static(path.join(kitDir, 'app', 'assets')))
  router.use(assetSrcPath, express.static(path.join(appDir, 'node_modules', 'govuk_frontend_alpha', 'assets')))

  return router
}

module.exports = routesStatic
