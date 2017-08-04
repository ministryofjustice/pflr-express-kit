const express = require('express')
const router = express.Router()

const routesCached = (cacheDir) => {
  router.use(express.static(cacheDir, {
    index: ['index.html'],
    extensions: ['html']
  }))

  return router
}

module.exports = routesCached
